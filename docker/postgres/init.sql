-- PostgreSQL initialization script
-- This script runs once when the postgres container is first created.

-- Ensure the database exists (handled by POSTGRES_DB env var, but kept for clarity)
-- CREATE DATABASE reverse_ai; -- handled by Docker image

-- Enable useful extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";  -- for fuzzy text search
CREATE EXTENSION IF NOT EXISTS "btree_gin"; -- for composite indexes

-- Create application user with limited privileges (optional hardening)
-- In production, the app should NOT use the superuser account.
-- DO $$
-- BEGIN
--   IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'app_user') THEN
--     CREATE ROLE app_user LOGIN PASSWORD 'change_me_in_production';
--   END IF;
-- END
-- $$;

-- Grant privileges to the app user
-- GRANT CONNECT ON DATABASE reverse_ai TO app_user;
-- GRANT USAGE ON SCHEMA public TO app_user;
-- GRANT CREATE ON SCHEMA public TO app_user;

-- The actual schema (tables, indexes, enums) is managed by Alembic migrations.
-- Run: alembic upgrade head

SELECT 'Database initialized successfully' AS status;
