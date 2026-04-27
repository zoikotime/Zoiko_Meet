from __future__ import annotations

from sqlalchemy import BigInteger, Column, DateTime, String, Text, text
from sqlalchemy.dialects.postgresql import ARRAY, UUID

from app.connect.shared.base import ConnectBase


class Message(ConnectBase):
    __tablename__ = "connect_messages"
    __table_args__ = {"extend_existing": True}

    # (id, created_at) is the composite PK on the partitioned table
    id = Column(UUID(as_uuid=False), primary_key=True)
    tenant_id = Column(String, nullable=False)
    conversation_id = Column(UUID(as_uuid=False), nullable=False)
    sender_id = Column(BigInteger, nullable=False)
    body = Column(Text, nullable=True)
    attachment_ids = Column(ARRAY(UUID(as_uuid=False)), nullable=False, default=list)
    reply_to_id = Column(UUID(as_uuid=False), nullable=True)
    status = Column(String, nullable=False, default="sent")
    correlation_id = Column(String, nullable=True)
    created_by = Column(BigInteger, nullable=False)
    created_at = Column(DateTime(timezone=True), primary_key=True, server_default=text("now()"))
    updated_at = Column(DateTime(timezone=True), server_default=text("now()"))


class MessageReceipt(ConnectBase):
    __tablename__ = "connect_message_receipts"
    __table_args__ = {"extend_existing": True}

    id = Column(UUID(as_uuid=False), primary_key=True)
    tenant_id = Column(String, nullable=False)
    conversation_id = Column(UUID(as_uuid=False), nullable=False)
    user_id = Column(BigInteger, nullable=False)
    last_read_id = Column(UUID(as_uuid=False), nullable=False)
    last_read_at = Column(DateTime(timezone=True), server_default=text("now()"))
    created_at = Column(DateTime(timezone=True), server_default=text("now()"))
    updated_at = Column(DateTime(timezone=True), server_default=text("now()"))
    correlation_id = Column(String, nullable=True)
