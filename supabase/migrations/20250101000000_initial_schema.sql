BEGIN;

CREATE TABLE alembic_version (
    version_num VARCHAR(32) NOT NULL, 
    CONSTRAINT alembic_version_pkc PRIMARY KEY (version_num)
);

-- Running upgrade  -> 001

CREATE TYPE user_role AS ENUM ('admin', 'manager', 'annotator', 'viewer');

CREATE TYPE video_status AS ENUM ('pending', 'processing', 'ready', 'failed', 'archived');

CREATE TYPE ocr_status AS ENUM ('pending', 'processing', 'done', 'failed');

CREATE TYPE annotation_status AS ENUM ('pending', 'in_review', 'approved', 'rejected');

CREATE TYPE dataset_status AS ENUM ('draft', 'active', 'archived');

CREATE TYPE training_status AS ENUM ('queued', 'running', 'completed', 'failed', 'cancelled');

CREATE TYPE model_status AS ENUM ('draft', 'trained', 'validated', 'deprecated');

CREATE TYPE deployment_status AS ENUM ('pending', 'running', 'stopped', 'failed');

CREATE TYPE split_type AS ENUM ('train', 'val', 'test');

CREATE TYPE log_level AS ENUM ('debug', 'info', 'warning', 'error', 'critical');

CREATE TYPE export_format AS ENUM ('yolo', 'coco', 'pascal_voc', 'csv');

CREATE TYPE version_status AS ENUM ('draft', 'ready', 'deprecated');

CREATE TABLE warehouses (
    id UUID DEFAULT gen_random_uuid() NOT NULL, 
    name VARCHAR(255) NOT NULL, 
    location VARCHAR(512), 
    description TEXT, 
    active BOOLEAN DEFAULT true NOT NULL, 
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
    PRIMARY KEY (id)
);

CREATE INDEX ix_warehouses_name ON warehouses (name);

CREATE TABLE brands (
    id UUID DEFAULT gen_random_uuid() NOT NULL, 
    name VARCHAR(255) NOT NULL, 
    description TEXT, 
    active BOOLEAN DEFAULT true NOT NULL, 
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
    PRIMARY KEY (id)
);

CREATE INDEX ix_brands_name ON brands (name);

CREATE TABLE users (
    id UUID DEFAULT gen_random_uuid() NOT NULL, 
    email VARCHAR(255) NOT NULL, 
    hashed_password VARCHAR(255) NOT NULL, 
    full_name VARCHAR(255) DEFAULT '' NOT NULL, 
    role TEXT DEFAULT 'viewer' NOT NULL, 
    is_active BOOLEAN DEFAULT true NOT NULL, 
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
    PRIMARY KEY (id), 
    UNIQUE (email)
);

CREATE INDEX ix_users_email ON users (email);

CREATE INDEX ix_users_role ON users (role);

CREATE TABLE videos (
    id UUID DEFAULT gen_random_uuid() NOT NULL, 
    name VARCHAR(512) NOT NULL, 
    warehouse VARCHAR(255) DEFAULT '' NOT NULL, 
    brand VARCHAR(255) DEFAULT '' NOT NULL, 
    duration FLOAT, 
    resolution VARCHAR(64) DEFAULT '' NOT NULL, 
    status TEXT DEFAULT 'pending' NOT NULL, 
    file_path VARCHAR(1024) DEFAULT '' NOT NULL, 
    thumbnail_path VARCHAR(1024) DEFAULT '' NOT NULL, 
    file_size BIGINT, 
    uploaded_by UUID, 
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
    PRIMARY KEY (id), 
    CONSTRAINT fk_videos_uploaded_by FOREIGN KEY(uploaded_by) REFERENCES users (id) ON DELETE SET NULL
);

CREATE INDEX ix_videos_status ON videos (status);

CREATE INDEX ix_videos_uploaded_by ON videos (uploaded_by);

CREATE INDEX ix_videos_created_at ON videos (created_at);

