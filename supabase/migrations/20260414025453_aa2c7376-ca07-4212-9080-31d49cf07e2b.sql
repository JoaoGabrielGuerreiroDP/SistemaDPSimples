
CREATE TABLE public.gescon_sales_goals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  vendedor TEXT NOT NULL,
  mes_ref TEXT NOT NULL,
  meta NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(vendedor, mes_ref)
);

ALTER TABLE public.gescon_sales_goals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view gescon goals"
  ON public.gescon_sales_goals FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert gescon goals"
  ON public.gescon_sales_goals FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update gescon goals"
  ON public.gescon_sales_goals FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Authenticated users can delete gescon goals"
  ON public.gescon_sales_goals FOR DELETE TO authenticated USING (true);
