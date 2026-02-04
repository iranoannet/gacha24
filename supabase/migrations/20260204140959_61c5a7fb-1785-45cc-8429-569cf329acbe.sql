-- Add unique constraint for user_transactions to enable proper upsert
-- Using a composite key of user_id + created_at + total_spent_points for transaction uniqueness
CREATE INDEX IF NOT EXISTS idx_user_transactions_dedup 
ON user_transactions(user_id, tenant_id, created_at, total_spent_points);

-- Add unique constraint for inventory_actions using legacy_pack_card_id
ALTER TABLE inventory_actions 
ADD CONSTRAINT inventory_actions_legacy_pack_card_unique 
UNIQUE (legacy_pack_card_id, tenant_id);

-- Add unique constraint for legacy_id in inventory_actions for shipping history
CREATE UNIQUE INDEX IF NOT EXISTS idx_inventory_actions_legacy_id 
ON inventory_actions(legacy_id, tenant_id) 
WHERE legacy_id IS NOT NULL;