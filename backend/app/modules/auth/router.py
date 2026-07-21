from __future__ import annotations

import structlog
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.dependencies import CurrentUser, get_current_user
from app.modules.auth.schemas import (
    LoginRequest,
    LoginResponse,
    RefreshRequest,
    TokenResponse,
    UserOut,
)
from app.modules.auth.service import AuthService

logger = structlog.get_logger(__name__)

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post("/login", response_model=LoginResponse, summary="Login with email + password")
async def login(
    body: LoginRequest,
    db: AsyncSession = Depends(get_db),
) -> LoginResponse:
    service = AuthService(db)
    return await service.login(email=body.email, password=body.password)


@router.post("/refresh", response_model=TokenResponse, summary="Refresh access token")
async def refresh_token(
    body: RefreshRequest,
    db: AsyncSession = Depends(get_db),
) -> TokenResponse:
    service = AuthService(db)
    return await service.refresh(refresh_token=body.refresh_token)


@router.post("/logout", summary="Logout (client-side token removal)")
async def logout(
    current_user: CurrentUser = Depends(get_current_user),
) -> dict:
    # JWT is stateless; real logout would blacklist the token in Redis.
    logger.info("User logged out", user_id=current_user.user_id)
    return {"status": "ok", "message": "Logged out successfully."}


@router.get("/me", response_model=UserOut, summary="Get current user profile")
async def get_me(
    current_user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> UserOut:
    from sqlalchemy import select
    import uuid
    from app.modules.auth.models import User

    result = await db.execute(
        select(User).where(User.id == uuid.UUID(current_user.user_id))
    )
    user = result.scalar_one_or_none()
    if user is None:
        from app.core.exceptions import NotFoundError
        raise NotFoundError("User not found.")
    return UserOut.model_validate(user)
