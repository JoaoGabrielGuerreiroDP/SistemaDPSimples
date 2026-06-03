CREATE TABLE public.sales_goals_byname (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  broker_name TEXT NOT NULL,
  mes_ref TEXT NOT NULL,
  meta NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (broker_name, mes_ref)
);

ALTER TABLE public.sales_goals_byname ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read goals"
  ON public.sales_goals_byname FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Gestors and admins can manage goals"
  ON public.sales_goals_byname FOR ALL
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR 
    public.has_role(auth.uid(), 'gestor')
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin') OR 
    public.has_role(auth.uid(), 'gestor')
  );