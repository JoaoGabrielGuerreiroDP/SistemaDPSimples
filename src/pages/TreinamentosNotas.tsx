import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { GraduationCap, Search, Trophy, Users, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { useState, useMemo } from "react";
import { format } from "date-fns";

interface QuizResult {
  id: string;
  score: number;
  total_questions: number;
  completed_at: string;
  user_id: string;
  video_id: string;
  profiles: { display_name: string | null; email: string | null } | null;
  training_videos: { title: string; category: string } | null;
}

export default function TreinamentosNotas() {
  const [search, setSearch] = useState("");
  const [filterVideo, setFilterVideo] = useState("all");

  const { data: results = [], isLoading } = useQuery({
    queryKey: ["training_quiz_results_all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("training_quiz_results")
        .select("id, score, total_questions, completed_at, user_id, video_id, profiles!training_quiz_results_user_id_fkey(display_name, email), training_videos(title, category)")
        .order("completed_at", { ascending: false });
      if (error) {
        // fallback: query without FK join names
        const { data: d2, error: e2 } = await supabase
          .from("training_quiz_results")
          .select("id, score, total_questions, completed_at, user_id, video_id")
          .order("completed_at", { ascending: false });
        if (e2) throw e2;
        return (d2 ?? []) as any[];
      }
      return (data ?? []) as any[];
    },
  });

  const { data: videos = [] } = useQuery({
    queryKey: ["training_videos_list"],
    queryFn: async () => {
      const { data } = await supabase.from("training_videos").select("id, title, category").order("title");
      return data ?? [];
    },
  });

  const { data: profiles = [] } = useQuery({
    queryKey: ["profiles_all"],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("user_id, display_name, email");
      return data ?? [];
    },
  });

  const profileMap = useMemo(() => {
    const m: Record<string, { display_name: string | null; email: string | null }> = {};
    profiles.forEach((p: any) => { m[p.user_id] = p; });
    return m;
  }, [profiles]);

  const videoMap = useMemo(() => {
    const m: Record<string, { title: string; category: string }> = {};
    videos.forEach((v: any) => { m[v.id] = v; });
    return m;
  }, [videos]);

  const enriched = useMemo(() => results.map((r: any) => {
    const profile = r.profiles ?? profileMap[r.user_id];
    const video = r.training_videos ?? videoMap[r.video_id];
    const userName = profile?.display_name || profile?.email || "Usuário";
    const videoTitle = video?.title || "Vídeo removido";
    const category = video?.category || "";
    return { ...r, userName, videoTitle, category };
  }), [results, profileMap, videoMap]);

  const filtered = useMemo(() => enriched
    .filter((r: any) => filterVideo === "all" || r.video_id === filterVideo)
    .filter((r: any) => !search || r.userName.toLowerCase().includes(search.toLowerCase()) || r.videoTitle.toLowerCase().includes(search.toLowerCase())),
  [enriched, filterVideo, search]);

  // Stats
  const uniqueUsers = new Set(enriched.map((r: any) => r.user_id)).size;
  const avgScore = enriched.length > 0
    ? Math.round(enriched.reduce((s: number, r: any) => s + (r.score / r.total_questions) * 100, 0) / enriched.length)
    : 0;

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center gap-3">
        <Link to="/treinamentos">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div className="p-2 rounded-lg bg-primary/10">
          <GraduationCap className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-foreground">Notas dos Treinamentos</h1>
          <p className="text-sm text-muted-foreground">Resultados de todos os usuários nas provas</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <Users className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="text-2xl font-bold">{uniqueUsers}</p>
              <p className="text-xs text-muted-foreground">Usuários</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <Trophy className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="text-2xl font-bold">{avgScore}%</p>
              <p className="text-xs text-muted-foreground">Média geral</p>
            </div>
          </CardContent>
        </Card>
        <Card className="col-span-2 md:col-span-1">
          <CardContent className="p-4 flex items-center gap-3">
            <GraduationCap className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="text-2xl font-bold">{enriched.length}</p>
              <p className="text-xs text-muted-foreground">Provas realizadas</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar usuário ou vídeo..." className="pl-8 h-9" />
        </div>
        {videos.length > 0 && (
          <Select value={filterVideo} onValueChange={setFilterVideo}>
            <SelectTrigger className="w-[200px] h-9">
              <SelectValue placeholder="Todos os vídeos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os vídeos</SelectItem>
              {videos.map((v: any) => (
                <SelectItem key={v.id} value={v.id}>{v.title}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">Carregando...</div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Nenhum resultado encontrado.
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Usuário</TableHead>
                  <TableHead>Treinamento</TableHead>
                  <TableHead className="text-center">Nota</TableHead>
                  <TableHead className="text-right">Data</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((r: any) => {
                  const pct = Math.round((r.score / r.total_questions) * 100);
                  return (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium text-sm">{r.userName}</TableCell>
                      <TableCell>
                        <span className="text-sm">{r.videoTitle}</span>
                        {r.category && <Badge variant="secondary" className="ml-2 text-[10px]">{r.category}</Badge>}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant={pct >= 70 ? "default" : "destructive"} className="text-xs">
                          {r.score}/{r.total_questions} ({pct}%)
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right text-xs text-muted-foreground">
                        {format(new Date(r.completed_at), "dd/MM/yyyy HH:mm")}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
