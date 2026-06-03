
CREATE TABLE public.broker_atraso_uploads (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  uploaded_by uuid,
  uploaded_by_name text,
  file_name text,
  total_rows integer NOT NULL DEFAULT 0,
  total_vendedores integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE public.broker_atraso (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  upload_id uuid REFERENCES public.broker_atraso_uploads(id) ON DELETE CASCADE,
  vendedor text,
  vendedor_normalizado text,
  cliente text,
  grupo text,
  cota text,
  parcelas_pagas numeric,
  parcelas_atraso numeric,
  credito_venda numeric,
  situacao text,
  comissao_corretor numeric,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX idx_broker_atraso_vendedor_normalizado ON public.broker_atraso(vendedor_normalizado);
CREATE INDEX idx_broker_atraso_upload_id ON public.broker_atraso(upload_id);

ALTER TABLE public.broker_atraso_uploads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.broker_atraso ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view broker atraso uploads"
  ON public.broker_atraso_uploads FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins and gestors can manage broker atraso uploads"
  ON public.broker_atraso_uploads FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'gestor'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'gestor'::app_role));

CREATE POLICY "Authenticated can view broker atraso"
  ON public.broker_atraso FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins and gestors can manage broker atraso"
  ON public.broker_atraso FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'gestor'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'gestor'::app_role));
