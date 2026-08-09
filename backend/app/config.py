from __future__ import annotations

import re
from functools import lru_cache
from typing import List
from urllib.parse import quote

from pydantic import field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore",
    )

    # App
    APP_NAME: str = "Reverse AI Studio"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = False

    # Database (raw URL from .env — may use asyncpg or plain postgres scheme)
    DATABASE_URL: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/reverse_ai"

    # Redis
    REDIS_URL: str = "redis://localhost:6379/0"

    # Supabase — accept both VITE_ prefixed and bare names
    SUPABASE_URL: str = ""
    VITE_SUPABASE_URL: str = ""
    SUPABASE_ANON_KEY: str = ""
    VITE_SUPABASE_ANON_KEY: str = ""
    SUPABASE_SERVICE_ROLE_KEY: str = ""
    SUPABASE_STORAGE_BUCKET: str = "videos"

    # OpenRouter AI (vision models)
    OPEN_ROUTE: str = ""

    # JWT
    JWT_SECRET: str = "change-me-in-production"
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRE_MINUTES: int = 60
    JWT_REFRESH_EXPIRE_DAYS: int = 7

    # CORS
    CORS_ORIGINS: List[str] = ["http://localhost:5173", "http://localhost:3000"]

    @field_validator("CORS_ORIGINS", mode="before")
    @classmethod
    def parse_cors_origins(cls, v: object) -> List[str]:
        if isinstance(v, str):
            import json
            return json.loads(v)
        return v  # type: ignore[return-value]

    @model_validator(mode="after")
    def resolve_supabase_aliases(self) -> "Settings":
        """Allow VITE_SUPABASE_* env vars as fallbacks for SUPABASE_* keys."""
        if not self.SUPABASE_URL and self.VITE_SUPABASE_URL:
            self.SUPABASE_URL = self.VITE_SUPABASE_URL
        if not self.SUPABASE_ANON_KEY and self.VITE_SUPABASE_ANON_KEY:
            self.SUPABASE_ANON_KEY = self.VITE_SUPABASE_ANON_KEY
        return self

    @property
    def DATABASE_URL_ENCODED(self) -> str:
        """Return DATABASE_URL with the password portion URL-encoded.

        Handles the raw password ``[wf6Ker3+RHP*hR&]`` that contains special
        chars invalid in a connection URI.  The method locates the
        ``user:password@host`` segment and percent-encodes only the password.
        """
        url = self.DATABASE_URL
        # Match  scheme://user:password@host  — password may contain any char
        match = re.match(
            r"(?P<scheme>[^:]+://)"
            r"(?P<user>[^:@]+)"
            r":(?P<password>.+?)"
            r"@(?P<rest>.+)$",
            url,
        )
        if not match:
            return url

        scheme = match.group("scheme")
        user = match.group("user")
        password = match.group("password")
        rest = match.group("rest")

        # Replace asyncpg with psycopg2-compatible scheme for Alembic sync runs
        encoded_password = quote(password, safe="")
        return f"{scheme}{user}:{encoded_password}@{rest}"

    @property
    def ASYNC_DATABASE_URL(self) -> str:
        """Ensure the DATABASE_URL uses the asyncpg driver."""
        url = self.DATABASE_URL_ENCODED
        if url.startswith("postgresql://"):
            return url.replace("postgresql://", "postgresql+asyncpg://", 1)
        return url

    @property
    def SYNC_DATABASE_URL(self) -> str:
        """Return a psycopg2-compatible URL for Alembic sync migrations."""
        url = self.DATABASE_URL_ENCODED
        url = url.replace("postgresql+asyncpg://", "postgresql://", 1)
        return url


@lru_cache()
def get_settings() -> Settings:
    return Settings()


settings: Settings = get_settings()
