import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { MessageSquare, Send, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

export function VideoComments({ videoId }: { videoId: string }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [text, setText] = useState("");

  const { data: comments = [] } = useQuery({
    queryKey: ["training_comments", videoId],
    queryFn: async () => {
      const { data: commentsData } = await supabase
        .from("training_comments")
        .select("*")
        .eq("video_id", videoId)
        .order("created_at", { ascending: true });

      if (!commentsData) return [];

      const userIds = [...new Set(commentsData.map((c) => c.user_id))];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, display_name, avatar_url")
        .in("user_id", userIds);

      const profileMap = new Map(profiles?.map((p) => [p.user_id, p]) ?? []);

      return commentsData.map((c) => ({
        ...c,
        profile: profileMap.get(c.user_id),
      }));
    },
  });

  const addComment = useMutation({
    mutationFn: async () => {
      if (!user || !text.trim()) return;
      const { error } = await supabase
        .from("training_comments")
        .insert({ video_id: videoId, user_id: user.id, content: text.trim() });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["training_comments", videoId] });
      setText("");
    },
    onError: () => toast.error("Erro ao enviar comentário"),
  });

  const deleteComment = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("training_comments").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["training_comments", videoId] });
    },
  });

  return (
    <div className="space-y-3">
      <h4 className="font-semibold text-sm text-foreground flex items-center gap-2">
        <MessageSquare className="h-4 w-4 text-primary" /> Comentários ({comments.length})
      </h4>

      <div className="space-y-3 max-h-60 overflow-y-auto">
        {comments.map((c) => (
          <div key={c.id} className="flex gap-2 group">
            <Avatar className="h-6 w-6 shrink-0 mt-0.5">
              <AvatarFallback className="text-[10px] bg-primary/10 text-primary">
                {(c.profile?.display_name || "?").charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-foreground">{c.profile?.display_name || "Usuário"}</span>
                <span className="text-[10px] text-muted-foreground">
                  {formatDistanceToNow(new Date(c.created_at), { addSuffix: true, locale: ptBR })}
                </span>
                {c.user_id === user?.id && (
                  <button
                    onClick={() => deleteComment.mutate(c.id)}
                    className="opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <Trash2 className="h-3 w-3 text-destructive" />
                  </button>
                )}
              </div>
              <p className="text-xs text-muted-foreground">{c.content}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="flex gap-2">
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Escreva um comentário..."
          rows={2}
          className="text-xs"
        />
        <Button
          size="icon"
          className="shrink-0 h-auto"
          disabled={!text.trim() || addComment.isPending}
          onClick={() => addComment.mutate()}
        >
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
