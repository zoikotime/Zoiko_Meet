from __future__ import annotations

from datetime import datetime

from fastapi import APIRouter, Depends, Header, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session as DbSession

from app.connect.messaging_service import service
from app.connect.shared.errors import DomainError
from app.connect.shared.tenant import TenantContext, resolve_tenant
from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.user import User

router = APIRouter(prefix="/conversations/{conversation_id}/messages", tags=["connect.messaging"])


class SendMessageIn(BaseModel):
    body: str | None = None
    attachment_ids: list[str] = []
    reply_to_id: str | None = None


class MarkReadIn(BaseModel):
    last_read_id: str


def _ctx(user: User = Depends(get_current_user), db: DbSession = Depends(get_db)) -> TenantContext:
    return resolve_tenant(db, user)


def _to_http(e: DomainError) -> HTTPException:
    return HTTPException(status_code=e.status_code, detail={"code": e.code, "message": e.message, **e.details})


@router.post("", status_code=201)
async def send_message(
    conversation_id: str,
    data: SendMessageIn,
    idempotency_key: str | None = Header(default=None, alias="Idempotency-Key"),
    db: DbSession = Depends(get_db),
    ctx: TenantContext = Depends(_ctx),
):
    try:
        return await service.send_message(
            db, ctx,
            conversation_id=conversation_id,
            body=data.body,
            attachment_ids=data.attachment_ids,
            reply_to_id=data.reply_to_id,
            idempotency_key=idempotency_key,
        )
    except DomainError as e:
        raise _to_http(e) from e


@router.get("")
async def list_messages(
    conversation_id: str,
    limit: int = Query(50, ge=1, le=200),
    before: datetime | None = None,
    db: DbSession = Depends(get_db),
    ctx: TenantContext = Depends(_ctx),
):
    try:
        return await service.list_messages(
            db, ctx, conversation_id=conversation_id, limit=limit, before=before,
        )
    except DomainError as e:
        raise _to_http(e) from e


@router.post("/read", status_code=200)
async def mark_read(
    conversation_id: str,
    data: MarkReadIn,
    db: DbSession = Depends(get_db),
    ctx: TenantContext = Depends(_ctx),
):
    try:
        await service.mark_read(db, ctx, conversation_id=conversation_id, last_read_id=data.last_read_id)
    except DomainError as e:
        raise _to_http(e) from e
    return {"ok": True}
