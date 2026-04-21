"""JWT validation for the WebSocket handshake.

The Gateway is stateless — it holds no session state locally — but it must
authenticate every frame's origin. Client connects as:

    wss://api.example.com/api/connect/ws?token=<jwt>

Token is validated once at upgrade time; the resolved (user, tenant) is
stashed on the WebSocket's scope for the life of the connection.
"""
from __future__ import annotations

from dataclasses import dataclass

from fastapi import WebSocket, status
from sqlalchemy.orm import Session as DbSession

from app.connect.shared.errors import Unauthenticated
from app.connect.shared.tenant import TenantContext, resolve_tenant
from app.core.deps import get_user_from_token
from app.models.user import User


@dataclass(frozen=True)
class WsAuth:
    user: User
    tenant: TenantContext


async def authenticate(ws: WebSocket, db: DbSession) -> WsAuth | None:
    """Resolve user + tenant from `?token=` or `Sec-WebSocket-Protocol: bearer.<jwt>`.
    Closes the WS with 4401 on failure and returns None.
    """
    token = ws.query_params.get("token")
    if not token:
        # Fallback: "Sec-WebSocket-Protocol: bearer.<jwt>" (works in browsers where
        # setting custom headers on WS is not possible).
        proto = ws.headers.get("sec-websocket-protocol", "")
        if proto.startswith("bearer."):
            token = proto[len("bearer."):]

    if not token:
        await ws.close(code=status.WS_1008_POLICY_VIOLATION, reason="missing_token")
        return None

    user = get_user_from_token(token, db)
    if user is None:
        await ws.close(code=status.WS_1008_POLICY_VIOLATION, reason="invalid_token")
        return None

    try:
        ctx = resolve_tenant(db, user)
    except Unauthenticated:
        await ws.close(code=status.WS_1008_POLICY_VIOLATION, reason="no_tenant")
        return None

    return WsAuth(user=user, tenant=ctx)
