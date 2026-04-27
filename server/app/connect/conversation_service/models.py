from __future__ import annotations

from sqlalchemy import BigInteger, Column, DateTime, String, text
from sqlalchemy.dialects.postgresql import UUID

from app.connect.shared.base import ConnectBase


class Conversation(ConnectBase):
    __tablename__ = "connect_conversations"
    __table_args__ = {"extend_existing": True}

    id = Column(UUID(as_uuid=False), primary_key=True)
    tenant_id = Column(String, nullable=False)
    kind = Column(String, nullable=False)        # direct|group|channel
    name = Column(String, nullable=True)
    topic = Column(String, nullable=True)
    created_by = Column(BigInteger, nullable=False)
    status = Column(String, nullable=False, default="active")
    correlation_id = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=text("now()"))
    updated_at = Column(DateTime(timezone=True), server_default=text("now()"))


class ConversationMember(ConnectBase):
    __tablename__ = "connect_conversation_members"
    __table_args__ = {"extend_existing": True}

    id = Column(UUID(as_uuid=False), primary_key=True)
    conversation_id = Column(UUID(as_uuid=False), nullable=False)
    tenant_id = Column(String, nullable=False)
    user_id = Column(BigInteger, nullable=False)
    role = Column(String, nullable=False, default="member")
    status = Column(String, nullable=False, default="active")
    joined_at = Column(DateTime(timezone=True), server_default=text("now()"))
    created_by = Column(BigInteger, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=text("now()"))
    updated_at = Column(DateTime(timezone=True), server_default=text("now()"))
    correlation_id = Column(String, nullable=True)
