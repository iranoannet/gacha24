-- Create hero_banners table for homepage carousel
CREATE TABLE public.hero_banners (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT,
  image_url TEXT NOT NULL,
  link_url TEXT,
  display_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.hero_banners ENABLE ROW LEVEL SECURITY;

-- Anyone can view active banners
CREATE POLICY "Anyone can view active banners"
ON public.hero_banners
FOR SELECT
USING (is_active = true OR is_admin());

-- Only admins can manage banners
CREATE POLICY "Admins can manage banners"
ON public.hero_banners
FOR ALL
USING (is_admin());

-- Create trigger for updated_at
CREATE TRIGGER update_hero_banners_updated_at
BEFORE UPDATE ON public.hero_banners
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create storage bucket for hero banners
INSERT INTO storage.buckets (id, name, public) VALUES ('hero-banners', 'hero-banners', true);

-- Storage policies for hero banners
CREATE POLICY "Hero banner images are publicly accessible"
ON storage.objects
FOR SELECT
USING (bucket_id = 'hero-banners');

CREATE POLICY "Admins can upload hero banners"
ON storage.objects
FOR INSERT
WITH CHECK (bucket_id = 'hero-banners' AND is_admin());

CREATE POLICY "Admins can update hero banners"
ON storage.objects
FOR UPDATE
USING (bucket_id = 'hero-banners' AND is_admin());

CREATE POLICY "Admins can delete hero banners"
ON storage.objects
FOR DELETE
USING (bucket_id = 'hero-banners' AND is_admin());