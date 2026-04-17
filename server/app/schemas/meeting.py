from datetime import datetime
from pydantic import BaseModel, ConfigDict, Field


class MeetingCreate(BaseModel):
    title: str = Field(default="Instant meeting", max_length=200)
    scheduled_at: datetime | None = None
    timezone_name: str | None = Field(default=None, max_length=64)
    waiting_room_enabled: bool = True


class MeetingUpdate(BaseModel):
    title: str | None = Field(default=None, max_length=200)
    scheduled_at: datetime | None = None
    timezone_name: str | None = Field(default=None, max_length=64)
    waiting_room_enabled: bool | None = None
    locked: bool | None = None


class MeetingOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    code: str
    title: str
    host_id: int
    is_active: bool
    scheduled_at: datetime | None = None
    timezone_name: str | None = None
    waiting_room_enabled: bool = True
    locked: bool = False
    created_at: datetime
    ended_at: datetime | None = None


class ParticipantOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int
    role: str
    status: str
    joined_at: datetime
    left_at: datetime | None = None


class MeetingRoster(BaseModel):
    """Richer view used by the in-meeting host panel — adds user names/colors so
    the client doesn't have to cross-reference another endpoint."""

    meeting: MeetingOut
    participants: list[dict]


class JoinMeetingIn(BaseModel):
    code: str


class ParticipantActionIn(BaseModel):
    user_id: int
