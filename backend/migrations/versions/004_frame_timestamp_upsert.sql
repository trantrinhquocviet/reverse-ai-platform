-- Migration 004: add frame_timestamp + unique constraint for upsert on reprocess
-- Run in Supabase SQL editor

ALTER TABLE dataset_images
    ADD COLUMN IF NOT EXISTS frame_timestamp FLOAT;

-- Unique constraint enables ON CONFLICT (video_id, frame_timestamp) upsert
-- so reprocessing the same video won't create duplicate rows
CREATE UNIQUE INDEX IF NOT EXISTS idx_dataset_images_video_frame
    ON dataset_images (video_id, frame_timestamp)
    WHERE frame_timestamp IS NOT NULL;
