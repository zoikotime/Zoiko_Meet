"""Mandatory audit logger.

Every control-plane mutation MUST call `audit.log(...)` in the same DB
transaction as the mutation. The DB trigger guarantees immutability after
commit — compliance depends on that invariant.
"""
from __future__ import annotations

from typing import Any

from sqlalchemy.orm import Session

from app.connect.audit.models import AuditEvent
from app.connect.shared.ids import uuid7_str
from app.connect.shared.telemetry import get_correlation_id


def log(
    db: Session,
    *,
    type: str,
    tenant_id: str,
    resource_type: str,
    resource_id: str,
    actor_user_id: int | None = None,
    ip_address: str | None = None,
    user_agent: str | None = None,
    metadata: dict[str, Any] | None = None,
) -> None:
    """Append an audit event. Must run inside the caller's transaction."""
    row = AuditEvent(
        id=uuid7_str(),
        tenant_id=tenant_id,
        type=type,
        actor_user_id=actor_user_id,
        resource_type=resource_type,
        resource_id=str(resource_id),
        ip_address=ip_address,
        user_agent=user_agent,
        metadata_=metadata or {},
        correlation_id=get_correlation_id(),
    )
    db.add(row)
