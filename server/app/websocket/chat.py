from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.database import SessionLocal
from app.core.deps import get_user_from_token
from app.models.chat import ChannelMember, Message
from app.models.user import User
from app.websocket.manager import chat_manager

router = APIRouter()


@router.websocket("/ws/channels/{channel_id}")
async def channel_ws(websocket: WebSocket, channel_id: int, token: str = ""):
    db: Session = SessionLocal()
    try:
        user = get_user_from_token(token, db)
        if not user:
            await websocket.close(code=4401)
            return
        membership = db.scalar(
            select(ChannelMember).where(
                ChannelMember.channel_id == channel_id,
                ChannelMember.user_id == user.id,
            )
        )
        if not membership:
            await websocket.close(code=4403)
            return

        await websocket.accept()
        room = f"channel:{channel_id}"
        await chat_manager.join(room, websocket)
        await chat_manager.broadcast(
            room,
            {"type": "presence", "user_id": user.id, "name": user.name, "joined": True},
            exclude=websocket,
        )

        try:
            while True:
                data = await websocket.receive_json()
                kind = data.get("type")
                if kind == "message":
                    body = (data.get("body") or "").strip()
                    if not body:
                        continue
                    msg = Message(channel_id=channel_id, sender_id=user.id, body=body[:4000])
                    db.add(msg)
                    db.commit()
                    db.refresh(msg)
                    payload = {
                        "type": "message",
                        "message": {
                            "id": msg.id,
                            "channel_id": channel_id,
                            "sender_id": user.id,
                            "sender_name": user.name,
                            "sender_color": user.avatar_color,
                            "body": msg.body,
                            "created_at": msg.created_at.isoformat(),
                        },
                    }
                    await chat_manager.broadcast(room, payload)
                elif kind == "typing":
                    await chat_manager.broadcast(
                        room,
                        {"type": "typing", "user_id": user.id, "name": user.name},
                        exclude=websocket,
                    )
        except WebSocketDisconnect:
            pass
        finally:
            await chat_manager.leave(room, websocket)
            await chat_manager.broadcast(
                room,
                {"type": "presence", "user_id": user.id, "name": user.name, "joined": False},
            )
    finally:
        db.close()
