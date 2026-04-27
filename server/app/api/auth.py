from fastapi import APIRouter, Depends, Header, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user
from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_password,
    verify_password,
    blacklist_token,
    validate_password_strength,
)
from app.models.user import User
from app.schemas.user import TokenOut, UserCreate, UserOut

router = APIRouter(prefix="/api/auth", tags=["auth"])

AVATAR_COLORS = ["#5b8def", "#f27167", "#47b881", "#d97706", "#8b5cf6", "#ec4899", "#0ea5e9"]


def _pick_color(email: str) -> str:
    return AVATAR_COLORS[hash(email) % len(AVATAR_COLORS)]


class RefreshIn(BaseModel):
    refresh_token: str


class PasswordChangeIn(BaseModel):
    current_password: str
    new_password: str = Field(min_length=8, max_length=128)


class ProfileUpdateIn(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=120)


@router.post("/register", response_model=TokenOut, status_code=status.HTTP_201_CREATED)
def register(data: UserCreate, db: Session = Depends(get_db)):
    # Validate password strength
    pw_err = validate_password_strength(data.password)
    if pw_err:
        raise HTTPException(status_code=400, detail=pw_err)

    existing = db.scalar(select(User).where(User.email == data.email.lower()))
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    user = User(
        email=data.email.lower(),
        name=data.name.strip(),
        password_hash=hash_password(data.password),
        avatar_color=_pick_color(data.email.lower()),
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    access = create_access_token(subject=user.id)
    refresh = create_refresh_token(subject=user.id)
    return TokenOut(
        access_token=access,
        refresh_token=refresh,
        user=UserOut.model_validate(user),
    )


@router.post("/login", response_model=TokenOut)
def login(form: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.scalar(select(User).where(User.email == form.username.lower()))
    if not user or not verify_password(form.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Incorrect email or password")
    access = create_access_token(subject=user.id)
    refresh = create_refresh_token(subject=user.id)
    return TokenOut(
        access_token=access,
        refresh_token=refresh,
        user=UserOut.model_validate(user),
    )


@router.post("/refresh", response_model=TokenOut)
def refresh_token(data: RefreshIn, db: Session = Depends(get_db)):
    user_id = decode_token(data.refresh_token, expected_type="refresh")
    if user_id is None:
        raise HTTPException(status_code=401, detail="Invalid or expired refresh token")
    user = db.get(User, int(user_id))
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    # Blacklist old refresh token (single-use rotation)
    blacklist_token(data.refresh_token)
    access = create_access_token(subject=user.id)
    refresh = create_refresh_token(subject=user.id)
    return TokenOut(
        access_token=access,
        refresh_token=refresh,
        user=UserOut.model_validate(user),
    )


@router.post("/logout", status_code=204)
def logout(authorization: str = Header(default="")):
    """Blacklist the current access token so it can't be reused."""
    token = authorization.replace("Bearer ", "").strip()
    if token:
        blacklist_token(token)


@router.get("/me", response_model=UserOut)
def me(user: User = Depends(get_current_user)):
    return user


@router.post("/change-password", status_code=200)
def change_password(
    data: PasswordChangeIn,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not verify_password(data.current_password, user.password_hash):
        raise HTTPException(status_code=403, detail="Current password is incorrect")
    pw_err = validate_password_strength(data.new_password)
    if pw_err:
        raise HTTPException(status_code=400, detail=pw_err)
    user.password_hash = hash_password(data.new_password)
    db.commit()
    return {"detail": "Password changed successfully"}


@router.patch("/profile", response_model=UserOut)
def update_profile(
    data: ProfileUpdateIn,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if data.name is not None:
        user.name = data.name.strip()
    db.commit()
    db.refresh(user)
    return user


@router.delete("/account", status_code=204)
def delete_account(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    authorization: str = Header(default=""),
):
    """Permanently delete the current user's account."""
    token = authorization.replace("Bearer ", "").strip()
    if token:
        blacklist_token(token)
    db.delete(user)
    db.commit()
