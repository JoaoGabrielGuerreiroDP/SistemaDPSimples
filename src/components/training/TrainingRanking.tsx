import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Trophy, Eye, CheckCircle2 } from "lucide-react";

interface RankedUser {
  user_id: string;
  display_name: string;
  watched: number;
  quizzes: number;
  avg_score: number;
}

export function TrainingRanking() {
  const { data: ranking = [], isLoading } = useQuery({
    queryKey: ["training_ranking"],
    queryFn: async () => {
      // Get all watched status
      const { data: watched } = await supabase.from("training_watch_status").select("user_id");
      // Get all quiz results
      const { data: quizzes } = await supabase.from("training_quiz_results").select("user_id, score, total_questions");
      // Get profiles
      const { data: profiles } = await supabase.from("profiles").select("user_id, display_name");

      const profileMap = new Map(profiles?.map((p) => [p.user_id, p.display_name || "Usuário"]) ?? []);
      const userMap = new Map<string, { watched: number; scores: number[]; totals: number[] }>();

      watched?.forEach((w) => {
        if (!userMap.has(w.user_id)) userMap.set(w.user_id, { watched: 0, scores: [], totals: [] });
        userMap.get(w.user_id)!.watched++;
      });

      quizzes?.forEach((q) => {
        if (!userMap.has(q.user_id)) userMap.set(q.user_id, { watched: 0, scores: [], totals: [] });
        const u = userMap.get(q.user_id)!;
        u.scores.push(q.score);
        u.totals.push(q.total_questions);
      });

      const result: RankedUser[] = [];
      userMap.forEach((data, userId) => {
        const totalScore = data.scores.reduce((a, b) => a + b, 0);
        const totalQuestions = data.totals.reduce((a, b) => a + b, 0);
        result.push({
          user_id: userId,
          display_name: profileMap.get(userId) || "Usuário",
          watched: data.watched,
          quizzes: data.scores.length,
          avg_score: totalQuestions > 0 ? Math.round((totalScore / totalQuestions) * 100) : 0,
        });
      });

      // Sort by: quizzes completed desc, avg score desc, watched desc
      return result.sort((a, b) => {
        if (b.quizzes !== a.quizzes) return b.quizzes - a.quizzes;
        if (b.avg_score !== a.avg_score) return b.avg_score - a.avg_score;
        return b.watched - a.watched;
      });
    },
  });

  const medals = ["🥇", "🥈", "🥉"];

  if (isLoading) return <p className="text-sm text-muted-foreground text-center py-4">Carregando ranking...</p>;
  if (ranking.length === 0) return null;

  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <h3 className="font-semibold text-sm text-foreground flex items-center gap-2">
          <Trophy className="h-4 w-4 text-yellow-500" /> Ranking de Alunos
        </h3>
        <div className="space-y-2">
          {ranking.slice(0, 10).map((u, i) => (
            <div key={u.user_id} className="flex items-center gap-3 py-1.5 px-2 rounded-md hover:bg-muted/50 transition-colors">
              <span className="text-sm w-6 text-center font-medium">
                {i < 3 ? medals[i] : `${i + 1}º`}
              </span>
              <Avatar className="h-6 w-6">
                <AvatarFallback className="text-[10px] bg-primary/10 text-primary">
                  {u.display_name.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <span className="text-sm font-medium text-foreground flex-1 truncate">{u.display_name}</span>
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-1"><Eye className="h-3 w-3" /> {u.watched}</span>
                <span className="flex items-center gap-1"><CheckCircle2 className="h-3 w-3" /> {u.quizzes}</span>
                {u.avg_score > 0 && <Badge variant="secondary" className="text-[10px]">{u.avg_score}%</Badge>}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
