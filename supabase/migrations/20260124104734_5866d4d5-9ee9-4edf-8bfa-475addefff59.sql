-- Create storage bucket for gacha banners
INSERT INTO storage.buckets (id, name, public)
VALUES ('gacha-banners', 'gacha-banners', true);

-- Allow authenticated admins to upload to gacha-banners bucket
CREATE POLICY "Admins can upload gacha banners"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'gacha-banners' AND is_admin());

-- Allow admins to update gacha banners
CREATE POLICY "Admins can update gacha banners"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'gacha-banners' AND is_admin());

-- Allow admins to delete gacha banners
CREATE POLICY "Admins can delete gacha banners"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'gacha-banners' AND is_admin());

-- Allow anyone to view gacha banners (public bucket)
CREATE POLICY "Anyone can view gacha banners"
ON storage.objects FOR SELECT
USING (bucket_id = 'gacha-banners');