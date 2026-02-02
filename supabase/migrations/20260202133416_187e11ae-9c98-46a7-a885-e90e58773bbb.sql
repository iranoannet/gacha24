-- Create table for daily analytics/sales data
CREATE TABLE public.daily_analytics (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID REFERENCES public.tenants(id),
  date DATE NOT NULL,
  payment_amount BIGINT DEFAULT 0,
  profit BIGINT DEFAULT 0,
  points_used BIGINT DEFAULT 0,
  status INTEGER DEFAULT 0,
  legacy_id INTEGER,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(tenant_id, date)
);

-- Enable RLS
ALTER TABLE public.daily_analytics ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Admins can view tenant daily analytics"
ON public.daily_analytics
FOR SELECT
USING (is_admin() AND (tenant_id IS NULL OR tenant_id = get_user_tenant_id()));

CREATE POLICY "Super admins can manage all daily analytics"
ON public.daily_analytics
FOR ALL
USING (is_super_admin());

-- Index for fast date-range queries
CREATE INDEX idx_daily_analytics_tenant_date ON public.daily_analytics(tenant_id, date DESC);