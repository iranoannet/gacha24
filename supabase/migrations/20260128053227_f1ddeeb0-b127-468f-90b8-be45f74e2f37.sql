-- Add display_tags column to gacha_masters for tag-based display sections
ALTER TABLE public.gacha_masters 
ADD COLUMN IF NOT EXISTS display_tags text[] DEFAULT '{}';

COMMENT ON COLUMN public.gacha_masters.display_tags IS 'Array of display tags for homepage sections: new_arrivals, hot_items';