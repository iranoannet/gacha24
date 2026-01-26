-- ガチャマスタに演出タイプを追加
ALTER TABLE public.gacha_masters 
ADD COLUMN animation_type TEXT NOT NULL DEFAULT 'A';

-- A = 従来のスロット風演出
-- B = カードパック開封風演出

COMMENT ON COLUMN public.gacha_masters.animation_type IS 'Animation type: A = slot machine style, B = card pack opening style';