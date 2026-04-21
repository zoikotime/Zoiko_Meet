"""LiveKit implementation — the ONLY file that knows the vendor name.

Imports the SDK lazily so local/dev deploys without LiveKit installed still
work via the NullMediaProvider fallback.
"""
from __future__ import annotations

import os
import time

from app.connect.media_service.provider import MediaProvider, MediaToken


class LiveKitMediaProvider(MediaProvider):
    def __init__(self):
        self.api_key = os.environ["LIVEKIT_API_KEY"]
        self.api_secret = os.environ["LIVEKIT_API_SECRET"]
        self.ws_url = os.environ["LIVEKIT_WS_URL"]

    async def create_room(self, *, session_id: str, tenant_id: str) -> str:
        # Room name schema: tenant-scoped so LiveKit ACLs map cleanly to tenants
        return f"zc:{tenant_id}:{session_id}"

    async def generate_token(
        self, *, media_room_ref: str, user_id: int, display_name: str, role: str
    ) -> MediaToken:
        from livekit import api  # type: ignore  # lazy import

        ttl = 3600
        can_publish = role in ("host", "cohost", "participant")
        at = (
            api.AccessToken(self.api_key, self.api_secret)
            .with_identity(f"user-{user_id}")
            .with_name(display_name)
            .with_grants(api.VideoGrants(
                room_join=True,
                room=media_room_ref,
                can_publish=can_publish,
                can_subscribe=True,
                can_publish_data=True,
            ))
            .with_ttl_seconds(ttl)
        )
        return MediaToken(
            access_token=at.to_jwt(),
            room_name=media_room_ref,
            identity=f"user-{user_id}",
            expires_at=int(time.time()) + ttl,
        )

    async def release_room(self, media_room_ref: str | None) -> None:
        if not media_room_ref:
            return
        from livekit import api  # type: ignore
        lk = api.LiveKitAPI(self.ws_url, self.api_key, self.api_secret)
        try:
            await lk.room.delete_room(api.DeleteRoomRequest(room=media_room_ref))
        finally:
            await lk.aclose()
