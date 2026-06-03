
CREATE TABLE public.team_managers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  team_name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (user_id),
  UNIQUE (team_name)
);

ALTER TABLE public.team_managers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view team managers"
ON public.team_managers FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Admins and gestors can manage team managers"
ON public.team_managers FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'gestor'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'gestor'::app_role));

CREATE TRIGGER update_team_managers_updated_at
BEFORE UPDATE ON public.team_managers
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
