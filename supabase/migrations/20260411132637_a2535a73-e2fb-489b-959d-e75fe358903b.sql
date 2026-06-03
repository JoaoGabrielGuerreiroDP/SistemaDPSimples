
-- Allow gestors to manage user_roles
CREATE POLICY "Gestors can view all roles"
  ON public.user_roles FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'gestor'::app_role));

CREATE POLICY "Gestors can insert roles"
  ON public.user_roles FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'gestor'::app_role));

CREATE POLICY "Gestors can update roles"
  ON public.user_roles FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'gestor'::app_role));

CREATE POLICY "Gestors can delete roles"
  ON public.user_roles FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'gestor'::app_role));

-- Allow gestors to manage user_permissions
CREATE POLICY "Gestors can manage permissions"
  ON public.user_permissions FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'gestor'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'gestor'::app_role));
