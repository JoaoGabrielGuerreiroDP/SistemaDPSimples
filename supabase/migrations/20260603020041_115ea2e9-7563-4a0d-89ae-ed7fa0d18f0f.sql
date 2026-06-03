CREATE TABLE public.copa_prospections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  broker_name text NOT NULL,
  mes_ref text NOT NULL,
  prospections integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (broker_name, mes_ref)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.copa_prospections TO authenticated;
GRANT ALL ON public.copa_prospections TO service_role;

ALTER TABLE public.copa_prospections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view copa prospections"
  ON public.copa_prospections FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Admins and gestors manage copa prospections"
  ON public.copa_prospections FOR ALL
  TO authenticated
  USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'gestor'))
  WITH CHECK (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'gestor'));

CREATE TRIGGER update_copa_prospections_updated_at
  BEFORE UPDATE ON public.copa_prospections
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();