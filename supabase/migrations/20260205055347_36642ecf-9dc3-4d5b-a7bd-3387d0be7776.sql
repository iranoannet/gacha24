-- Drop the partial index and create a proper constraint
DROP INDEX IF EXISTS inventory_actions_legacy_id_tenant_id_unique;

-- Create a composite unique constraint that works with upsert
ALTER TABLE inventory_actions 
ADD CONSTRAINT inventory_actions_legacy_tenant_unique 
UNIQUE (legacy_id, tenant_id);