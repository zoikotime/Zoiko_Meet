import os
import uuid
from datetime import datetime, timezone as tz

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from fastapi.responses import FileResponse
from sqlalchemy import select, func, desc
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.chat import (
    Channel, ChannelMember, Message, MessageReaction, MessageReadReceipt,
)
from app.models.user import User
from app.schemas.chat import (
    ChannelCreate, ChannelMemberOut, ChannelOut,
    MessageCreate, MessageOut, ReactionIn, ReactionOut,
    ReadReceiptIn, ReadReceiptOut,
)

router = APIRouter(prefix="/api/channels", tags=["chat"])

UPLOAD_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "uploads")
ALLOWED_EXTENSIONS = {
    "png", "jpg", "jpeg", "gif", "webp", "svg",
    "pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx",
    "txt", "csv", "zip", "json", "md",
    # Audio / voice notes
    "webm", "mp3", "wav", "ogg", "m4a",
}
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10 MB


def _membership(db: Session, channel_id: int, user_id: int) -> ChannelMember | None:
    return db.scalar(
        select(ChannelMember).where(
            ChannelMember.channel_id == channel_id, ChannelMember.user_id == user_id
        )
    )


def _channel_out(db: Session, channel: Channel, user_id: int | None = None) -> ChannelOut:
    member_users = db.scalars(
        select(User)
        .join(ChannelMember, ChannelMember.user_id == User.id)
        .where(ChannelMember.channel_id == channel.id)
    ).all()
    last = db.scalar(
        select(Message)
        .where(Message.channel_id == channel.id, Message.deleted_at.is_(None))
        .order_by(desc(Message.created_at))
        .limit(1)
    )
    unread = 0
    if user_id and last:
        receipt = db.scalar(
            select(MessageReadReceipt).where(
                MessageReadReceipt.channel_id == channel.id,
                MessageReadReceipt.user_id == user_id,
            )
        )
        if receipt:
            unread = db.scalar(
                select(func.count(Message.id)).where(
                    Message.channel_id == channel.id,
                    Message.id > receipt.last_read_message_id,
                    Message.deleted_at.is_(None),
                )
            ) or 0
        else:
            unread = db.scalar(
                select(func.count(Message.id)).where(
                    Message.channel_id == channel.id,
                    Message.deleted_at.is_(None),
                )
            ) or 0

    return ChannelOut(
        id=channel.id,
        name=channel.name,
        is_direct=channel.is_direct,
        created_at=channel.created_at,
        members=[ChannelMemberOut.model_validate(u) for u in member_users],
        last_message_preview=(last.body[:120] if last else None),
        last_message_at=last.created_at if last else None,
        unread_count=unread,
    )


def _message_out(msg: Message, sender: User, db: Session) -> MessageOut:
    reactions_raw = db.scalars(
        select(MessageReaction).where(MessageReaction.message_id == msg.id)
    ).all()
    reaction_users = {}
    if reactions_raw:
        uids = {r.user_id for r in reactions_raw}
        reaction_users = {u.id: u for u in db.scalars(select(User).where(User.id.in_(uids))).all()}

    reactions = [
        ReactionOut(emoji=r.emoji, user_id=r.user_id, user_name=reaction_users.get(r.user_id, sender).name)
        for r in reactions_raw
    ]

    reply_preview = None
    if msg.reply_to_id:
        parent = db.get(Message, msg.reply_to_id)
        if parent and not parent.deleted_at:
            reply_preview = parent.body[:120]

    return MessageOut(
        id=msg.id,
        channel_id=msg.channel_id,
        sender_id=msg.sender_id,
        sender_name=sender.name,
        sender_color=sender.avatar_color,
        body=msg.body,
        created_at=msg.created_at,
        deleted_at=msg.deleted_at,
        reply_to_id=msg.reply_to_id,
        reply_preview=reply_preview,
        file_url=msg.file_url,
        file_name=msg.file_name,
        file_type=msg.file_type,
        file_size=msg.file_size,
        reactions=reactions,
    )


# ── Channels ────────────────────────────────────────────────────────────

@router.get("", response_model=list[ChannelOut])
def list_my_channels(
    db: Session = Depends(get_db), user: User = Depends(get_current_user)
):
    channel_ids = db.scalars(
        select(ChannelMember.channel_id).where(ChannelMember.user_id == user.id)
    ).all()
    if not channel_ids:
        return []
    channels = db.scalars(
        select(Channel).where(Channel.id.in_(channel_ids)).order_by(desc(Channel.created_at))
    ).all()
    results = [_channel_out(db, c, user.id) for c in channels]
    results.sort(key=lambda c: c.last_message_at or c.created_at, reverse=True)
    return results


