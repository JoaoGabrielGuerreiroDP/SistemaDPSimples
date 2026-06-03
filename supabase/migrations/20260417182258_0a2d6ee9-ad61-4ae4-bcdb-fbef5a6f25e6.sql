-- Tabela do Kanban CRM Canceladas
CREATE TABLE public.crm_canceladas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cliente TEXT NOT NULL,
  origem_cliente TEXT,
  origem_administradora TEXT,
  observacoes TEXT,
  fundo_comum NUMERIC DEFAULT 0,
  melhor_proposta NUMERIC DEFAULT 0,
  quem_fez_proposta TEXT,
  valor_ofertado_cliente NUMERIC DEFAULT 0,
  extrato_url TEXT,
  extrato_path TEXT,
  stage TEXT NOT NULL DEFAULT 'tem_proposta',
  tags TEXT[] DEFAULT '{}',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.crm_canceladas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view crm_canceladas"
  ON public.crm_canceladas FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins and gestors can insert crm_canceladas"
  ON public.crm_canceladas FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'gestor'::app_role));

CREATE POLICY "Admins and gestors can update crm_canceladas"
  ON public.crm_canceladas FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'gestor'::app_role));

CREATE POLICY "Admins and gestors can delete crm_canceladas"
  ON public.crm_canceladas FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'gestor'::app_role));

CREATE TRIGGER update_crm_canceladas_updated_at
  BEFORE UPDATE ON public.crm_canceladas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_crm_canceladas_stage ON public.crm_canceladas(stage, sort_order);

-- Bucket de extratos
INSERT INTO storage.buckets (id, name, public)
VALUES ('crm-canceladas-extratos', 'crm-canceladas-extratos', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Authenticated can read crm canceladas extratos"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'crm-canceladas-extratos');

CREATE POLICY "Admins/gestors can upload crm canceladas extratos"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'crm-canceladas-extratos' AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'gestor'::app_role)));

CREATE POLICY "Admins/gestors can update crm canceladas extratos"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'crm-canceladas-extratos' AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'gestor'::app_role)));

CREATE POLICY "Admins/gestors can delete crm canceladas extratos"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'crm-canceladas-extratos' AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'gestor'::app_role)));