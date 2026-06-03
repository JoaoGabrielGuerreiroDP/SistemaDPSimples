-- Create sales_records table for "Hall dos Recordes"
CREATE TABLE public.sales_records (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  broker_name TEXT NOT NULL UNIQUE,
  record_value NUMERIC NOT NULL DEFAULT 0,
  record_count INTEGER NOT NULL DEFAULT 0,
  record_month TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.sales_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view sales records"
ON public.sales_records FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins and gestors can manage sales records"
ON public.sales_records FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'gestor'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'gestor'::app_role));

CREATE TRIGGER update_sales_records_updated_at
BEFORE UPDATE ON public.sales_records
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();