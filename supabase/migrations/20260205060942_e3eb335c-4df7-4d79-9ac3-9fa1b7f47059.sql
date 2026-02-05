
-- Create storage bucket for CSV imports
INSERT INTO storage.buckets (id, name, public)
VALUES ('import-files', 'import-files', false)
ON CONFLICT (id) DO NOTHING;

-- Create RLS policies for import-files bucket
CREATE POLICY "Super admins can manage import files"
ON storage.objects
FOR ALL
USING (bucket_id = 'import-files' AND public.is_super_admin())
WITH CHECK (bucket_id = 'import-files' AND public.is_super_admin());

CREATE POLICY "Admins can view import files"
ON storage.objects
FOR SELECT
USING (bucket_id = 'import-files' AND public.is_admin());

-- Add storage_path column to import_history to reference stored files
ALTER TABLE public.import_history
ADD COLUMN IF NOT EXISTS storage_path TEXT;
