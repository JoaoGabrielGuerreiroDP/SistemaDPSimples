import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAdmin } from "@/hooks/useAdmin";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Pencil, Trash2, Play, GraduationCap, ChevronDown, ChevronUp, Search, ClipboardList, BookOpen, Users, FolderPlus } from "lucide-react";
import { Link, useSearchParams, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import VideoDetail from "@/components/training/VideoDetail";
import { WatchButton } from "@/components/training/WatchButton";

interface TrainingVideo {
  id: string;
  title: string;
  description: string | null;
  youtube_url: string;
  category: string;
  sort_order: number;
  created_at: string;
  ai_summary?: string | null;
  ai_quiz?: any[] | null;
  ai_generated_at?: string | null;
}

const DEFAULT_CATEGORIES = ["Geral", "Vendas", "Financeiro", "Processos", "Produto", "Liderança"];

function extractYouTubeId(url: string): string | null {
  const match = url.match(
    /(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([^&?\s]{11})/
  );
  return match ? match[1] : null;
}

function VideoForm({
  initial,
  onSave,
  onCancel,
  saving,
}: {
  initial?: TrainingVideo;
  onSave: (data: { title: string; description: string; youtube_url: string; category: string }) => void;
  onCancel: () => void;
  saving: boolean;
}) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [youtubeUrl, setYoutubeUrl] = useState(initial?.youtube_url ?? "");
  const [category, setCategory] = useState(initial?.category ?? "Geral");

  return (
    <div className="space-y-4">
      <div>
        <label className="text-sm font-medium text-foreground mb-1 block">Título *</label>
        <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Nome do treinamento" />
      </div>
      <div>
        <label className="text-sm font-medium text-foreground mb-1 block">URL do YouTube *</label>
        <Input value={youtubeUrl} onChange={(e) => setYoutubeUrl(e.target.value)} placeholder="https://www.youtube.com/watch?v=..." />
      </div>
      <div>
        <label className="text-sm font-medium text-foreground mb-1 block">Categoria</label>
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {DEFAULT_CATEGORIES.map((c) => (
              <SelectItem key={c} value={c}>{c}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div>
        <label className="text-sm font-medium text-foreground mb-1 block">Descrição</label>
        <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Descrição opcional..." rows={3} />
      </div>
      <div className="flex gap-2 justify-end pt-2">
        <Button variant="outline" onClick={onCancel} disabled={saving}>Cancelar</Button>
        <Button
          onClick={() => {
            if (!title.trim() || !youtubeUrl.trim()) {
              toast.error("Título e URL são obrigatórios");
              return;
            }
            if (!extractYouTubeId(youtubeUrl)) {
              toast.error("URL do YouTube inválida");
              return;
            }
            onSave({ title: title.trim(), description: description.trim(), youtube_url: youtubeUrl.trim(), category });
          }}
          disabled={saving}
        >
          {saving ? "Salvando..." : "Salvar"}
        </Button>
      </div>
    </div>
  );
}

export default function Treinamentos() {
  const { isAdmin } = useAdmin();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<TrainingVideo | null>(null);
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [collapsedCats, setCollapsedCats] = useState<Record<string, boolean>>({});
  const [searchParams] = useSearchParams();

  const toggleCat = (cat: string) => setCollapsedCats((p) => ({ ...p, [cat]: !p[cat] }));

  // Auto-expand video from URL param (from trilhas)
  const videoParam = searchParams.get("video");
  if (videoParam && expandedId !== videoParam && !expandedId) {
    setExpandedId(videoParam);
  }

  const { data: videos = [], isLoading } = useQuery({
    queryKey: ["training_videos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("training_videos")
        .select("*")
        .order("category")
        .order("sort_order")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as TrainingVideo[];
    },
  });

  const upsert = useMutation({
    mutationFn: async (payload: { id?: string; title: string; description: string; youtube_url: string; category: string }) => {
      if (payload.id) {
        const { error } = await supabase.from("training_videos").update({
          title: payload.title,
          description: payload.description || null,
          youtube_url: payload.youtube_url,
          category: payload.category,
          updated_at: new Date().toISOString(),
        }).eq("id", payload.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("training_videos").insert({
          title: payload.title,
          description: payload.description || null,
          youtube_url: payload.youtube_url,
          category: payload.category,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["training_videos"] });
      setDialogOpen(false);
      setEditing(null);
      toast.success("Vídeo salvo com sucesso!");
    },
    onError: () => toast.error("Erro ao salvar vídeo"),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("training_videos").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["training_videos"] });
      toast.success("Vídeo removido");
    },
    onError: () => toast.error("Erro ao remover vídeo"),
  });

  const categories = [...new Set(videos.map((v) => v.category))].sort();
  const filtered = videos
    .filter((v) => filterCategory === "all" || v.category === filterCategory)
    .filter((v) => !searchQuery || v.title.toLowerCase().includes(searchQuery.toLowerCase()) || v.description?.toLowerCase().includes(searchQuery.toLowerCase()));

  // group by category
  const grouped: Record<string, TrainingVideo[]> = {};
  filtered.forEach((v) => {
    if (!grouped[v.category]) grouped[v.category] = [];
    grouped[v.category].push(v);
  });

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <GraduationCap className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">Treinamentos</h1>
            <p className="text-sm text-muted-foreground">{videos.length} vídeo{videos.length !== 1 ? "s" : ""} disponíve{videos.length !== 1 ? "is" : "l"}</p>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto flex-wrap">
          <div className="relative flex-1 sm:flex-none">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar vídeo..."
              className="pl-8 w-full sm:w-[200px] h-9"
            />
          </div>
          {categories.length > 1 && (
            <Select value={filterCategory} onValueChange={setFilterCategory}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Categoria" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                {categories.map((c) => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          <Button size="sm" variant="outline" onClick={() => navigate("/treinamentos/trilhas")}>
            <BookOpen className="h-4 w-4 mr-1" /> Trilhas
          </Button>

          {isAdmin && (
            <>
              <Button size="sm" variant="outline" onClick={() => navigate("/treinamentos/trilhas?criar=1")}>
                <FolderPlus className="h-4 w-4 mr-1" /> Criar Trilha
              </Button>
              <Link to="/treinamentos/alunos">
                <Button size="sm" variant="outline"><Users className="h-4 w-4 mr-1" /> Alunos</Button>
              </Link>
              <Link to="/treinamentos/notas">
                <Button size="sm" variant="outline"><ClipboardList className="h-4 w-4 mr-1" /> Notas</Button>
              </Link>
              <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) setEditing(null); }}>
                <DialogTrigger asChild>
                  <Button size="sm"><Plus className="h-4 w-4 mr-1" /> Adicionar</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>{editing ? "Editar Vídeo" : "Novo Vídeo"}</DialogTitle>
                  </DialogHeader>
                  <VideoForm
                    initial={editing ?? undefined}
                    saving={upsert.isPending}
                    onCancel={() => { setDialogOpen(false); setEditing(null); }}
                    onSave={(data) => upsert.mutate({ ...data, id: editing?.id })}
                  />
                </DialogContent>
              </Dialog>
            </>
          )}
        </div>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">Carregando...</div>
      ) : videos.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <Play className="h-12 w-12 text-muted-foreground/40 mb-4" />
            <p className="text-muted-foreground">Nenhum treinamento cadastrado ainda.</p>
            {isAdmin && <p className="text-sm text-muted-foreground mt-1">Clique em "Adicionar" para criar o primeiro.</p>}
          </CardContent>
        </Card>
      ) : (
        Object.entries(grouped).map(([cat, vids]) => {
          const isCollapsed = collapsedCats[cat];
          return (
            <div key={cat} className="space-y-3">
              <button
                type="button"
                onClick={() => toggleCat(cat)}
                className="flex items-center gap-2 w-full text-left hover:opacity-80 transition-opacity"
              >
                {isCollapsed ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronUp className="h-4 w-4 text-muted-foreground" />}
                <h2 className="text-base font-semibold text-foreground">{cat}</h2>
                <Badge variant="secondary" className="text-xs">{vids.length}</Badge>
              </button>
              {!isCollapsed && (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {vids.map((video) => {
                    const ytId = extractYouTubeId(video.youtube_url);
                    return (
                      <Card key={video.id} className="overflow-hidden group">
                        <div className="relative aspect-video bg-muted">
                          {ytId ? (
                            <iframe
                              src={`https://www.youtube.com/embed/${ytId}`}
                              title={video.title}
                              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                              allowFullScreen
                              className="absolute inset-0 w-full h-full"
                            />
                          ) : (
                            <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">
                              <Play className="h-8 w-8" />
                            </div>
                          )}
                        </div>
                        <CardContent className="p-3 space-y-1">
                          <div className="flex items-start justify-between gap-2">
                            <h3 className="font-medium text-sm text-foreground line-clamp-2">{video.title}</h3>
                            <div className="flex gap-1 shrink-0">
                              {(video.ai_summary || isAdmin) && (
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-7 w-7"
                                  onClick={() => setExpandedId(expandedId === video.id ? null : video.id)}
                                >
                                  {expandedId === video.id ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                                </Button>
                              )}
                              {isAdmin && (
                                <>
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                                    onClick={() => { setEditing(video); setDialogOpen(true); }}
                                  >
                                    <Pencil className="h-3.5 w-3.5" />
                                  </Button>
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    className="h-7 w-7 text-destructive hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                                    onClick={() => {
                                      if (confirm("Remover este vídeo?")) remove.mutate(video.id);
                                    }}
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </Button>
                                </>
                              )}
                            </div>
                          </div>
                          <WatchButton videoId={video.id} />
                          {video.description && (
                            <p className="text-xs text-muted-foreground line-clamp-2">{video.description}</p>
                          )}
                          {video.ai_summary && expandedId !== video.id && (
                            <Badge variant="secondary" className="text-[10px] gap-1 cursor-pointer" onClick={() => setExpandedId(video.id)}>
                              ✨ Resumo + Prova disponíveis
                            </Badge>
                          )}
                        </CardContent>
                        {expandedId === video.id && (
                          <CardContent className="px-3 pb-3 pt-0">
                            <VideoDetail video={video} />
                          </CardContent>
                        )}
                      </Card>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })
      )}

    </div>
  );
}
