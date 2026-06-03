
CREATE TABLE public.broker_results_uploads (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  uploaded_by UUID,
  uploaded_by_name TEXT,
  file_name TEXT,
  total_rows INTEGER NOT NULL DEFAULT 0,
  total_vendedores INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.broker_results_uploads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view broker uploads"
ON public.broker_results_uploads FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins and gestors can manage broker uploads"
ON public.broker_results_uploads FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'gestor'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'gestor'::app_role));

CREATE TABLE public.broker_results (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  upload_id UUID REFERENCES public.broker_results_uploads(id) ON DELETE CASCADE,
  grupo TEXT,
  cota TEXT,
  vendedor TEXT,
  vendedor_normalizado TEXT,
  cliente TEXT,
  parcelas_pagas NUMERIC,
  credito_gerado NUMERIC,
  pct_estorno NUMERIC,
  pct_comissao NUMERIC,
  vlr_estorno NUMERIC,
  vlr_fim_ciclo NUMERIC,
  dinheiro_na_mesa NUMERIC,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_broker_results_vendedor_norm ON public.broker_results(vendedor_normalizado);
CREATE INDEX idx_broker_results_upload ON public.broker_results(upload_id);

ALTER TABLE public.broker_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view broker results"
ON public.broker_results FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins and gestors can manage broker results"
ON public.broker_results FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'gestor'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'gestor'::app_role));
