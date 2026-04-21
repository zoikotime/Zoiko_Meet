"""Idempotency-Key dedupe backed by Redis.

Clients may send `Idempotency-Key: <uuid>` on POSTs. The first request
completes normally and the response hash is cached for 24h; identical
replays short-circuit and return the cached response.
"""
from __future__ import annotations

import hashlib
import json
from typing import Any

from app.connect.shared.redis import get_redis

_TTL_SECONDS = 24 * 3600


def _cache_key(tenant_id: str, user_id: int, route: str, idem_key: str) -> str:
    h = hashlib.sha256(f"{tenant_id}|{user_id}|{route}|{idem_key}".encode()).hexdigest()
    return f"connect:idem:{h}"


async def check(tenant_id: str, user_id: int, route: str, idem_key: str) -> dict[str, Any] | None:
    redis = await get_redis()
    if redis is None:
        return None
    cached = await redis.get(_cache_key(tenant_id, user_id, route, idem_key))
    return json.loads(cached) if cached else None


async def store(tenant_id: str, user_id: int, route: str, idem_key: str, response: dict[str, Any]) -> None:
    redis = await get_redis()
    if redis is None:
        return
    await redis.set(
        _cache_key(tenant_id, user_id, route, idem_key),
        json.dumps(response, default=str),
        ex=_TTL_SECONDS,
    )
