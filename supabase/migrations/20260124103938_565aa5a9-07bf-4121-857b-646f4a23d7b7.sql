-- Drop the existing policy that exposes admin_note
DROP POLICY IF EXISTS "Anyone can view cards without admin notes" ON public.cards;

-- Create a view that excludes admin_note for public access
CREATE VIEW public.cards_public
WITH (security_invoker=on) AS
  SELECT id, name, image_url, created_at, conversion_points, rarity, gacha_id
  FROM public.cards;

-- Create a new SELECT policy that only allows admins to view cards directly
-- (public users should use the view)
CREATE POLICY "Only admins can view cards directly"
  ON public.cards FOR SELECT
  USING (is_admin());