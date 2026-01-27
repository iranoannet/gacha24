-- Step 1: Add super_admin role to app_role enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'super_admin';

-- Create tenants table
CREATE TABLE public.tenants (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  logo_url TEXT,
  primary_color TEXT DEFAULT '#D4AF37',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on tenants
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;

-- Add tenant_id to existing tables (if not already added)
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'gacha_masters' AND column_name = 'tenant_id') THEN
    ALTER TABLE public.gacha_masters ADD COLUMN tenant_id UUID REFERENCES public.tenants(id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'cards' AND column_name = 'tenant_id') THEN
    ALTER TABLE public.cards ADD COLUMN tenant_id UUID REFERENCES public.tenants(id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'tenant_id') THEN
    ALTER TABLE public.profiles ADD COLUMN tenant_id UUID REFERENCES public.tenants(id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_transactions' AND column_name = 'tenant_id') THEN
    ALTER TABLE public.user_transactions ADD COLUMN tenant_id UUID REFERENCES public.tenants(id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'inventory_actions' AND column_name = 'tenant_id') THEN
    ALTER TABLE public.inventory_actions ADD COLUMN tenant_id UUID REFERENCES public.tenants(id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'payments' AND column_name = 'tenant_id') THEN
    ALTER TABLE public.payments ADD COLUMN tenant_id UUID REFERENCES public.tenants(id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'hero_banners' AND column_name = 'tenant_id') THEN
    ALTER TABLE public.hero_banners ADD COLUMN tenant_id UUID REFERENCES public.tenants(id);
  END IF;
END $$;

-- Create helper function to get user's tenant_id (doesn't use super_admin)
CREATE OR REPLACE FUNCTION public.get_user_tenant_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT tenant_id FROM public.profiles WHERE user_id = auth.uid()
$$;

-- Create trigger for updated_at on tenants
CREATE TRIGGER update_tenants_updated_at
BEFORE UPDATE ON public.tenants
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for tenant_id columns for performance
CREATE INDEX IF NOT EXISTS idx_gacha_masters_tenant_id ON public.gacha_masters(tenant_id);
CREATE INDEX IF NOT EXISTS idx_cards_tenant_id ON public.cards(tenant_id);
CREATE INDEX IF NOT EXISTS idx_profiles_tenant_id ON public.profiles(tenant_id);
CREATE INDEX IF NOT EXISTS idx_user_transactions_tenant_id ON public.user_transactions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_inventory_actions_tenant_id ON public.inventory_actions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_hero_banners_tenant_id ON public.hero_banners(tenant_id);