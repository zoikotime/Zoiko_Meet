"""Event envelope — the only shape that crosses service boundaries.

Spec §8: `{id, type, version, tenant_id, correlation_id, payload, emitted_at}`.
All connect_* events are persisted to the outbox with this envelope and
dispatched to Pub/Sub topics keyed by `type`.
"""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from pydantic import BaseModel, Field

from app.connect.shared.ids import uuid7_str


class EventEnvelope(BaseModel):
    id: str = Field(default_factory=uuid7_str)
    type: str                          # e.g. "message.sent"
    version: int = 1
    tenant_id: str
    correlation_id: str | None = None
    causation_id: str | None = None
    actor_user_id: int | None = None
    payload: dict[str, Any]
    emitted_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    def as_pubsub_message(self) -> dict[str, Any]:
        return self.model_dump(mode="json")
