
-- 1. Fix privilege escalation: gestors cannot assign admin role
DROP POLICY IF EXISTS "Gestors can insert roles" ON public.user_roles;
CREATE POLICY "Gestors can insert roles"
  ON public.user_roles
  FOR INSERT
  TO authenticated
  WITH CHECK (
    has_role(auth.uid(), 'gestor'::app_role)
    AND role != 'admin'::app_role
  );

DROP POLICY IF EXISTS "Gestors can update roles" ON public.user_roles;
CREATE POLICY "Gestors can update roles"
  ON public.user_roles
  FOR UPDATE
  TO authenticated
  USING (has_role(auth.uid(), 'gestor'::app_role))
  WITH CHECK (role != 'admin'::app_role);

-- 2. Fix notifications: restrict INSERT to own user_id
DROP POLICY IF EXISTS "Authenticated users can create notifications" ON public.notifications;
CREATE POLICY "Authenticated users can create notifications"
  ON public.notifications
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);
