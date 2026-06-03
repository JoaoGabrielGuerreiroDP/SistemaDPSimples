-- 1) Remove account_approvals from Realtime to avoid broadcasting emails
ALTER PUBLICATION supabase_realtime DROP TABLE public.account_approvals;

-- 2) Restrict gescon_sales_goals writes to admin/gestor only
DROP POLICY IF EXISTS "Authenticated users can delete gescon goals" ON public.gescon_sales_goals;
DROP POLICY IF EXISTS "Authenticated users can insert gescon goals" ON public.gescon_sales_goals;
DROP POLICY IF EXISTS "Authenticated users can update gescon goals" ON public.gescon_sales_goals;

CREATE POLICY "Admins and gestors manage gescon goals"
ON public.gescon_sales_goals
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'gestor'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'gestor'::app_role));

-- 3) Restrict simulador_grupos writes to admin/gestor; keep reads open to authenticated
DROP POLICY IF EXISTS "Authenticated users can manage simulador_grupos" ON public.simulador_grupos;
DROP POLICY IF EXISTS "Authenticated can manage simulador_grupos" ON public.simulador_grupos;
DROP POLICY IF EXISTS "Authenticated users manage simulador_grupos" ON public.simulador_grupos;

CREATE POLICY "Authenticated can view simulador_grupos"
ON public.simulador_grupos
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Admins and gestors manage simulador_grupos"
ON public.simulador_grupos
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'gestor'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'gestor'::app_role));

-- 4) Restrict CRM canceladas extratos bucket reads to admin/gestor only
DROP POLICY IF EXISTS "Authenticated can read crm canceladas extratos" ON storage.objects;

CREATE POLICY "Admins/gestors can read crm canceladas extratos"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'crm-canceladas-extratos'
  AND (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'gestor'::app_role))
);