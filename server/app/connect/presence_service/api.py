from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session as DbSession

from app.connect.presence_service import service
from app.connect.shared.tenant import TenantContext, resolve_tenant
from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.user import User

router = APIRouter(prefix="/presence", tags=["connect.presence"])


def _ctx(user: User = Depends(get_current_user), db: DbSession = Depends(get_db)) -> TenantContext:
    return resolve_tenant(db, user)


@router.get("")
async def get_presence(
    user_ids: list[int] = Query(default=[]),
    ctx: TenantContext = Depends(_ctx),
):
    result = await service.get_presence(tenant_id=ctx.tenant_id, user_ids=user_ids)
    return {"presence": [{"user_id": uid, "status": s} for uid, s in result.items()]}
