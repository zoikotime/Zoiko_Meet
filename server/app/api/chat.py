from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, func, desc
from sqlalchemy.orm import Session, selectinload

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.chat import Channel, ChannelMember, Message
from app.models.user import User
from app.schemas.chat import (
    ChannelCreate,
    ChannelMemberOut,
    ChannelOut,
    MessageCreate,
    MessageOut,
)

router = APIRouter(prefix="/api/channels", tags=["chat"])


def _membership(db: Session, channel_id: int, user_id: int) -> ChannelMember | None:
    return db.scalar(
        select(ChannelMember).where(
            ChannelMember.channel_id == channel_id, ChannelMember.user_id == user_id
        )
    )


def _channel_out(db: Session, channel: Channel) -> ChannelOut:
    member_users = db.scalars(
        select(User)
        .join(ChannelMember, ChannelMember.user_id == User.id)
        .where(ChannelMember.channel_id == channel.id)
    ).all()
    last = db.scalar(
        select(Message)
        .where(Message.channel_id == channel.id)
        .order_by(desc(Message.created_at))
        .limit(1)
    )
    return ChannelOut(
        id=channel.id,
        name=channel.name,
        is_direct=channel.is_direct,
        created_at=channel.created_at,
        members=[ChannelMemberOut.model_validate(u) for u in member_users],
        last_message_preview=(last.body[:120] if last else None),
        last_message_at=last.created_at if last else None,
    )


def _message_out(msg: Message, sender: User) -> MessageOut:
    return MessageOut(
        id=msg.id,
        channel_id=msg.channel_id,
        sender_id=msg.sender_id,
        sender_name=sender.name,
        sender_color=sender.avatar_color,
        body=msg.body,
        created_at=msg.created_at,
    )


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
    results = [_channel_out(db, c) for c in channels]
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
                return _channel_out(db, c)

    channel = Channel(name=data.name.strip(), is_direct=data.is_direct, created_by=user.id)
    db.add(channel)
    db.flush()
    for uid in member_ids:
        db.add(ChannelMember(channel_id=channel.id, user_id=uid))
    db.commit()
    db.refresh(channel)
    return _channel_out(db, channel)


@router.get("/{channel_id}/messages", response_model=list[MessageOut])
def list_messages(
    channel_id: int,
    limit: int = 50,
    before_id: int | None = None,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    if not _membership(db, channel_id, user.id):
        raise HTTPException(status_code=403, detail="Not a channel member")
    stmt = select(Message).where(Message.channel_id == channel_id)
    if before_id:
        stmt = stmt.where(Message.id < before_id)
    stmt = stmt.order_by(desc(Message.id)).limit(min(limit, 200))
    messages = list(db.scalars(stmt).all())
    messages.reverse()
    sender_ids = {m.sender_id for m in messages}
    senders = {u.id: u for u in db.scalars(select(User).where(User.id.in_(sender_ids))).all()}
    return [_message_out(m, senders[m.sender_id]) for m in messages]


@router.post("/{channel_id}/messages", response_model=MessageOut, status_code=201)
def post_message(
    channel_id: int,
    data: MessageCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    if not _membership(db, channel_id, user.id):
        raise HTTPException(status_code=403, detail="Not a channel member")
    msg = Message(channel_id=channel_id, sender_id=user.id, body=data.body.strip())
    db.add(msg)
    db.commit()
    db.refresh(msg)
    return _message_out(msg, user)
