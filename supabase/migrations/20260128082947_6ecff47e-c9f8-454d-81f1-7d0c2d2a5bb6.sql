-- Drop the existing policy that doesn't work for non-authenticated users
DROP POLICY IF EXISTS "Users can view active gachas" ON public.gacha_masters;

-- Create a new policy that allows everyone to view active gachas
-- Since tenant filtering is done in the application code (useTenantGachas hook),
-- the RLS policy just needs to allow SELECT on active gachas
CREATE POLICY "Public can view active gachas" 
ON public.gacha_masters 
FOR SELECT 
USING (status = 'active'::gacha_status);

-- Add a comment explaining the policy
COMMENT ON POLICY "Public can view active gachas" ON public.gacha_masters IS 
'Allows everyone (including non-authenticated users) to view active gachas. Tenant filtering is handled at the application level.';