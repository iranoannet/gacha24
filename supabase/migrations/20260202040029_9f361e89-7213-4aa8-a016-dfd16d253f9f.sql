-- Create animation patterns table
CREATE TABLE public.gacha_animation_patterns (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add unique constraint for pattern name within tenant
CREATE UNIQUE INDEX idx_animation_patterns_tenant_name ON public.gacha_animation_patterns(tenant_id, name);

-- Enable RLS
ALTER TABLE public.gacha_animation_patterns ENABLE ROW LEVEL SECURITY;

-- RLS policies for animation patterns
CREATE POLICY "Anyone can view animation patterns"
ON public.gacha_animation_patterns FOR SELECT
USING (true);

CREATE POLICY "Admins can manage tenant animation patterns"
ON public.gacha_animation_patterns FOR ALL
USING (is_admin() AND (tenant_id IS NULL OR tenant_id = get_user_tenant_id()));

CREATE POLICY "Super admins can manage all animation patterns"
ON public.gacha_animation_patterns FOR ALL
USING (is_super_admin());

-- Add pattern_id column to gacha_animation_videos
ALTER TABLE public.gacha_animation_videos
ADD COLUMN pattern_id UUID REFERENCES public.gacha_animation_patterns(id) ON DELETE CASCADE;

-- Add index for faster lookups
CREATE INDEX idx_animation_videos_pattern ON public.gacha_animation_videos(pattern_id);

-- Update gacha_masters to reference pattern instead of just animation_type text
ALTER TABLE public.gacha_masters
ADD COLUMN animation_pattern_id UUID REFERENCES public.gacha_animation_patterns(id) ON DELETE SET NULL;

-- Add trigger for updated_at on patterns
CREATE TRIGGER update_animation_patterns_updated_at
BEFORE UPDATE ON public.gacha_animation_patterns
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();