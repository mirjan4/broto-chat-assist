-- Create function to check if user can invite staff
CREATE OR REPLACE FUNCTION public.can_invite_staff(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('staff', 'admin')
  )
$$;

-- Drop existing policies
DROP POLICY IF EXISTS "Only staff/admin can create staff roles" ON public.user_roles;
DROP POLICY IF EXISTS "Users can insert their own student role" ON public.user_roles;

-- Add RLS policy to prevent unauthorized role creation
CREATE POLICY "Users can insert their own student role"
ON public.user_roles
FOR INSERT
WITH CHECK (
  user_id = auth.uid() AND role = 'student'
);

CREATE POLICY "Staff/admin can create staff/admin roles"
ON public.user_roles
FOR INSERT
WITH CHECK (
  role IN ('staff', 'admin') AND public.can_invite_staff(auth.uid())
);

-- Create audit log table for escalation attempts
CREATE TABLE IF NOT EXISTS public.security_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id),
  action text NOT NULL,
  details jsonb,
  ip_address text,
  created_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.security_audit_log ENABLE ROW LEVEL SECURITY;

-- Only admins can view audit logs
CREATE POLICY "Only admins can view audit logs"
ON public.security_audit_log
FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

-- Function to log security events
CREATE OR REPLACE FUNCTION public.log_security_event(
  _action text,
  _details jsonb,
  _ip_address text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
BEGIN
  INSERT INTO public.security_audit_log (user_id, action, details, ip_address)
  VALUES (auth.uid(), _action, _details, _ip_address);
END;
$$;