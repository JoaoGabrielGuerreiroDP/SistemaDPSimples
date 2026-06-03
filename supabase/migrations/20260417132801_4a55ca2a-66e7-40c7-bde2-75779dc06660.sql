-- Allow all authenticated users to manage simulador_grupos
DROP POLICY IF EXISTS "Admins and gestors can manage simulador grupos" ON public.simulador_grupos;

CREATE POLICY "Authenticated can manage simulador grupos"
ON public.simulador_grupos
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);