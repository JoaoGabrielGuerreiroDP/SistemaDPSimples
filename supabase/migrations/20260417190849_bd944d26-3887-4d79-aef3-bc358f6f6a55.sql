CREATE TABLE public.crm_canceladas_propositores (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID
);

ALTER TABLE public.crm_canceladas_propositores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view propositores"
ON public.crm_canceladas_propositores FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins and gestors can insert propositores"
ON public.crm_canceladas_propositores FOR INSERT TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'gestor'::app_role));

CREATE POLICY "Admins and gestors can delete propositores"
ON public.crm_canceladas_propositores FOR DELETE TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'gestor'::app_role));