from datetime import datetime
from pydantic import BaseModel, ConfigDict, Field


# ── Organization schemas ──────────────────────────────────────────────────

class OrgCreate(BaseModel):
    name: str = Field(max_length=200)
    slug: str = Field(max_length=100, pattern=r"^[a-z0-9]([a-z0-9-]*[a-z0-9])?$")


class OrgUpdate(BaseModel):
    name: str | None = Field(default=None, max_length=200)


class OrgOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    slug: str
    owner_id: int
    logo_url: str | None = None
    created_at: datetime
    member_count: int = 0


class OrgMemberOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int
    role: str
    joined_at: datetime
    user_name: str | None = None
    user_email: str | None = None
    avatar_color: str | None = None


class OrgInviteIn(BaseModel):
    email: str = Field(max_length=255)
    role: str = Field(default="member", pattern=r"^(admin|member)$")


# ── Notification schemas ──────────────────────────────────────────────────

class NotificationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    type: str
    title: str
    body: str | None = None
    data: str | None = None
    is_read: bool = False
    created_at: datetime


# ── Meeting invite schemas ────────────────────────────────────────────────

class MeetingInviteIn(BaseModel):
    emails: list[str] = Field(min_length=1, max_length=50)


class MeetingInviteOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    meeting_id: int
    inviter_id: int
    invitee_email: str
    status: str
    created_at: datetime
    meeting_code: str | None = None
    meeting_title: str | None = None
    inviter_name: str | None = None


# ── Dashboard / analytics schemas ────────────────────────────────────────

class DashboardStats(BaseModel):
    total_meetings: int = 0
    meetings_this_week: int = 0
    meetings_this_month: int = 0
    total_participants: int = 0
    total_duration_minutes: int = 0
    total_recordings: int = 0


class MeetingHistoryItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    code: str
    title: str
    host_id: int
    host_name: str | None = None
    is_active: bool
    scheduled_at: datetime | None = None
    created_at: datetime
    ended_at: datetime | None = None
    participant_count: int = 0
    duration_minutes: int | None = None
