-- cards_publicビューを更新してprize_tierを追加
DROP VIEW IF EXISTS public.cards_public;

CREATE VIEW public.cards_public
WITH (security_invoker=on) AS
  SELECT 
    id, 
    gacha_id, 
    name, 
    image_url, 
    prize_tier,
    rarity, 
    conversion_points, 
    created_at
  FROM public.cards;