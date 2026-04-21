"""Presence is transient — Redis only, never Postgres. TTL keeps it self-healing
when a pod crashes and skips the disconnect hook.

Key shape:
  connect:presence:{tenant_id}:{user_id}  →  "{status}|{last_seen_ts}|{conn_id}"
  connect:typing:{tenant_id}:{conversation_id}:{user_id}  →  "1" (TTL 6s)
"""
from __future__ import annotations

import time
from typing import Literal

from app.connect.events import types as etypes
from app.connect.events.bus import publish
from app.connect.shared.envelope import EventEnvelope
from app.connect.shared.redis import get_redis
from app.connect.shared.telemetry import get_correlation_id

_PRESENCE_TTL = 60      # refreshed every 30s by the Gateway
_TYPING_TTL = 6

Status = Literal["online", "away", "offline"]


def _presence_key(tenant_id: str, user_id: int) -> str:
    return f"connect:presence:{tenant_id}:{user_id}"


def _typing_key(tenant_id: str, conversation_id: str, user_id: int) -> str:
    return f"connect:typing:{tenant_id}:{conversation_id}:{user_id}"


async def set_presence(
    *, tenant_id: str, user_id: int, status: Status, conn_id: str
) -> None:
    redis = await get_redis()
    if redis is None:
        return
    payload = f"{status}|{int(time.time())}|{conn_id}"
    await redis.set(_presence_key(tenant_id, user_id), payload, ex=_PRESENCE_TTL)
    await publish(
        EventEnvelope(
            type=etypes.PRESENCE_CHANGED,
            tenant_id=tenant_id,
            correlation_id=get_correlation_id(),
            actor_user_id=user_id,
            payload={"user_id": user_id, "status": status},
        ),
        topic=f"tenant:{tenant_id}",
    )


async def clear_presence(*, tenant_id: str, user_id: int) -> None:
    redis = await get_redis()
    if redis is None:
        return
    await redis.delete(_presence_key(tenant_id, user_id))
    await publish(
        EventEnvelope(
            type=etypes.PRESENCE_CHANGED,
            tenant_id=tenant_id,
            payload={"user_id": user_id, "status": "offline"},
        ),
        topic=f"tenant:{tenant_id}",
    )


async def get_presence(*, tenant_id: str, user_ids: list[int]) -> dict[int, Status]:
    redis = await get_redis()
    if redis is None:
        return {uid: "offline" for uid in user_ids}
    keys = [_presence_key(tenant_id, uid) for uid in user_ids]
    vals = await redis.mget(keys)
    out: dict[int, Status] = {}
    for uid, raw in zip(user_ids, vals):
        if raw is None:
            out[uid] = "offline"
        else:
            out[uid] = raw.split("|", 1)[0]  # type: ignore[assignment]
    return out


async def start_typing(*, tenant_id: str, conversation_id: str, user_id: int) -> None:
    redis = await get_redis()
    if redis is None:
        return
    await redis.set(_typing_key(tenant_id, conversation_id, user_id), "1", ex=_TYPING_TTL)
    await publish(
        EventEnvelope(
            type=etypes.TYPING_STARTED,
            tenant_id=tenant_id,
            correlation_id=get_correlation_id(),
            actor_user_id=user_id,
            payload={"conversation_id": conversation_id, "user_id": user_id},
        ),
        topic=f"conversation:{conversation_id}",
    )


async def stop_typing(*, tenant_id: str, conversation_id: str, user_id: int) -> None:
    redis = await get_redis()
    if redis is None:
        return
    await redis.delete(_typing_key(tenant_id, conversation_id, user_id))
    await publish(
        EventEnvelope(
            type=etypes.TYPING_STOPPED,
            tenant_id=tenant_id,
            payload={"conversation_id": conversation_id, "user_id": user_id},
        ),
        topic=f"conversation:{conversation_id}",
    )
