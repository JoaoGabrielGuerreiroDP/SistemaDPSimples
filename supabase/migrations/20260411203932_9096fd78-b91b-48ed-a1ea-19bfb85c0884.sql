
-- Create companies table
CREATE TABLE public.companies (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  icon TEXT NOT NULL DEFAULT '🏢',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;

-- All authenticated users can view companies
CREATE POLICY "Authenticated users can view companies"
ON public.companies FOR SELECT
TO authenticated
USING (true);

-- Admins can manage companies
CREATE POLICY "Admins can manage companies"
ON public.companies FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Gestors can manage companies
CREATE POLICY "Gestors can manage companies"
ON public.companies FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'gestor'))
WITH CHECK (public.has_role(auth.uid(), 'gestor'));

-- Add updated_at trigger
CREATE TRIGGER update_companies_updated_at
BEFORE UPDATE ON public.companies
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Add company_id to departments
ALTER TABLE public.departments ADD COLUMN company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL;

-- Insert default companies
INSERT INTO public.companies (name, icon, sort_order) VALUES
  ('DP Soluções e Investimentos', '💼', 0),
  ('DP Prime', '⭐', 1),
  ('DP Consórcios', '🤝', 2),
  ('Banco de Contempladas', '🏦', 3),
  ('DP Contempladas (Intermediações)', '🔄', 4),
  ('DP Educação', '📚', 5),
  ('Hub DP', '🌐', 6);
