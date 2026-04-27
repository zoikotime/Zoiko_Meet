"""REST facade for Session Service. Thin: parse → call service → serialize."""
from __future__ import annotations

from datetime import datetime
from typing import Literal

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session as DbSession

from app.connect.session_service import service
from app.connect.shared.errors import DomainError
from app.connect.shared.tenant import TenantContext, resolve_tenant
from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.user import User

from fastapi import HTTPException

router = APIRouter(prefix="/sessions", tags=["connect.session"])


class CreateSessionIn(BaseModel):
    kind: Literal["1to1", "group", "webinar"]
    title: str | None = None
    scheduled_start_at: datetime | None = None


class SessionOut(BaseModel):
    id: str
    tenant_id: str
    kind: str
    title: str | None
    host_id: int
    status: str
    started_at: datetime | None
    ended_at: datetime | None
    media_room_ref: str | None


def _to_out(s) -> SessionOut:
    return SessionOut(
        id=s.id, tenant_id=s.tenant_id, kind=s.kind, title=s.title,
        host_id=s.host_id, status=s.status,
        started_at=s.started_at, ended_at=s.ended_at,
        media_room_ref=s.media_room_ref,
    )


def _ctx(user: User = Depends(get_current_user), db: DbSession = Depends(get_db)) -> TenantContext:
    return resolve_tenant(db, user)


def _to_http(e: DomainError) -> HTTPException:
    return HTTPException(status_code=e.status_code, detail={"code": e.code, "message": e.message, **e.details})


@router.post("", response_model=SessionOut, status_code=201)
async def create_session(
    data: CreateSessionIn,
    db: DbSession = Depends(get_db),
    ctx: TenantContext = Depends(_ctx),
):
    try:
        s = await service.create_session(
            db, ctx, kind=data.kind, title=data.title,
            scheduled_start_at=data.scheduled_start_at,
        )
    except DomainError as e:
        raise _to_http(e) from e
    return _to_out(s)


@router.post("/{session_id}/start", response_model=SessionOut)
async def start_session(
    session_id: str,
    db: DbSession = Depends(get_db),
    ctx: TenantContext = Depends(_ctx),
):
    try:
        s = await service.start_session(db, ctx, session_id=session_id)
    except DomainError as e:
        raise _to_http(e) from e
    return _to_out(s)


@router.post("/{session_id}/join", status_code=200)
async def join_session(
    session_id: str,
    db: DbSession = Depends(get_db),
    ctx: TenantContext = Depends(_ctx),
):
    try:
        member = await service.join_session(db, ctx, session_id=session_id)
    except DomainError as e:
        raise _to_http(e) from e
    return {"session_id": session_id, "user_id": member.user_id, "status": member.status}


@router.post("/{session_id}/leave", status_code=200)
async def leave_session(
    session_id: str,
    db: DbSession = Depends(get_db),
    ctx: TenantContext = Depends(_ctx),
):
    try:
        await service.leave_session(db, ctx, session_id=session_id)
    except DomainError as e:
        raise _to_http(e) from e
    return {"ok": True}


@router.post("/{session_id}/end", response_model=SessionOut)
async def end_session(
    session_id: str,
    db: DbSession = Depends(get_db),
    ctx: TenantContext = Depends(_ctx),
):
    try:
        s = await service.end_session(db, ctx, session_id=session_id)
    except DomainError as e:
        raise _to_http(e) from e
    return _to_out(s)


@router.get("/{session_id}", response_model=SessionOut)
def get_session(
    session_id: str,
    db: DbSession = Depends(get_db),
    ctx: TenantContext = Depends(_ctx),
):
    try:
        s = service.get_session(db, ctx, session_id)
    except DomainError as e:
        raise _to_http(e) from e
    return _to_out(s)
