
-- RLS: gestor_hub can fully manage all hub tables
CREATE POLICY "Gestor Hub can manage hub partners"
  ON public.hub_partners FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'gestor_hub'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'gestor_hub'::app_role));

CREATE POLICY "Gestor Hub can manage hub historico"
  ON public.hub_historico FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'gestor_hub'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'gestor_hub'::app_role));

CREATE POLICY "Gestor Hub can manage hub metas"
  ON public.hub_metas FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'gestor_hub'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'gestor_hub'::app_role));

CREATE POLICY "Gestor Hub can manage hub checklist"
  ON public.hub_checklist FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'gestor_hub'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'gestor_hub'::app_role));

CREATE POLICY "Gestor Hub can manage hub checklist status"
  ON public.hub_checklist_status FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'gestor_hub'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'gestor_hub'::app_role));

-- RLS: gestor_hub can view OKR data
CREATE POLICY "Gestor Hub can view departments"
  ON public.departments FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'gestor_hub'::app_role));

CREATE POLICY "Gestor Hub can view objectives"
  ON public.objectives FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'gestor_hub'::app_role));

CREATE POLICY "Gestor Hub can view key results"
  ON public.key_results FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'gestor_hub'::app_role));

-- RLS: gestor_hub can view profiles
CREATE POLICY "Gestor Hub can view profiles"
  ON public.profiles FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'gestor_hub'::app_role));
