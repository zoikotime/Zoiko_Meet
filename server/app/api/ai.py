from pydantic import BaseModel, Field
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user
from app.core.ai import ai_chat, ai_summarize, ai_suggest_actions
from app.models.user import User

router = APIRouter(prefix="/api/ai", tags=["ai"])


class AIChatIn(BaseModel):
    messages: list[dict] = Field(min_length=1)
    meeting_context: dict | None = None


class AISummarizeIn(BaseModel):
    chat_log: list[dict] = Field(min_length=1)
    meeting_title: str = "Meeting"


class AISuggestIn(BaseModel):
    participants: list[dict] = []
    chat_messages: list[dict] = []
    meeting_duration_minutes: int = 0


@router.post("/chat")
def chat_with_ai(
    data: AIChatIn,
    user: User = Depends(get_current_user),
):
    response = ai_chat(
        messages=data.messages,
        user_name=user.name,
        user_email=user.email,
        meeting_context=data.meeting_context,
    )
    return {"response": response}


@router.post("/summarize")
def summarize_meeting(
    data: AISummarizeIn,
    user: User = Depends(get_current_user),
):
    summary = ai_summarize(
        chat_log=data.chat_log,
        meeting_title=data.meeting_title,
    )
    return {"summary": summary}


@router.post("/suggest")
def get_suggestions(
    data: AISuggestIn,
    user: User = Depends(get_current_user),
):
    suggestions = ai_suggest_actions(
        participants=data.participants,
        chat_messages=data.chat_messages,
        meeting_duration_minutes=data.meeting_duration_minutes,
    )
    return {"suggestions": suggestions}
