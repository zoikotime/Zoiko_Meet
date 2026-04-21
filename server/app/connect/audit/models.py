"""Append-only audit log. UPDATE/DELETE are blocked by a DB trigger — this
code can only INSERT.
"""
from __future__ import annotations

from sqlalchemy import BigInteger, Column, DateTime, String, text
from sqlalchemy.dialects.postgresql import JSONB, UUID

from app.connect.shared.base import ConnectBase


class AuditEvent(ConnectBase):
    __tablename__ = "connect_audit_events"
    __table_args__ = {"extend_existing": True}

    id = Column(UUID(as_uuid=False), primary_key=True)
    tenant_id = Column(String, nullable=False)
    type = Column(String, nullable=False)
    actor_user_id = Column(BigInteger, nullable=True)
    resource_type = Column(String, nullable=False)
    resource_id = Column(String, nullable=False)
    ip_address = Column(String, nullable=True)
    user_agent = Column(String, nullable=True)
    metadata_ = Column("metadata", JSONB, nullable=False, default=dict)
    correlation_id = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), primary_key=True, server_default=text("now()"))
