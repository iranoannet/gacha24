-- Drop the existing policy that doesn't work for non-authenticated users
DROP POLICY IF EXISTS "Users can view active banners" ON public.hero_banners;

-- Create a new policy that allows everyone to view active banners
CREATE POLICY "Public can view active banners" 
ON public.hero_banners 
FOR SELECT 
USING (is_active = true);

-- Add a comment explaining the policy
COMMENT ON POLICY "Public can view active banners" ON public.hero_banners IS 
'Allows everyone (including non-authenticated users) to view active banners. Tenant filtering is handled at the application level.';