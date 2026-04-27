"""Stateless WebSocket Gateway.

  ws(s)://…/api/connect/ws?token=<jwt>

Responsibilities (and nothing else):
  * Accept + authenticate connection
  * Register presence (Redis)
  * Dispatch each inbound frame via gateway/router.py
  * Forward Redis-subscribed envelopes back to the client via fanout

No business logic. No in-memory room state. Safe to run N replicas.
"""
from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, WebSocket, WebSocketDisconnect
from sqlalchemy.orm import Session as DbSession

from app.connect.gateway.auth import authenticate
from app.connect.gateway.fanout import ClientFanout
from app.connect.gateway.router import handle_frame
from app.connect.presence_service import service as presence
from app.connect.shared.ids import uuid7_str
from app.connect.shared.telemetry import set_correlation_id
from app.core.database import get_db

log = logging.getLogger(__name__)

router = APIRouter()


@router.websocket("/ws")
async def connect_ws(ws: WebSocket, db: DbSession = Depends(get_db)):
    await ws.accept(subprotocol=_negotiate_subprotocol(ws))

    auth = await authenticate(ws, db)
    if auth is None:
        return

    conn_id = uuid7_str()
    set_correlation_id(conn_id)

    fanout = ClientFanout(ws, auth.tenant.tenant_id)

    # Tenant broadcast topic (presence changes, cross-conversation system events)
    await fanout.subscribe_topic(f"tenant:{auth.tenant.tenant_id}")

    await presence.set_presence(
        tenant_id=auth.tenant.tenant_id,
        user_id=auth.user.id,
        status="online",
        conn_id=conn_id,
    )

    await ws.send_json({
        "kind": "hello",
        "conn_id": conn_id,
        "user_id": auth.user.id,
        "tenant_id": auth.tenant.tenant_id,
    })

    try:
        while True:
            frame = await ws.receive_json()
            await handle_frame(ws, frame, auth, fanout, db, conn_id)
    except WebSocketDisconnect:
        pass
    except Exception:  # noqa: BLE001
        log.exception("WS connection failed")
    finally:
        await fanout.close()
        await presence.clear_presence(
            tenant_id=auth.tenant.tenant_id,
            user_id=auth.user.id,
        )


def _negotiate_subprotocol(ws: WebSocket) -> str | None:
    """If the browser sent `Sec-WebSocket-Protocol: bearer.<jwt>` we must
    echo the same value back or the handshake fails in strict browsers.
    """
    proto = ws.headers.get("sec-websocket-protocol", "")
    if proto.startswith("bearer."):
        return proto
    return None
