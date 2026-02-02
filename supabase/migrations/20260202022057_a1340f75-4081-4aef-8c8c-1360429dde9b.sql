-- Create gacha animation videos table
CREATE TABLE public.gacha_animation_videos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  gacha_id UUID NOT NULL REFERENCES public.gacha_masters(id) ON DELETE CASCADE,
  prize_tier TEXT NOT NULL CHECK (prize_tier IN ('S', 'A', 'B', 'C', 'D', 'E')),
  video_url TEXT NOT NULL,
  file_name TEXT,
  file_size INTEGER,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  tenant_id UUID REFERENCES public.tenants(id)
);

-- Enable RLS
ALTER TABLE public.gacha_animation_videos ENABLE ROW LEVEL SECURITY;

-- Admins can manage their tenant's animation videos
CREATE POLICY "Admins can manage tenant animation videos"
ON public.gacha_animation_videos
FOR ALL
USING (is_admin() AND (tenant_id IS NULL OR tenant_id = get_user_tenant_id()));

-- Super admins can manage all animation videos
CREATE POLICY "Super admins can manage all animation videos"
ON public.gacha_animation_videos
FOR ALL
USING (is_super_admin());

-- Anyone can view animation videos (needed for gacha play)
CREATE POLICY "Anyone can view animation videos"
ON public.gacha_animation_videos
FOR SELECT
USING (true);

-- Create index for faster lookups
CREATE INDEX idx_gacha_animation_videos_gacha_tier ON public.gacha_animation_videos(gacha_id, prize_tier);

-- Create storage bucket for animation videos
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('gacha-animations', 'gacha-animations', true, 104857600);

-- Storage policies for gacha-animations bucket
CREATE POLICY "Anyone can view animation videos"
ON storage.objects FOR SELECT
USING (bucket_id = 'gacha-animations');

CREATE POLICY "Admins can upload animation videos"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'gacha-animations' AND (is_admin() OR is_super_admin()));

CREATE POLICY "Admins can update animation videos"
ON storage.objects FOR UPDATE
USING (bucket_id = 'gacha-animations' AND (is_admin() OR is_super_admin()));

CREATE POLICY "Admins can delete animation videos"
ON storage.objects FOR DELETE
USING (bucket_id = 'gacha-animations' AND (is_admin() OR is_super_admin()));