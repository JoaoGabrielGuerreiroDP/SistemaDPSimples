CREATE TABLE public.simulador_grupos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  asset_type TEXT NOT NULL CHECK (asset_type IN ('Imovel','Veiculo')),
  administradora TEXT,
  term_months INTEGER NOT NULL,
  credit_value NUMERIC NOT NULL,
  payment_half NUMERIC NOT NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  source_pdf_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.simulador_grupos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view simulador grupos"
ON public.simulador_grupos FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Admins and gestors can manage simulador grupos"
ON public.simulador_grupos FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'gestor'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'gestor'::app_role));

CREATE TRIGGER update_simulador_grupos_updated_at
BEFORE UPDATE ON public.simulador_grupos
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_simulador_grupos_asset_active ON public.simulador_grupos(asset_type, active);