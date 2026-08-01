#!/usr/bin/env python3
"""
Seed the database with initial data:
  - 1 admin user
  - 3 warehouses (A, B, C)
  - 3 brands (X, Y, Z)

Usage:
    cd backend
    python scripts/seed_data.py
"""
from __future__ import annotations

import asyncio
import os
import sys
import uuid
from datetime import datetime, timezone

# Allow running from backend/ directory
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Load .env before importing app config
try:
    from dotenv import load_dotenv
    load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), "..", ".env"))
except ImportError:
    pass

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.config import settings
from app.core.security import get_password_hash


# ── Engine ─────────────────────────────────────────────────────────────────
engine = create_async_engine(settings.ASYNC_DATABASE_URL, echo=False, pool_pre_ping=True)
SessionFactory = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


# ── Helpers ────────────────────────────────────────────────────────────────
def now() -> datetime:
    return datetime.now(timezone.utc)


async def seed_users(session: AsyncSession) -> None:
    print("Seeding users...")
    result = await session.execute(
        text("SELECT id FROM users WHERE email = :email"),
        {"email": "admin@reverse-ai.com"},
    )
    existing = result.fetchone()
    if existing:
        print("  [--] Admin user already exists — skipped")
        return

    hashed = get_password_hash("admin123")
    await session.execute(
        text(
            """
            INSERT INTO users (id, email, hashed_password, full_name, role, is_active, created_at, updated_at)
            VALUES (:id, :email, :hashed_password, :full_name, :role, :is_active, :created_at, :updated_at)
            """
        ),
        {
            "id": str(uuid.uuid4()),
            "email": "admin@reverse-ai.com",
            "hashed_password": hashed,
            "full_name": "System Admin",
            "role": "admin",
            "is_active": True,
            "created_at": now(),
            "updated_at": now(),
        },
    )
    print("  [OK] Created admin user: admin@reverse-ai.com / admin123")


async def seed_warehouses(session: AsyncSession) -> None:
    print("Seeding warehouses...")
    warehouses = [
        {"name": "Warehouse A", "location": "Hanoi", "description": "Main warehouse in Hanoi"},
        {"name": "Warehouse B", "location": "Ho Chi Minh City", "description": "Southern distribution hub"},
        {"name": "Warehouse C", "location": "Da Nang", "description": "Central region warehouse"},
    ]
    for wh in warehouses:
        result = await session.execute(
            text("SELECT id FROM warehouses WHERE name = :name"),
            {"name": wh["name"]},
        )
        if result.fetchone():
            print(f"  [--] {wh['name']} already exists — skipped")
            continue
        await session.execute(
            text(
                """
                INSERT INTO warehouses (id, name, location, description, active, created_at)
                VALUES (:id, :name, :location, :description, :active, :created_at)
                """
            ),
            {
                "id": str(uuid.uuid4()),
                "name": wh["name"],
                "location": wh["location"],
                "description": wh["description"],
                "active": True,
                "created_at": now(),
            },
        )
        print(f"  [OK] Created {wh['name']}")


async def seed_brands(session: AsyncSession) -> None:
    print("Seeding brands...")
    brands = [
        {"name": "Brand X", "description": "Premium brand tier X"},
        {"name": "Brand Y", "description": "Standard brand tier Y"},
        {"name": "Brand Z", "description": "Economy brand tier Z"},
    ]
    for brand in brands:
        result = await session.execute(
            text("SELECT id FROM brands WHERE name = :name"),
            {"name": brand["name"]},
        )
        if result.fetchone():
            print(f"  [--] {brand['name']} already exists — skipped")
            continue
        await session.execute(
            text(
                """
                INSERT INTO brands (id, name, description, active, created_at)
                VALUES (:id, :name, :description, :active, :created_at)
                """
            ),
            {
                "id": str(uuid.uuid4()),
                "name": brand["name"],
                "description": brand["description"],
                "active": True,
                "created_at": now(),
            },
        )
        print(f"  [OK] Created {brand['name']}")


async def main() -> None:
    print("Starting seed script...")
    print(f"Database: {settings.ASYNC_DATABASE_URL[:60]}...\n")

    async with SessionFactory() as session:
        async with session.begin():
            await seed_users(session)
            await seed_warehouses(session)
            await seed_brands(session)

    await engine.dispose()
    print("\nSeed complete.")


if __name__ == "__main__":
    asyncio.run(main())
