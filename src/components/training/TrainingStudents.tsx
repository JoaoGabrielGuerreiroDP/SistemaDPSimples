import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Trash2, Search, Eye, CheckCircle2, ArrowLeft, AlertTriangle, CalendarIcon, X } from "lucide-react";
import { toast } from "sonner";
import { Link } from "react-router-dom";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

interface StudentData {
  user_id: string;
  display_name: string;
  email: string;
  avatar_url: string | null;
  watched: number;
  quizzes: number;
  avg_score: number;
}

export function TrainingStudents() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<StudentData | null>(null);
  const [filterCategory, setFilterCategory] = useState("all");
  const [dateFrom, setDateFrom] = useState<Date | undefined>();
  const [dateTo, setDateTo] = useState<Date | undefined>();

  // Fetch videos for category filter
  const { data: videos = [] } = useQuery({
    queryKey: ["training_videos_list"],
    queryFn: async () => {
      const { data } = await supabase.from("training_videos").select("id, title, category").order("title");
      return data ?? [];
    },
  });

  const categories = useMemo(() => {
    const cats = new Set(videos.map((v: any) => v.category));
    return Array.from(cats).sort();
  }, [videos]);

  // Video IDs filtered by category
  const categoryVideoIds = useMemo(() => {
    if (filterCategory === "all") return null;
    return new Set(videos.filter((v: any) => v.category === filterCategory).map((v: any) => v.id));
  }, [videos, filterCategory]);

  const { data: students = [], isLoading } = useQuery({
    queryKey: ["training_students", filterCategory, dateFrom?.toISOString(), dateTo?.toISOString()],
    queryFn: async () => {
      const [
        { data: profiles },
        { data: watched },
        { data: quizzes },
      ] = await Promise.all([
        supabase.from("profiles").select("user_id, display_name, email, avatar_url"),
        (() => {
          let q = supabase.from("training_watch_status").select("user_id, video_id, watched_at");
          if (dateFrom) q = q.gte("watched_at", dateFrom.toISOString());
          if (dateTo) {
            const end = new Date(dateTo);
            end.setHours(23, 59, 59, 999);
            q = q.lte("watched_at", end.toISOString());
          }
          return q;
        })(),
        (() => {
          let q = supabase.from("training_quiz_results").select("user_id, video_id, score, total_questions, completed_at");
          if (dateFrom) q = q.gte("completed_at", dateFrom.toISOString());
          if (dateTo) {
            const end = new Date(dateTo);
            end.setHours(23, 59, 59, 999);
            q = q.lte("completed_at", end.toISOString());
          }
          return q;
        })(),
      ]);

      const userMap = new Map<string, { watched: number; scores: number[]; totals: number[] }>();

      watched?.forEach((w) => {
        if (categoryVideoIds && !categoryVideoIds.has(w.video_id)) return;
        if (!userMap.has(w.user_id)) userMap.set(w.user_id, { watched: 0, scores: [], totals: [] });
        userMap.get(w.user_id)!.watched++;
      });

      quizzes?.forEach((q) => {
        if (categoryVideoIds && !categoryVideoIds.has(q.video_id)) return;
        if (!userMap.has(q.user_id)) userMap.set(q.user_id, { watched: 0, scores: [], totals: [] });
        const u = userMap.get(q.user_id)!;
        u.scores.push(q.score);
        u.totals.push(q.total_questions);
      });

      const result: StudentData[] = [];
      const profileMap = new Map(profiles?.map((p) => [p.user_id, p]) ?? []);

      userMap.forEach((data, userId) => {
        const profile = profileMap.get(userId);
        const totalScore = data.scores.reduce((a, b) => a + b, 0);
        const totalQuestions = data.totals.reduce((a, b) => a + b, 0);
        result.push({
          user_id: userId,
          display_name: profile?.display_name || "Usuário",
          email: profile?.email || "",
          avatar_url: profile?.avatar_url || null,
          watched: data.watched,
          quizzes: data.scores.length,
          avg_score: totalQuestions > 0 ? Math.round((totalScore / totalQuestions) * 100) : 0,
        });
      });

      return result.sort((a, b) => a.display_name.localeCompare(b.display_name));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (userId: string) => {
      const results = await Promise.all([
        supabase.from("training_watch_status").delete().eq("user_id", userId),
        supabase.from("training_quiz_results").delete().eq("user_id", userId),
        supabase.from("training_notes").delete().eq("user_id", userId),
        supabase.from("training_comments").delete().eq("user_id", userId),
        supabase.from("training_ratings").delete().eq("user_id", userId),
      ]);
      const errors = results.filter((r) => r.error);
      if (errors.length > 0) throw new Error(errors[0].error!.message);
    },
    onSuccess: () => {
      toast.success("Dados do aluno excluídos com sucesso");
      queryClient.invalidateQueries({ queryKey: ["training_students"] });
      queryClient.invalidateQueries({ queryKey: ["training_ranking"] });
      setDeleteTarget(null);
    },
    onError: (e: Error) => {
      toast.error("Erro ao excluir: " + e.message);
    },
  });

  const filtered = students.filter(
    (s) =>
      s.display_name.toLowerCase().includes(search.toLowerCase()) ||
      s.email.toLowerCase().includes(search.toLowerCase())
  );

  const hasActiveFilters = filterCategory !== "all" || !!dateFrom || !!dateTo;

  const clearFilters = () => {
    setFilterCategory("all");
    setDateFrom(undefined);
    setDateTo(undefined);
  };

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link to="/treinamentos">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-xl font-bold text-foreground">Alunos</h1>
          <p className="text-sm text-muted-foreground">
            {students.length} aluno{students.length !== 1 ? "s" : ""} com atividade
          </p>
        </div>
      </div>

      {/* Search + Filters */}
      <div className="space-y-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar aluno..."
            className="pl-8 h-9"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Category filter */}
          {categories.length > 0 && (
            <Select value={filterCategory} onValueChange={setFilterCategory}>
              <SelectTrigger className="w-[160px] h-9 text-xs">
                <SelectValue placeholder="Categoria" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas categorias</SelectItem>
                {categories.map((c) => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {/* Date From */}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className={cn("h-9 text-xs gap-1.5 px-3", !dateFrom && "text-muted-foreground")}>
                <CalendarIcon className="h-3.5 w-3.5" />
                {dateFrom ? format(dateFrom, "dd/MM/yyyy") : "De"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar mode="single" selected={dateFrom} onSelect={setDateFrom} initialFocus className="p-3 pointer-events-auto" />
            </PopoverContent>
          </Popover>

          {/* Date To */}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className={cn("h-9 text-xs gap-1.5 px-3", !dateTo && "text-muted-foreground")}>
                <CalendarIcon className="h-3.5 w-3.5" />
                {dateTo ? format(dateTo, "dd/MM/yyyy") : "Até"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar mode="single" selected={dateTo} onSelect={setDateTo} initialFocus className="p-3 pointer-events-auto" />
            </PopoverContent>
          </Popover>

          {hasActiveFilters && (
            <Button variant="ghost" size="sm" className="h-9 text-xs gap-1 text-muted-foreground" onClick={clearFilters}>
              <X className="h-3.5 w-3.5" /> Limpar
            </Button>
          )}
        </div>
      </div>

      {/* List */}
      {isLoading ? (
        <p className="text-center text-muted-foreground py-8">Carregando...</p>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Nenhum aluno encontrado.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.map((student) => (
            <Card key={student.user_id}>
              <CardContent className="p-3 flex items-center gap-3">
                <Avatar className="h-9 w-9">
                  {student.avatar_url && <AvatarImage src={student.avatar_url} />}
                  <AvatarFallback className="text-xs bg-primary/10 text-primary">
                    {student.display_name.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>

                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{student.display_name}</p>
                  <p className="text-xs text-muted-foreground truncate">{student.email}</p>
                </div>

                <div className="flex items-center gap-3 text-xs text-muted-foreground shrink-0">
                  <span className="flex items-center gap-1" title="Vídeos assistidos">
                    <Eye className="h-3 w-3" /> {student.watched}
                  </span>
                  <span className="flex items-center gap-1" title="Provas realizadas">
                    <CheckCircle2 className="h-3 w-3" /> {student.quizzes}
                  </span>
                  {student.avg_score > 0 && (
                    <Badge variant="secondary" className="text-[10px]">{student.avg_score}%</Badge>
                  )}
                </div>

                <Button
                  variant="ghost"
                  size="icon"
                  className="text-destructive hover:text-destructive hover:bg-destructive/10 shrink-0"
                  onClick={() => setDeleteTarget(student)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Delete confirmation */}
      <Dialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Excluir dados do aluno
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Tem certeza que deseja excluir <strong>todos os dados de treinamento</strong> de{" "}
            <strong>{deleteTarget?.display_name}</strong>?
          </p>
          <p className="text-sm text-muted-foreground">
            Isso removerá: vídeos assistidos, resultados de provas, anotações, comentários e avaliações.
            <br />
            <span className="text-destructive font-medium">Esta ação não pode ser desfeita.</span>
          </p>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              disabled={deleteMutation.isPending}
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.user_id)}
            >
              {deleteMutation.isPending ? "Excluindo..." : "Excluir dados"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
