
-- Create role enum
CREATE TYPE public.app_role AS ENUM ('admin', 'moderator', 'user');

-- Create user_roles table
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Security definer function to check roles without recursion
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

-- RLS for user_roles: only admins can manage
CREATE POLICY "Admins can view all roles"
  ON public.user_roles FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert roles"
  ON public.user_roles FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete roles"
  ON public.user_roles FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Update departments policies: keep SELECT for all, restrict mutations to admin
DROP POLICY IF EXISTS "Authenticated users can insert departments" ON public.departments;
DROP POLICY IF EXISTS "Authenticated users can update departments" ON public.departments;
DROP POLICY IF EXISTS "Authenticated users can delete departments" ON public.departments;

CREATE POLICY "Admins can insert departments"
  ON public.departments FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update departments"
  ON public.departments FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete departments"
  ON public.departments FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Update objectives policies
DROP POLICY IF EXISTS "Authenticated users can insert objectives" ON public.objectives;
DROP POLICY IF EXISTS "Authenticated users can update objectives" ON public.objectives;
DROP POLICY IF EXISTS "Authenticated users can delete objectives" ON public.objectives;

CREATE POLICY "Admins can insert objectives"
  ON public.objectives FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update objectives"
  ON public.objectives FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete objectives"
  ON public.objectives FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Update key_results policies
DROP POLICY IF EXISTS "Authenticated users can insert key_results" ON public.key_results;
DROP POLICY IF EXISTS "Authenticated users can update key_results" ON public.key_results;
DROP POLICY IF EXISTS "Authenticated users can delete key_results" ON public.key_results;

CREATE POLICY "Admins can insert key_results"
  ON public.key_results FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update key_results"
  ON public.key_results FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete key_results"
  ON public.key_results FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
