-- profiles テーブルの複合ユニーク制約を追加
-- 同じユーザーが複数テナントにプロファイルを持てるように変更

-- 既存のuser_id一意制約を削除（存在する場合）
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_user_id_key;

-- user_id と tenant_id の複合一意制約を追加
-- これにより、同じユーザーが複数のテナントにプロファイルを持つことが可能
ALTER TABLE public.profiles ADD CONSTRAINT profiles_user_tenant_unique UNIQUE (user_id, tenant_id);

-- user_transactions テーブルにもテナント必須制約を追加するためのデフォルト関数更新
-- inventory_actions も同様

-- get_user_tenant_id 関数を更新して、現在のテナントコンテキストを考慮
CREATE OR REPLACE FUNCTION public.get_user_tenant_id()
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT tenant_id FROM public.profiles WHERE user_id = auth.uid() LIMIT 1
$$;