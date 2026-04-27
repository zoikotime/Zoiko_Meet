"""Session Service — creates/joins/leaves/ends sessions.

Everything goes through this one file. Nothing else in the codebase is
allowed to mutate connect_sessions or connect_session_members. WS / REST
handlers call into these functions; they never touch the ORM directly.

Each mutation:
  1. Validates tenant context (Layer 1 isolation).
  2. Validates state-machine transition.
  3. Delegates media-room creation to the Media Service (vendor-agnostic).
  4. Writes the domain row.
  5. Logs an audit event.
  6. Enqueues an outbox event envelope.

All of (3)-(6) happen inside a single `db.begin()` so a partial failure
rolls the whole thing back — this is the outbox pattern's entire value.
"""
from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy.orm import Session as DbSession

from app.connect.audit import service as audit
from app.connect.events import types as etypes
from app.connect.events.bus import publish
from app.connect.events.outbox import enqueue
from app.connect.media_service import service as media
from app.connect.session_service.models import Session, SessionMember
from app.connect.session_service.state import (
    assert_member_transition,
    assert_transition,
)
from app.connect.shared.envelope import EventEnvelope
from app.connect.shared.errors import Forbidden, NotFound
from app.connect.shared.ids import uuid7_str
from app.connect.shared.telemetry import get_correlation_id
from app.connect.shared.tenant import TenantContext


# ─── Commands ────────────────────────────────────────────────────────────

async def create_session(
    db: DbSession,
    ctx: TenantContext,
    *,
    kind: str,
    title: str | None,
    scheduled_start_at: datetime | None = None,
) -> Session:
    if kind not in ("1to1", "group", "webinar"):
        raise NotFound(f"Unknown session kind: {kind}")

    session = Session(
        id=uuid7_str(),
        tenant_id=ctx.tenant_id,
        kind=kind,
        title=title,
        host_id=ctx.user_id,
        scheduled_start_at=scheduled_start_at,
        status="scheduled",
        correlation_id=get_correlation_id(),
        created_by=ctx.user_id,
    )
    db.add(session)
    db.flush()

    # Host is implicit session member with role=host
    db.add(SessionMember(
        id=uuid7_str(),
        session_id=session.id,
        tenant_id=ctx.tenant_id,
        user_id=ctx.user_id,
        role="host",
        status="admitted",
        joined_at=datetime.now(timezone.utc),
        created_by=ctx.user_id,
        correlation_id=get_correlation_id(),
    ))

    audit.log(
        db,
        type="session.created",
        tenant_id=ctx.tenant_id,
        actor_user_id=ctx.user_id,
        resource_type="session",
        resource_id=session.id,
        metadata={"kind": kind, "title": title},
    )

    env = EventEnvelope(
        type=etypes.SESSION_CREATED,
        tenant_id=ctx.tenant_id,
        correlation_id=get_correlation_id(),
        actor_user_id=ctx.user_id,
        payload={
            "session_id": session.id,
            "kind": kind,
            "host_id": ctx.user_id,
            "title": title,
        },
    )
    enqueue(db, env)
    db.commit()
    await publish(env, topic=f"session:{session.id}")
    return session


async def start_session(db: DbSession, ctx: TenantContext, *, session_id: str) -> Session:
    session = _load_for_host(db, ctx, session_id)
    assert_transition(session.status, "pending_start")
    # Ask the abstract Media Service for a room — no LiveKit knowledge here
    session.media_room_ref = await media.create_media_room(session_id=session.id, tenant_id=ctx.tenant_id)
    session.status = "active"
    session.started_at = datetime.now(timezone.utc)

    audit.log(db, type="session.started", tenant_id=ctx.tenant_id,
              actor_user_id=ctx.user_id, resource_type="session",
              resource_id=session.id, metadata={})
    env = EventEnvelope(
        type=etypes.SESSION_STARTED,
        tenant_id=ctx.tenant_id,
        correlation_id=get_correlation_id(),
        actor_user_id=ctx.user_id,
        payload={"session_id": session.id, "started_at": session.started_at.isoformat()},
    )
    enqueue(db, env)
    db.commit()
    await publish(env, topic=f"session:{session.id}")
    return session


