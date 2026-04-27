"""In-process event bus for real-time fan-out to the Gateway.

This is the hot path: after a service commits a message and enqueues the
outbox row, it also publishes the envelope on the in-process bus (which
relays to Redis pub/sub). The outbox dispatcher separately forwards to
GCP Pub/Sub for durable downstream consumers.

Layer-3 tenant isolation: subscribers MUST assert `envelope.tenant_id`
before serving any bytes back out.
"""
from __future__ import annotations

import json
import logging

from app.connect.shared.envelope import EventEnvelope
from app.connect.shared.redis import get_redis

log = logging.getLogger(__name__)

_CHANNEL_PREFIX = "connect:bus"


def _channel(tenant_id: str, topic: str) -> str:
    # Keys are namespaced by tenant so a Redis ACL slip can't cross tenants.
    return f"{_CHANNEL_PREFIX}:{tenant_id}:{topic}"


async def publish(envelope: EventEnvelope, topic: str) -> None:
    """Publish an envelope to the tenant-scoped topic. Best-effort: Redis
    outage degrades real-time fan-out but does not break the write path
    (outbox + Pub/Sub still carry the event downstream).
    """
    redis = await get_redis()
    if redis is None:
        log.debug("Redis unavailable — envelope %s not fanned out", envelope.id)
        return
    try:
        await redis.publish(
            _channel(envelope.tenant_id, topic),
            envelope.model_dump_json(),
        )
    except Exception:  # noqa: BLE001
        log.exception("Redis publish failed for envelope %s", envelope.id)


async def subscribe(tenant_id: str, topic: str):
    """Async generator yielding envelopes. Caller owns the lifecycle."""
    redis = await get_redis()
    if redis is None:
        return
    pubsub = redis.pubsub()
    await pubsub.subscribe(_channel(tenant_id, topic))
    try:
        async for msg in pubsub.listen():
            if msg.get("type") != "message":
                continue
            try:
                data = json.loads(msg["data"])
            except (TypeError, ValueError):
                continue
            env = EventEnvelope.model_validate(data)
            if env.tenant_id != tenant_id:
                # Layer-3 defense: refuse to emit a cross-tenant envelope
                log.warning("Dropped cross-tenant envelope %s", env.id)
                continue
            yield env
    finally:
        await pubsub.unsubscribe(_channel(tenant_id, topic))
        await pubsub.aclose()
