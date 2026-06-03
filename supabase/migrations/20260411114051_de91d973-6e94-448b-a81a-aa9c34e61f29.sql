
-- Hub Partners - main partner data matching spreadsheet PARCEIROS tab
CREATE TABLE public.hub_partners (
  id serial PRIMARY KEY,
  nome text NOT NULL,
  escritorio text,
  cidade text,
  etapa text NOT NULL DEFAULT 'Apresentação',
  programa20 boolean DEFAULT false,
  prazo date,
  status_mag text DEFAULT 'Aguardando',
  docs_mag text,
  obs_mag text,
  status_anc text DEFAULT 'Aguardando',
  docs_anc text,
  obs_anc text,
  status_can text DEFAULT 'Aguardando',
  docs_can text,
  obs_can text,
  meta_mag numeric DEFAULT 100000,
  meta_anc numeric DEFAULT 80000,
  meta_can numeric DEFAULT 60000,
  prox_acao text,
  responsavel text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.hub_partners ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view hub partners"
  ON public.hub_partners FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins and gestors can insert hub partners"
  ON public.hub_partners FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'gestor'::app_role));

CREATE POLICY "Admins and gestors can update hub partners"
  ON public.hub_partners FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'gestor'::app_role));

CREATE POLICY "Admins and gestors can delete hub partners"
  ON public.hub_partners FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'gestor'::app_role));

-- Hub Activity History matching HISTORICO tab
CREATE TABLE public.hub_historico (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id integer REFERENCES public.hub_partners(id) ON DELETE CASCADE NOT NULL,
  data date NOT NULL DEFAULT CURRENT_DATE,
  etapa text,
  adm text DEFAULT 'Todas',
  tipo text,
  acao text,
  status_mag text,
  status_anc text,
  status_can text,
  doc_pendente text,
  responsavel text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.hub_historico ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view hub historico"
  ON public.hub_historico FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins and gestors can insert hub historico"
  ON public.hub_historico FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'gestor'::app_role));

CREATE POLICY "Admins and gestors can update hub historico"
  ON public.hub_historico FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'gestor'::app_role));

CREATE POLICY "Admins and gestors can delete hub historico"
  ON public.hub_historico FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'gestor'::app_role));

-- Hub Checklist matching CHECKLIST tab
CREATE TABLE public.hub_checklist (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  grupo text NOT NULL,
  documento text NOT NULL,
  obrigatorio text DEFAULT 'Obrigatório',
  adm text DEFAULT 'Todas',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.hub_checklist ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view hub checklist"
  ON public.hub_checklist FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins and gestors can manage hub checklist"
  ON public.hub_checklist FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'gestor'::app_role));

-- Hub Checklist Status per partner
CREATE TABLE public.hub_checklist_status (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  checklist_id uuid REFERENCES public.hub_checklist(id) ON DELETE CASCADE NOT NULL,
  partner_id integer REFERENCES public.hub_partners(id) ON DELETE CASCADE NOT NULL,
  status text DEFAULT '⏳',
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(checklist_id, partner_id)
);

ALTER TABLE public.hub_checklist_status ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view checklist status"
  ON public.hub_checklist_status FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins and gestors can manage checklist status"
  ON public.hub_checklist_status FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'gestor'::app_role));

-- Hub Metas (monthly targets/actuals)
CREATE TABLE public.hub_metas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id integer REFERENCES public.hub_partners(id) ON DELETE CASCADE NOT NULL,
  mes_ref text NOT NULL,
  meta_mag numeric DEFAULT 0,
  realizado_mag numeric DEFAULT 0,
  meta_anc numeric DEFAULT 0,
  realizado_anc numeric DEFAULT 0,
  meta_can numeric DEFAULT 0,
  realizado_can numeric DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.hub_metas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view hub metas"
  ON public.hub_metas FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins and gestors can manage hub metas"
  ON public.hub_metas FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'gestor'::app_role));

-- Triggers for updated_at
CREATE TRIGGER update_hub_partners_updated_at
  BEFORE UPDATE ON public.hub_partners
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_hub_checklist_status_updated_at
  BEFORE UPDATE ON public.hub_checklist_status
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
