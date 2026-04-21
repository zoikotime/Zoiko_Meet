from __future__ import annotations

from typing import Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session as DbSession

from app.connect.conversation_service import service
from app.connect.shared.errors import DomainError
from app.connect.shared.tenant import TenantContext, resolve_tenant
from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.user import User

router = APIRouter(prefix="/conversations", tags=["connect.conversation"])


class CreateConversationIn(BaseModel):
    kind: Literal["direct", "group", "channel"]
    name: str | None = None
    member_user_ids: list[int] = []


class AddMemberIn(BaseModel):
    user_id: int
    role: Literal["owner", "admin", "member", "guest"] = "member"


def _ctx(user: User = Depends(get_current_user), db: DbSession = Depends(get_db)) -> TenantContext:
    return resolve_tenant(db, user)


def _to_http(e: DomainError) -> HTTPException:
    return HTTPException(status_code=e.status_code, detail={"code": e.code, "message": e.message, **e.details})


@router.post("", status_code=201)
async def create_conversation(
    data: CreateConversationIn,
    db: DbSession = Depends(get_db),
    ctx: TenantContext = Depends(_ctx),
):
    try:
        c = await service.create_conversation(
            db, ctx, kind=data.kind, name=data.name, member_user_ids=data.member_user_ids,
        )
    except DomainError as e:
        raise _to_http(e) from e
    return {"id": c.id, "kind": c.kind, "name": c.name, "status": c.status}


@router.get("")
def list_my_conversations(
    db: DbSession = Depends(get_db),
    ctx: TenantContext = Depends(_ctx),
):
    return service.list_my_conversations(db, ctx)


@router.post("/{conversation_id}/members", status_code=201)
async def add_member(
    conversation_id: str,
    data: AddMemberIn,
    db: DbSession = Depends(get_db),
    ctx: TenantContext = Depends(_ctx),
):
    try:
        m = await service.add_member(db, ctx, conversation_id=conversation_id,
                                     user_id=data.user_id, role=data.role)
    except DomainError as e:
        raise _to_http(e) from e
    return {"id": m.id, "user_id": m.user_id, "role": m.role, "status": m.status}
