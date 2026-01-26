-- Drop and recreate the cards_public view without security_invoker
-- This allows the view to bypass RLS on the cards table

DROP VIEW IF EXISTS public.cards_public;

CREATE VIEW public.cards_public AS
SELECT 
    id,
    gacha_id,
    name,
    image_url,
    prize_tier,
    rarity,
    conversion_points,
    created_at
FROM cards;

-- Grant select access to all users (including anonymous)
GRANT SELECT ON public.cards_public TO anon, authenticated;