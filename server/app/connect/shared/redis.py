"""Redis client factory.

Lazy singleton; uses `REDIS_URL` env var (GCP Memorystore private IP in prod,
`redis://localhost:6379/0` in dev). Falls back to a null client in tests so
services can run without Redis present.
"""
from __future__ import annotations

import os
from typing import Optional

try:
    from redis import asyncio as aioredis  # redis>=4.2
except ImportError:  # pragma: no cover — redis is optional in dev
    aioredis = None  # type: ignore

_client: Optional["aioredis.Redis"] = None


def get_redis_url() -> str:
    return os.getenv("REDIS_URL", "redis://localhost:6379/0")


async def get_redis() -> Optional["aioredis.Redis"]:
    global _client
    if aioredis is None:
        return None
    if _client is None:
        _client = aioredis.from_url(get_redis_url(), decode_responses=True)
    return _client


async def close_redis() -> None:
    global _client
    if _client is not None:
        await _client.aclose()
        _client = None
