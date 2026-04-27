from datetime import datetime, timezone, timedelta

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select, func, desc, or_, and_, extract
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.user import User
from app.models.meeting import Meeting, MeetingParticipant, MeetingRecording
from app.schemas.organization import DashboardStats, MeetingHistoryItem

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])


@router.get("/stats", response_model=DashboardStats)
def get_stats(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    now = datetime.now(timezone.utc)
    week_ago = now - timedelta(days=7)
    month_ago = now - timedelta(days=30)

    # Meetings where user is host or participant
    user_meeting_ids = (
        select(Meeting.id).where(Meeting.host_id == user.id)
        .union(
            select(MeetingParticipant.meeting_id).where(
                MeetingParticipant.user_id == user.id
            )
        )
    ).subquery()

    total_meetings = db.scalar(
        select(func.count()).select_from(
            select(Meeting.id).where(Meeting.id.in_(select(user_meeting_ids))).subquery()
        )
    ) or 0

    meetings_this_week = db.scalar(
        select(func.count()).where(
            Meeting.id.in_(select(user_meeting_ids)),
            Meeting.created_at >= week_ago,
        )
    ) or 0

    meetings_this_month = db.scalar(
        select(func.count()).where(
            Meeting.id.in_(select(user_meeting_ids)),
            Meeting.created_at >= month_ago,
        )
    ) or 0

    total_participants = db.scalar(
        select(func.count()).where(
            MeetingParticipant.meeting_id.in_(
                select(Meeting.id).where(Meeting.host_id == user.id)
            )
        )
    ) or 0

    # Total duration from ended meetings (in minutes)
    ended_meetings = db.scalars(
        select(Meeting).where(
            Meeting.id.in_(select(user_meeting_ids)),
            Meeting.ended_at.is_not(None),
        )
    ).all()

    total_duration_minutes = 0
    for m in ended_meetings:
        if m.ended_at and m.created_at:
            delta = m.ended_at - m.created_at
            total_duration_minutes += int(delta.total_seconds() / 60)

    total_recordings = db.scalar(
        select(func.count()).where(MeetingRecording.user_id == user.id)
    ) or 0

    return DashboardStats(
        total_meetings=total_meetings,
        meetings_this_week=meetings_this_week,
        meetings_this_month=meetings_this_month,
        total_participants=total_participants,
        total_duration_minutes=total_duration_minutes,
        total_recordings=total_recordings,
    )


@router.get("/history", response_model=list[MeetingHistoryItem])
def meeting_history(
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=20, le=100),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    offset = (page - 1) * limit

    # All meetings where user participated or hosted
    user_meeting_ids = (
        select(Meeting.id).where(Meeting.host_id == user.id)
        .union(
            select(MeetingParticipant.meeting_id).where(
                MeetingParticipant.user_id == user.id
            )
        )
    ).subquery()

    meetings = db.scalars(
        select(Meeting)
        .where(Meeting.id.in_(select(user_meeting_ids)))
        .order_by(desc(Meeting.created_at))
        .offset(offset)
        .limit(limit)
    ).all()

    result = []
    for m in meetings:
        host = db.get(User, m.host_id)
        participant_count = db.scalar(
            select(func.count()).where(MeetingParticipant.meeting_id == m.id)
        ) or 0

        duration_minutes = None
        if m.ended_at and m.created_at:
            duration_minutes = int((m.ended_at - m.created_at).total_seconds() / 60)

        result.append({
            "id": m.id,
            "code": m.code,
            "title": m.title,
            "host_id": m.host_id,
            "host_name": host.name if host else None,
            "is_active": m.is_active,
            "scheduled_at": m.scheduled_at,
            "created_at": m.created_at,
            "ended_at": m.ended_at,
            "participant_count": participant_count,
            "duration_minutes": duration_minutes,
        })

    return result


@router.get("/upcoming")
def upcoming_meetings(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Get upcoming scheduled meetings for the current user."""
    now = datetime.now(timezone.utc)

    meetings = db.scalars(
        select(Meeting)
        .where(
            Meeting.host_id == user.id,
            Meeting.scheduled_at.is_not(None),
            Meeting.scheduled_at > now,
            Meeting.is_active == True,  # noqa: E712
        )
        .order_by(Meeting.scheduled_at)
        .limit(10)
    ).all()

    result = []
    for m in meetings:
        result.append({
            "id": m.id,
            "code": m.code,
            "title": m.title,
            "scheduled_at": m.scheduled_at.isoformat() if m.scheduled_at else None,
            "timezone_name": m.timezone_name,
        })
    return result
