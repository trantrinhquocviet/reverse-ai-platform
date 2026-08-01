-- Storage: create videos bucket (if not exists) and set policies
-- Run this AFTER the initial schema migration

-- Create the videos bucket (public)
INSERT INTO storage.buckets (id, name, public)
VALUES ('videos', 'videos', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Allow anonymous users to upload files to the videos bucket
CREATE POLICY "Allow anon uploads to videos bucket"
ON storage.objects FOR INSERT
TO anon
WITH CHECK (bucket_id = 'videos');

-- Allow anonymous users to read files from the videos bucket
CREATE POLICY "Allow public reads from videos bucket"
ON storage.objects FOR SELECT
TO anon
USING (bucket_id = 'videos');
