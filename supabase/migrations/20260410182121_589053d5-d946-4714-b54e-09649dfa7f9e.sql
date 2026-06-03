
-- Departments: restore full access for authenticated
DROP POLICY IF EXISTS "Admins can insert departments" ON public.departments;
DROP POLICY IF EXISTS "Admins can update departments" ON public.departments;
DROP POLICY IF EXISTS "Admins can delete departments" ON public.departments;

CREATE POLICY "Authenticated users can insert departments" ON public.departments FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update departments" ON public.departments FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated users can delete departments" ON public.departments FOR DELETE TO authenticated USING (true);

-- Objectives
DROP POLICY IF EXISTS "Admins can insert objectives" ON public.objectives;
DROP POLICY IF EXISTS "Admins can update objectives" ON public.objectives;
DROP POLICY IF EXISTS "Admins can delete objectives" ON public.objectives;

CREATE POLICY "Authenticated users can insert objectives" ON public.objectives FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update objectives" ON public.objectives FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated users can delete objectives" ON public.objectives FOR DELETE TO authenticated USING (true);

-- Key results
DROP POLICY IF EXISTS "Admins can insert key_results" ON public.key_results;
DROP POLICY IF EXISTS "Admins can update key_results" ON public.key_results;
DROP POLICY IF EXISTS "Admins can delete key_results" ON public.key_results;

CREATE POLICY "Authenticated users can insert key_results" ON public.key_results FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update key_results" ON public.key_results FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated users can delete key_results" ON public.key_results FOR DELETE TO authenticated USING (true);
