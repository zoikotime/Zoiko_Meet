"""Admin-only dashboard endpoints — system-wide stats, user management, monitoring."""
from datetime import datetime, timezone, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, func, desc
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.user import User
from app.models.meeting import Meeting, MeetingParticipant, MeetingRecording
from app.models.organization import Organization, Notification

router = APIRouter(prefix="/api/admin", tags=["admin"])

# For now, admin = first registered user (id == 1). Replace with a proper
# role column in production.
ADMIN_USER_IDS = {1}


def _require_admin(user: User):
    if user.id not in ADMIN_USER_IDS:
        raise HTTPException(status_code=403, detail="Admin access required")


# ── System-wide stats ─────────────────────────────────────────────────────

@router.get("/stats")
def system_stats(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    _require_admin(user)
    now = datetime.now(timezone.utc)
    week_ago = now - timedelta(days=7)
    month_ago = now - timedelta(days=30)

    total_users = db.scalar(select(func.count()).select_from(User)) or 0
    users_this_week = db.scalar(
        select(func.count()).where(User.created_at >= week_ago)
    ) or 0
    total_meetings = db.scalar(select(func.count()).select_from(Meeting)) or 0
    meetings_this_week = db.scalar(
        select(func.count()).where(Meeting.created_at >= week_ago)
    ) or 0
    meetings_this_month = db.scalar(
        select(func.count()).where(Meeting.created_at >= month_ago)
    ) or 0
    active_meetings = db.scalar(
        select(func.count()).where(Meeting.is_active == True)  # noqa: E712
    ) or 0
    total_recordings = db.scalar(select(func.count()).select_from(MeetingRecording)) or 0
    total_orgs = db.scalar(select(func.count()).select_from(Organization)) or 0
    total_participants = db.scalar(select(func.count()).select_from(MeetingParticipant)) or 0

    return {
        "total_users": total_users,
        "users_this_week": users_this_week,
        "total_meetings": total_meetings,
        "meetings_this_week": meetings_this_week,
        "meetings_this_month": meetings_this_month,
        "active_meetings": active_meetings,
        "total_recordings": total_recordings,
        "total_organizations": total_orgs,
        "total_participants_joined": total_participants,
    }


# ── User management ──────────────────────────────────────────────────────

@router.get("/users")
def list_users(
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=50, le=200),
    search: str = Query(default=""),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    _require_admin(user)
    offset = (page - 1) * limit
    stmt = select(User)
    if search:
        stmt = stmt.where(
            User.name.ilike(f"%{search}%") | User.email.ilike(f"%{search}%")
        )
    stmt = stmt.order_by(desc(User.created_at)).offset(offset).limit(limit)
    users = db.scalars(stmt).all()

    result = []
    for u in users:
        meeting_count = db.scalar(
            select(func.count()).where(Meeting.host_id == u.id)
        ) or 0
        result.append({
            "id": u.id,
            "email": u.email,
            "name": u.name,
            "avatar_color": u.avatar_color,
            "created_at": u.created_at.isoformat() if u.created_at else None,
            "meeting_count": meeting_count,
            "is_admin": u.id in ADMIN_USER_IDS,
        })
    return result


@router.delete("/users/{user_id}", status_code=204)
def delete_user(
    user_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    _require_admin(user)
    if user_id == user.id:
        raise HTTPException(status_code=400, detail="Cannot delete your own admin account")
    target = db.get(User, user_id)
    if not target:
        raise HTTPException(status_code=404, detail="User not found")
    db.delete(target)
    db.commit()


# ── Recent meetings (system-wide) ────────────────────────────────────────

@router.get("/meetings")
def list_meetings(
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=50, le=200),
    active_only: bool = False,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    _require_admin(user)
    offset = (page - 1) * limit
    stmt = select(Meeting)
    if active_only:
        stmt = stmt.where(Meeting.is_active == True)  # noqa: E712
    stmt = stmt.order_by(desc(Meeting.created_at)).offset(offset).limit(limit)
    meetings = db.scalars(stmt).all()

    result = []
    for m in meetings:
        host = db.get(User, m.host_id)
        p_count = db.scalar(
            select(func.count()).where(MeetingParticipant.meeting_id == m.id)
        ) or 0
        result.append({
            "id": m.id,
            "code": m.code,
            "title": m.title,
            "host_name": host.name if host else "Unknown",
            "host_email": host.email if host else "",
            "is_active": m.is_active,
            "locked": m.locked,
            "password_protected": m.password_hash is not None,
            "waiting_room_enabled": m.waiting_room_enabled,
            "participant_count": p_count,
            "scheduled_at": m.scheduled_at.isoformat() if m.scheduled_at else None,
            "created_at": m.created_at.isoformat() if m.created_at else None,
            "ended_at": m.ended_at.isoformat() if m.ended_at else None,
        })
    return result


# ── Activity feed ─────────────────────────────────────────────────────────

@router.get("/activity")
def activity_feed(
    limit: int = Query(default=30, le=100),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    _require_admin(user)

    # Recent user signups
    recent_users = db.scalars(
        select(User).order_by(desc(User.created_at)).limit(limit)
    ).all()

    # Recent meetings
    recent_meetings = db.scalars(
        select(Meeting).order_by(desc(Meeting.created_at)).limit(limit)
    ).all()

    events = []
    for u in recent_users:
        events.append({
            "type": "user_signup",
            "message": f"{u.name} signed up",
            "email": u.email,
            "timestamp": u.created_at.isoformat() if u.created_at else None,
        })
    for m in recent_meetings:
        host = db.get(User, m.host_id)
        events.append({
            "type": "meeting_created",
            "message": f"{host.name if host else 'Unknown'} created \"{m.title}\"",
            "code": m.code,
            "timestamp": m.created_at.isoformat() if m.created_at else None,
        })

    events.sort(key=lambda e: e.get("timestamp", ""), reverse=True)
    return events[:limit]
