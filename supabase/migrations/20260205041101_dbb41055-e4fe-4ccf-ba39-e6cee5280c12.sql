-- Add cost management columns to daily_analytics
ALTER TABLE public.daily_analytics 
ADD COLUMN IF NOT EXISTS cost INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS expenses INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS gross_profit_margin DECIMAL(5,2) DEFAULT 0;

-- Add comment for clarity
COMMENT ON COLUMN public.daily_analytics.cost IS '仕入れ原価';
COMMENT ON COLUMN public.daily_analytics.expenses IS 'その他経費';
COMMENT ON COLUMN public.daily_analytics.gross_profit_margin IS '粗利率 (wait_arari)';