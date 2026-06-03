import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export function StarRating({ videoId }: { videoId: string }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [hover, setHover] = useState(0);

  const { data: myRating } = useQuery({
    queryKey: ["my_rating", videoId, user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("training_ratings")
        .select("rating")
        .eq("video_id", videoId)
        .eq("user_id", user!.id)
        .maybeSingle();
      return data?.rating ?? 0;
    },
    enabled: !!user,
  });

  const { data: avgData } = useQuery({
    queryKey: ["avg_rating", videoId],
    queryFn: async () => {
      const { data } = await supabase
        .from("training_ratings")
        .select("rating")
        .eq("video_id", videoId);
      if (!data || data.length === 0) return { avg: 0, count: 0 };
      const sum = data.reduce((a, b) => a + b.rating, 0);
      return { avg: sum / data.length, count: data.length };
    },
  });

  const rate = useMutation({
    mutationFn: async (rating: number) => {
      if (!user) return;
      const { error } = await supabase
        .from("training_ratings")
        .upsert({ video_id: videoId, user_id: user.id, rating }, { onConflict: "video_id,user_id" });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my_rating", videoId] });
      queryClient.invalidateQueries({ queryKey: ["avg_rating", videoId] });
      toast.success("Avaliação salva!");
    },
  });

  const current = hover || myRating || 0;

  return (
    <div className="flex items-center gap-2">
      <div className="flex gap-0.5" onMouseLeave={() => setHover(0)}>
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            onMouseEnter={() => setHover(star)}
            onClick={() => rate.mutate(star)}
            className="p-0.5 transition-colors"
          >
            <Star
              className={cn(
                "h-4 w-4 transition-colors",
                star <= current ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground/30"
              )}
            />
          </button>
        ))}
      </div>
      {avgData && avgData.count > 0 && (
        <span className="text-xs text-muted-foreground">
          {avgData.avg.toFixed(1)} ({avgData.count})
        </span>
      )}
    </div>
  );
}