CREATE TABLE processing_jobs (
    id UUID DEFAULT gen_random_uuid() NOT NULL, 
    video_id UUID NOT NULL, 
    status TEXT DEFAULT 'pending' NOT NULL, 
    progress INTEGER DEFAULT '0' NOT NULL, 
    current_step VARCHAR(255), 
    total_frames INTEGER, 
    selected_frames INTEGER, 
    discarded_frames INTEGER, 
    blur_frames INTEGER, 
    duplicate_frames INTEGER, 
    fps FLOAT DEFAULT '1.0' NOT NULL, 
    started_at TIMESTAMP WITH TIME ZONE, 
    completed_at TIMESTAMP WITH TIME ZONE, 
    created_by UUID, 
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
    PRIMARY KEY (id), 
    CONSTRAINT fk_processing_jobs_video_id FOREIGN KEY(video_id) REFERENCES videos (id) ON DELETE CASCADE, 
    CONSTRAINT fk_processing_jobs_created_by FOREIGN KEY(created_by) REFERENCES users (id) ON DELETE SET NULL
);

CREATE INDEX ix_processing_jobs_video_id ON processing_jobs (video_id);

CREATE INDEX ix_processing_jobs_status ON processing_jobs (status);

CREATE INDEX ix_processing_jobs_created_at ON processing_jobs (created_at);

CREATE TABLE frames (
    id UUID DEFAULT gen_random_uuid() NOT NULL, 
    video_id UUID NOT NULL, 
    job_id UUID, 
    timestamp_ms INTEGER, 
    file_path VARCHAR(1024) DEFAULT '' NOT NULL, 
    blur_score FLOAT, 
    ocr_status TEXT DEFAULT 'pending' NOT NULL, 
    tracking_found BOOLEAN DEFAULT false NOT NULL, 
    frame_quality VARCHAR(64), 
    is_duplicate BOOLEAN DEFAULT false NOT NULL, 
    brightness FLOAT, 
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
    PRIMARY KEY (id), 
    CONSTRAINT fk_frames_video_id FOREIGN KEY(video_id) REFERENCES videos (id) ON DELETE CASCADE, 
    CONSTRAINT fk_frames_job_id FOREIGN KEY(job_id) REFERENCES processing_jobs (id) ON DELETE SET NULL
);

CREATE INDEX ix_frames_video_id ON frames (video_id);

CREATE INDEX ix_frames_job_id ON frames (job_id);

CREATE INDEX ix_frames_ocr_status ON frames (ocr_status);

CREATE INDEX ix_frames_created_at ON frames (created_at);

CREATE TABLE processing_logs (
    id UUID DEFAULT gen_random_uuid() NOT NULL, 
    job_id UUID NOT NULL, 
    level VARCHAR(16) DEFAULT 'info' NOT NULL, 
    message TEXT NOT NULL, 
    epoch INTEGER, 
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
    PRIMARY KEY (id), 
    CONSTRAINT fk_processing_logs_job_id FOREIGN KEY(job_id) REFERENCES processing_jobs (id) ON DELETE CASCADE
);

CREATE INDEX ix_processing_logs_job_id ON processing_logs (job_id);

CREATE INDEX ix_processing_logs_created_at ON processing_logs (created_at);

CREATE TABLE ocr_results (
    id UUID DEFAULT gen_random_uuid() NOT NULL, 
    frame_id UUID NOT NULL, 
    detected_text TEXT, 
    confidence FLOAT, 
    language VARCHAR(32), 
    carrier VARCHAR(128), 
    tracking_code VARCHAR(255), 
    status TEXT DEFAULT 'pending' NOT NULL, 
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
    PRIMARY KEY (id), 
    CONSTRAINT fk_ocr_results_frame_id FOREIGN KEY(frame_id) REFERENCES frames (id) ON DELETE CASCADE
);

CREATE INDEX ix_ocr_results_frame_id ON ocr_results (frame_id);

CREATE INDEX ix_ocr_results_status ON ocr_results (status);

CREATE INDEX ix_ocr_results_tracking_code ON ocr_results (tracking_code);

CREATE TABLE annotations (
    id UUID DEFAULT gen_random_uuid() NOT NULL, 
    frame_id UUID NOT NULL, 
    label VARCHAR(255) NOT NULL, 
    bounding_box JSONB, 
    confidence FLOAT, 
    reason TEXT, 
    status TEXT DEFAULT 'pending' NOT NULL, 
    created_by UUID, 
    reviewed_by UUID, 
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
    PRIMARY KEY (id), 
    CONSTRAINT fk_annotations_frame_id FOREIGN KEY(frame_id) REFERENCES frames (id) ON DELETE CASCADE, 
    CONSTRAINT fk_annotations_created_by FOREIGN KEY(created_by) REFERENCES users (id) ON DELETE SET NULL, 
    CONSTRAINT fk_annotations_reviewed_by FOREIGN KEY(reviewed_by) REFERENCES users (id) ON DELETE SET NULL
);

