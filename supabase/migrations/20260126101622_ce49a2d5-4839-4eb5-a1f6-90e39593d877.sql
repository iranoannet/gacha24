-- フェイク演出確率カラムを追加（0-100の整数でパーセンテージを表す）
ALTER TABLE public.gacha_masters 
ADD COLUMN fake_s_tier_chance INTEGER NOT NULL DEFAULT 15
CHECK (fake_s_tier_chance >= 0 AND fake_s_tier_chance <= 100);

COMMENT ON COLUMN public.gacha_masters.fake_s_tier_chance IS 'Probability of fake S-tier animation in Type B animation (0-100 percent)';