-- handle_new_user 関数を更新
-- 新規ユーザー登録時に、tenant_id が指定されていれば
-- そのテナント用のプロファイルを作成

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_tenant_id uuid;
BEGIN
  -- Get tenant_id from user metadata (set during signup)
  v_tenant_id := (NEW.raw_user_meta_data->>'tenant_id')::uuid;

  -- Create profile with tenant association
  -- 同じユーザーが複数テナントにプロファイルを持つことを許可
  INSERT INTO public.profiles (user_id, display_name, points_balance, tenant_id, email)
  VALUES (
    NEW.id, 
    COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.email), 
    0,
    v_tenant_id,
    NEW.email
  )
  ON CONFLICT (user_id, tenant_id) DO NOTHING;
  
  -- Create user role (only if not exists)
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'user')
  ON CONFLICT DO NOTHING;
  
  RETURN NEW;
END;
$$;

-- 既存ユーザーが別テナントで登録できるようにする関数を追加
CREATE OR REPLACE FUNCTION public.create_tenant_profile(
  p_user_id uuid,
  p_tenant_id uuid,
  p_display_name text DEFAULT NULL,
  p_email text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_profile_id uuid;
BEGIN
  -- 既存ユーザーの新しいテナントプロファイルを作成
  INSERT INTO public.profiles (user_id, display_name, points_balance, tenant_id, email)
  VALUES (
    p_user_id,
    COALESCE(p_display_name, p_email),
    0,
    p_tenant_id,
    p_email
  )
  ON CONFLICT (user_id, tenant_id) DO UPDATE
  SET email = EXCLUDED.email
  RETURNING id INTO v_profile_id;
  
  RETURN v_profile_id;
END;
$$;