from __future__ import annotations

from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session as DbSession

from app.connect.audit import service as audit
from app.connect.conversation_service.models import Conversation, ConversationMember
from app.connect.events import types as etypes
from app.connect.events.bus import publish
from app.connect.events.outbox import enqueue
from app.connect.shared.envelope import EventEnvelope
from app.connect.shared.errors import Forbidden, Invalid, NotFound
from app.connect.shared.ids import uuid7_str
from app.connect.shared.telemetry import get_correlation_id
from app.connect.shared.tenant import TenantContext


async def create_conversation(
    db: DbSession,
    ctx: TenantContext,
    *,
    kind: str,
    name: str | None,
    member_user_ids: list[int],
) -> Conversation:
    if kind not in ("direct", "group", "channel"):
        raise Invalid(f"Unknown conversation kind: {kind}")
    member_ids = set(member_user_ids) | {ctx.user_id}
    if kind == "direct" and len(member_ids) != 2:
        raise Invalid("Direct conversations require exactly 2 members")

    conv = Conversation(
        id=uuid7_str(),
        tenant_id=ctx.tenant_id,
        kind=kind,
        name=name,
        created_by=ctx.user_id,
        status="active",
        correlation_id=get_correlation_id(),
    )
    db.add(conv)
    db.flush()

    for uid in member_ids:
        db.add(ConversationMember(
            id=uuid7_str(),
            conversation_id=conv.id,
            tenant_id=ctx.tenant_id,
            user_id=uid,
            role="owner" if uid == ctx.user_id else "member",
            status="active",
            created_by=ctx.user_id,
            correlation_id=get_correlation_id(),
        ))

    audit.log(db, type="conversation.created", tenant_id=ctx.tenant_id,
              actor_user_id=ctx.user_id, resource_type="conversation",
              resource_id=conv.id, metadata={"kind": kind, "member_count": len(member_ids)})
    env = EventEnvelope(
        type=etypes.CONVERSATION_CREATED,
        tenant_id=ctx.tenant_id,
        correlation_id=get_correlation_id(),
        actor_user_id=ctx.user_id,
        payload={
            "conversation_id": conv.id, "kind": kind, "name": name,
            "member_user_ids": list(member_ids),
        },
    )
    enqueue(db, env)
    db.commit()
    await publish(env, topic=f"tenant:{ctx.tenant_id}")
    return conv


def list_my_conversations(db: DbSession, ctx: TenantContext) -> list[dict[str, Any]]:
    rows = db.scalars(
        select(Conversation)
        .join(ConversationMember, ConversationMember.conversation_id == Conversation.id)
        .where(
            ConversationMember.user_id == ctx.user_id,
            ConversationMember.tenant_id == ctx.tenant_id,
            ConversationMember.status == "active",
            Conversation.status == "active",
        )
        .order_by(Conversation.updated_at.desc())
    ).all()
    return [
        {"id": c.id, "kind": c.kind, "name": c.name, "status": c.status,
         "updated_at": c.updated_at.isoformat() if c.updated_at else None}
        for c in rows
    ]


async def add_member(
    db: DbSession,
    ctx: TenantContext,
    *,
    conversation_id: str,
    user_id: int,
    role: str = "member",
) -> ConversationMember:
    conv = _load_tenant_scoped(db, ctx, conversation_id)
    caller = _load_member(db, ctx, conversation_id, ctx.user_id)
    if caller.role not in ("owner", "admin"):
        raise Forbidden("Only owners/admins can add members")

    existing = db.scalar(
        select(ConversationMember).where(
            ConversationMember.conversation_id == conversation_id,
            ConversationMember.user_id == user_id,
        )
    )
    if existing is not None:
        if existing.status == "active":
            return existing
        existing.status = "active"
        member = existing
    else:
        member = ConversationMember(
            id=uuid7_str(),
            conversation_id=conversation_id,
            tenant_id=ctx.tenant_id,
            user_id=user_id,
            role=role,
            status="active",
            created_by=ctx.user_id,
            correlation_id=get_correlation_id(),
        )
        db.add(member)

    audit.log(db, type="conversation.member.added", tenant_id=ctx.tenant_id,
              actor_user_id=ctx.user_id, resource_type="conversation",
              resource_id=conversation_id, metadata={"added_user_id": user_id, "role": role})
    env = EventEnvelope(
        type=etypes.CONVERSATION_MEMBER_ADDED,
        tenant_id=ctx.tenant_id,
        correlation_id=get_correlation_id(),
        actor_user_id=ctx.user_id,
        payload={"conversation_id": conversation_id, "user_id": user_id, "role": role},
    )
    enqueue(db, env)
    db.commit()
    await publish(env, topic=f"conversation:{conversation_id}")
    return member


def _load_tenant_scoped(db: DbSession, ctx: TenantContext, conversation_id: str) -> Conversation:
    conv = db.scalar(
        select(Conversation).where(
            Conversation.id == conversation_id,
            Conversation.tenant_id == ctx.tenant_id,
        )
    )
    if conv is None:
        raise NotFound("Conversation not found")
    return conv


def _load_member(db: DbSession, ctx: TenantContext, conversation_id: str, user_id: int) -> ConversationMember:
    mem = db.scalar(
        select(ConversationMember).where(
            ConversationMember.conversation_id == conversation_id,
            ConversationMember.tenant_id == ctx.tenant_id,
            ConversationMember.user_id == user_id,
        )
    )
    if mem is None:
        raise NotFound("Not a member of this conversation")
    return mem
