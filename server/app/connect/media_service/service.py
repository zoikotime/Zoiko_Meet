"""Media Orchestration Service — everyone calls these two functions.

Provider is chosen by `MEDIA_PROVIDER` env var (`livekit` | `null`). The
rest of the app (session service, gateway, api) never imports a provider
class directly — they call `create_media_room` / `generate_token`.
"""
from __future__ import annotations

import os
from functools import lru_cache

from app.connect.media_service.provider import MediaProvider, MediaToken


@lru_cache(maxsize=1)
def _provider() -> MediaProvider:
    kind = os.getenv("MEDIA_PROVIDER", "null").lower()
    if kind == "livekit":
        from app.connect.media_service.livekit_provider import LiveKitMediaProvider
        return LiveKitMediaProvider()
    from app.connect.media_service.null_provider import NullMediaProvider
    return NullMediaProvider()


async def create_media_room(*, session_id: str, tenant_id: str) -> str:
    return await _provider().create_room(session_id=session_id, tenant_id=tenant_id)


async def generate_token(
    *, media_room_ref: str, user_id: int, display_name: str, role: str,
) -> MediaToken:
    return await _provider().generate_token(
        media_room_ref=media_room_ref, user_id=user_id,
        display_name=display_name, role=role,
    )


async def release_media_room(media_room_ref: str | None) -> None:
    await _provider().release_room(media_room_ref)
