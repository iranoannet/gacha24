-- ガチャスロットに選択期限を追加
ALTER TABLE gacha_slots
ADD COLUMN selection_deadline TIMESTAMP WITH TIME ZONE;

-- 既存の抽選済みスロットに対しても期限を設定（drawn_at + 2週間）
UPDATE gacha_slots
SET selection_deadline = drawn_at + INTERVAL '14 days'
WHERE is_drawn = true AND selection_deadline IS NULL;

-- 今後新規抽選時に自動で期限を設定するトリガー関数
CREATE OR REPLACE FUNCTION public.set_selection_deadline()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_drawn = true AND OLD.is_drawn = false THEN
    NEW.selection_deadline = NEW.drawn_at + INTERVAL '14 days';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- トリガー作成
CREATE TRIGGER set_gacha_slot_selection_deadline
BEFORE UPDATE ON gacha_slots
FOR EACH ROW
EXECUTE FUNCTION public.set_selection_deadline();

-- インデックスを作成して期限切れスロットの検索を高速化
CREATE INDEX idx_gacha_slots_selection_deadline 
ON gacha_slots (selection_deadline) 
WHERE is_drawn = true AND selection_deadline IS NOT NULL;