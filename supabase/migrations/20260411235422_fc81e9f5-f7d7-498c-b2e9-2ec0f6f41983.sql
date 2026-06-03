
CREATE TABLE public.sales_goals_individual (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  mes_ref text NOT NULL,
  meta numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, mes_ref)
);

ALTER TABLE public.sales_goals_individual ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view individual goals"
  ON public.sales_goals_individual FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Admins can manage individual goals"
  ON public.sales_goals_individual FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Gestors can manage individual goals"
  ON public.sales_goals_individual FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'gestor'))
  WITH CHECK (public.has_role(auth.uid(), 'gestor'));

CREATE TRIGGER update_sales_goals_individual_updated_at
  BEFORE UPDATE ON public.sales_goals_individual
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
