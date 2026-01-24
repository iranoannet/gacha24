-- ====================================
-- 1. Role System (app_role enum + user_roles table)
-- ====================================
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL DEFAULT 'user',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- ====================================
-- 2. Helper Functions (SECURITY DEFINER)
-- ====================================
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(auth.uid(), 'admin')
$$;

-- ====================================
-- 3. Profiles Table
-- ====================================
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  display_name TEXT,
  points_balance INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- ====================================
-- 4. Gacha Masters Table
-- ====================================
CREATE TYPE public.gacha_status AS ENUM ('draft', 'active', 'sold_out', 'archived');

CREATE TABLE public.gacha_masters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  price_per_play INTEGER NOT NULL DEFAULT 500,
  total_slots INTEGER NOT NULL DEFAULT 100,
  remaining_slots INTEGER NOT NULL DEFAULT 100,
  banner_url TEXT,
  pop_image_url TEXT,
  status gacha_status NOT NULL DEFAULT 'draft',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.gacha_masters ENABLE ROW LEVEL SECURITY;

-- ====================================
-- 5. Cards Table
-- ====================================
CREATE TYPE public.card_rarity AS ENUM ('S', 'A', 'B', 'C', 'D');

CREATE TABLE public.cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gacha_id UUID REFERENCES public.gacha_masters(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  rarity card_rarity NOT NULL DEFAULT 'C',
  image_url TEXT,
  conversion_points INTEGER NOT NULL DEFAULT 0,
  admin_note TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.cards ENABLE ROW LEVEL SECURITY;

-- ====================================
-- 6. User Transactions Table
-- ====================================
CREATE TYPE public.transaction_status AS ENUM ('pending', 'completed', 'error');

CREATE TABLE public.user_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  gacha_id UUID REFERENCES public.gacha_masters(id) ON DELETE SET NULL,
  play_count INTEGER NOT NULL DEFAULT 1,
  total_spent_points INTEGER NOT NULL DEFAULT 0,
  result_items JSONB NOT NULL DEFAULT '[]'::jsonb,
  status transaction_status NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.user_transactions ENABLE ROW LEVEL SECURITY;

-- ====================================
-- 7. Gacha Slots Table
-- ====================================
CREATE TABLE public.gacha_slots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gacha_id UUID REFERENCES public.gacha_masters(id) ON DELETE CASCADE NOT NULL,
  slot_number INTEGER NOT NULL,
  card_id UUID REFERENCES public.cards(id) ON DELETE SET NULL,
  is_drawn BOOLEAN NOT NULL DEFAULT false,
  drawn_at TIMESTAMP WITH TIME ZONE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  transaction_id UUID REFERENCES public.user_transactions(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(gacha_id, slot_number)
);

ALTER TABLE public.gacha_slots ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_gacha_slots_gacha_drawn ON public.gacha_slots(gacha_id, is_drawn);

-- ====================================
-- 8. Inventory Actions Table
-- ====================================
CREATE TYPE public.action_type AS ENUM ('shipping', 'conversion');
CREATE TYPE public.action_status AS ENUM ('pending', 'processing', 'completed', 'shipped');

CREATE TABLE public.inventory_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  slot_id UUID REFERENCES public.gacha_slots(id) ON DELETE SET NULL,
  card_id UUID REFERENCES public.cards(id) ON DELETE SET NULL,
  action_type action_type NOT NULL,
  status action_status NOT NULL DEFAULT 'pending',
  tracking_number TEXT,
  converted_points INTEGER,
  requested_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  processed_at TIMESTAMP WITH TIME ZONE
);

ALTER TABLE public.inventory_actions ENABLE ROW LEVEL SECURITY;

-- ====================================
-- 9. RLS Policies
-- ====================================

-- user_roles policies
CREATE POLICY "Users can view their own roles"
ON public.user_roles FOR SELECT
USING (auth.uid() = user_id OR public.is_admin());

CREATE POLICY "Admins can manage roles"
ON public.user_roles FOR ALL
USING (public.is_admin());

-- profiles policies
CREATE POLICY "Users can view own profile"
ON public.profiles FOR SELECT
USING (auth.uid() = user_id OR public.is_admin());

CREATE POLICY "Users can update own profile"
ON public.profiles FOR UPDATE
USING (auth.uid() = user_id OR public.is_admin());

CREATE POLICY "Users can insert own profile"
ON public.profiles FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- gacha_masters policies
CREATE POLICY "Anyone can view active gachas"
ON public.gacha_masters FOR SELECT
USING (status = 'active' OR public.is_admin());

CREATE POLICY "Admins can manage gachas"
ON public.gacha_masters FOR ALL
USING (public.is_admin());

-- cards policies
CREATE POLICY "Anyone can view cards without admin notes"
ON public.cards FOR SELECT
USING (true);

CREATE POLICY "Admins can manage cards"
ON public.cards FOR ALL
USING (public.is_admin());

-- user_transactions policies
CREATE POLICY "Users can view own transactions"
ON public.user_transactions FOR SELECT
USING (auth.uid() = user_id OR public.is_admin());

CREATE POLICY "Users can insert own transactions"
ON public.user_transactions FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can manage transactions"
ON public.user_transactions FOR ALL
USING (public.is_admin());

-- gacha_slots policies
CREATE POLICY "Users can view drawn slots they own"
ON public.gacha_slots FOR SELECT
USING ((is_drawn = true AND auth.uid() = user_id) OR public.is_admin());

CREATE POLICY "Admins can manage slots"
ON public.gacha_slots FOR ALL
USING (public.is_admin());

-- inventory_actions policies
CREATE POLICY "Users can view own inventory actions"
ON public.inventory_actions FOR SELECT
USING (auth.uid() = user_id OR public.is_admin());

CREATE POLICY "Users can insert own inventory actions"
ON public.inventory_actions FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can manage inventory actions"
ON public.inventory_actions FOR ALL
USING (public.is_admin());

-- ====================================
-- 10. Trigger for profile creation on signup
-- ====================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, display_name, points_balance)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.email), 0);
  
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'user');
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ====================================
-- 11. Updated_at trigger function
-- ====================================
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_gacha_masters_updated_at
  BEFORE UPDATE ON public.gacha_masters
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();