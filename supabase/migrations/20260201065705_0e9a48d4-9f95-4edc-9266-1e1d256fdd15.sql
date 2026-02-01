-- Migration table to store imported user data
CREATE TABLE public.user_migrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  tenant_id uuid REFERENCES public.tenants(id),
  display_name text,
  last_name text,
  first_name text,
  points_balance integer DEFAULT 0,
  phone_number text,
  postal_code text,
  prefecture text,
  city text,
  address_line1 text,
  address_line2 text,
  legacy_user_id bigint,
  is_applied boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  UNIQUE(email, tenant_id)
);

-- Enable RLS
ALTER TABLE public.user_migrations ENABLE ROW LEVEL SECURITY;

-- Only admins and super admins can access
CREATE POLICY "Admins can manage migrations"
ON public.user_migrations
FOR ALL
USING (is_admin() OR is_super_admin());

-- Index for quick lookup
CREATE INDEX idx_user_migrations_email_tenant ON public.user_migrations(email, tenant_id);
