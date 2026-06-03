import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { StickyNote, Save } from "lucide-react";
import { toast } from "sonner";

export function PersonalNotes({ videoId }: { videoId: string }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [text, setText] = useState("");
  const [dirty, setDirty] = useState(false);

  const { data: note } = useQuery({
    queryKey: ["training_note", videoId, user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("training_notes")
        .select("*")
        .eq("video_id", videoId)
        .eq("user_id", user!.id)
        .maybeSingle();
      return data;
    },
    enabled: !!user,
  });

  useEffect(() => {
    if (note) {
      setText(note.content);
      setDirty(false);
    }
  }, [note]);

  const save = useMutation({
    mutationFn: async () => {
      if (!user) return;
      const { error } = await supabase
        .from("training_notes")
        .upsert(
          { video_id: videoId, user_id: user.id, content: text },
          { onConflict: "video_id,user_id" }
        );
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["training_note", videoId] });
      setDirty(false);
      toast.success("Anotação salva!");
    },
    onError: () => toast.error("Erro ao salvar anotação"),
  });

  return (
    <div className="space-y-2">
      <h4 className="font-semibold text-sm text-foreground flex items-center gap-2">
        <StickyNote className="h-4 w-4 text-primary" /> Minhas Anotações
      </h4>
      <Textarea
        value={text}
        onChange={(e) => { setText(e.target.value); setDirty(true); }}
        placeholder="Escreva suas anotações pessoais sobre este vídeo..."
        rows={4}
        className="text-xs"
      />
      {dirty && (
        <Button size="sm" onClick={() => save.mutate()} disabled={save.isPending} className="gap-1.5">
          <Save className="h-3 w-3" />
          Salvar Anotação
        </Button>
      )}
    </div>
  );
}
