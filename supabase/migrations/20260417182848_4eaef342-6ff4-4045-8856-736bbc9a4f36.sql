CREATE TABLE public.crm_canceladas_origens (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID
);

ALTER TABLE public.crm_canceladas_origens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view origens"
ON public.crm_canceladas_origens FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins and gestors can insert origens"
ON public.crm_canceladas_origens FOR INSERT TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'gestor'::app_role));

CREATE POLICY "Admins and gestors can delete origens"
ON public.crm_canceladas_origens FOR DELETE TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'gestor'::app_role));

INSERT INTO public.crm_canceladas_origens (nome) VALUES ('DP'), ('Jardel') ON CONFLICT DO NOTHING;