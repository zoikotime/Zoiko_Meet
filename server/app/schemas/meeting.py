from datetime import datetime
from pydantic import BaseModel, ConfigDict, Field


class MeetingCreate(BaseModel):
    title: str = Field(default="Instant meeting", max_length=200)
    scheduled_at: datetime | None = None
    timezone_name: str | None = Field(default=None, max_length=64)
    waiting_room_enabled: bool = True
    password: str | None = Field(default=None, max_length=128)


class MeetingUpdate(BaseModel):
    title: str | None = Field(default=None, max_length=200)
    scheduled_at: datetime | None = None
    timezone_name: str | None = Field(default=None, max_length=64)
    waiting_room_enabled: bool | None = None
    locked: bool | None = None
    chat_enabled: bool | None = None
    screenshare_enabled: bool | None = None


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
    chat_enabled: bool = True
    screenshare_enabled: bool = True
    password_protected: bool = False
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
    password: str | None = None


class ParticipantActionIn(BaseModel):
    user_id: int


# ── Recording schemas ──────────────────────────────────────────────────────

class RecordingOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    meeting_id: int
    user_id: int
    file_url: str | None = None
    file_name: str
    file_size: int | None = None
    duration: int | None = None
    includes_chat: bool = False
    chat_log_url: str | None = None
    status: str
    share_token: str | None = None
    created_at: datetime
    meeting_code: str | None = None
    meeting_title: str | None = None
    recorder_name: str | None = None


class RecordingShareOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    file_url: str | None = None
    file_name: str
    file_size: int | None = None
    duration: int | None = None
    includes_chat: bool = False
    chat_log_url: str | None = None
    status: str
    created_at: datetime
    meeting_title: str | None = None
    recorder_name: str | None = None
