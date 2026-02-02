-- Add unique constraint on email + tenant_id for proper upsert behavior
ALTER TABLE public.user_migrations 
ADD CONSTRAINT user_migrations_email_tenant_unique 
UNIQUE (email, tenant_id);