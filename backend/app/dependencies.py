from __future__ import annotations

from collections.abc import AsyncGenerator

import structlog
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.redis import get_redis
from app.core.security import Role, decode_token

logger = structlog.get_logger(__name__)

_bearer = HTTPBearer(auto_error=True)


class CurrentUser:
    """Lightweight principal object extracted from a validated JWT."""

    def __init__(self, user_id: str, email: str, role: str) -> None:
        self.user_id = user_id
        self.email = email
        self.role = role

    def has_role(self, *roles: Role) -> bool:
        return Role(self.role) in roles


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(_bearer),
) -> CurrentUser:
    """Decode the Bearer JWT and return the current principal."""
    token = credentials.credentials
    try:
        payload = decode_token(token)
    except JWTError as exc:
        logger.warning("JWT decode failed", error=str(exc))
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if payload.get("type") != "access":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token is not an access token.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user_id: str | None = payload.get("sub")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token subject is missing.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return CurrentUser(
        user_id=user_id,
        email=payload.get("email", ""),
        role=payload.get("role", Role.viewer.value),
    )


def require_roles(*roles: Role):
    """Return a FastAPI dependency that enforces one of the given roles."""

    async def _check(current_user: CurrentUser = Depends(get_current_user)) -> CurrentUser:
        if not current_user.has_role(*roles):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Requires one of roles: {[r.value for r in roles]}",
            )
        return current_user

    return _check


# Re-export for convenience
__all__ = [
    "get_db",
    "get_redis",
    "get_current_user",
    "require_roles",
    "CurrentUser",
]
