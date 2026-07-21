from __future__ import annotations

import enum
from datetime import datetime, timedelta, timezone
from typing import Any

from jose import JWTError, jwt
from passlib.context import CryptContext

from app.config import settings

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


class Role(str, enum.Enum):
    admin = "admin"
    ai_engineer = "ai_engineer"
    reviewer = "reviewer"
    operator = "operator"
    viewer = "viewer"


def hash_password(plain: str) -> str:
    """Return the bcrypt hash of a plaintext password."""
    return pwd_context.hash(plain)


def verify_password(plain: str, hashed: str) -> bool:
    """Return True if the plaintext matches the hash."""
    return pwd_context.verify(plain, hashed)


def _build_token(
    subject: str,
    extra_claims: dict[str, Any],
    expire_delta: timedelta,
) -> str:
    now = datetime.now(tz=timezone.utc)
    payload: dict[str, Any] = {
        "sub": subject,
        "iat": now,
        "exp": now + expire_delta,
        **extra_claims,
    }
    return jwt.encode(payload, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)


def create_access_token(user_id: str, role: str, email: str) -> str:
    """Create a short-lived JWT access token."""
    return _build_token(
        subject=user_id,
        extra_claims={"role": role, "email": email, "type": "access"},
        expire_delta=timedelta(minutes=settings.JWT_EXPIRE_MINUTES),
    )


def create_refresh_token(user_id: str) -> str:
    """Create a long-lived JWT refresh token."""
    return _build_token(
        subject=user_id,
        extra_claims={"type": "refresh"},
        expire_delta=timedelta(days=settings.JWT_REFRESH_EXPIRE_DAYS),
    )


def decode_token(token: str) -> dict[str, Any]:
    """Decode and validate a JWT, raising JWTError on failure."""
    try:
        payload: dict[str, Any] = jwt.decode(
            token,
            settings.JWT_SECRET,
            algorithms=[settings.JWT_ALGORITHM],
        )
        return payload
    except JWTError as exc:
        raise exc
