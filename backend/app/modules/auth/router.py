from __future__ import annotations

import structlog
import httpx
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from app.config import settings

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


# ---------------------------------------------------------------------------
# Admin user management
# ---------------------------------------------------------------------------

SUPABASE_AUTH = "{url}/auth/v1/admin/users"

def _admin_headers():
    return {
        "Authorization": f"Bearer {settings.SUPABASE_SERVICE_ROLE_KEY}",
        "apikey": settings.SUPABASE_SERVICE_ROLE_KEY,
        "Content-Type": "application/json",
    }

@router.get("/admin/users", summary="List all users (admin)")
async def list_users(current_user: CurrentUser = Depends(get_current_user)):
    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.get(
            SUPABASE_AUTH.format(url=settings.SUPABASE_URL),
            headers=_admin_headers(),
        )
        if not resp.is_success:
            raise HTTPException(status_code=resp.status_code, detail=resp.text)
        data = resp.json()
        users = data.get("users", data) if isinstance(data, dict) else data
        return [{"id": u["id"], "email": u.get("email",""), "created_at": u.get("created_at",""), "last_sign_in_at": u.get("last_sign_in_at")} for u in users]


class CreateUserRequest(BaseModel):
    email: str
    password: str

@router.post("/admin/users", summary="Create user (admin)")
async def create_user(body: CreateUserRequest, current_user: CurrentUser = Depends(get_current_user)):
    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.post(
            SUPABASE_AUTH.format(url=settings.SUPABASE_URL),
            headers=_admin_headers(),
            json={"email": body.email, "password": body.password, "email_confirm": True},
        )
        if not resp.is_success:
            raise HTTPException(status_code=resp.status_code, detail=resp.text)
        return resp.json()


class ChangePasswordRequest(BaseModel):
    password: str

@router.put("/admin/users/{user_id}/password", summary="Change user password (admin)")
async def change_password(user_id: str, body: ChangePasswordRequest, current_user: CurrentUser = Depends(get_current_user)):
    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.put(
            f"{SUPABASE_AUTH.format(url=settings.SUPABASE_URL)}/{user_id}",
            headers=_admin_headers(),
            json={"password": body.password},
        )
        if not resp.is_success:
            raise HTTPException(status_code=resp.status_code, detail=resp.text)
        return {"status": "ok"}


@router.delete("/admin/users/{user_id}", summary="Delete user (admin)")
async def delete_user(user_id: str, current_user: CurrentUser = Depends(get_current_user)):
    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.delete(
            f"{SUPABASE_AUTH.format(url=settings.SUPABASE_URL)}/{user_id}",
            headers=_admin_headers(),
        )
        if not resp.is_success:
            raise HTTPException(status_code=resp.status_code, detail=resp.text)
        return {"status": "ok"}
