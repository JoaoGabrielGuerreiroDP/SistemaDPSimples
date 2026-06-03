import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { toast } from "sonner";

export interface PlaybookContribution {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  file_path: string;
  file_url: string;
  file_type: string | null;
  file_size: number | null;
  created_at: string;
  author_name?: string;
}

const BUCKET = "playbook-contributions";
const MAX_BYTES = 20 * 1024 * 1024; // 20 MB

export function usePlaybookContributions() {
  const { user } = useAuth();
  const [items, setItems] = useState<PlaybookContribution[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("playbook_contributions")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) {
      toast.error("Erro ao carregar contribuições");
      setLoading(false);
      return;
    }
    const userIds = Array.from(new Set((data || []).map((c) => c.user_id)));
    let nameMap: Record<string, string> = {};
    if (userIds.length) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("user_id, display_name, email")
        .in("user_id", userIds);
      nameMap = Object.fromEntries((profs || []).map((p) => [p.user_id, p.display_name || p.email || "Usuário"]));
    }
    setItems((data || []).map((c) => ({ ...c, author_name: nameMap[c.user_id] })));
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const upload = useCallback(async (file: File, title: string, description: string) => {
    if (!user) { toast.error("Faça login para contribuir"); return false; }
    if (file.size > MAX_BYTES) { toast.error("Arquivo maior que 20 MB"); return false; }
    if (!title.trim()) { toast.error("Informe um título"); return false; }

    setUploading(true);
    try {
      const ext = file.name.split(".").pop() || "bin";
      const safeName = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
      const path = `${user.id}/${safeName}`;

      const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, file, {
        cacheControl: "3600",
        upsert: false,
        contentType: file.type || undefined,
      });
      if (upErr) throw upErr;

      const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path);

      const { error: insErr } = await supabase.from("playbook_contributions").insert({
        user_id: user.id,
        title: title.trim(),
        description: description.trim() || null,
        file_path: path,
        file_url: pub.publicUrl,
        file_type: file.type || ext,
        file_size: file.size,
      });
      if (insErr) throw insErr;

      toast.success("Contribuição enviada! Obrigado 🙌");
      await load();
      return true;
    } catch (e) {
      console.error(e);
      toast.error(e instanceof Error ? e.message : "Erro ao enviar");
      return false;
    } finally {
      setUploading(false);
    }
  }, [user, load]);

  const remove = useCallback(async (item: PlaybookContribution) => {
    if (!confirm(`Remover "${item.title}"?`)) return;
    const { error: delObj } = await supabase.storage.from(BUCKET).remove([item.file_path]);
    if (delObj) console.warn("storage remove warn:", delObj);
    const { error } = await supabase.from("playbook_contributions").delete().eq("id", item.id);
    if (error) { toast.error("Não foi possível remover"); return; }
    toast.success("Removido");
    await load();
  }, [load]);

  return { items, loading, uploading, upload, remove, currentUserId: user?.id };
}