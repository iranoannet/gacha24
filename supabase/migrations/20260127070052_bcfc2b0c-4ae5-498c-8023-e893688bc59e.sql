-- Create helper function for super admin check (now that enum value is committed)
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(auth.uid(), 'super_admin')
$$;

-- RLS policies for tenants table
CREATE POLICY "Super admins can manage all tenants"
ON public.tenants
FOR ALL
USING (is_super_admin());

CREATE POLICY "Admins can view their own tenant"
ON public.tenants
FOR SELECT
USING (id = get_user_tenant_id());

-- Update gacha_masters policies to include tenant filtering
DROP POLICY IF EXISTS "Admins can manage gachas" ON public.gacha_masters;
DROP POLICY IF EXISTS "Anyone can view active gachas" ON public.gacha_masters;

CREATE POLICY "Super admins can manage all gachas"
ON public.gacha_masters
FOR ALL
USING (is_super_admin());

CREATE POLICY "Admins can manage their tenant gachas"
ON public.gacha_masters
FOR ALL
USING (is_admin() AND (tenant_id IS NULL OR tenant_id = get_user_tenant_id()));

CREATE POLICY "Users can view active gachas"
ON public.gacha_masters
FOR SELECT
USING (status = 'active' AND (tenant_id IS NULL OR tenant_id = get_user_tenant_id()));

-- Update cards policies
DROP POLICY IF EXISTS "Admins can manage cards" ON public.cards;
DROP POLICY IF EXISTS "Only admins can view cards directly" ON public.cards;

CREATE POLICY "Super admins can manage all cards"
ON public.cards
FOR ALL
USING (is_super_admin());

CREATE POLICY "Admins can manage their tenant cards"
ON public.cards
FOR ALL
USING (is_admin() AND (tenant_id IS NULL OR tenant_id = get_user_tenant_id()));

-- Update profiles policies for tenant
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;

CREATE POLICY "Super admins can view all profiles"
ON public.profiles
FOR SELECT
USING (is_super_admin());

CREATE POLICY "Admins can view tenant profiles"
ON public.profiles
FOR SELECT
USING (is_admin() AND (tenant_id IS NULL OR tenant_id = get_user_tenant_id()));

CREATE POLICY "Users can view own profile"
ON public.profiles
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Super admins can update all profiles"
ON public.profiles
FOR UPDATE
USING (is_super_admin());

CREATE POLICY "Admins can update tenant profiles"
ON public.profiles
FOR UPDATE
USING (is_admin() AND (tenant_id IS NULL OR tenant_id = get_user_tenant_id()));

CREATE POLICY "Users can update own profile"
ON public.profiles
FOR UPDATE
USING (auth.uid() = user_id);

-- Update hero_banners policies
DROP POLICY IF EXISTS "Admins can manage banners" ON public.hero_banners;
DROP POLICY IF EXISTS "Anyone can view active banners" ON public.hero_banners;

CREATE POLICY "Super admins can manage all banners"
ON public.hero_banners
FOR ALL
USING (is_super_admin());

CREATE POLICY "Admins can manage their tenant banners"
ON public.hero_banners
FOR ALL
USING (is_admin() AND (tenant_id IS NULL OR tenant_id = get_user_tenant_id()));

CREATE POLICY "Users can view active banners"
ON public.hero_banners
FOR SELECT
USING (is_active = true AND (tenant_id IS NULL OR tenant_id = get_user_tenant_id()));

-- Update user_transactions policies
DROP POLICY IF EXISTS "Admins can manage transactions" ON public.user_transactions;

CREATE POLICY "Super admins can manage all transactions"
ON public.user_transactions
FOR ALL
USING (is_super_admin());

CREATE POLICY "Admins can manage tenant transactions"
ON public.user_transactions
FOR ALL
USING (is_admin() AND (tenant_id IS NULL OR tenant_id = get_user_tenant_id()));

-- Update inventory_actions policies
DROP POLICY IF EXISTS "Admins can manage inventory actions" ON public.inventory_actions;

CREATE POLICY "Super admins can manage all inventory actions"
ON public.inventory_actions
FOR ALL
USING (is_super_admin());

CREATE POLICY "Admins can manage tenant inventory actions"
ON public.inventory_actions
FOR ALL
USING (is_admin() AND (tenant_id IS NULL OR tenant_id = get_user_tenant_id()));

-- Update payments policies
DROP POLICY IF EXISTS "Admins can manage payments" ON public.payments;

CREATE POLICY "Super admins can manage all payments"
ON public.payments
FOR ALL
USING (is_super_admin());

CREATE POLICY "Admins can manage tenant payments"
ON public.payments
FOR ALL
USING (is_admin() AND (tenant_id IS NULL OR tenant_id = get_user_tenant_id()));

-- Update gacha_slots policies
DROP POLICY IF EXISTS "Admins can manage slots" ON public.gacha_slots;

CREATE POLICY "Super admins can manage all slots"
ON public.gacha_slots
FOR ALL
USING (is_super_admin());

-- Update admin_user_notes policies
DROP POLICY IF EXISTS "Admins can manage user notes" ON public.admin_user_notes;

CREATE POLICY "Super admins can manage all user notes"
ON public.admin_user_notes
FOR ALL
USING (is_super_admin());

CREATE POLICY "Admins can manage user notes"
ON public.admin_user_notes
FOR ALL
USING (is_admin());