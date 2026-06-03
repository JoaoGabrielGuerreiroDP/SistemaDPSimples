import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAdmin } from "@/hooks/useAdmin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Paperclip, ExternalLink, Plus, Trash2, FileText } from "lucide-react";
import { toast } from "sonner";

export function VideoAttachments({ videoId }: { videoId: string }) {
  const { isAdmin } = useAdmin();
  const queryClient = useQueryClient();
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");

  const { data: attachments = [] } = useQuery({
    queryKey: ["training_attachments", videoId],
    queryFn: async () => {
      const { data } = await supabase
        .from("training_attachments")
        .select("*")
        .eq("video_id", videoId)
        .order("sort_order");
      return data ?? [];
    },
  });

  const add = useMutation({
    mutationFn: async () => {
      const type = url.toLowerCase().endsWith(".pdf") ? "pdf" : "link";
      const { error } = await supabase
        .from("training_attachments")
        .insert({ video_id: videoId, title: title.trim(), url: url.trim(), type });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["training_attachments", videoId] });
      setTitle(""); setUrl(""); setAdding(false);
      toast.success("Material adicionado!");
    },
    onError: () => toast.error("Erro ao adicionar material"),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("training_attachments").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["training_attachments", videoId] });
    },
  });

  if (attachments.length === 0 && !isAdmin) return null;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h4 className="font-semibold text-sm text-foreground flex items-center gap-2">
          <Paperclip className="h-4 w-4 text-primary" /> Materiais de Apoio
        </h4>
        {isAdmin && !adding && (
          <Button variant="ghost" size="sm" onClick={() => setAdding(true)} className="h-6 text-xs gap-1">
            <Plus className="h-3 w-3" /> Adicionar
          </Button>
        )}
      </div>

      {adding && (
        <div className="flex gap-2 items-end">
          <div className="flex-1 space-y-1">
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Título" className="h-8 text-xs" />
            <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="URL do material" className="h-8 text-xs" />
          </div>
          <div className="flex gap-1">
            <Button size="sm" className="h-8" disabled={!title.trim() || !url.trim()} onClick={() => add.mutate()}>Salvar</Button>
            <Button size="sm" variant="ghost" className="h-8" onClick={() => { setAdding(false); setTitle(""); setUrl(""); }}>Cancelar</Button>
          </div>
        </div>
      )}

      <div className="space-y-1">
        {attachments.map((a) => (
          <div key={a.id} className="flex items-center gap-2 group">
            <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <a href={a.url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline flex items-center gap-1 flex-1 min-w-0 truncate">
              {a.title} <ExternalLink className="h-3 w-3 shrink-0" />
            </a>
            {isAdmin && (
              <button onClick={() => remove.mutate(a.id)} className="opacity-0 group-hover:opacity-100">
                <Trash2 className="h-3 w-3 text-destructive" />
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