CREATE INDEX ix_annotations_frame_id ON annotations (frame_id);

CREATE INDEX ix_annotations_status ON annotations (status);

CREATE INDEX ix_annotations_created_by ON annotations (created_by);

CREATE INDEX ix_annotations_created_at ON annotations (created_at);

CREATE TABLE annotation_history (
    id UUID DEFAULT gen_random_uuid() NOT NULL, 
    annotation_id UUID NOT NULL, 
    action VARCHAR(64) NOT NULL, 
    previous_value JSONB, 
    new_value JSONB, 
    changed_by UUID, 
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
    PRIMARY KEY (id), 
    CONSTRAINT fk_annotation_history_annotation_id FOREIGN KEY(annotation_id) REFERENCES annotations (id) ON DELETE CASCADE, 
    CONSTRAINT fk_annotation_history_changed_by FOREIGN KEY(changed_by) REFERENCES users (id) ON DELETE SET NULL
);

CREATE INDEX ix_annotation_history_annotation_id ON annotation_history (annotation_id);

CREATE INDEX ix_annotation_history_created_at ON annotation_history (created_at);

CREATE TABLE datasets (
    id UUID DEFAULT gen_random_uuid() NOT NULL, 
    name VARCHAR(512) NOT NULL, 
    description TEXT, 
    total_images INTEGER DEFAULT '0' NOT NULL, 
    training_images INTEGER DEFAULT '0' NOT NULL, 
    validation_images INTEGER DEFAULT '0' NOT NULL, 
    rejected_images INTEGER DEFAULT '0' NOT NULL, 
    pending_review INTEGER DEFAULT '0' NOT NULL, 
    quality_score FLOAT, 
    created_by UUID, 
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
    PRIMARY KEY (id), 
    CONSTRAINT fk_datasets_created_by FOREIGN KEY(created_by) REFERENCES users (id) ON DELETE SET NULL
);

CREATE INDEX ix_datasets_created_by ON datasets (created_by);

CREATE INDEX ix_datasets_created_at ON datasets (created_at);

CREATE TABLE dataset_versions (
    id UUID DEFAULT gen_random_uuid() NOT NULL, 
    dataset_id UUID NOT NULL, 
    version VARCHAR(64) NOT NULL, 
    format TEXT DEFAULT 'yolo' NOT NULL, 
    status TEXT DEFAULT 'draft' NOT NULL, 
    total_images INTEGER, 
    export_path VARCHAR(1024), 
    exported_at TIMESTAMP WITH TIME ZONE, 
    created_by UUID, 
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
    PRIMARY KEY (id), 
    CONSTRAINT fk_dataset_versions_dataset_id FOREIGN KEY(dataset_id) REFERENCES datasets (id) ON DELETE CASCADE, 
    CONSTRAINT fk_dataset_versions_created_by FOREIGN KEY(created_by) REFERENCES users (id) ON DELETE SET NULL
);

CREATE INDEX ix_dataset_versions_dataset_id ON dataset_versions (dataset_id);

CREATE INDEX ix_dataset_versions_status ON dataset_versions (status);

CREATE TABLE dataset_images (
    id UUID DEFAULT gen_random_uuid() NOT NULL, 
    dataset_id UUID NOT NULL, 
    frame_id UUID NOT NULL, 
    image_name VARCHAR(512), 
    split_type TEXT DEFAULT 'train' NOT NULL, 
    status TEXT DEFAULT 'pending' NOT NULL, 
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
    PRIMARY KEY (id), 
    CONSTRAINT fk_dataset_images_dataset_id FOREIGN KEY(dataset_id) REFERENCES datasets (id) ON DELETE CASCADE, 
    CONSTRAINT fk_dataset_images_frame_id FOREIGN KEY(frame_id) REFERENCES frames (id) ON DELETE CASCADE
);

CREATE INDEX ix_dataset_images_dataset_id ON dataset_images (dataset_id);

CREATE INDEX ix_dataset_images_frame_id ON dataset_images (frame_id);

CREATE INDEX ix_dataset_images_split_type ON dataset_images (split_type);

