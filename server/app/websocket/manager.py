import asyncio
from collections import defaultdict
from typing import Any

from fastapi import WebSocket


class RoomManager:
    """Generic room-based pub/sub for WebSockets."""

    def __init__(self) -> None:
        self._rooms: dict[str, set[WebSocket]] = defaultdict(set)
        self._lock = asyncio.Lock()

    async def join(self, room: str, ws: WebSocket) -> None:
        async with self._lock:
            self._rooms[room].add(ws)

    async def leave(self, room: str, ws: WebSocket) -> None:
        async with self._lock:
            if ws in self._rooms.get(room, set()):
                self._rooms[room].discard(ws)
            if room in self._rooms and not self._rooms[room]:
                self._rooms.pop(room, None)

    def members(self, room: str) -> list[WebSocket]:
        return list(self._rooms.get(room, set()))

    async def broadcast(
        self, room: str, payload: dict[str, Any], exclude: WebSocket | None = None
    ) -> None:
        for ws in list(self._rooms.get(room, set())):
            if ws is exclude:
                continue
            try:
                await ws.send_json(payload)
            except Exception:
                pass


chat_manager = RoomManager()
meet_manager = RoomManager()
