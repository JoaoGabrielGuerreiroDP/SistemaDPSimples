CREATE TABLE public.sales_record_breaks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  broker_name TEXT NOT NULL,
  previous_value NUMERIC NOT NULL DEFAULT 0,
  new_value NUMERIC NOT NULL DEFAULT 0,
  new_count INTEGER NOT NULL DEFAULT 0,
  record_month TEXT NOT NULL,
  broken_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_sales_record_breaks_broker ON public.sales_record_breaks(broker_name);
CREATE INDEX idx_sales_record_breaks_date ON public.sales_record_breaks(broken_at DESC);

ALTER TABLE public.sales_record_breaks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view record breaks"
ON public.sales_record_breaks FOR SELECT
TO authenticated USING (true);

CREATE POLICY "Admins and gestors can manage record breaks"
ON public.sales_record_breaks FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'gestor'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'gestor'::app_role));