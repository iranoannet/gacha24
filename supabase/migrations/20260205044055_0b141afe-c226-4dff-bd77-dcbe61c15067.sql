-- Add legacy_user_id column to inventory_actions for pre-login data storage
ALTER TABLE public.inventory_actions
ALTER COLUMN user_id DROP NOT NULL;

-- Add legacy_user_id column if not exists
ALTER TABLE public.inventory_actions
ADD COLUMN IF NOT EXISTS legacy_user_id BIGINT;

-- Create index for efficient lookup
CREATE INDEX IF NOT EXISTS idx_inventory_actions_legacy_user_id 
ON public.inventory_actions(legacy_user_id, tenant_id) 
WHERE legacy_user_id IS NOT NULL;

-- Add comment
COMMENT ON COLUMN public.inventory_actions.legacy_user_id IS 'レガシーユーザーID（ログイン前のデータ保存用）';