import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.database import SessionLocal
from app.core.deps import get_user_from_token
from app.models.meeting import Meeting, MeetingParticipant
from app.websocket.manager import meet_manager

router = APIRouter()


# Track connection metadata per websocket
_conn_info: dict[WebSocket, dict] = {}


@router.websocket("/ws/meetings/{code}")
async def meeting_ws(websocket: WebSocket, code: str, token: str = ""):
    db: Session = SessionLocal()
    try:
        user = get_user_from_token(token, db)
        if not user:
            await websocket.close(code=4401)
            return

        meeting = db.scalar(select(Meeting).where(Meeting.code == code))
        if not meeting or not meeting.is_active:
            await websocket.close(code=4404)
            return

        peer_id = uuid.uuid4().hex[:10]
        await websocket.accept()
        room = f"meeting:{code}"

        # Tell the new peer about existing peers
        existing = []
        for member_ws in meet_manager.members(room):
            info = _conn_info.get(member_ws)
            if info:
                existing.append(
                    {
                        "peer_id": info["peer_id"],
                        "user_id": info["user_id"],
                        "name": info["name"],
                        "color": info["color"],
                    }
                )

        _conn_info[websocket] = {
            "peer_id": peer_id,
            "user_id": user.id,
            "name": user.name,
            "color": user.avatar_color,
        }
        await meet_manager.join(room, websocket)

        # Record participant in DB
        participant = MeetingParticipant(meeting_id=meeting.id, user_id=user.id)
        db.add(participant)
        db.commit()
        db.refresh(participant)

        await websocket.send_json(
            {
                "type": "welcome",
                "self": _conn_info[websocket],
                "peers": existing,
                "is_host": meeting.host_id == user.id,
            }
        )

        # Notify everyone else
        await meet_manager.broadcast(
            room,
            {"type": "peer-joined", "peer": _conn_info[websocket]},
            exclude=websocket,
        )

        try:
            while True:
                data = await websocket.receive_json()
                kind = data.get("type")

                if kind in {"offer", "answer", "ice-candidate"}:
                    target_peer_id = data.get("target")
                    if not target_peer_id:
                        continue
                    for member_ws in meet_manager.members(room):
                        info = _conn_info.get(member_ws)
                        if info and info["peer_id"] == target_peer_id:
                            await member_ws.send_json(
                                {
                                    "type": kind,
                                    "from": peer_id,
                                    "from_user": user.name,
                                    "payload": data.get("payload"),
                                }
                            )
                            break
                elif kind == "media-state":
                    await meet_manager.broadcast(
                        room,
                        {
                            "type": "media-state",
                            "peer_id": peer_id,
                            "audio": bool(data.get("audio", True)),
                            "video": bool(data.get("video", True)),
                            "screen": bool(data.get("screen", False)),
                        },
                        exclude=websocket,
                    )
                elif kind == "chat":
                    body = (data.get("body") or "").strip()
                    if not body:
                        continue
                    await meet_manager.broadcast(
                        room,
                        {
                            "type": "chat",
                            "peer_id": peer_id,
                            "user_id": user.id,
                            "name": user.name,
                            "color": user.avatar_color,
                            "body": body[:2000],
                            "created_at": datetime.now(timezone.utc).isoformat(),
                        },
                    )
                elif kind == "reaction":
                    await meet_manager.broadcast(
                        room,
                        {
                            "type": "reaction",
                            "peer_id": peer_id,
                            "name": user.name,
                            "emoji": (data.get("emoji") or "👍")[:8],
                        },
                    )
                elif kind == "raise-hand":
                    await meet_manager.broadcast(
                        room,
                        {
                            "type": "raise-hand",
                            "peer_id": peer_id,
                            "name": user.name,
                            "raised": bool(data.get("raised", True)),
                        },
                    )
        except WebSocketDisconnect:
            pass
        finally:
            await meet_manager.leave(room, websocket)
            leaving = _conn_info.pop(websocket, None)
            if leaving:
                await meet_manager.broadcast(
                    room,
                    {"type": "peer-left", "peer_id": leaving["peer_id"]},
                )
            participant.left_at = datetime.now(timezone.utc)
            db.commit()
    finally:
        db.close()
