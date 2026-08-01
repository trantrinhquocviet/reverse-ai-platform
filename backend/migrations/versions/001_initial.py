"""Initial schema — all tables

Revision ID: 001
Revises:
Create Date: 2026-07-22 00:00:00.000000

"""
from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


# ─────────────────────────────────────────────────────────────────────────────
# UPGRADE
# ─────────────────────────────────────────────────────────────────────────────
def upgrade() -> None:
    # ── ENUM types ─────────────────────────────────────────────────────────
    op.execute("CREATE TYPE user_role AS ENUM ('admin', 'manager', 'annotator', 'viewer')")
    op.execute("CREATE TYPE video_status AS ENUM ('pending', 'processing', 'ready', 'failed', 'archived')")
    op.execute("CREATE TYPE ocr_status AS ENUM ('pending', 'processing', 'done', 'failed')")
    op.execute("CREATE TYPE annotation_status AS ENUM ('pending', 'in_review', 'approved', 'rejected')")
    op.execute("CREATE TYPE dataset_status AS ENUM ('draft', 'active', 'archived')")
    op.execute("CREATE TYPE training_status AS ENUM ('queued', 'running', 'completed', 'failed', 'cancelled')")
    op.execute("CREATE TYPE model_status AS ENUM ('draft', 'trained', 'validated', 'deprecated')")
    op.execute("CREATE TYPE deployment_status AS ENUM ('pending', 'running', 'stopped', 'failed')")
    op.execute("CREATE TYPE split_type AS ENUM ('train', 'val', 'test')")
    op.execute("CREATE TYPE log_level AS ENUM ('debug', 'info', 'warning', 'error', 'critical')")
    op.execute("CREATE TYPE export_format AS ENUM ('yolo', 'coco', 'pascal_voc', 'csv')")
    op.execute("CREATE TYPE version_status AS ENUM ('draft', 'ready', 'deprecated')")

    # ── warehouses ─────────────────────────────────────────────────────────
    op.create_table(
        "warehouses",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("location", sa.String(512), nullable=True),
        sa.Column("description", sa.Text, nullable=True),
        sa.Column("active", sa.Boolean, nullable=False, server_default=sa.text("true")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )
    op.create_index("ix_warehouses_name", "warehouses", ["name"])

    # ── brands ─────────────────────────────────────────────────────────────
    op.create_table(
        "brands",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("description", sa.Text, nullable=True),
        sa.Column("active", sa.Boolean, nullable=False, server_default=sa.text("true")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )
    op.create_index("ix_brands_name", "brands", ["name"])

    # ── users ──────────────────────────────────────────────────────────────
    op.create_table(
        "users",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("email", sa.String(255), nullable=False, unique=True),
        sa.Column("hashed_password", sa.String(255), nullable=False),
        sa.Column("full_name", sa.String(255), nullable=False, server_default=""),
        sa.Column("role", sa.Text, nullable=False, server_default="viewer"),
        sa.Column("is_active", sa.Boolean, nullable=False, server_default=sa.text("true")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )
    op.create_index("ix_users_email", "users", ["email"])
    op.create_index("ix_users_role", "users", ["role"])

    # ── videos ─────────────────────────────────────────────────────────────
    op.create_table(
        "videos",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("name", sa.String(512), nullable=False),
        sa.Column("warehouse", sa.String(255), nullable=False, server_default=""),
        sa.Column("brand", sa.String(255), nullable=False, server_default=""),
        sa.Column("duration", sa.Float, nullable=True),
        sa.Column("resolution", sa.String(64), nullable=False, server_default=""),
        sa.Column("status", sa.Text, nullable=False, server_default="pending"),
        sa.Column("file_path", sa.String(1024), nullable=False, server_default=""),
        sa.Column("thumbnail_path", sa.String(1024), nullable=False, server_default=""),
        sa.Column("file_size", sa.BigInteger, nullable=True),
        sa.Column("uploaded_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.ForeignKeyConstraint(["uploaded_by"], ["users.id"], name="fk_videos_uploaded_by", ondelete="SET NULL"),
    )
    op.create_index("ix_videos_status", "videos", ["status"])
    op.create_index("ix_videos_uploaded_by", "videos", ["uploaded_by"])
    op.create_index("ix_videos_created_at", "videos", ["created_at"])

    # ── processing_jobs ────────────────────────────────────────────────────
    op.create_table(
        "processing_jobs",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("video_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("status", sa.Text, nullable=False, server_default="pending"),
        sa.Column("progress", sa.Integer, nullable=False, server_default="0"),
        sa.Column("current_step", sa.String(255), nullable=True),
        sa.Column("total_frames", sa.Integer, nullable=True),
        sa.Column("selected_frames", sa.Integer, nullable=True),
        sa.Column("discarded_frames", sa.Integer, nullable=True),
        sa.Column("blur_frames", sa.Integer, nullable=True),
        sa.Column("duplicate_frames", sa.Integer, nullable=True),
        sa.Column("fps", sa.Float, nullable=False, server_default="1.0"),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.ForeignKeyConstraint(["video_id"], ["videos.id"], name="fk_processing_jobs_video_id", ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["created_by"], ["users.id"], name="fk_processing_jobs_created_by", ondelete="SET NULL"),
    )
    op.create_index("ix_processing_jobs_video_id", "processing_jobs", ["video_id"])
    op.create_index("ix_processing_jobs_status", "processing_jobs", ["status"])
    op.create_index("ix_processing_jobs_created_at", "processing_jobs", ["created_at"])

    # ── frames ─────────────────────────────────────────────────────────────
    op.create_table(
        "frames",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("video_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("job_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("timestamp_ms", sa.Integer, nullable=True),
        sa.Column("file_path", sa.String(1024), nullable=False, server_default=""),
        sa.Column("blur_score", sa.Float, nullable=True),
        sa.Column("ocr_status", sa.Text, nullable=False, server_default="pending"),
        sa.Column("tracking_found", sa.Boolean, nullable=False, server_default=sa.text("false")),
        sa.Column("frame_quality", sa.String(64), nullable=True),
        sa.Column("is_duplicate", sa.Boolean, nullable=False, server_default=sa.text("false")),
        sa.Column("brightness", sa.Float, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.ForeignKeyConstraint(["video_id"], ["videos.id"], name="fk_frames_video_id", ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["job_id"], ["processing_jobs.id"], name="fk_frames_job_id", ondelete="SET NULL"),
    )
    op.create_index("ix_frames_video_id", "frames", ["video_id"])
    op.create_index("ix_frames_job_id", "frames", ["job_id"])
    op.create_index("ix_frames_ocr_status", "frames", ["ocr_status"])
    op.create_index("ix_frames_created_at", "frames", ["created_at"])

    # ── processing_logs ────────────────────────────────────────────────────
    op.create_table(
        "processing_logs",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("job_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("level", sa.String(16), nullable=False, server_default="info"),
        sa.Column("message", sa.Text, nullable=False),
        sa.Column("epoch", sa.Integer, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.ForeignKeyConstraint(["job_id"], ["processing_jobs.id"], name="fk_processing_logs_job_id", ondelete="CASCADE"),
    )
    op.create_index("ix_processing_logs_job_id", "processing_logs", ["job_id"])
    op.create_index("ix_processing_logs_created_at", "processing_logs", ["created_at"])

    # ── ocr_results ────────────────────────────────────────────────────────
    op.create_table(
        "ocr_results",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("frame_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("detected_text", sa.Text, nullable=True),
        sa.Column("confidence", sa.Float, nullable=True),
        sa.Column("language", sa.String(32), nullable=True),
        sa.Column("carrier", sa.String(128), nullable=True),
        sa.Column("tracking_code", sa.String(255), nullable=True),
        sa.Column("status", sa.Text, nullable=False, server_default="pending"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.ForeignKeyConstraint(["frame_id"], ["frames.id"], name="fk_ocr_results_frame_id", ondelete="CASCADE"),
    )
    op.create_index("ix_ocr_results_frame_id", "ocr_results", ["frame_id"])
    op.create_index("ix_ocr_results_status", "ocr_results", ["status"])
    op.create_index("ix_ocr_results_tracking_code", "ocr_results", ["tracking_code"])

    # ── annotations ────────────────────────────────────────────────────────
    op.create_table(
        "annotations",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("frame_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("label", sa.String(255), nullable=False),
        sa.Column("bounding_box", postgresql.JSONB, nullable=True),
        sa.Column("confidence", sa.Float, nullable=True),
        sa.Column("reason", sa.Text, nullable=True),
        sa.Column("status", sa.Text, nullable=False, server_default="pending"),
        sa.Column("created_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("reviewed_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.ForeignKeyConstraint(["frame_id"], ["frames.id"], name="fk_annotations_frame_id", ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["created_by"], ["users.id"], name="fk_annotations_created_by", ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["reviewed_by"], ["users.id"], name="fk_annotations_reviewed_by", ondelete="SET NULL"),
    )
    op.create_index("ix_annotations_frame_id", "annotations", ["frame_id"])
    op.create_index("ix_annotations_status", "annotations", ["status"])
    op.create_index("ix_annotations_created_by", "annotations", ["created_by"])
    op.create_index("ix_annotations_created_at", "annotations", ["created_at"])

    # ── annotation_history ─────────────────────────────────────────────────
    op.create_table(
        "annotation_history",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("annotation_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("action", sa.String(64), nullable=False),
        sa.Column("previous_value", postgresql.JSONB, nullable=True),
        sa.Column("new_value", postgresql.JSONB, nullable=True),
        sa.Column("changed_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.ForeignKeyConstraint(["annotation_id"], ["annotations.id"], name="fk_annotation_history_annotation_id", ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["changed_by"], ["users.id"], name="fk_annotation_history_changed_by", ondelete="SET NULL"),
    )
    op.create_index("ix_annotation_history_annotation_id", "annotation_history", ["annotation_id"])
    op.create_index("ix_annotation_history_created_at", "annotation_history", ["created_at"])

    # ── datasets ───────────────────────────────────────────────────────────
    op.create_table(
        "datasets",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("name", sa.String(512), nullable=False),
        sa.Column("description", sa.Text, nullable=True),
        sa.Column("total_images", sa.Integer, nullable=False, server_default="0"),
        sa.Column("training_images", sa.Integer, nullable=False, server_default="0"),
        sa.Column("validation_images", sa.Integer, nullable=False, server_default="0"),
        sa.Column("rejected_images", sa.Integer, nullable=False, server_default="0"),
        sa.Column("pending_review", sa.Integer, nullable=False, server_default="0"),
        sa.Column("quality_score", sa.Float, nullable=True),
        sa.Column("created_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.ForeignKeyConstraint(["created_by"], ["users.id"], name="fk_datasets_created_by", ondelete="SET NULL"),
    )
    op.create_index("ix_datasets_created_by", "datasets", ["created_by"])
    op.create_index("ix_datasets_created_at", "datasets", ["created_at"])

    # ── dataset_versions ───────────────────────────────────────────────────
    op.create_table(
        "dataset_versions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("dataset_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("version", sa.String(64), nullable=False),
        sa.Column("format", sa.Text, nullable=False, server_default="yolo"),
        sa.Column("status", sa.Text, nullable=False, server_default="draft"),
        sa.Column("total_images", sa.Integer, nullable=True),
        sa.Column("export_path", sa.String(1024), nullable=True),
        sa.Column("exported_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.ForeignKeyConstraint(["dataset_id"], ["datasets.id"], name="fk_dataset_versions_dataset_id", ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["created_by"], ["users.id"], name="fk_dataset_versions_created_by", ondelete="SET NULL"),
    )
    op.create_index("ix_dataset_versions_dataset_id", "dataset_versions", ["dataset_id"])
    op.create_index("ix_dataset_versions_status", "dataset_versions", ["status"])

    # ── dataset_images ─────────────────────────────────────────────────────
    op.create_table(
        "dataset_images",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("dataset_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("frame_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("image_name", sa.String(512), nullable=True),
        sa.Column("split_type", sa.Text, nullable=False, server_default="train"),
        sa.Column("status", sa.Text, nullable=False, server_default="pending"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.ForeignKeyConstraint(["dataset_id"], ["datasets.id"], name="fk_dataset_images_dataset_id", ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["frame_id"], ["frames.id"], name="fk_dataset_images_frame_id", ondelete="CASCADE"),
    )
    op.create_index("ix_dataset_images_dataset_id", "dataset_images", ["dataset_id"])
    op.create_index("ix_dataset_images_frame_id", "dataset_images", ["frame_id"])
    op.create_index("ix_dataset_images_split_type", "dataset_images", ["split_type"])

    # ── features ───────────────────────────────────────────────────────────
    op.create_table(
        "features",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("frame_id", postgresql.UUID(as_uuid=True), nullable=False, unique=True),
        sa.Column("tracking_found", sa.Boolean, nullable=False, server_default=sa.text("false")),
        sa.Column("barcode_found", sa.Boolean, nullable=False, server_default=sa.text("false")),
        sa.Column("packaging_type", sa.String(128), nullable=True),
        sa.Column("ocr_confidence", sa.Float, nullable=True),
        sa.Column("blur_score", sa.Float, nullable=True),
        sa.Column("brightness", sa.Float, nullable=True),
        sa.Column("frame_quality", sa.String(64), nullable=True),
        sa.Column("rotation", sa.Float, nullable=True),
        sa.Column("is_duplicate", sa.Boolean, nullable=False, server_default=sa.text("false")),
        sa.Column("duplicate_score", sa.Float, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.ForeignKeyConstraint(["frame_id"], ["frames.id"], name="fk_features_frame_id", ondelete="CASCADE"),
    )
    op.create_index("ix_features_frame_id", "features", ["frame_id"])

    # ── training_jobs ──────────────────────────────────────────────────────
    op.create_table(
        "training_jobs",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("name", sa.String(512), nullable=False),
        sa.Column("description", sa.Text, nullable=True),
        sa.Column("model_template", sa.String(255), nullable=False, server_default="yolov8n"),
        sa.Column("dataset_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("dataset_version_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("status", sa.Text, nullable=False, server_default="queued"),
        sa.Column("progress", sa.Integer, nullable=False, server_default="0"),
        sa.Column("current_epoch", sa.Integer, nullable=False, server_default="0"),
        sa.Column("total_epochs", sa.Integer, nullable=False, server_default="100"),
        sa.Column("hyperparams", postgresql.JSONB, nullable=True),
        sa.Column("gpu_id", sa.String(64), nullable=True),
        sa.Column("train_loss", sa.Float, nullable=True),
        sa.Column("val_loss", sa.Float, nullable=True),
        sa.Column("accuracy", sa.Float, nullable=True),
        sa.Column("map50", sa.Float, nullable=True),
        sa.Column("map5095", sa.Float, nullable=True),
        sa.Column("recall", sa.Float, nullable=True),
        sa.Column("precision_score", sa.Float, nullable=True),
        sa.Column("gpu_usage", sa.Float, nullable=True),
        sa.Column("ram_usage", sa.Float, nullable=True),
        sa.Column("disk_usage", sa.Float, nullable=True),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.ForeignKeyConstraint(["dataset_id"], ["datasets.id"], name="fk_training_jobs_dataset_id", ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["dataset_version_id"], ["dataset_versions.id"], name="fk_training_jobs_dataset_version_id", ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["created_by"], ["users.id"], name="fk_training_jobs_created_by", ondelete="SET NULL"),
    )
    op.create_index("ix_training_jobs_dataset_id", "training_jobs", ["dataset_id"])
    op.create_index("ix_training_jobs_status", "training_jobs", ["status"])
    op.create_index("ix_training_jobs_created_at", "training_jobs", ["created_at"])

    # ── training_logs ──────────────────────────────────────────────────────
    op.create_table(
        "training_logs",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("job_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("level", sa.String(16), nullable=False, server_default="info"),
        sa.Column("message", sa.Text, nullable=False),
        sa.Column("epoch", sa.Integer, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.ForeignKeyConstraint(["job_id"], ["training_jobs.id"], name="fk_training_logs_job_id", ondelete="CASCADE"),
    )
    op.create_index("ix_training_logs_job_id", "training_logs", ["job_id"])
    op.create_index("ix_training_logs_created_at", "training_logs", ["created_at"])

    # ── experiments ────────────────────────────────────────────────────────
    op.create_table(
        "experiments",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("name", sa.String(512), nullable=False),
        sa.Column("job_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("dataset_version_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("model_template", sa.String(255), nullable=True),
        sa.Column("hyperparams", postgresql.JSONB, nullable=True),
        sa.Column("final_map50", sa.Float, nullable=True),
        sa.Column("final_accuracy", sa.Float, nullable=True),
        sa.Column("final_recall", sa.Float, nullable=True),
        sa.Column("final_precision", sa.Float, nullable=True),
        sa.Column("f1_score", sa.Float, nullable=True),
        sa.Column("training_time_s", sa.Integer, nullable=True),
        sa.Column("inference_speed_ms", sa.Float, nullable=True),
        sa.Column("model_size_mb", sa.Float, nullable=True),
        sa.Column("created_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.ForeignKeyConstraint(["job_id"], ["training_jobs.id"], name="fk_experiments_job_id", ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["dataset_version_id"], ["dataset_versions.id"], name="fk_experiments_dataset_version_id", ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["created_by"], ["users.id"], name="fk_experiments_created_by", ondelete="SET NULL"),
    )
    op.create_index("ix_experiments_job_id", "experiments", ["job_id"])
    op.create_index("ix_experiments_created_at", "experiments", ["created_at"])

    # ── models_registry ────────────────────────────────────────────────────
    op.create_table(
        "models_registry",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("name", sa.String(512), nullable=False),
        sa.Column("task", sa.String(128), nullable=False, server_default="detection"),
        sa.Column("framework", sa.String(128), nullable=False, server_default="pytorch"),
        sa.Column("description", sa.Text, nullable=True),
        sa.Column("owner", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.ForeignKeyConstraint(["owner"], ["users.id"], name="fk_models_registry_owner", ondelete="SET NULL"),
    )
    op.create_index("ix_models_registry_owner", "models_registry", ["owner"])
    op.create_index("ix_models_registry_created_at", "models_registry", ["created_at"])

    # ── model_versions ─────────────────────────────────────────────────────
    op.create_table(
        "model_versions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("model_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("version", sa.String(64), nullable=False),
        sa.Column("framework", sa.String(128), nullable=True),
        sa.Column("dataset_version_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("experiment_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("accuracy", sa.Float, nullable=True),
        sa.Column("map50", sa.Float, nullable=True),
        sa.Column("inference_speed_ms", sa.Float, nullable=True),
        sa.Column("model_size_mb", sa.Float, nullable=True),
        sa.Column("status", sa.Text, nullable=False, server_default="draft"),
        sa.Column("deployment_status", sa.Text, nullable=False, server_default="pending"),
        sa.Column("artifacts", postgresql.JSONB, nullable=True),
        sa.Column("created_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.ForeignKeyConstraint(["model_id"], ["models_registry.id"], name="fk_model_versions_model_id", ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["dataset_version_id"], ["dataset_versions.id"], name="fk_model_versions_dataset_version_id", ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["experiment_id"], ["experiments.id"], name="fk_model_versions_experiment_id", ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["created_by"], ["users.id"], name="fk_model_versions_created_by", ondelete="SET NULL"),
    )
    op.create_index("ix_model_versions_model_id", "model_versions", ["model_id"])
    op.create_index("ix_model_versions_status", "model_versions", ["status"])
    op.create_index("ix_model_versions_created_at", "model_versions", ["created_at"])

    # ── deployments ────────────────────────────────────────────────────────
    op.create_table(
        "deployments",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("model_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("model_version_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("environment", sa.String(64), nullable=False, server_default="staging"),
        sa.Column("format", sa.String(64), nullable=False, server_default="onnx"),
        sa.Column("status", sa.Text, nullable=False, server_default="pending"),
        sa.Column("endpoint", sa.Text, nullable=True),
        sa.Column("replicas", sa.Integer, nullable=False, server_default="1"),
        sa.Column("cpu_usage", sa.Float, nullable=True),
        sa.Column("memory_usage", sa.Float, nullable=True),
        sa.Column("deployed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("deployed_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.ForeignKeyConstraint(["model_id"], ["models_registry.id"], name="fk_deployments_model_id", ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["model_version_id"], ["model_versions.id"], name="fk_deployments_model_version_id", ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["deployed_by"], ["users.id"], name="fk_deployments_deployed_by", ondelete="SET NULL"),
    )
    op.create_index("ix_deployments_model_id", "deployments", ["model_id"])
    op.create_index("ix_deployments_model_version_id", "deployments", ["model_version_id"])
    op.create_index("ix_deployments_status", "deployments", ["status"])

    # ── evaluation_reports ─────────────────────────────────────────────────
    op.create_table(
        "evaluation_reports",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("model_version_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("dataset_version_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("precision_score", sa.Float, nullable=True),
        sa.Column("recall", sa.Float, nullable=True),
        sa.Column("f1", sa.Float, nullable=True),
        sa.Column("map50", sa.Float, nullable=True),
        sa.Column("map5095", sa.Float, nullable=True),
        sa.Column("total_images", sa.Integer, nullable=True),
        sa.Column("false_positives", sa.Integer, nullable=True),
        sa.Column("false_negatives", sa.Integer, nullable=True),
        sa.Column("iou", sa.Float, nullable=True),
        sa.Column("inference_speed_ms", sa.Float, nullable=True),
        sa.Column("created_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.ForeignKeyConstraint(["model_version_id"], ["model_versions.id"], name="fk_evaluation_reports_model_version_id", ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["dataset_version_id"], ["dataset_versions.id"], name="fk_evaluation_reports_dataset_version_id", ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["created_by"], ["users.id"], name="fk_evaluation_reports_created_by", ondelete="SET NULL"),
    )
    op.create_index("ix_evaluation_reports_model_version_id", "evaluation_reports", ["model_version_id"])
    op.create_index("ix_evaluation_reports_created_at", "evaluation_reports", ["created_at"])

    # ── notifications ──────────────────────────────────────────────────────
    op.create_table(
        "notifications",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("type", sa.String(64), nullable=False),
        sa.Column("title", sa.String(512), nullable=False),
        sa.Column("message", sa.Text, nullable=True),
        sa.Column("read", sa.Boolean, nullable=False, server_default=sa.text("false")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], name="fk_notifications_user_id", ondelete="CASCADE"),
    )
    op.create_index("ix_notifications_user_id", "notifications", ["user_id"])
    op.create_index("ix_notifications_read", "notifications", ["read"])
    op.create_index("ix_notifications_created_at", "notifications", ["created_at"])

    # ── audit_logs ─────────────────────────────────────────────────────────
    op.create_table(
        "audit_logs",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("action", sa.String(128), nullable=False),
        sa.Column("resource_type", sa.String(128), nullable=True),
        sa.Column("resource_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("ip_address", sa.String(64), nullable=True),
        sa.Column("user_agent", sa.Text, nullable=True),
        sa.Column("payload", postgresql.JSONB, nullable=True),
        sa.Column("status_code", sa.Integer, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], name="fk_audit_logs_user_id", ondelete="SET NULL"),
    )
    op.create_index("ix_audit_logs_user_id", "audit_logs", ["user_id"])
    op.create_index("ix_audit_logs_action", "audit_logs", ["action"])
    op.create_index("ix_audit_logs_resource_type", "audit_logs", ["resource_type"])
    op.create_index("ix_audit_logs_created_at", "audit_logs", ["created_at"])

    # ── system_configs ─────────────────────────────────────────────────────
    op.create_table(
        "system_configs",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("key", sa.String(255), nullable=False, unique=True),
        sa.Column("value", sa.Text, nullable=True),
        sa.Column("value_type", sa.String(32), nullable=False, server_default="string"),
        sa.Column("description", sa.Text, nullable=True),
        sa.Column("is_secret", sa.Boolean, nullable=False, server_default=sa.text("false")),
        sa.Column("updated_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.ForeignKeyConstraint(["updated_by"], ["users.id"], name="fk_system_configs_updated_by", ondelete="SET NULL"),
    )
    op.create_index("ix_system_configs_key", "system_configs", ["key"])

    # ── api_keys ───────────────────────────────────────────────────────────
    op.create_table(
        "api_keys",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("key_hash", sa.String(255), nullable=False, unique=True),
        sa.Column("key_prefix", sa.String(16), nullable=False),
        sa.Column("scopes", postgresql.JSONB, nullable=True),
        sa.Column("last_used_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("is_active", sa.Boolean, nullable=False, server_default=sa.text("true")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], name="fk_api_keys_user_id", ondelete="CASCADE"),
    )
    op.create_index("ix_api_keys_user_id", "api_keys", ["user_id"])
    op.create_index("ix_api_keys_key_prefix", "api_keys", ["key_prefix"])
    op.create_index("ix_api_keys_is_active", "api_keys", ["is_active"])


# ─────────────────────────────────────────────────────────────────────────────
# DOWNGRADE — drop tables in reverse dependency order
# ─────────────────────────────────────────────────────────────────────────────
def downgrade() -> None:
    op.drop_table("api_keys")
    op.drop_table("system_configs")
    op.drop_table("audit_logs")
    op.drop_table("notifications")
    op.drop_table("evaluation_reports")
    op.drop_table("deployments")
    op.drop_table("model_versions")
    op.drop_table("models_registry")
    op.drop_table("experiments")
    op.drop_table("training_logs")
    op.drop_table("training_jobs")
    op.drop_table("features")
    op.drop_table("dataset_images")
    op.drop_table("dataset_versions")
    op.drop_table("datasets")
    op.drop_table("annotation_history")
    op.drop_table("annotations")
    op.drop_table("ocr_results")
    op.drop_table("processing_logs")
    op.drop_table("frames")
    op.drop_table("processing_jobs")
    op.drop_table("videos")
    op.drop_table("users")
    op.drop_table("brands")
    op.drop_table("warehouses")

    # Drop custom enum types
    op.execute("DROP TYPE IF EXISTS version_status")
    op.execute("DROP TYPE IF EXISTS export_format")
    op.execute("DROP TYPE IF EXISTS log_level")
    op.execute("DROP TYPE IF EXISTS split_type")
    op.execute("DROP TYPE IF EXISTS deployment_status")
    op.execute("DROP TYPE IF EXISTS model_status")
    op.execute("DROP TYPE IF EXISTS training_status")
    op.execute("DROP TYPE IF EXISTS dataset_status")
    op.execute("DROP TYPE IF EXISTS annotation_status")
    op.execute("DROP TYPE IF EXISTS ocr_status")
    op.execute("DROP TYPE IF EXISTS video_status")
    op.execute("DROP TYPE IF EXISTS user_role")
