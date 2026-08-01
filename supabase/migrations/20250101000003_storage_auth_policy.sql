-- Allow authenticated users to upload and manage files in the videos bucket
CREATE POLICY "Allow authenticated uploads to videos bucket"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'videos');

CREATE POLICY "Allow authenticated reads from videos bucket"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'videos');

CREATE POLICY "Allow authenticated deletes from videos bucket"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'videos');
