"""Redis pub/sub fan-out.

Replaces the legacy in-memory RoomManager. Every Gateway replica subscribes
to the same tenant-scoped Redis channels, so a message published by replica A
reaches clients attached to replica B.

Subscribed keys are computed lazily per WS connection (one task per client).
"""
from __future__ import annotations

import asyncio
import logging

from fastapi import WebSocket

from app.connect.events.bus import subscribe
from app.connect.shared.envelope import EventEnvelope

log = logging.getLogger(__name__)


class ClientFanout:
    """Routes server-side envelopes to a single WebSocket client.

    One instance per WS connection. Holds N asyncio tasks (one per topic
    the client is subscribed to). Cancel all on disconnect.
    """

    def __init__(self, ws: WebSocket, tenant_id: str):
        self.ws = ws
        self.tenant_id = tenant_id
        self._tasks: dict[str, asyncio.Task] = {}

    async def subscribe_topic(self, topic: str) -> None:
        if topic in self._tasks:
            return
        self._tasks[topic] = asyncio.create_task(self._pump(topic))

    async def unsubscribe_topic(self, topic: str) -> None:
        task = self._tasks.pop(topic, None)
        if task is not None:
            task.cancel()

    async def close(self) -> None:
        for task in self._tasks.values():
            task.cancel()
        await asyncio.gather(*self._tasks.values(), return_exceptions=True)
        self._tasks.clear()

    async def _pump(self, topic: str) -> None:
        try:
            async for env in subscribe(self.tenant_id, topic):
                await self._forward(env, topic)
        except asyncio.CancelledError:
            raise
        except Exception:  # noqa: BLE001
            log.exception("Fanout pump failed for topic %s", topic)

    async def _forward(self, env: EventEnvelope, topic: str) -> None:
        try:
            await self.ws.send_json({
                "kind": "event",
                "topic": topic,
                "envelope": env.model_dump(mode="json"),
            })
        except Exception:  # noqa: BLE001
            log.debug("WS send failed; client likely disconnected")
