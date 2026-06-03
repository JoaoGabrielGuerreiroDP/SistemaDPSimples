-- Catálogo de conquistas customizadas
CREATE TABLE public.custom_achievements (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  icon_url TEXT NOT NULL,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.custom_achievements ENABLE ROW LEVEL SECURITY;

-- Helper: é líder de time?
CREATE OR REPLACE FUNCTION public.is_team_manager(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.team_managers WHERE user_id = _user_id)
$$;

CREATE POLICY "Anyone authenticated can view custom achievements"
ON public.custom_achievements FOR SELECT TO authenticated
USING (true);

CREATE POLICY "Admins, gestors and team managers can manage custom achievements"
ON public.custom_achievements FOR ALL TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'gestor'::app_role)
  OR is_team_manager(auth.uid())
)
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'gestor'::app_role)
  OR is_team_manager(auth.uid())
);

CREATE TRIGGER set_custom_achievements_updated_at
BEFORE UPDATE ON public.custom_achievements
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Atribuições de conquistas a vendedores
CREATE TABLE public.broker_achievements (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  achievement_id UUID NOT NULL REFERENCES public.custom_achievements(id) ON DELETE CASCADE,
  broker_name TEXT NOT NULL,
  note TEXT,
  awarded_by UUID,
  awarded_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (achievement_id, broker_name)
);

ALTER TABLE public.broker_achievements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can view broker achievements"
ON public.broker_achievements FOR SELECT TO authenticated
USING (true);

CREATE POLICY "Admins, gestors and team managers can manage broker achievements"
ON public.broker_achievements FOR ALL TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'gestor'::app_role)
  OR is_team_manager(auth.uid())
)
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'gestor'::app_role)
  OR is_team_manager(auth.uid())
);

CREATE INDEX idx_broker_achievements_broker ON public.broker_achievements(broker_name);

-- Bucket público para ícones gerados
INSERT INTO storage.buckets (id, name, public)
VALUES ('achievement-icons', 'achievement-icons', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Public can view achievement icons"
ON storage.objects FOR SELECT
USING (bucket_id = 'achievement-icons');

CREATE POLICY "Admins, gestors and team managers can upload icons"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'achievement-icons'
  AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'gestor'::app_role)
    OR is_team_manager(auth.uid())
  )
);

CREATE POLICY "Admins, gestors and team managers can update icons"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'achievement-icons'
  AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'gestor'::app_role)
    OR is_team_manager(auth.uid())
  )
);

CREATE POLICY "Admins, gestors and team managers can delete icons"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'achievement-icons'
  AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'gestor'::app_role)
    OR is_team_manager(auth.uid())
  )
);