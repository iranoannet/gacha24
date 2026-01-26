
-- Drop existing policies
DROP POLICY IF EXISTS "Users can view own drawn slots" ON public.gacha_slots;
DROP POLICY IF EXISTS "Admins can manage slots" ON public.gacha_slots;

-- Create PERMISSIVE policies (default behavior, but being explicit)
-- Admin can do everything
CREATE POLICY "Admins can manage slots"
ON public.gacha_slots
AS PERMISSIVE
FOR ALL
USING (is_admin())
WITH CHECK (is_admin());

-- Users can view their own drawn slots
CREATE POLICY "Users can view own drawn slots"
ON public.gacha_slots
AS PERMISSIVE
FOR SELECT
USING (is_drawn = true AND auth.uid() = user_id);
