import { useState, useCallback, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { toast } from "sonner";

export interface PlaybookResponse {
  category: string;
  logical_approach: string;
  emotional_approach: string;
  technical_approach: string;
  recommended_video: string;
  quick_phrase: string;
  structure?: string;
  matched?: boolean;
  source?: string;
}

export interface PlaybookEntry {
  id: string;
  user_id: string;
  objection_text: string;
  ai_response: PlaybookResponse;
  saved: boolean;
  shared: boolean;
  created_at: string;
}

export function usePlaybook() {
  const { user } = useAuth();
  const [history, setHistory] = useState<PlaybookEntry[]>([]);
  const [shared, setShared] = useState<PlaybookEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const [own, sharedRes] = await Promise.all([
      supabase.from("playbook_objections").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(20),
      supabase.from("playbook_objections").select("*").eq("shared", true).order("created_at", { ascending: false }).limit(50),
    ]);
    setHistory((own.data || []) as any);
    setShared((sharedRes.data || []) as any);
    setLoading(false);
  }, [user]);

  useEffect(() => { load(); }, [load]);

  const generate = useCallback(async (objection: string): Promise<PlaybookResponse | null> => {
    if (!user) return null;
    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke("playbook-respond", {
        body: { objection },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      const response = data as PlaybookResponse;

      // Persistir
      await supabase.from("playbook_objections").insert({
        user_id: user.id,
        objection_text: objection,
        ai_response: response as any,
      });
      await load();
      return response;
    } catch (e: any) {
      toast.error(e.message || "Erro ao gerar resposta");
      return null;
    } finally {
      setGenerating(false);
    }
  }, [user, load]);

  const toggleShare = useCallback(async (id: string, shared: boolean) => {
    const { error } = await supabase.from("playbook_objections").update({ shared, saved: shared }).eq("id", id);
    if (error) { toast.error("Não foi possível compartilhar"); return; }
    toast.success(shared ? "Compartilhado com a equipe" : "Removido da biblioteca");
    await load();
  }, [load]);

  const remove = useCallback(async (id: string) => {
    await supabase.from("playbook_objections").delete().eq("id", id);
    await load();
  }, [load]);

  return { history, shared, loading, generating, generate, toggleShare, remove, reload: load };
}