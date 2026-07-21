from __future__ import annotations

import uuid

import structlog
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.core.exceptions import ConflictError, UnauthorizedError
from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_password,
    verify_password,
)
from app.modules.auth.models import User
from app.modules.auth.schemas import LoginResponse, TokenResponse, UserOut

logger = structlog.get_logger(__name__)


class AuthService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def login(self, email: str, password: str) -> LoginResponse:
        """Authenticate user credentials and return token pair + user info."""
        result = await self.db.execute(select(User).where(User.email == email))
        user: User | None = result.scalar_one_or_none()

        if user is None or not verify_password(password, user.hashed_password):
            logger.warning("Failed login attempt", email=email)
            raise UnauthorizedError("Invalid email or password.")

        if not user.is_active:
            raise UnauthorizedError("Account is disabled.")

        access_token = create_access_token(
            user_id=str(user.id),
            role=user.role,
            email=user.email,
        )
        refresh_token = create_refresh_token(user_id=str(user.id))

        logger.info("User logged in", user_id=str(user.id), email=email)

        return LoginResponse(
            user=UserOut.model_validate(user),
            tokens=TokenResponse(
                access_token=access_token,
                refresh_token=refresh_token,
                expires_in=settings.JWT_EXPIRE_MINUTES * 60,
            ),
        )

    async def refresh(self, refresh_token: str) -> TokenResponse:
        """Validate a refresh token and return a new access token."""
        from jose import JWTError

        try:
            payload = decode_token(refresh_token)
        except JWTError:
            raise UnauthorizedError("Invalid or expired refresh token.")

        if payload.get("type") != "refresh":
            raise UnauthorizedError("Token is not a refresh token.")

        user_id: str = payload["sub"]
        result = await self.db.execute(
            select(User).where(User.id == uuid.UUID(user_id))
        )
        user: User | None = result.scalar_one_or_none()

        if user is None or not user.is_active:
            raise UnauthorizedError("User not found or inactive.")

        access_token = create_access_token(
            user_id=str(user.id),
            role=user.role,
            email=user.email,
        )

        logger.info("Token refreshed", user_id=user_id)

        return TokenResponse(
            access_token=access_token,
            refresh_token=refresh_token,  # reuse same refresh token
            expires_in=settings.JWT_EXPIRE_MINUTES * 60,
        )

    async def create_user(
        self,
        email: str,
        password: str,
        full_name: str = "",
        role: str = "viewer",
    ) -> User:
        """Create a new user. Raises ConflictError if email is taken."""
        existing = await self.db.execute(select(User).where(User.email == email))
        if existing.scalar_one_or_none():
            raise ConflictError(f"A user with email '{email}' already exists.")

        user = User(
            id=uuid.uuid4(),
            email=email,
            hashed_password=hash_password(password),
            full_name=full_name,
            role=role,
        )
        self.db.add(user)
        await self.db.flush()
        logger.info("User created", user_id=str(user.id), email=email)
        return user
