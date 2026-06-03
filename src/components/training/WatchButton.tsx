import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";

export function WatchButton({ videoId }: { videoId: string }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: watched } = useQuery({
    queryKey: ["watch_status", videoId, user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("training_watch_status")
        .select("id")
        .eq("video_id", videoId)
        .eq("user_id", user!.id)
        .maybeSingle();
      return !!data;
    },
    enabled: !!user,
  });

  const toggle = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Não autenticado");
      if (watched) {
        await supabase.from("training_watch_status").delete().eq("video_id", videoId).eq("user_id", user.id);
      } else {
        await supabase.from("training_watch_status").insert({ video_id: videoId, user_id: user.id });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["watch_status"] });
      queryClient.invalidateQueries({ queryKey: ["training_ranking"] });
      toast.success(watched ? "Desmarcado como assistido" : "Marcado como assistido ✅");
    },
  });

  return (
    <Button
      variant={watched ? "default" : "outline"}
      size="sm"
      onClick={(e) => { e.stopPropagation(); toggle.mutate(); }}
      disabled={toggle.isPending}
      className="gap-1.5 h-7 text-xs"
    >
      {watched ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
      {watched ? "Assistido" : "Marcar como assistido"}
    </Button>
  );
}