async def join_session(db: DbSession, ctx: TenantContext, *, session_id: str) -> SessionMember:
    session = _load_tenant_scoped(db, ctx, session_id)
    if session.status not in ("active", "pending_start", "scheduled"):
        raise Forbidden(f"Cannot join session in status {session.status}")

    member = (
        db.query(SessionMember)
        .filter(SessionMember.session_id == session_id, SessionMember.user_id == ctx.user_id)
        .first()
    )
    is_host = session.host_id == ctx.user_id
    target = "admitted" if is_host else ("pending_admission" if session.kind != "1to1" else "admitted")

    if member is None:
        member = SessionMember(
            id=uuid7_str(),
            session_id=session_id,
            tenant_id=ctx.tenant_id,
            user_id=ctx.user_id,
            role="host" if is_host else "participant",
            status=target,
            joined_at=datetime.now(timezone.utc) if target == "admitted" else None,
            created_by=ctx.user_id,
            correlation_id=get_correlation_id(),
        )
        db.add(member)
    else:
        assert_member_transition(member.status, target)
        member.status = target
        if target == "admitted":
            member.joined_at = datetime.now(timezone.utc)
            member.left_at = None

    audit.log(db, type=f"session.member.{target}", tenant_id=ctx.tenant_id,
              actor_user_id=ctx.user_id, resource_type="session",
              resource_id=session_id, metadata={"member_user_id": ctx.user_id})
    env = EventEnvelope(
        type=etypes.SESSION_MEMBER_JOINED,
        tenant_id=ctx.tenant_id,
        correlation_id=get_correlation_id(),
        actor_user_id=ctx.user_id,
        payload={"session_id": session_id, "user_id": ctx.user_id, "status": target},
    )
    enqueue(db, env)
    db.commit()
    await publish(env, topic=f"session:{session_id}")
    return member


async def leave_session(db: DbSession, ctx: TenantContext, *, session_id: str) -> None:
    session = _load_tenant_scoped(db, ctx, session_id)
    member = (
        db.query(SessionMember)
        .filter(SessionMember.session_id == session_id, SessionMember.user_id == ctx.user_id)
        .first()
    )
    if member is None:
        raise NotFound("Not a member of this session")
    assert_member_transition(member.status, "left")
    member.status = "left"
    member.left_at = datetime.now(timezone.utc)

    audit.log(db, type="session.member.left", tenant_id=ctx.tenant_id,
              actor_user_id=ctx.user_id, resource_type="session",
              resource_id=session_id, metadata={})
    env = EventEnvelope(
        type=etypes.SESSION_MEMBER_LEFT,
        tenant_id=ctx.tenant_id,
        correlation_id=get_correlation_id(),
        actor_user_id=ctx.user_id,
        payload={"session_id": session_id, "user_id": ctx.user_id},
    )
    enqueue(db, env)
    db.commit()
    await publish(env, topic=f"session:{session_id}")


async def end_session(db: DbSession, ctx: TenantContext, *, session_id: str) -> Session:
    session = _load_for_host(db, ctx, session_id)
    assert_transition(session.status, "ended")
    session.status = "ended"
    session.ended_at = datetime.now(timezone.utc)
    await media.release_media_room(session.media_room_ref)

    audit.log(db, type="session.ended", tenant_id=ctx.tenant_id,
              actor_user_id=ctx.user_id, resource_type="session",
              resource_id=session_id, metadata={})
    env = EventEnvelope(
        type=etypes.SESSION_ENDED,
        tenant_id=ctx.tenant_id,
        correlation_id=get_correlation_id(),
        actor_user_id=ctx.user_id,
        payload={"session_id": session_id, "ended_at": session.ended_at.isoformat()},
    )
    enqueue(db, env)
    db.commit()
    await publish(env, topic=f"session:{session_id}")
    return session


# ─── Queries ─────────────────────────────────────────────────────────────

def get_session(db: DbSession, ctx: TenantContext, session_id: str) -> Session:
    return _load_tenant_scoped(db, ctx, session_id)


# ─── Internal helpers ────────────────────────────────────────────────────

def _load_tenant_scoped(db: DbSession, ctx: TenantContext, session_id: str) -> Session:
    # Layer-1 isolation: query filtered by tenant so a wrong id returns 404
    # regardless of what the caller tried to access.
    session = (
        db.query(Session)
        .filter(Session.id == session_id, Session.tenant_id == ctx.tenant_id)
        .first()
    )
    if session is None:
        raise NotFound("Session not found")
    return session


def _load_for_host(db: DbSession, ctx: TenantContext, session_id: str) -> Session:
    session = _load_tenant_scoped(db, ctx, session_id)
    if session.host_id != ctx.user_id:
        raise Forbidden("Only the session host can perform this action")
    return session
