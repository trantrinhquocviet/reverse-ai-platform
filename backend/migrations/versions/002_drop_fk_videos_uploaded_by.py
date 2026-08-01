"""Drop FK constraint on videos.uploaded_by — uploaded_by stores Supabase auth UUID

Revision ID: 002
Revises: 001
Create Date: 2026-08-01 00:00:00.000000

"""
from __future__ import annotations

from typing import Sequence, Union

from alembic import op

revision: str = "002"
down_revision: Union[str, None] = "001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.drop_constraint("fk_videos_uploaded_by", "videos", type_="foreignkey")


def downgrade() -> None:
    op.create_foreign_key(
        "fk_videos_uploaded_by",
        "videos",
        "users",
        ["uploaded_by"],
        ["id"],
        ondelete="SET NULL",
    )
