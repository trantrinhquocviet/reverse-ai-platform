"""Add processing_log JSONB column to dataset_images

Revision ID: 003
Revises: 002
Create Date: 2026-08-10 00:00:00.000000

"""
from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "003"
down_revision: Union[str, None] = "002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "dataset_images",
        sa.Column(
            "processing_log",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=True,
            server_default="'[]'::jsonb",
            comment="Array of per-call AI analysis log entries: [{job_id, step, model, timestamp, status, notes}]",
        ),
    )


def downgrade() -> None:
    op.drop_column("dataset_images", "processing_log")
