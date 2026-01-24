-- Create card category enum
CREATE TYPE public.card_category AS ENUM ('yugioh', 'pokemon', 'weiss', 'onepiece');

-- Add category column to cards table
ALTER TABLE public.cards ADD COLUMN category public.card_category;

-- Add category column to gacha_masters table
ALTER TABLE public.gacha_masters ADD COLUMN category public.card_category;

-- Add comments
COMMENT ON COLUMN public.cards.category IS 'Card category: 遊戯王(yugioh), ポケモン(pokemon), ヴァイスシュバルツ(weiss), ワンピース(onepiece)';
COMMENT ON COLUMN public.gacha_masters.category IS 'Gacha category matching card categories';