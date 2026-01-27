-- Add allowed_ips column to tenants table for IP restriction
ALTER TABLE public.tenants 
ADD COLUMN allowed_ips text[] DEFAULT NULL;

-- NULL = no restriction, empty array = block all, array with IPs = only those IPs allowed

COMMENT ON COLUMN public.tenants.allowed_ips IS 'Array of allowed IP addresses. NULL means no restriction, empty array blocks all access.';