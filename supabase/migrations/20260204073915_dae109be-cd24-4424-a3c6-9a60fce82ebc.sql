-- Create import history table
CREATE TABLE public.import_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  data_type TEXT NOT NULL,
  records_processed INTEGER DEFAULT 0,
  records_inserted INTEGER DEFAULT 0,
  records_skipped INTEGER DEFAULT 0,
  records_failed INTEGER DEFAULT 0,
  status TEXT DEFAULT 'completed',
  imported_by UUID,
  imported_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  error_summary TEXT
);

-- Enable RLS
ALTER TABLE public.import_history ENABLE ROW LEVEL SECURITY;

-- Policy for super admins
CREATE POLICY "Super admins can manage all import history"
ON public.import_history
FOR ALL
USING (public.is_super_admin())
WITH CHECK (public.is_super_admin());

-- Policy for admins to view their tenant's history
CREATE POLICY "Admins can view their tenant import history"
ON public.import_history
FOR SELECT
USING (
  public.is_admin() AND 
  tenant_id = public.get_user_tenant_id()
);

-- Index for faster queries
CREATE INDEX idx_import_history_tenant_date ON public.import_history(tenant_id, imported_at DESC);
CREATE INDEX idx_import_history_data_type ON public.import_history(tenant_id, data_type);