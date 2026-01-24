-- Add indexes for better performance on large tables
CREATE INDEX IF NOT EXISTS idx_cards_category ON public.cards(category);
CREATE INDEX IF NOT EXISTS idx_cards_gacha_id ON public.cards(gacha_id);
CREATE INDEX IF NOT EXISTS idx_cards_category_gacha_id ON public.cards(category, gacha_id);
CREATE INDEX IF NOT EXISTS idx_cards_name ON public.cards USING gin(to_tsvector('simple', name));