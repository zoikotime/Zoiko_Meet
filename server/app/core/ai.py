"""AI assistant service powered by Anthropic Claude."""
import json
import logging
from datetime import datetime, timezone

from app.core.config import get_settings

log = logging.getLogger(__name__)

SYSTEM_PROMPT = """You are Zoiko, the AI assistant built into Zoiko sema — a real-time SaaS video conferencing and team chat platform.

Your capabilities:
- Answer questions about Zoiko sema features (meetings, chat, recordings, screen sharing, whiteboard, etc.)
- Help users create, join, and manage meetings
- Summarize meeting discussions from chat logs
- Generate meeting notes and action items
- Suggest meeting best practices (muting, camera usage, etc.)
- Assist hosts with participant management tips
- Provide real-time intelligent suggestions

Keep responses concise, professional, and helpful. Use markdown formatting when appropriate.
When asked to summarize or generate notes, structure them clearly with headings and bullet points.

Current date/time: {current_time}
User: {user_name} ({user_email})
"""


def _get_client():
    """Lazy-import anthropic to avoid startup crash if not installed."""
    try:
        import anthropic
        settings = get_settings()
        if not settings.anthropic_api_key:
            return None
        return anthropic.Anthropic(api_key=settings.anthropic_api_key)
    except ImportError:
        log.warning("anthropic package not installed — AI features disabled")
        return None


def ai_chat(
    messages: list[dict],
    user_name: str = "User",
    user_email: str = "",
    meeting_context: dict | None = None,
) -> str:
    """Send a conversation to the AI and return the response text.

    messages: list of {"role": "user"|"assistant", "content": "..."}
    meeting_context: optional dict with meeting_code, title, participants, chat_log
    """
    client = _get_client()
    if not client:
        return "AI assistant is not configured. Please set your `ANTHROPIC_API_KEY` in the server environment."

    settings = get_settings()
    now = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")

    system = SYSTEM_PROMPT.format(
        current_time=now,
        user_name=user_name,
        user_email=user_email,
    )

    if meeting_context:
        system += "\n\nCurrent meeting context:\n"
        if meeting_context.get("meeting_code"):
            system += f"- Meeting code: {meeting_context['meeting_code']}\n"
        if meeting_context.get("title"):
            system += f"- Title: {meeting_context['title']}\n"
        if meeting_context.get("participants"):
            system += f"- Participants: {', '.join(meeting_context['participants'])}\n"
        if meeting_context.get("chat_log"):
            system += f"\nRecent chat log:\n{meeting_context['chat_log']}\n"

    try:
        response = client.messages.create(
            model=settings.ai_model,
            max_tokens=1024,
            system=system,
            messages=messages,
        )
        return response.content[0].text
    except Exception as e:
        log.exception("AI chat error")
        return f"Sorry, I encountered an error: {str(e)}"


def ai_summarize(chat_log: list[dict], meeting_title: str = "Meeting") -> str:
    """Generate a meeting summary from chat messages."""
    if not chat_log:
        return "No chat messages to summarize."

    formatted = "\n".join(
        f"[{m.get('time', '')}] {m.get('name', 'Unknown')}: {m.get('body', '')}"
        for m in chat_log
    )

    messages = [{
        "role": "user",
        "content": (
            f"Please summarize this meeting chat log from \"{meeting_title}\".\n"
            f"Provide:\n"
            f"1. A brief summary (2-3 sentences)\n"
            f"2. Key discussion points\n"
            f"3. Action items (if any)\n"
            f"4. Decisions made (if any)\n\n"
            f"Chat log:\n{formatted}"
        ),
    }]

    return ai_chat(messages, user_name="System", user_email="system@zoikomeet.com")


def ai_suggest_replies(
    recent_messages: list[dict],
    my_name: str = "User",
    context: str | None = None,
) -> list[str]:
    """Return up to three short reply suggestions for the next message.
    recent_messages: list of {"name", "body"} ordered oldest -> newest.
    Falls back to an empty list if the AI client isn't configured."""
    client = _get_client()
    if not client or not recent_messages:
        return []

    settings = get_settings()
    convo = "\n".join(
        f"{m.get('name', 'Someone')}: {m.get('body', '')}"
        for m in recent_messages[-8:]
    )
    prompt = (
        f"You are helping {my_name} pick a quick reply to send next in a chat.\n"
        + (f"Channel context: {context}\n" if context else "")
        + "Read the last few messages and propose THREE short reply options "
        "(each <= 12 words, distinct in tone — e.g. acknowledge, clarify, decline). "
        "Return them as a JSON array of strings, no other text.\n\n"
        f"Conversation so far:\n{convo}"
    )
    try:
        response = client.messages.create(
            model=settings.ai_model,
            max_tokens=240,
            messages=[{"role": "user", "content": prompt}],
        )
        text = response.content[0].text.strip()
        # Strip markdown fences if the model wraps the JSON
        if text.startswith("```"):
            text = text.strip("`")
            if text.lower().startswith("json"):
                text = text[4:].strip()
        suggestions = json.loads(text)
        if isinstance(suggestions, list):
            return [str(s)[:140] for s in suggestions[:3]]
    except Exception:
        log.exception("ai_suggest_replies failed")
    return []


def ai_suggest_actions(
    participants: list[dict],
    chat_messages: list[dict],
    meeting_duration_minutes: int = 0,
) -> list[str]:
    """Generate smart suggestions for the host based on meeting state."""
    suggestions = []

    # Rule-based suggestions (no AI needed)
    muted_count = sum(1 for p in participants if not p.get("audio", True))
    total = len(participants)

    if total > 3 and muted_count < total * 0.5:
        suggestions.append("Consider asking participants to mute when not speaking to reduce background noise.")

    if meeting_duration_minutes > 60:
        suggestions.append("Meeting has been running for over an hour. Consider taking a short break.")

    if meeting_duration_minutes > 5 and len(chat_messages) == 0:
        suggestions.append("No chat activity yet. Encourage participants to use chat for questions.")

    hands_raised = [p.get("name", "Someone") for p in participants if p.get("hand")]
    if hands_raised:
        names = ", ".join(hands_raised[:3])
        suggestions.append(f"{names} {'has' if len(hands_raised) == 1 else 'have'} a hand raised.")

    inactive = [p for p in participants if not p.get("audio", True) and not p.get("video", True)]
    if len(inactive) > total * 0.5 and total > 2:
        suggestions.append("Most participants have both audio and video off. Consider checking if everyone is engaged.")

    return suggestions
