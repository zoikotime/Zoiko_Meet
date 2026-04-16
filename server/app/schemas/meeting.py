from datetime import datetime
from pydantic import BaseModel, ConfigDict, Field


class MeetingCreate(BaseModel):
    title: str = Field(default="Instant meeting", max_length=200)


class MeetingOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    code: str
    title: str
    host_id: int
    is_active: bool
    created_at: datetime
    ended_at: datetime | None = None


class JoinMeetingIn(BaseModel):
    code: str
