"""Outbox pattern — events are persisted transactionally with domain state.

A separate dispatcher process (see ops/outbox_dispatcher.py) reads rows where
`dispatched_at IS NULL`, publishes to Pub/Sub, and stamps `dispatched_at`.
This guarantees at-least-once delivery even if the service crashes between
the DB commit and the network publish.
"""
from __future__ import annotations

import json

from sqlalchemy import Column, DateTime, Integer, String, Text, text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Session

from app.connect.shared.envelope import EventEnvelope
from app.connect.shared.base import ConnectBase


class OutboxEvent(ConnectBase):
    """SQLAlchemy view of connect_outbox (partitioned table).

    DDL lives in migrations/connect_v3_001_init.sql — SQLAlchemy only writes
    to this table, it doesn't manage its lifecycle.
    """
    __tablename__ = "connect_outbox"
    __table_args__ = {"extend_existing": True}

    id = Column(UUID(as_uuid=False), primary_key=True)
    tenant_id = Column(String, nullable=False)
    type = Column(String, nullable=False)
    version = Column(Integer, nullable=False, default=1)
    correlation_id = Column(String, nullable=True)
    payload = Column(JSONB, nullable=False)
    dispatched_at = Column(DateTime(timezone=True), nullable=True)
    attempts = Column(Integer, nullable=False, default=0)
    last_error = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), primary_key=True, server_default=text("now()"))


def enqueue(db: Session, env: EventEnvelope) -> None:
    """Persist an event to the outbox in the current transaction.

    MUST be called inside the same `db.commit()` boundary as the domain
    mutation that produced it — that's the whole point of the outbox.
    """
    row = OutboxEvent(
        id=env.id,
        tenant_id=env.tenant_id,
        type=env.type,
        version=env.version,
        correlation_id=env.correlation_id,
        payload=json.loads(env.model_dump_json()),
    )
    db.add(row)