CREATE TABLE features (
    id UUID DEFAULT gen_random_uuid() NOT NULL, 
    frame_id UUID NOT NULL, 
    tracking_found BOOLEAN DEFAULT false NOT NULL, 
    barcode_found BOOLEAN DEFAULT false NOT NULL, 
    packaging_type VARCHAR(128), 
    ocr_confidence FLOAT, 
    blur_score FLOAT, 
    brightness FLOAT, 
    frame_quality VARCHAR(64), 
    rotation FLOAT, 
    is_duplicate BOOLEAN DEFAULT false NOT NULL, 
    duplicate_score FLOAT, 
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
    PRIMARY KEY (id), 
    CONSTRAINT fk_features_frame_id FOREIGN KEY(frame_id) REFERENCES frames (id) ON DELETE CASCADE, 
    UNIQUE (frame_id)
);

CREATE INDEX ix_features_frame_id ON features (frame_id);

CREATE TABLE training_jobs (
    id UUID DEFAULT gen_random_uuid() NOT NULL, 
    name VARCHAR(512) NOT NULL, 
    description TEXT, 
    model_template VARCHAR(255) DEFAULT 'yolov8n' NOT NULL, 
    dataset_id UUID, 
    dataset_version_id UUID, 
    status TEXT DEFAULT 'queued' NOT NULL, 
    progress INTEGER DEFAULT '0' NOT NULL, 
    current_epoch INTEGER DEFAULT '0' NOT NULL, 
    total_epochs INTEGER DEFAULT '100' NOT NULL, 
    hyperparams JSONB, 
    gpu_id VARCHAR(64), 
    train_loss FLOAT, 
    val_loss FLOAT, 
    accuracy FLOAT, 
    map50 FLOAT, 
    map5095 FLOAT, 
    recall FLOAT, 
    precision_score FLOAT, 
    gpu_usage FLOAT, 
    ram_usage FLOAT, 
    disk_usage FLOAT, 
    started_at TIMESTAMP WITH TIME ZONE, 
    completed_at TIMESTAMP WITH TIME ZONE, 
    created_by UUID, 
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
    PRIMARY KEY (id), 
    CONSTRAINT fk_training_jobs_dataset_id FOREIGN KEY(dataset_id) REFERENCES datasets (id) ON DELETE SET NULL, 
    CONSTRAINT fk_training_jobs_dataset_version_id FOREIGN KEY(dataset_version_id) REFERENCES dataset_versions (id) ON DELETE SET NULL, 
    CONSTRAINT fk_training_jobs_created_by FOREIGN KEY(created_by) REFERENCES users (id) ON DELETE SET NULL
);

CREATE INDEX ix_training_jobs_dataset_id ON training_jobs (dataset_id);

CREATE INDEX ix_training_jobs_status ON training_jobs (status);

CREATE INDEX ix_training_jobs_created_at ON training_jobs (created_at);

CREATE TABLE training_logs (
    id UUID DEFAULT gen_random_uuid() NOT NULL, 
    job_id UUID NOT NULL, 
    level VARCHAR(16) DEFAULT 'info' NOT NULL, 
    message TEXT NOT NULL, 
    epoch INTEGER, 
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
    PRIMARY KEY (id), 
    CONSTRAINT fk_training_logs_job_id FOREIGN KEY(job_id) REFERENCES training_jobs (id) ON DELETE CASCADE
);

CREATE INDEX ix_training_logs_job_id ON training_logs (job_id);

CREATE INDEX ix_training_logs_created_at ON training_logs (created_at);

CREATE TABLE experiments (
    id UUID DEFAULT gen_random_uuid() NOT NULL, 
    name VARCHAR(512) NOT NULL, 
    job_id UUID, 
    dataset_version_id UUID, 
    model_template VARCHAR(255), 
    hyperparams JSONB, 
    final_map50 FLOAT, 
    final_accuracy FLOAT, 
    final_recall FLOAT, 
    final_precision FLOAT, 
    f1_score FLOAT, 
    training_time_s INTEGER, 
    inference_speed_ms FLOAT, 
    model_size_mb FLOAT, 
    created_by UUID, 
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
    PRIMARY KEY (id), 
    CONSTRAINT fk_experiments_job_id FOREIGN KEY(job_id) REFERENCES training_jobs (id) ON DELETE SET NULL, 
    CONSTRAINT fk_experiments_dataset_version_id FOREIGN KEY(dataset_version_id) REFERENCES dataset_versions (id) ON DELETE SET NULL, 
    CONSTRAINT fk_experiments_created_by FOREIGN KEY(created_by) REFERENCES users (id) ON DELETE SET NULL
);

