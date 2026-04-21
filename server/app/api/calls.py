"""1:1 call invites — ring, accept, decline — layered on top of the Meeting model.

A call creates a short-lived Meeting (waiting_room_enabled=False) so the ringing
flow can reuse the existing signaling/WebRTC stack. The call invite itself lives
in memory only; it is ephemeral signaling, not history.
"""
import secrets
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.meetings import _generate_code
from app.api.notifications import push_to_user
from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.meeting import Meeting
from app.models.user import User

router = APIRouter(prefix="/api/calls", tags=["calls"])


class _ActiveCall:
    __slots__ = ("id", "caller_id", "callee_id", "kind", "meeting_code", "created_at")

    def __init__(self, id_: str, caller_id: int, callee_id: int, kind: str, meeting_code: str):
        self.id = id_
        self.caller_id = caller_id
        self.callee_id = callee_id
        self.kind = kind
        self.meeting_code = meeting_code
        self.created_at = datetime.now(timezone.utc)


_active_calls: dict[str, _ActiveCall] = {}


class CallInviteIn(BaseModel):
    callee_user_id: int
    kind: str = Field(default="video", pattern="^(audio|video)$")


class CallInviteOut(BaseModel):
    call_id: str
    meeting_code: str
    kind: str


class CallRespondIn(BaseModel):
    accepted: bool


@router.post("/invite", response_model=CallInviteOut)
async def invite(
    data: CallInviteIn,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    if data.callee_user_id == user.id:
        raise HTTPException(status_code=400, detail="Cannot call yourself")

    callee = db.get(User, data.callee_user_id)
    if not callee:
        raise HTTPException(status_code=404, detail="User not found")

    for _ in range(5):
        code = _generate_code()
        if not db.scalar(select(Meeting).where(Meeting.code == code)):
            break
    else:
        raise HTTPException(status_code=500, detail="Could not allocate meeting code")

    meeting = Meeting(
        code=code,
        title=f"{user.name} & {callee.name}",
        host_id=user.id,
        waiting_room_enabled=False,
    )
    db.add(meeting)
    db.commit()
    db.refresh(meeting)

    call_id = secrets.token_urlsafe(12)
    _active_calls[call_id] = _ActiveCall(call_id, user.id, callee.id, data.kind, code)

    delivered = await push_to_user(callee.id, {
        "type": "call-invite",
        "call_id": call_id,
        "meeting_code": code,
        "kind": data.kind,
        "caller": {
            "id": user.id,
            "name": user.name,
            "avatar_color": user.avatar_color,
        },
    })
    if delivered == 0:
        _active_calls.pop(call_id, None)
        raise HTTPException(status_code=409, detail=f"{callee.name} is offline")

    return CallInviteOut(call_id=call_id, meeting_code=code, kind=data.kind)


@router.post("/{call_id}/respond")
async def respond(
    call_id: str,
    data: CallRespondIn,
    user: User = Depends(get_current_user),
):
    call = _active_calls.get(call_id)
    if not call:
        raise HTTPException(status_code=404, detail="Call not found")
    if call.callee_id != user.id:
        raise HTTPException(status_code=403, detail="Only the callee can respond")

    await push_to_user(call.caller_id, {
        "type": "call-response",
        "call_id": call_id,
        "accepted": data.accepted,
        "meeting_code": call.meeting_code,
        "kind": call.kind,
    })

    if not data.accepted:
        _active_calls.pop(call_id, None)
    return {"ok": True}


@router.post("/{call_id}/cancel")
async def cancel(
    call_id: str,
    user: User = Depends(get_current_user),
):
    call = _active_calls.get(call_id)
    if not call:
        return {"ok": True}
    if call.caller_id != user.id:
        raise HTTPException(status_code=403, detail="Only the caller can cancel")

    await push_to_user(call.callee_id, {
        "type": "call-cancelled",
        "call_id": call_id,
    })
    _active_calls.pop(call_id, None)
    return {"ok": True}
