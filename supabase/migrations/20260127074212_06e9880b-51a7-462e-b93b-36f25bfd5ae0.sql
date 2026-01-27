-- Update handle_new_user to include tenant_id from user metadata
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_tenant_id uuid;
BEGIN
  -- Get tenant_id from user metadata (set during signup)
  v_tenant_id := (NEW.raw_user_meta_data->>'tenant_id')::uuid;

  -- Create profile with tenant association
  INSERT INTO public.profiles (user_id, display_name, points_balance, tenant_id, email)
  VALUES (
    NEW.id, 
    COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.email), 
    0,
    v_tenant_id,
    NEW.email
  );
  
  -- Create user role
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'user');
  
  RETURN NEW;
END;
$function$;