CREATE INDEX ix_experiments_job_id ON experiments (job_id);

CREATE INDEX ix_experiments_created_at ON experiments (created_at);

CREATE TABLE models_registry (
    id UUID DEFAULT gen_random_uuid() NOT NULL, 
    name VARCHAR(512) NOT NULL, 
    task VARCHAR(128) DEFAULT 'detection' NOT NULL, 
    framework VARCHAR(128) DEFAULT 'pytorch' NOT NULL, 
    description TEXT, 
    owner UUID, 
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
    PRIMARY KEY (id), 
    CONSTRAINT fk_models_registry_owner FOREIGN KEY(owner) REFERENCES users (id) ON DELETE SET NULL
);

CREATE INDEX ix_models_registry_owner ON models_registry (owner);

CREATE INDEX ix_models_registry_created_at ON models_registry (created_at);

CREATE TABLE model_versions (
    id UUID DEFAULT gen_random_uuid() NOT NULL, 
    model_id UUID NOT NULL, 
    version VARCHAR(64) NOT NULL, 
    framework VARCHAR(128), 
    dataset_version_id UUID, 
    experiment_id UUID, 
    accuracy FLOAT, 
    map50 FLOAT, 
    inference_speed_ms FLOAT, 
    model_size_mb FLOAT, 
    status TEXT DEFAULT 'draft' NOT NULL, 
    deployment_status TEXT DEFAULT 'pending' NOT NULL, 
    artifacts JSONB, 
    created_by UUID, 
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
    PRIMARY KEY (id), 
    CONSTRAINT fk_model_versions_model_id FOREIGN KEY(model_id) REFERENCES models_registry (id) ON DELETE CASCADE, 
    CONSTRAINT fk_model_versions_dataset_version_id FOREIGN KEY(dataset_version_id) REFERENCES dataset_versions (id) ON DELETE SET NULL, 
    CONSTRAINT fk_model_versions_experiment_id FOREIGN KEY(experiment_id) REFERENCES experiments (id) ON DELETE SET NULL, 
    CONSTRAINT fk_model_versions_created_by FOREIGN KEY(created_by) REFERENCES users (id) ON DELETE SET NULL
);

CREATE INDEX ix_model_versions_model_id ON model_versions (model_id);

CREATE INDEX ix_model_versions_status ON model_versions (status);

CREATE INDEX ix_model_versions_created_at ON model_versions (created_at);

CREATE TABLE deployments (
    id UUID DEFAULT gen_random_uuid() NOT NULL, 
    model_id UUID NOT NULL, 
    model_version_id UUID NOT NULL, 
    environment VARCHAR(64) DEFAULT 'staging' NOT NULL, 
    format VARCHAR(64) DEFAULT 'onnx' NOT NULL, 
    status TEXT DEFAULT 'pending' NOT NULL, 
    endpoint TEXT, 
    replicas INTEGER DEFAULT '1' NOT NULL, 
    cpu_usage FLOAT, 
    memory_usage FLOAT, 
    deployed_at TIMESTAMP WITH TIME ZONE, 
    deployed_by UUID, 
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
    PRIMARY KEY (id), 
    CONSTRAINT fk_deployments_model_id FOREIGN KEY(model_id) REFERENCES models_registry (id) ON DELETE CASCADE, 
    CONSTRAINT fk_deployments_model_version_id FOREIGN KEY(model_version_id) REFERENCES model_versions (id) ON DELETE CASCADE, 
    CONSTRAINT fk_deployments_deployed_by FOREIGN KEY(deployed_by) REFERENCES users (id) ON DELETE SET NULL
);

CREATE INDEX ix_deployments_model_id ON deployments (model_id);

CREATE INDEX ix_deployments_model_version_id ON deployments (model_version_id);

CREATE INDEX ix_deployments_status ON deployments (status);

