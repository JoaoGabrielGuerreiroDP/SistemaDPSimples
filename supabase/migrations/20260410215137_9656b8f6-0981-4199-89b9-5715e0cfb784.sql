-- Migrate existing data
UPDATE public.user_roles SET role = 'gestor' WHERE role = 'moderator';
UPDATE public.user_roles SET role = 'vendedor' WHERE role = 'user';

-- Allow users to view their own role
CREATE POLICY "Users can view their own role"
ON public.user_roles
FOR SELECT
USING (auth.uid() = user_id);

-- Allow admins to update roles
CREATE POLICY "Admins can update roles"
ON public.user_roles
FOR UPDATE
USING (public.has_role(auth.uid(), 'admin'));