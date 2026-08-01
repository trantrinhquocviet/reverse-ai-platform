-- Migration 003: dataset_images and annotations tables
-- Run this directly on Supabase SQL editor or via psql

-- dataset_images: stores extracted frames with AI analysis results
CREATE TABLE IF NOT EXISTS dataset_images (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    video_id UUID NOT NULL,
    file_path TEXT NOT NULL,
    image_name TEXT NOT NULL,
    ai_result JSONB,
    split_type TEXT DEFAULT 'train' CHECK (split_type IN ('train', 'val', 'test')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- annotations: human review decisions on AI detections
CREATE TABLE IF NOT EXISTS annotations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dataset_image_id UUID NOT NULL REFERENCES dataset_images(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    reviewer_id UUID,
    reviewer_note TEXT,
    reviewed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_dataset_images_video_id ON dataset_images(video_id);
CREATE INDEX IF NOT EXISTS idx_annotations_dataset_image_id ON annotations(dataset_image_id);
CREATE INDEX IF NOT EXISTS idx_annotations_status ON annotations(status);