CREATE TABLE evaluation_reports (
    id UUID DEFAULT gen_random_uuid() NOT NULL, 
    model_version_id UUID NOT NULL, 
    dataset_version_id UUID, 
    precision_score FLOAT, 
    recall FLOAT, 
    f1 FLOAT, 
    map50 FLOAT, 
    map5095 FLOAT, 
    total_images INTEGER, 
    false_positives INTEGER, 
    false_negatives INTEGER, 
    iou FLOAT, 
    inference_speed_ms FLOAT, 
    created_by UUID, 
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
    PRIMARY KEY (id), 
    CONSTRAINT fk_evaluation_reports_model_version_id FOREIGN KEY(model_version_id) REFERENCES model_versions (id) ON DELETE CASCADE, 
    CONSTRAINT fk_evaluation_reports_dataset_version_id FOREIGN KEY(dataset_version_id) REFERENCES dataset_versions (id) ON DELETE SET NULL, 
    CONSTRAINT fk_evaluation_reports_created_by FOREIGN KEY(created_by) REFERENCES users (id) ON DELETE SET NULL
);

CREATE INDEX ix_evaluation_reports_model_version_id ON evaluation_reports (model_version_id);

CREATE INDEX ix_evaluation_reports_created_at ON evaluation_reports (created_at);

CREATE TABLE notifications (
    id UUID DEFAULT gen_random_uuid() NOT NULL, 
    user_id UUID NOT NULL, 
    type VARCHAR(64) NOT NULL, 
    title VARCHAR(512) NOT NULL, 
    message TEXT, 
    read BOOLEAN DEFAULT false NOT NULL, 
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
    PRIMARY KEY (id), 
    CONSTRAINT fk_notifications_user_id FOREIGN KEY(user_id) REFERENCES users (id) ON DELETE CASCADE
);

CREATE INDEX ix_notifications_user_id ON notifications (user_id);

CREATE INDEX ix_notifications_read ON notifications (read);

CREATE INDEX ix_notifications_created_at ON notifications (created_at);

CREATE TABLE audit_logs (
    id UUID DEFAULT gen_random_uuid() NOT NULL, 
    user_id UUID, 
    action VARCHAR(128) NOT NULL, 
    resource_type VARCHAR(128), 
    resource_id UUID, 
    ip_address VARCHAR(64), 
    user_agent TEXT, 
    payload JSONB, 
    status_code INTEGER, 
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
    PRIMARY KEY (id), 
    CONSTRAINT fk_audit_logs_user_id FOREIGN KEY(user_id) REFERENCES users (id) ON DELETE SET NULL
);

CREATE INDEX ix_audit_logs_user_id ON audit_logs (user_id);

CREATE INDEX ix_audit_logs_action ON audit_logs (action);

CREATE INDEX ix_audit_logs_resource_type ON audit_logs (resource_type);

CREATE INDEX ix_audit_logs_created_at ON audit_logs (created_at);

CREATE TABLE system_configs (
    id UUID DEFAULT gen_random_uuid() NOT NULL, 
    key VARCHAR(255) NOT NULL, 
    value TEXT, 
    value_type VARCHAR(32) DEFAULT 'string' NOT NULL, 
    description TEXT, 
    is_secret BOOLEAN DEFAULT false NOT NULL, 
    updated_by UUID, 
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
    PRIMARY KEY (id), 
    CONSTRAINT fk_system_configs_updated_by FOREIGN KEY(updated_by) REFERENCES users (id) ON DELETE SET NULL, 
    UNIQUE (key)
);

CREATE INDEX ix_system_configs_key ON system_configs (key);

CREATE TABLE api_keys (
    id UUID DEFAULT gen_random_uuid() NOT NULL, 
    user_id UUID NOT NULL, 
    name VARCHAR(255) NOT NULL, 
    key_hash VARCHAR(255) NOT NULL, 
    key_prefix VARCHAR(16) NOT NULL, 
    scopes JSONB, 
    last_used_at TIMESTAMP WITH TIME ZONE, 
    expires_at TIMESTAMP WITH TIME ZONE, 
    is_active BOOLEAN DEFAULT true NOT NULL, 
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
    PRIMARY KEY (id), 
    CONSTRAINT fk_api_keys_user_id FOREIGN KEY(user_id) REFERENCES users (id) ON DELETE CASCADE, 
    UNIQUE (key_hash)
);

CREATE INDEX ix_api_keys_user_id ON api_keys (user_id);

CREATE INDEX ix_api_keys_key_prefix ON api_keys (key_prefix);

CREATE INDEX ix_api_keys_is_active ON api_keys (is_active);

INSERT INTO alembic_version (version_num) VALUES ('001') RETURNING alembic_version.version_num;

COMMIT;

