import re
from datetime import datetime, timezone as tz

from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.database import SessionLocal
from app.core.deps import get_user_from_token
from app.models.chat import Channel, ChannelMember, Message, MessageReaction, MessageReadReceipt
from app.models.organization import NOTIF_CHAT_MENTION
from app.models.user import User
from app.api.notifications import create_notification_sync, push_to_user
from app.websocket.manager import chat_manager

router = APIRouter()


# Match @<word>. Word = letters/digits/_/. across non-whitespace, up to 80 chars.
# Names with spaces are matched by stripping spaces from the candidate user names
# during lookup, so "@JohnDoe" hits a user named "John Doe".
_MENTION_RE = re.compile(r"(?:^|\s)@([\w.\-]{1,80})", re.UNICODE)


def _resolve_mentions(body: str, channel_id: int, sender_id: int, db: Session) -> list[User]:
    """Return distinct channel-member users mentioned in `body` via @<name>.
    Matches case-insensitively against name with spaces removed. Sender is excluded."""
    raw = _MENTION_RE.findall(body or "")
    if not raw:
        return []
    members = db.scalars(
        select(User)
        .join(ChannelMember, ChannelMember.user_id == User.id)
        .where(ChannelMember.channel_id == channel_id)
    ).all()
    by_handle: dict[str, User] = {}
    for u in members:
        handle = re.sub(r"\s+", "", u.name).lower()
        by_handle.setdefault(handle, u)
    seen: set[int] = set()
    matched: list[User] = []
    for token in raw:
        u = by_handle.get(token.lower())
        if u and u.id != sender_id and u.id not in seen:
            seen.add(u.id)
            matched.append(u)
    return matched


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

                # Refresh membership for mute checks
                db.refresh(membership)

                if kind == "message":
                    if membership.is_muted:
                        await websocket.send_json({"type": "error", "message": "You are muted in this channel"})
                        continue
                    body = (data.get("body") or "").strip()
                    if not body:
                        continue
                    reply_to_id = data.get("reply_to_id")
                    if reply_to_id:
                        parent = db.get(Message, reply_to_id)
                        if not parent or parent.channel_id != channel_id:
                            reply_to_id = None

                    msg = Message(
                        channel_id=channel_id,
                        sender_id=user.id,
                        body=body[:4000],
                        reply_to_id=reply_to_id,
                    )
                    db.add(msg)
                    db.commit()
                    db.refresh(msg)

                    reply_preview = None
                    if msg.reply_to_id:
                        parent = db.get(Message, msg.reply_to_id)
                        if parent and not parent.deleted_at:
                            reply_preview = parent.body[:120]

                    mentions = _resolve_mentions(msg.body, channel_id, user.id, db)
                    mention_ids = [u.id for u in mentions]

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
                            "deleted_at": None,
                            "reply_to_id": msg.reply_to_id,
                            "reply_preview": reply_preview,
                            "file_url": None,
                            "file_name": None,
                            "file_type": None,
                            "file_size": None,
                            "reactions": [],
                            "mentions": mention_ids,
                        },
                    }
                    await chat_manager.broadcast(room, payload)

                    # Fan out @mention notifications. Persist + push live to each
                    # mentioned user's open notification WS connections.
                    if mentions:
                        channel_obj = db.get(Channel, channel_id)
                        channel_label = channel_obj.name if channel_obj else "a channel"
                        snippet = msg.body[:140]
                        for u in mentions:
                            notif = create_notification_sync(
                                db,
                                user_id=u.id,
                                notif_type=NOTIF_CHAT_MENTION,
                                title=f"{user.name} mentioned you in {channel_label}",
                                body=snippet,
                                data={"channel_id": channel_id, "message_id": msg.id},
                            )
                            db.commit()
                            await push_to_user(u.id, {
                                "type": "notification",
                                "notification": {
                                    "id": notif.id,
                                    "type": notif.type,
                                    "title": notif.title,
                                    "body": notif.body,
                                    "is_read": False,
                                    "created_at": notif.created_at.isoformat(),
                                    "data": {"channel_id": channel_id, "message_id": msg.id},
                                },
                            })

                elif kind == "typing":
                    if membership.is_muted:
                        continue
                    await chat_manager.broadcast(
                        room,
                        {"type": "typing", "user_id": user.id, "name": user.name},
                        exclude=websocket,
                    )

                elif kind == "reaction":
                    message_id = data.get("message_id")
                    emoji = (data.get("emoji") or "").strip()
                    if not message_id or not emoji:
                        continue
                    msg = db.get(Message, message_id)
                    if not msg or msg.channel_id != channel_id or msg.deleted_at:
                        continue

                    existing = db.scalar(
                        select(MessageReaction).where(
                            MessageReaction.message_id == message_id,
                            MessageReaction.user_id == user.id,
                            MessageReaction.emoji == emoji,
                        )
                    )
                    if existing:
                        db.delete(existing)
                        db.commit()
                        action = "removed"
                    else:
                        db.add(MessageReaction(message_id=message_id, user_id=user.id, emoji=emoji))
                        db.commit()
                        action = "added"

                    await chat_manager.broadcast(room, {
                        "type": "reaction",
                        "message_id": message_id,
                        "emoji": emoji,
                        "user_id": user.id,
                        "user_name": user.name,
                        "action": action,
                    })

                elif kind == "delete":
                    message_id = data.get("message_id")
                    if not message_id:
                        continue
                    msg = db.get(Message, message_id)
                    if not msg or msg.channel_id != channel_id or msg.deleted_at:
                        continue
                    channel = db.get(Channel, channel_id)
                    if msg.sender_id != user.id and (not channel or channel.created_by != user.id):
                        await websocket.send_json({"type": "error", "message": "Cannot delete this message"})
                        continue
                    msg.deleted_at = datetime.now(tz.utc)
                    db.commit()
                    await chat_manager.broadcast(room, {
                        "type": "message_deleted",
                        "message_id": message_id,
                        "deleted_by": user.id,
                    })

                elif kind == "read":
                    last_read_id = data.get("last_read_message_id")
                    if not last_read_id:
                        continue
                    receipt = db.scalar(
                        select(MessageReadReceipt).where(
                            MessageReadReceipt.channel_id == channel_id,
                            MessageReadReceipt.user_id == user.id,
                        )
                    )
                    if receipt:
                        if last_read_id > receipt.last_read_message_id:
                            receipt.last_read_message_id = last_read_id
                            receipt.read_at = datetime.now(tz.utc)
                    else:
                        receipt = MessageReadReceipt(
                            channel_id=channel_id,
                            user_id=user.id,
                            last_read_message_id=last_read_id,
                        )
                        db.add(receipt)
                    db.commit()
                    await chat_manager.broadcast(room, {
                        "type": "read_receipt",
                        "user_id": user.id,
                        "user_name": user.name,
                        "last_read_message_id": last_read_id,
                    }, exclude=websocket)

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
