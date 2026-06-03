import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface HubPartner {
  id: number;
  nome: string;
  escritorio: string | null;
  cidade: string | null;
  etapa: string;
  programa20: boolean | null;
  prazo: string | null;
  status_mag: string | null;
  docs_mag: string | null;
  obs_mag: string | null;
  status_anc: string | null;
  docs_anc: string | null;
  obs_anc: string | null;
  status_can: string | null;
  docs_can: string | null;
  obs_can: string | null;
  meta_mag: number | null;
  meta_anc: number | null;
  meta_can: number | null;
  prox_acao: string | null;
  responsavel: string | null;
  origem: string | null;
  created_at: string;
}

export interface HubHistorico {
  id: string;
  partner_id: number;
  data: string;
  etapa: string | null;
  adm: string | null;
  tipo: string | null;
  acao: string | null;
  status_mag: string | null;
  status_anc: string | null;
  status_can: string | null;
  doc_pendente: string | null;
  responsavel: string | null;
}

export interface HubMeta {
  id: string;
  partner_id: number;
  mes_ref: string;
  meta_mag: number;
  realizado_mag: number;
  meta_anc: number;
  realizado_anc: number;
  meta_can: number;
  realizado_can: number;
}

export interface HubChecklistItem {
  id: string;
  grupo: string;
  documento: string;
  obrigatorio: string;
  adm: string;
}

export interface HubChecklistStatus {
  id: string;
  checklist_id: string;
  partner_id: number;
  status: string;
}

export function useHubData() {
  const [partners, setPartners] = useState<HubPartner[]>([]);
  const [historico, setHistorico] = useState<HubHistorico[]>([]);
  const [metas, setMetas] = useState<HubMeta[]>([]);
  const [checklist, setChecklist] = useState<HubChecklistItem[]>([]);
  const [checklistStatus, setChecklistStatus] = useState<HubChecklistStatus[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const [p, h, m, cl, cs] = await Promise.all([
      supabase.from("hub_partners").select("*").order("id"),
      supabase.from("hub_historico").select("*").order("data", { ascending: false }),
      supabase.from("hub_metas").select("*").order("mes_ref"),
      supabase.from("hub_checklist").select("*").order("created_at"),
      supabase.from("hub_checklist_status").select("*"),
    ]);
    if (p.data) setPartners(p.data as unknown as HubPartner[]);
    if (h.data) setHistorico(h.data as unknown as HubHistorico[]);
    if (m.data) setMetas(m.data as unknown as HubMeta[]);
    if (cl.data) setChecklist(cl.data as unknown as HubChecklistItem[]);
    if (cs.data) setChecklistStatus(cs.data as unknown as HubChecklistStatus[]);
    setLoading(false);
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  return { partners, historico, metas, checklist, checklistStatus, loading, reload: fetchAll };
}
