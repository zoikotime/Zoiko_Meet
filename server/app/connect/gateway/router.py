"""Frame router — translates inbound WS frames to service calls.

The Gateway itself must not contain business logic (spec §19). Its only
responsibilities are:
  * Authn (gateway/auth.py)
  * Routing inbound frames to the right service
  * Forwarding published envelopes to subscribed clients (gateway/fanout.py)

Frame schema (JSON):
  { "kind": "subscribe",   "topic": "conversation:<uuid>" }
  { "kind": "unsubscribe", "topic": "conversation:<uuid>" }
  { "kind": "cmd", "op": "messaging.send",  "args": { ... } }
  { "kind": "cmd", "op": "messaging.typing.start", "args": { ... } }
  { "kind": "cmd", "op": "messaging.typing.stop",  "args": { ... } }
  { "kind": "cmd", "op": "presence.ping",   "args": { ... } }

Output:
  { "kind": "ack",   "req_id": "...", "result": {...} }
  { "kind": "error", "req_id": "...", "code": "...", "message": "..." }
  { "kind": "event", "topic": "...", "envelope": {...} }
"""
from __future__ import annotations

import logging
from typing import Any

from fastapi import WebSocket
from sqlalchemy.orm import Session as DbSession

from app.connect.gateway.auth import WsAuth
from app.connect.gateway.fanout import ClientFanout
from app.connect.messaging_service import service as messaging
from app.connect.presence_service import service as presence
from app.connect.shared.errors import DomainError

log = logging.getLogger(__name__)


_ALLOWED_TOPIC_PREFIXES = ("conversation:", "session:", "tenant:")


async def handle_frame(
    ws: WebSocket,
    frame: dict[str, Any],
    auth: WsAuth,
    fanout: ClientFanout,
    db: DbSession,
    conn_id: str,
) -> None:
    kind = frame.get("kind")
    req_id = frame.get("req_id")

    try:
        if kind == "subscribe":
            topic = frame.get("topic", "")
            _assert_topic(topic)
            _assert_topic_belongs_to_tenant(topic, auth)
            await fanout.subscribe_topic(topic)
            await _ack(ws, req_id, {"subscribed": topic})

        elif kind == "unsubscribe":
            topic = frame.get("topic", "")
            await fanout.unsubscribe_topic(topic)
            await _ack(ws, req_id, {"unsubscribed": topic})

        elif kind == "cmd":
            op = frame.get("op")
            args = frame.get("args", {}) or {}
            result = await _dispatch_cmd(op, args, auth, db, conn_id)
            await _ack(ws, req_id, result)

        else:
            await _error(ws, req_id, "invalid_frame", f"Unknown kind: {kind}")

    except DomainError as e:
        await _error(ws, req_id, e.code, e.message)
    except Exception as e:  # noqa: BLE001
        log.exception("Gateway frame handling failed")
        await _error(ws, req_id, "internal_error", str(e))


async def _dispatch_cmd(op: str | None, args: dict, auth: WsAuth, db: DbSession, conn_id: str) -> dict:
    """Thin dispatcher — each branch is one service call, no logic here."""
    if op == "messaging.send":
        # Note: WS cannot carry Idempotency-Key header — clients pass it in args
        return await messaging.send_message(
            db, auth.tenant,
            conversation_id=args["conversation_id"],
            body=args.get("body"),
            attachment_ids=args.get("attachment_ids"),
            reply_to_id=args.get("reply_to_id"),
            idempotency_key=args.get("idempotency_key"),
        )

    if op == "messaging.read":
        await messaging.mark_read(
            db, auth.tenant,
            conversation_id=args["conversation_id"],
            last_read_id=args["last_read_id"],
        )
        return {"ok": True}

    if op == "presence.ping":
        await presence.set_presence(
            tenant_id=auth.tenant.tenant_id,
            user_id=auth.user.id,
            status=args.get("status", "online"),
            conn_id=conn_id,
        )
        return {"ok": True}

    if op == "typing.start":
        await presence.start_typing(
            tenant_id=auth.tenant.tenant_id,
            conversation_id=args["conversation_id"],
            user_id=auth.user.id,
        )
        return {"ok": True}

    if op == "typing.stop":
        await presence.stop_typing(
            tenant_id=auth.tenant.tenant_id,
            conversation_id=args["conversation_id"],
            user_id=auth.user.id,
        )
        return {"ok": True}

    raise DomainError(f"Unknown op: {op}")


def _assert_topic(topic: str) -> None:
    if not any(topic.startswith(p) for p in _ALLOWED_TOPIC_PREFIXES):
        raise DomainError(f"Invalid topic: {topic}")


def _assert_topic_belongs_to_tenant(topic: str, auth: WsAuth) -> None:
    # tenant:<id> topics must match the caller's tenant. For conversation/session
    # topics we rely on the service layer's membership check the first time the
    # client sends a command — this keeps the subscribe path O(1) without DB.
    if topic.startswith("tenant:"):
        if topic != f"tenant:{auth.tenant.tenant_id}":
            raise DomainError("Cannot subscribe to another tenant's feed")


async def _ack(ws: WebSocket, req_id: str | None, result: dict) -> None:
    await ws.send_json({"kind": "ack", "req_id": req_id, "result": result})


async def _error(ws: WebSocket, req_id: str | None, code: str, message: str) -> None:
    await ws.send_json({"kind": "error", "req_id": req_id, "code": code, "message": message})
