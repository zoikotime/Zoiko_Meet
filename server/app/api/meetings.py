import secrets
import string
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, desc
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.meeting import Meeting, MeetingParticipant
from app.models.user import User
from app.schemas.meeting import MeetingCreate, MeetingOut

router = APIRouter(prefix="/api/meetings", tags=["meetings"])


def _generate_code() -> str:
    alphabet = string.ascii_lowercase
    groups = [
        "".join(secrets.choice(alphabet) for _ in range(3)),
        "".join(secrets.choice(alphabet) for _ in range(4)),
        "".join(secrets.choice(alphabet) for _ in range(3)),
    ]
    return "-".join(groups)


@router.post("", response_model=MeetingOut, status_code=201)
def create_meeting(
    data: MeetingCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    for _ in range(5):
        code = _generate_code()
        if not db.scalar(select(Meeting).where(Meeting.code == code)):
            break
    else:
        raise HTTPException(status_code=500, detail="Could not allocate meeting code")
    meeting = Meeting(code=code, title=data.title or "Instant meeting", host_id=user.id)
    db.add(meeting)
    db.commit()
    db.refresh(meeting)
    return meeting


@router.get("/recent", response_model=list[MeetingOut])
def recent_meetings(
    db: Session = Depends(get_db), user: User = Depends(get_current_user)
):
    stmt = (
        select(Meeting)
        .where(Meeting.host_id == user.id)
        .order_by(desc(Meeting.created_at))
        .limit(10)
    )
    return db.scalars(stmt).all()


@router.get("/{code}", response_model=MeetingOut)
def get_meeting(
    code: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    meeting = db.scalar(select(Meeting).where(Meeting.code == code))
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")
    return meeting


@router.post("/{code}/end", response_model=MeetingOut)
def end_meeting(
    code: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    meeting = db.scalar(select(Meeting).where(Meeting.code == code))
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")
    if meeting.host_id != user.id:
        raise HTTPException(status_code=403, detail="Only host can end the meeting")
    meeting.is_active = False
    meeting.ended_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(meeting)
    return meeting
