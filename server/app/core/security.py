import secrets
import threading
from datetime import datetime, timedelta, timezone
from typing import Optional

from jose import JWTError, jwt
from passlib.context import CryptContext

from app.core.config import get_settings

settings = get_settings()
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# In-memory token blacklist (jti → expiry timestamp).
# In production this should be backed by Redis or a DB table.
_blacklist: dict[str, float] = {}
_blacklist_lock = threading.Lock()


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


def create_access_token(subject: str, expires_delta: Optional[timedelta] = None) -> str:
    now = datetime.now(timezone.utc)
    expire = now + (expires_delta or timedelta(minutes=settings.access_token_expire_minutes))
    jti = secrets.token_hex(16)
    payload = {
        "sub": str(subject),
        "exp": expire,
        "iat": now,
        "jti": jti,
        "type": "access",
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def create_refresh_token(subject: str) -> str:
    now = datetime.now(timezone.utc)
    expire = now + timedelta(days=30)
    jti = secrets.token_hex(16)
    payload = {
        "sub": str(subject),
        "exp": expire,
        "iat": now,
        "jti": jti,
        "type": "refresh",
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def decode_token(token: str, expected_type: str = "access") -> Optional[str]:
    try:
        payload = jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
        # Check token type
        if payload.get("type", "access") != expected_type:
            return None
        # Check blacklist
        jti = payload.get("jti")
        if jti and is_blacklisted(jti):
            return None
        return payload.get("sub")
    except JWTError:
        return None


def blacklist_token(token: str) -> None:
    """Add a token's jti to the blacklist until it expires."""
    try:
        payload = jwt.decode(
            token, settings.jwt_secret,
            algorithms=[settings.jwt_algorithm],
            options={"verify_exp": False},
        )
        jti = payload.get("jti")
        exp = payload.get("exp", 0)
        if jti:
            with _blacklist_lock:
                _blacklist[jti] = exp
    except JWTError:
        pass


def is_blacklisted(jti: str) -> bool:
    with _blacklist_lock:
        return jti in _blacklist


def cleanup_blacklist() -> None:
    """Remove expired entries from the blacklist."""
    now = datetime.now(timezone.utc).timestamp()
    with _blacklist_lock:
        expired = [jti for jti, exp in _blacklist.items() if exp < now]
        for jti in expired:
            del _blacklist[jti]


def validate_password_strength(password: str) -> str | None:
    """Return an error message if the password is too weak, else None."""
    if len(password) < 8:
        return "Password must be at least 8 characters"
    has_upper = any(c.isupper() for c in password)
    has_lower = any(c.islower() for c in password)
    has_digit = any(c.isdigit() for c in password)
    if not (has_upper and has_lower and has_digit):
        return "Password must contain uppercase, lowercase, and a digit"
    return None
