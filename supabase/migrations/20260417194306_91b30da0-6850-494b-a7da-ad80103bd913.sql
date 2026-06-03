
-- Add origem column to hub_partners
ALTER TABLE public.hub_partners ADD COLUMN IF NOT EXISTS origem text;

-- Create hub_origens table
CREATE TABLE IF NOT EXISTS public.hub_origens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid
);

ALTER TABLE public.hub_origens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view hub origens"
ON public.hub_origens FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins and gestors can insert hub origens"
ON public.hub_origens FOR INSERT TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'gestor'::app_role) OR has_role(auth.uid(), 'gestor_hub'::app_role));

CREATE POLICY "Admins and gestors can delete hub origens"
ON public.hub_origens FOR DELETE TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'gestor'::app_role) OR has_role(auth.uid(), 'gestor_hub'::app_role));
