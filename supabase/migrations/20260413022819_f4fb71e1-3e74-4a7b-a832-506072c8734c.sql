
CREATE TABLE public.crm_prospections (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  source text NOT NULL CHECK (source IN ('piperun', 'hubspot')),
  external_id text NOT NULL,
  seller_name text,
  lead_name text,
  amount numeric DEFAULT 0,
  stage text,
  pipeline_id text,
  created_at_crm timestamp with time zone,
  synced_at timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (source, external_id)
);

ALTER TABLE public.crm_prospections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view prospections"
  ON public.crm_prospections FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins and gestors can manage prospections"
  ON public.crm_prospections FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'gestor'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'gestor'::app_role));

CREATE INDEX idx_crm_prospections_seller ON public.crm_prospections (seller_name);
CREATE INDEX idx_crm_prospections_created ON public.crm_prospections (created_at_crm);
CREATE INDEX idx_crm_prospections_source ON public.crm_prospections (source);
