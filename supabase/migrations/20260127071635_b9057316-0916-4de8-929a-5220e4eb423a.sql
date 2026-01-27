-- Add custom_domain column to tenants table for custom domain support
ALTER TABLE public.tenants 
ADD COLUMN IF NOT EXISTS custom_domain text UNIQUE;

-- Add index for faster domain lookup
CREATE INDEX IF NOT EXISTS idx_tenants_custom_domain ON public.tenants(custom_domain) WHERE custom_domain IS NOT NULL;

-- Insert the initial/default tenant for the existing gacha site
INSERT INTO public.tenants (name, slug, is_active, primary_color)
VALUES ('デフォルトサイト', 'default', true, '#D4AF37')
ON CONFLICT (slug) DO NOTHING;