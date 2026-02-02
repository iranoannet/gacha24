-- Add stock_status column to inventory_actions for legacy shire_state tracking
ALTER TABLE public.inventory_actions
ADD COLUMN IF NOT EXISTS stock_status integer DEFAULT NULL;

-- Add legacy_pack_card_id for reference
ALTER TABLE public.inventory_actions
ADD COLUMN IF NOT EXISTS legacy_pack_card_id bigint DEFAULT NULL;

-- Add legacy_id for tracking original record
ALTER TABLE public.inventory_actions
ADD COLUMN IF NOT EXISTS legacy_id bigint DEFAULT NULL;

-- Add index for legacy lookups
CREATE INDEX IF NOT EXISTS idx_inventory_actions_legacy_id 
ON public.inventory_actions(legacy_id) WHERE legacy_id IS NOT NULL;