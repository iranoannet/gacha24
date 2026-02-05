-- Add unique constraint for upsert on legacy imports
CREATE UNIQUE INDEX IF NOT EXISTS inventory_actions_legacy_id_tenant_id_unique 
ON inventory_actions (legacy_id, tenant_id) 
WHERE legacy_id IS NOT NULL;