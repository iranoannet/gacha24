-- Update handle_new_user function to apply migration data on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_tenant_id uuid;
  v_migration RECORD;
BEGIN
  -- Get tenant_id from user metadata (set during signup)
  v_tenant_id := (NEW.raw_user_meta_data->>'tenant_id')::uuid;

  -- Check if there's migration data for this user
  SELECT * INTO v_migration
  FROM public.user_migrations
  WHERE email = NEW.email
    AND tenant_id = v_tenant_id
    AND is_applied = false
  LIMIT 1;

  IF FOUND THEN
    -- Create profile with migrated data
    INSERT INTO public.profiles (
      user_id, 
      display_name, 
      last_name,
      first_name,
      points_balance, 
      tenant_id, 
      email,
      phone_number,
      postal_code,
      prefecture,
      city,
      address_line1,
      address_line2
    )
    VALUES (
      NEW.id, 
      v_migration.display_name,
      v_migration.last_name,
      v_migration.first_name,
      v_migration.points_balance,
      v_tenant_id,
      NEW.email,
      v_migration.phone_number,
      v_migration.postal_code,
      v_migration.prefecture,
      v_migration.city,
      v_migration.address_line1,
      v_migration.address_line2
    )
    ON CONFLICT (user_id, tenant_id) DO NOTHING;

    -- Mark migration as applied
    UPDATE public.user_migrations
    SET is_applied = true
    WHERE id = v_migration.id;
  ELSE
    -- Create standard profile
    INSERT INTO public.profiles (user_id, display_name, points_balance, tenant_id, email)
    VALUES (
      NEW.id, 
      COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.email), 
      0,
      v_tenant_id,
      NEW.email
    )
    ON CONFLICT (user_id, tenant_id) DO NOTHING;
  END IF;
  
  -- Create user role (only if not exists)
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'user')
  ON CONFLICT DO NOTHING;
  
  RETURN NEW;
END;
$function$;