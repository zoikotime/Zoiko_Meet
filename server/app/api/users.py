from fastapi import APIRouter, Depends
from sqlalchemy import select, or_
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.user import User
from app.schemas.user import UserOut

router = APIRouter(prefix="/api/users", tags=["users"])


@router.get("", response_model=list[UserOut])
def list_users(
    q: str | None = None,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    stmt = select(User).where(User.id != user.id)
    if q:
        term = f"%{q.lower()}%"
        stmt = stmt.where(or_(User.email.ilike(term), User.name.ilike(term)))
    stmt = stmt.order_by(User.name).limit(50)
    return db.scalars(stmt).all()
