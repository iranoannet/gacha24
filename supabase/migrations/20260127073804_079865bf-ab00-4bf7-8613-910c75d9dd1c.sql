-- Allow public read access to active tenants for routing purposes
CREATE POLICY "Anyone can view active tenants"
ON public.tenants
FOR SELECT
USING (is_active = true);