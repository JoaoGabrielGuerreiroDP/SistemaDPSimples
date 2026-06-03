
CREATE TABLE public.sales_goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mes_ref text NOT NULL UNIQUE,
  meta numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.sales_goals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view sales goals"
  ON public.sales_goals FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can manage sales goals"
  ON public.sales_goals FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Gestors can manage sales goals"
  ON public.sales_goals FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'gestor'::app_role))
  WITH CHECK (has_role(auth.uid(), 'gestor'::app_role));

CREATE TRIGGER update_sales_goals_updated_at
  BEFORE UPDATE ON public.sales_goals
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
