"""Messaging Service — the only writer of connect_messages + receipts.

sendMessage:
  1. Verify sender is an active member of the conversation (Layer-1 isolation).
  2. INSERT the row.
  3. Append `message.sent.v1` to the outbox in the same transaction.
  4. After commit, publish on the in-process bus so the Gateway fans out
     to connected WS clients.
  5. Log audit event (`messaging.message.sent`).

Idempotency: callers supply `Idempotency-Key`; service checks Redis first
and returns the cached Message if it's a replay.
"""
from __future__ import annotations

from datetime import datetime
from typing import Any

from sqlalchemy import and_, select
from sqlalchemy.orm import Session as DbSession

from app.connect.audit import service as audit
from app.connect.conversation_service.models import ConversationMember
from app.connect.events import types as etypes
from app.connect.events.bus import publish
from app.connect.events.outbox import enqueue
from app.connect.messaging_service.models import Message, MessageReceipt
from app.connect.shared import idempotency
from app.connect.shared.envelope import EventEnvelope
from app.connect.shared.errors import Forbidden, Invalid, NotFound
from app.connect.shared.ids import uuid7_str
from app.connect.shared.telemetry import get_correlation_id
from app.connect.shared.tenant import TenantContext


_MAX_BODY = 16_000


async def send_message(
    db: DbSession,
    ctx: TenantContext,
    *,
    conversation_id: str,
    body: str | None,
    attachment_ids: list[str] | None = None,
    reply_to_id: str | None = None,
    idempotency_key: str | None = None,
) -> dict[str, Any]:
    """Returns the serialized Message row (already committed)."""
    body = (body or "").strip() or None
    attachment_ids = attachment_ids or []
    if body is None and not attachment_ids:
        raise Invalid("Message must have a body or at least one attachment")
    if body and len(body) > _MAX_BODY:
        raise Invalid(f"Message body exceeds {_MAX_BODY} characters")

    # Idempotency short-circuit
    if idempotency_key:
        cached = await idempotency.check(ctx.tenant_id, ctx.user_id,
                                         f"POST /conversations/{conversation_id}/messages",
                                         idempotency_key)
        if cached is not None:
            return cached

    _assert_active_member(db, ctx, conversation_id)

    msg = Message(
        id=uuid7_str(),
        tenant_id=ctx.tenant_id,
        conversation_id=conversation_id,
        sender_id=ctx.user_id,
        body=body,
        attachment_ids=attachment_ids,
        reply_to_id=reply_to_id,
        status="sent",
        correlation_id=get_correlation_id(),
        created_by=ctx.user_id,
    )
    db.add(msg)
    db.flush()  # populate created_at server_default for the envelope

    audit.log(
        db,
        type="messaging.message.sent",
        tenant_id=ctx.tenant_id,
        actor_user_id=ctx.user_id,
        resource_type="message",
        resource_id=msg.id,
        metadata={
            "conversation_id": conversation_id,
            "has_attachments": bool(attachment_ids),
            "reply_to_id": reply_to_id,
        },
    )

    envelope = EventEnvelope(
        type=etypes.MESSAGE_SENT,
        tenant_id=ctx.tenant_id,
        correlation_id=get_correlation_id(),
        actor_user_id=ctx.user_id,
        payload={
            "message_id": msg.id,
            "conversation_id": conversation_id,
            "sender_id": ctx.user_id,
            "body": body,
            "attachment_ids": attachment_ids,
            "reply_to_id": reply_to_id,
        },
    )
    enqueue(db, envelope)
    db.commit()

    # Real-time fan-out to connected Gateways (best-effort; durable delivery
    # is handled by the outbox dispatcher → Pub/Sub).
    await publish(envelope, topic=f"conversation:{conversation_id}")

    out = {
        "id": msg.id,
        "tenant_id": msg.tenant_id,
        "conversation_id": msg.conversation_id,
        "sender_id": msg.sender_id,
        "body": msg.body,
        "attachment_ids": list(msg.attachment_ids or []),
        "reply_to_id": msg.reply_to_id,
        "status": msg.status,
        "created_at": msg.created_at.isoformat() if msg.created_at else None,
    }
    if idempotency_key:
        await idempotency.store(
            ctx.tenant_id, ctx.user_id,
            f"POST /conversations/{conversation_id}/messages",
            idempotency_key, out,
        )
    return out


async def list_messages(
    db: DbSession,
    ctx: TenantContext,
    *,
    conversation_id: str,
    limit: int = 50,
    before: datetime | None = None,
) -> list[dict[str, Any]]:
    _assert_active_member(db, ctx, conversation_id)
    q = (
        select(Message)
        .where(
            Message.tenant_id == ctx.tenant_id,
            Message.conversation_id == conversation_id,
            Message.status != "deleted",
        )
        .order_by(Message.created_at.desc())
        .limit(min(limit, 200))
    )
    if before is not None:
        q = q.where(Message.created_at < before)
    rows = list(db.scalars(q).all())
    rows.reverse()
    return [
        {
            "id": m.id, "sender_id": m.sender_id, "body": m.body,
            "attachment_ids": list(m.attachment_ids or []),
            "reply_to_id": m.reply_to_id,
            "status": m.status,
            "created_at": m.created_at.isoformat() if m.created_at else None,
        }
        for m in rows
    ]


async def mark_read(
    db: DbSession,
    ctx: TenantContext,
    *,
    conversation_id: str,
    last_read_id: str,
) -> None:
    _assert_active_member(db, ctx, conversation_id)
    existing = db.scalar(
        select(MessageReceipt).where(
            MessageReceipt.conversation_id == conversation_id,
            MessageReceipt.user_id == ctx.user_id,
        )
    )
    if existing is None:
        db.add(MessageReceipt(
            id=uuid7_str(),
            tenant_id=ctx.tenant_id,
            conversation_id=conversation_id,
            user_id=ctx.user_id,
            last_read_id=last_read_id,
            correlation_id=get_correlation_id(),
        ))
    else:
        existing.last_read_id = last_read_id

    env = EventEnvelope(
        type=etypes.MESSAGE_READ,
        tenant_id=ctx.tenant_id,
        correlation_id=get_correlation_id(),
        actor_user_id=ctx.user_id,
        payload={
            "conversation_id": conversation_id,
            "user_id": ctx.user_id,
            "last_read_id": last_read_id,
        },
    )
    enqueue(db, env)
    db.commit()
    await publish(env, topic=f"conversation:{conversation_id}")


# ─── Internals ──────────────────────────────────────────────────────────

def _assert_active_member(db: DbSession, ctx: TenantContext, conversation_id: str) -> None:
    mem = db.scalar(
        select(ConversationMember).where(and_(
            ConversationMember.conversation_id == conversation_id,
            ConversationMember.tenant_id == ctx.tenant_id,
            ConversationMember.user_id == ctx.user_id,
        ))
    )
    if mem is None:
        # Don't leak existence of the conversation to non-members
        raise NotFound("Conversation not found")
    if mem.status != "active":
        raise Forbidden(f"Membership status is {mem.status}")
