-- Create support ticket status enum
CREATE TYPE public.ticket_status AS ENUM ('pending', 'in_progress', 'completed', 'cancelled');

-- Create support tickets table
CREATE TABLE public.support_tickets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  status ticket_status NOT NULL DEFAULT 'pending',
  estimated_cost INTEGER DEFAULT 0,
  is_paid BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create support messages table for real-time chat
CREATE TABLE public.support_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ticket_id UUID REFERENCES public.support_tickets(id) ON DELETE CASCADE NOT NULL,
  sender_id UUID NOT NULL,
  sender_type TEXT NOT NULL CHECK (sender_type IN ('tenant_admin', 'super_admin')),
  message TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_messages ENABLE ROW LEVEL SECURITY;

-- RLS Policies for support_tickets
CREATE POLICY "Tenant admins can view their own tickets"
ON public.support_tickets
FOR SELECT
USING (is_admin() AND tenant_id = get_user_tenant_id());

CREATE POLICY "Tenant admins can create their own tickets"
ON public.support_tickets
FOR INSERT
WITH CHECK (is_admin() AND tenant_id = get_user_tenant_id());

CREATE POLICY "Super admins can manage all tickets"
ON public.support_tickets
FOR ALL
USING (is_super_admin());

-- RLS Policies for support_messages
CREATE POLICY "Tenant admins can view messages for their tickets"
ON public.support_messages
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.support_tickets t
    WHERE t.id = ticket_id
    AND t.tenant_id = get_user_tenant_id()
  )
  OR is_super_admin()
);

CREATE POLICY "Tenant admins can send messages to their tickets"
ON public.support_messages
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.support_tickets t
    WHERE t.id = ticket_id
    AND t.tenant_id = get_user_tenant_id()
  )
  OR is_super_admin()
);

CREATE POLICY "Super admins can manage all messages"
ON public.support_messages
FOR ALL
USING (is_super_admin());

-- Enable realtime for messages
ALTER PUBLICATION supabase_realtime ADD TABLE public.support_messages;

-- Update trigger for tickets
CREATE TRIGGER update_support_tickets_updated_at
BEFORE UPDATE ON public.support_tickets
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();