@router.post("", response_model=ChannelOut, status_code=201)
def create_channel(
    data: ChannelCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    member_ids = set(data.member_ids) | {user.id}
    existing_users = db.scalars(select(User).where(User.id.in_(member_ids))).all()
    if len(existing_users) != len(member_ids):
        raise HTTPException(status_code=400, detail="Invalid member ids")

    if data.is_direct and len(member_ids) == 2:
        other_id = next(i for i in member_ids if i != user.id)
        candidates = db.scalars(
            select(Channel)
            .join(ChannelMember, ChannelMember.channel_id == Channel.id)
            .where(Channel.is_direct.is_(True), ChannelMember.user_id == user.id)
        ).all()
        for c in candidates:
            member_set = {m.user_id for m in c.members}
            if member_set == {user.id, other_id}:
                return _channel_out(db, c, user.id)

    channel = Channel(name=data.name.strip(), is_direct=data.is_direct, created_by=user.id)
    db.add(channel)
    db.flush()
    for uid in member_ids:
        db.add(ChannelMember(channel_id=channel.id, user_id=uid))
    db.commit()
    db.refresh(channel)
    return _channel_out(db, channel, user.id)


# ── Messages ────────────────────────────────────────────────────────────

@router.get("/{channel_id}/messages", response_model=list[MessageOut])
def list_messages(
    channel_id: int,
    limit: int = 50,
    before_id: int | None = None,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    mem = _membership(db, channel_id, user.id)
    if not mem:
        raise HTTPException(status_code=403, detail="Not a channel member")
    if mem.is_muted:
        raise HTTPException(status_code=403, detail="You are muted in this channel")
    stmt = select(Message).where(Message.channel_id == channel_id)
    if before_id:
        stmt = stmt.where(Message.id < before_id)
    stmt = stmt.order_by(desc(Message.id)).limit(min(limit, 200))
    messages = list(db.scalars(stmt).all())
    messages.reverse()
    sender_ids = {m.sender_id for m in messages}
    senders = {u.id: u for u in db.scalars(select(User).where(User.id.in_(sender_ids))).all()}
    return [_message_out(m, senders[m.sender_id], db) for m in messages]


@router.post("/{channel_id}/messages", response_model=MessageOut, status_code=201)
def post_message(
    channel_id: int,
    data: MessageCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    mem = _membership(db, channel_id, user.id)
    if not mem:
        raise HTTPException(status_code=403, detail="Not a channel member")
    if mem.is_muted:
        raise HTTPException(status_code=403, detail="You are muted in this channel")

    if data.reply_to_id:
        parent = db.get(Message, data.reply_to_id)
        if not parent or parent.channel_id != channel_id:
            raise HTTPException(status_code=400, detail="Invalid reply target")

    msg = Message(
        channel_id=channel_id,
        sender_id=user.id,
        body=data.body.strip(),
        reply_to_id=data.reply_to_id,
    )
    db.add(msg)
    db.commit()
    db.refresh(msg)
    return _message_out(msg, user, db)


@router.delete("/{channel_id}/messages/{message_id}", status_code=200)
def delete_message(
    channel_id: int,
    message_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    if not _membership(db, channel_id, user.id):
        raise HTTPException(status_code=403, detail="Not a channel member")
    msg = db.get(Message, message_id)
    if not msg or msg.channel_id != channel_id:
        raise HTTPException(status_code=404, detail="Message not found")

    # Sender can delete their own; channel creator can delete any
    channel = db.get(Channel, channel_id)
    if msg.sender_id != user.id and channel.created_by != user.id:
        raise HTTPException(status_code=403, detail="Cannot delete this message")

    msg.deleted_at = datetime.now(tz.utc)
    db.commit()
    return {"ok": True, "message_id": message_id}


# ── Reactions ───────────────────────────────────────────────────────────

@router.post("/{channel_id}/messages/{message_id}/reactions", status_code=201)
def add_reaction(
    channel_id: int,
    message_id: int,
    data: ReactionIn,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    if not _membership(db, channel_id, user.id):
        raise HTTPException(status_code=403, detail="Not a channel member")
    msg = db.get(Message, message_id)
    if not msg or msg.channel_id != channel_id or msg.deleted_at:
        raise HTTPException(status_code=404, detail="Message not found")

    existing = db.scalar(
        select(MessageReaction).where(
            MessageReaction.message_id == message_id,
            MessageReaction.user_id == user.id,
            MessageReaction.emoji == data.emoji,
        )
    )
    if existing:
        return {"ok": True, "action": "already_exists"}

    reaction = MessageReaction(message_id=message_id, user_id=user.id, emoji=data.emoji)
    db.add(reaction)
    db.commit()
    return {"ok": True, "action": "added", "emoji": data.emoji, "user_id": user.id, "user_name": user.name}


@router.delete("/{channel_id}/messages/{message_id}/reactions/{emoji}", status_code=200)
def remove_reaction(
    channel_id: int,
    message_id: int,
    emoji: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    if not _membership(db, channel_id, user.id):
        raise HTTPException(status_code=403, detail="Not a channel member")
    reaction = db.scalar(
        select(MessageReaction).where(
            MessageReaction.message_id == message_id,
            MessageReaction.user_id == user.id,
            MessageReaction.emoji == emoji,
        )
    )
    if reaction:
        db.delete(reaction)
        db.commit()
    return {"ok": True, "action": "removed", "emoji": emoji}


# ── File Upload ─────────────────────────────────────────────────────────

@router.post("/{channel_id}/upload", response_model=MessageOut, status_code=201)
async def upload_file(
    channel_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    mem = _membership(db, channel_id, user.id)
    if not mem:
        raise HTTPException(status_code=403, detail="Not a channel member")
    if mem.is_muted:
        raise HTTPException(status_code=403, detail="You are muted in this channel")

    ext = (file.filename or "file").rsplit(".", 1)[-1].lower() if file.filename else ""
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=400, detail=f"File type .{ext} not allowed")

    content = await file.read()
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail="File too large (max 10 MB)")

    os.makedirs(UPLOAD_DIR, exist_ok=True)
    safe_name = f"{uuid.uuid4().hex}.{ext}"
    path = os.path.join(UPLOAD_DIR, safe_name)
    with open(path, "wb") as f:
        f.write(content)

    file_url = f"/api/uploads/{safe_name}"
    msg = Message(
        channel_id=channel_id,
        sender_id=user.id,
        body=file.filename or "File",
        file_url=file_url,
        file_name=file.filename,
        file_type=file.content_type or f"application/{ext}",
        file_size=len(content),
    )
    db.add(msg)
    db.commit()
    db.refresh(msg)
    return _message_out(msg, user, db)


# ── Read Receipts ───────────────────────────────────────────────────────

@router.post("/{channel_id}/read", status_code=200)
def mark_read(
    channel_id: int,
    data: ReadReceiptIn,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    if not _membership(db, channel_id, user.id):
        raise HTTPException(status_code=403, detail="Not a channel member")
    receipt = db.scalar(
        select(MessageReadReceipt).where(
            MessageReadReceipt.channel_id == channel_id,
            MessageReadReceipt.user_id == user.id,
        )
    )
    if receipt:
        if data.last_read_message_id > receipt.last_read_message_id:
            receipt.last_read_message_id = data.last_read_message_id
            receipt.read_at = datetime.now(tz.utc)
    else:
        receipt = MessageReadReceipt(
            channel_id=channel_id,
            user_id=user.id,
            last_read_message_id=data.last_read_message_id,
        )
        db.add(receipt)
    db.commit()
    return {"ok": True}


@router.get("/{channel_id}/read-receipts", response_model=list[ReadReceiptOut])
def get_read_receipts(
    channel_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    if not _membership(db, channel_id, user.id):
        raise HTTPException(status_code=403, detail="Not a channel member")
    receipts = db.scalars(
        select(MessageReadReceipt).where(MessageReadReceipt.channel_id == channel_id)
    ).all()
    uids = {r.user_id for r in receipts}
    users_map = {u.id: u for u in db.scalars(select(User).where(User.id.in_(uids))).all()}
    return [
        ReadReceiptOut(
            user_id=r.user_id,
            user_name=users_map[r.user_id].name,
            last_read_message_id=r.last_read_message_id,
            read_at=r.read_at,
        )
        for r in receipts if r.user_id in users_map
    ]


# ── Moderation (mute/unmute) ────────────────────────────────────────────

@router.post("/{channel_id}/mute/{target_user_id}", status_code=200)
def mute_user(
    channel_id: int,
    target_user_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    channel = db.get(Channel, channel_id)
    if not channel:
        raise HTTPException(status_code=404, detail="Channel not found")
    if channel.created_by != user.id:
        raise HTTPException(status_code=403, detail="Only channel creator can mute users")
    target_mem = _membership(db, channel_id, target_user_id)
    if not target_mem:
        raise HTTPException(status_code=404, detail="User not in channel")
    target_mem.is_muted = True
    db.commit()
    return {"ok": True, "user_id": target_user_id, "muted": True}


@router.post("/{channel_id}/unmute/{target_user_id}", status_code=200)
def unmute_user(
    channel_id: int,
    target_user_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    channel = db.get(Channel, channel_id)
    if not channel:
        raise HTTPException(status_code=404, detail="Channel not found")
    if channel.created_by != user.id:
        raise HTTPException(status_code=403, detail="Only channel creator can unmute users")
    target_mem = _membership(db, channel_id, target_user_id)
    if not target_mem:
        raise HTTPException(status_code=404, detail="User not in channel")
    target_mem.is_muted = False
    db.commit()
    return {"ok": True, "user_id": target_user_id, "muted": False}
