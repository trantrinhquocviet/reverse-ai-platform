-- RLS policies: authenticated users have full access to all tables
-- Anon users have read-only access to videos, warehouses, brands

ALTER TABLE videos ENABLE ROW LEVEL SECURITY;
ALTER TABLE warehouses ENABLE ROW LEVEL SECURITY;
ALTER TABLE brands ENABLE ROW LEVEL SECURITY;
ALTER TABLE dataset_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE training_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE processing_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE frames ENABLE ROW LEVEL SECURITY;
ALTER TABLE ocr_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE annotations ENABLE ROW LEVEL SECURITY;
ALTER TABLE datasets ENABLE ROW LEVEL SECURITY;
ALTER TABLE dataset_versions ENABLE ROW LEVEL SECURITY;

-- Authenticated users: full access
CREATE POLICY "auth_all_videos"         ON videos         FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all_warehouses"     ON warehouses     FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all_brands"         ON brands         FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all_dataset_images" ON dataset_images FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all_training_jobs"  ON training_jobs  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all_proc_jobs"      ON processing_jobs FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all_frames"         ON frames         FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all_ocr_results"    ON ocr_results    FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all_annotations"    ON annotations    FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all_datasets"       ON datasets       FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all_dataset_ver"    ON dataset_versions FOR ALL TO authenticated USING (true) WITH CHECK (true);
