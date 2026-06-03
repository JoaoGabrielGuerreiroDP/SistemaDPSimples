
-- Add shared status directly to key_results
ALTER TABLE public.key_results ADD COLUMN status text NOT NULL DEFAULT 'pending';

-- Add user_id to departments (NULL = company, set = personal)
ALTER TABLE public.departments ADD COLUMN user_id uuid;

-- Migrate existing kr_statuses data into key_results.status (take the most recent status)
UPDATE public.key_results kr
SET status = COALESCE(
  (SELECT ks.status FROM public.kr_statuses ks WHERE ks.kr_id = kr.id ORDER BY ks.updated_at DESC LIMIT 1),
  'pending'
);

-- Update departments RLS
DROP POLICY "Authenticated users can view departments" ON public.departments;
CREATE POLICY "Users can view company and own departments" ON public.departments
FOR SELECT TO authenticated
USING (user_id IS NULL OR user_id = auth.uid());

DROP POLICY "Authenticated users can insert departments" ON public.departments;
CREATE POLICY "Users can insert departments" ON public.departments
FOR INSERT TO authenticated
WITH CHECK (user_id IS NULL OR user_id = auth.uid());

DROP POLICY "Authenticated users can update departments" ON public.departments;
CREATE POLICY "Users can update departments" ON public.departments
FOR UPDATE TO authenticated
USING (user_id IS NULL OR user_id = auth.uid());

DROP POLICY "Authenticated users can delete departments" ON public.departments;
CREATE POLICY "Users can delete departments" ON public.departments
FOR DELETE TO authenticated
USING (user_id IS NULL OR user_id = auth.uid());

-- Update objectives RLS to respect department visibility
DROP POLICY "Authenticated users can view objectives" ON public.objectives;
CREATE POLICY "Users can view objectives" ON public.objectives
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.departments d
    WHERE d.id = department_id
    AND (d.user_id IS NULL OR d.user_id = auth.uid())
  )
);

DROP POLICY "Authenticated users can insert objectives" ON public.objectives;
CREATE POLICY "Users can insert objectives" ON public.objectives
FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.departments d
    WHERE d.id = department_id
    AND (d.user_id IS NULL OR d.user_id = auth.uid())
  )
);

DROP POLICY "Authenticated users can update objectives" ON public.objectives;
CREATE POLICY "Users can update objectives" ON public.objectives
FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.departments d
    WHERE d.id = department_id
    AND (d.user_id IS NULL OR d.user_id = auth.uid())
  )
);

DROP POLICY "Authenticated users can delete objectives" ON public.objectives;
CREATE POLICY "Users can delete objectives" ON public.objectives
FOR DELETE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.departments d
    WHERE d.id = department_id
    AND (d.user_id IS NULL OR d.user_id = auth.uid())
  )
);

-- Update key_results RLS to respect objective->department chain
DROP POLICY "Authenticated users can view key_results" ON public.key_results;
CREATE POLICY "Users can view key_results" ON public.key_results
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.objectives o
    JOIN public.departments d ON d.id = o.department_id
    WHERE o.id = objective_id
    AND (d.user_id IS NULL OR d.user_id = auth.uid())
  )
);

DROP POLICY "Authenticated users can insert key_results" ON public.key_results;
CREATE POLICY "Users can insert key_results" ON public.key_results
FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.objectives o
    JOIN public.departments d ON d.id = o.department_id
    WHERE o.id = objective_id
    AND (d.user_id IS NULL OR d.user_id = auth.uid())
  )
);

DROP POLICY "Authenticated users can update key_results" ON public.key_results;
CREATE POLICY "Users can update key_results" ON public.key_results
FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.objectives o
    JOIN public.departments d ON d.id = o.department_id
    WHERE o.id = objective_id
    AND (d.user_id IS NULL OR d.user_id = auth.uid())
  )
);

DROP POLICY "Authenticated users can delete key_results" ON public.key_results;
CREATE POLICY "Users can delete key_results" ON public.key_results
FOR DELETE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.objectives o
    JOIN public.departments d ON d.id = o.department_id
    WHERE o.id = objective_id
    AND (d.user_id IS NULL OR d.user_id = auth.uid())
  )
);
