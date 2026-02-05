-- Create function to link inventory_actions when user logs in
CREATE OR REPLACE FUNCTION public.link_inventory_actions_on_login()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_legacy_user_id BIGINT;
BEGIN
  -- Get legacy_user_id from user_migrations
  SELECT legacy_user_id INTO v_legacy_user_id
  FROM public.user_migrations
  WHERE email = NEW.email
    AND tenant_id = NEW.tenant_id
  LIMIT 1;

  -- If legacy_user_id found, update inventory_actions
  IF v_legacy_user_id IS NOT NULL THEN
    UPDATE public.inventory_actions
    SET user_id = NEW.user_id
    WHERE legacy_user_id = v_legacy_user_id
      AND tenant_id = NEW.tenant_id
      AND user_id IS NULL;
  END IF;

  RETURN NEW;
END;
$$;

-- Create trigger on profiles table
DROP TRIGGER IF EXISTS link_inventory_on_profile_create ON public.profiles;
CREATE TRIGGER link_inventory_on_profile_create
AFTER INSERT ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.link_inventory_actions_on_login();

-- Add comment
COMMENT ON FUNCTION public.link_inventory_actions_on_login() IS 'ユーザーログイン時にlegacy_user_idで紐付いたinventory_actionsを自動更新';