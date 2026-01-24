-- Add prize_tier column to cards table (S賞, A賞, B賞, ハズレ)
-- Remove the rarity enum and add prize_tier enum instead

-- Create prize tier enum
CREATE TYPE public.prize_tier AS ENUM ('S', 'A', 'B', 'miss');

-- Add prize_tier column with default 'miss' (ハズレ)
ALTER TABLE public.cards ADD COLUMN prize_tier public.prize_tier NOT NULL DEFAULT 'miss';

-- Add sort order for prize tiers (S=1, A=2, B=3, miss=99)
COMMENT ON COLUMN public.cards.prize_tier IS 'Prize tier: S賞, A賞, B賞, or ハズレ(miss). Used for display ordering.';