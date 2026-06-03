
CREATE TABLE public.budget_lines (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  year INTEGER NOT NULL,
  month INTEGER NOT NULL CHECK (month >= 1 AND month <= 12),
  category TEXT NOT NULL,
  amount_cents BIGINT NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(year, month, category)
);

ALTER TABLE public.budget_lines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins and gestors can manage budget"
  ON public.budget_lines
  FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'gestor'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'gestor'::app_role));

CREATE TRIGGER update_budget_lines_updated_at
  BEFORE UPDATE ON public.budget_lines
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
