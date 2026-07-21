from __future__ import annotations

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_health_check(client: AsyncClient) -> None:
    response = await client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert "version" in data
    assert "timestamp" in data


@pytest.mark.asyncio
async def test_login_invalid_credentials(client: AsyncClient) -> None:
    response = await client.post(
        "/api/v1/auth/login",
        json={"email": "nobody@example.com", "password": "wrongpassword"},
    )
    # No user exists yet — should return 401
    assert response.status_code == 401
    data = response.json()
    assert data["error_code"] == "UNAUTHORIZED"


@pytest.mark.asyncio
async def test_login_missing_fields(client: AsyncClient) -> None:
    response = await client.post("/api/v1/auth/login", json={"email": "bad"})
    # Pydantic validation should reject the request
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_me_unauthenticated(client: AsyncClient) -> None:
    response = await client.get("/api/v1/auth/me")
    # No Bearer token → 403 (HTTPBearer raises 403 when no auth header)
    assert response.status_code in (401, 403)


@pytest.mark.asyncio
async def test_refresh_invalid_token(client: AsyncClient) -> None:
    response = await client.post(
        "/api/v1/auth/refresh",
        json={"refresh_token": "not.a.valid.jwt"},
    )
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_list_videos_unauthenticated(client: AsyncClient) -> None:
    response = await client.get("/api/v1/videos")
    assert response.status_code in (401, 403)


@pytest.mark.asyncio
async def test_create_user_and_login(client: AsyncClient, db_session) -> None:
    """Create a user directly via service, then log in via API."""
    from app.modules.auth.service import AuthService

    service = AuthService(db_session)
    await service.create_user(
        email="test@example.com",
        password="securepassword",
        full_name="Test User",
        role="viewer",
    )
    await db_session.commit()

    response = await client.post(
        "/api/v1/auth/login",
        json={"email": "test@example.com", "password": "securepassword"},
    )
    assert response.status_code == 200
    data = response.json()
    assert "tokens" in data
    assert data["tokens"]["token_type"] == "bearer"
    assert data["user"]["email"] == "test@example.com"


@pytest.mark.asyncio
async def test_me_with_valid_token(client: AsyncClient, db_session) -> None:
    """Login and then fetch /me with the returned token."""
    from app.modules.auth.service import AuthService

    service = AuthService(db_session)
    await service.create_user(
        email="me@example.com",
        password="securepassword2",
        full_name="Me User",
        role="admin",
    )
    await db_session.commit()

    login_resp = await client.post(
        "/api/v1/auth/login",
        json={"email": "me@example.com", "password": "securepassword2"},
    )
    assert login_resp.status_code == 200
    token = login_resp.json()["tokens"]["access_token"]

    me_resp = await client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert me_resp.status_code == 200
    assert me_resp.json()["email"] == "me@example.com"
