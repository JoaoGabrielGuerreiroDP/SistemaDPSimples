
CREATE TABLE public.partners_onboarding (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  logo_url text,
  status text NOT NULL DEFAULT 'cadastro',
  progress integer NOT NULL DEFAULT 0,
  notes text,
  responsible_user_id uuid,
  started_at date DEFAULT CURRENT_DATE,
  completed_at date,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.partners_onboarding ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view partners"
  ON public.partners_onboarding FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins and gestors can insert partners"
  ON public.partners_onboarding FOR INSERT
  TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'gestor')
  );

CREATE POLICY "Admins and gestors can update partners"
  ON public.partners_onboarding FOR UPDATE
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'gestor')
  );

CREATE POLICY "Admins and gestors can delete partners"
  ON public.partners_onboarding FOR DELETE
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'gestor')
  );

CREATE TRIGGER update_partners_onboarding_updated_at
  BEFORE UPDATE ON public.partners_onboarding
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
