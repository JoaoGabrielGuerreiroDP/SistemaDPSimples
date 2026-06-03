import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAdmin } from "@/hooks/useAdmin";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Plus, Trash2, ChevronRight, ChevronDown, BookOpen, CheckCircle2, Lock, Play, FileText, FormInput, Link2, Upload, Loader2, ExternalLink, ClipboardList, Users } from "lucide-react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";

interface TrainingPath {
  id: string;
  title: string;
  description: string | null;
  sort_order: number;
}

interface PathContent {
  id: string;
  path_id: string;
  content_type: string;
  title: string;
  url: string | null;
  file_path: string | null;
  sort_order: number;
}

export default function TrainingPaths() {
  const { isAdmin } = useAdmin();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [dialogOpen, setDialogOpen] = useState(() => searchParams.get("criar") === "1");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [collapsedPaths, setCollapsedPaths] = useState<Record<string, boolean>>({});
  const togglePath = (id: string) => setCollapsedPaths((p) => ({ ...p, [id]: !p[id] }));

  // Add content dialog state
  const [addContentDialog, setAddContentDialog] = useState<string | null>(null);
  const [contentTab, setContentTab] = useState("url");
  const [contentTitle, setContentTitle] = useState("");
  const [contentUrl, setContentUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const docInputRef = useRef<HTMLInputElement>(null);

  const { data: paths = [] } = useQuery({
    queryKey: ["training_paths"],
    queryFn: async () => {
      const { data } = await supabase.from("training_paths").select("*").order("sort_order");
      return (data ?? []) as TrainingPath[];
    },
  });

  const { data: pathContents = [] } = useQuery({
    queryKey: ["training_path_contents"],
    queryFn: async () => {
      const { data } = await supabase.from("training_path_contents").select("*").order("sort_order");
      return (data ?? []) as PathContent[];
    },
  });

  const { data: watchedIds = [] } = useQuery({
    queryKey: ["watch_status_all", user?.id],
    queryFn: async () => {
      const { data } = await supabase.from("training_watch_status").select("video_id").eq("user_id", user!.id);
      return data?.map((d) => d.video_id) ?? [];
    },
    enabled: !!user,
  });

  const watchedSet = new Set(watchedIds);

  const createPath = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("training_paths").insert({ title: title.trim(), description: description.trim() || null });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["training_paths"] });
      setDialogOpen(false);
      setTitle("");
      setDescription("");
      toast.success("Trilha criada!");
    },
  });

  const deletePath = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("training_paths").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["training_paths"] });
      toast.success("Trilha removida!");
    },
  });

  const addContent = useMutation({
    mutationFn: async (payload: { pathId: string; content_type: string; title: string; url?: string; file_path?: string }) => {
      const existing = pathContents.filter((c) => c.path_id === payload.pathId);
      const { error } = await supabase.from("training_path_contents").insert({
        path_id: payload.pathId,
        content_type: payload.content_type,
        title: payload.title,
        url: payload.url || null,
        file_path: payload.file_path || null,
        sort_order: existing.length,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["training_path_contents"] });
      resetContentForm();
      toast.success("Conteúdo adicionado!");
    },
    onError: () => toast.error("Erro ao adicionar conteúdo"),
  });

  const removeContent = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("training_path_contents").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["training_path_contents"] });
    },
  });

  const resetContentForm = () => {
    setAddContentDialog(null);
    setContentTab("url");
    setContentTitle("");
    setContentUrl("");
  };

  const handleAddUrl = () => {
    if (!contentTitle.trim() || !contentUrl.trim()) {
      toast.error("Título e URL são obrigatórios");
      return;
    }
    addContent.mutate({
      pathId: addContentDialog!,
      content_type: "url",
      title: contentTitle.trim(),
      url: contentUrl.trim(),
    });
  };

  const handleAddForm = () => {
    if (!contentTitle.trim() || !contentUrl.trim()) {
      toast.error("Título e URL do formulário são obrigatórios");
      return;
    }
    addContent.mutate({
      pathId: addContentDialog!,
      content_type: "form",
      title: contentTitle.trim(),
      url: contentUrl.trim(),
    });
  };

  const handleFileUpload = async (file: File, type: "video" | "document") => {
    if (!addContentDialog) return;
    setUploading(true);
    try {
      const ext = file.name.split(".").pop();
      const filePath = `${addContentDialog}/${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage.from("training-files").upload(filePath, file);
      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage.from("training-files").getPublicUrl(filePath);

      addContent.mutate({
        pathId: addContentDialog,
        content_type: type,
        title: contentTitle.trim() || file.name,
        url: urlData.publicUrl,
        file_path: filePath,
      });
    } catch (err: any) {
      toast.error("Erro ao fazer upload: " + err.message);
    } finally {
      setUploading(false);
    }
  };

  const getContentIcon = (type: string) => {
    switch (type) {
      case "video": return <Play className="h-3.5 w-3.5 text-primary" />;
      case "document": return <FileText className="h-3.5 w-3.5 text-orange-500" />;
      case "form": return <FormInput className="h-3.5 w-3.5 text-purple-500" />;
      case "url": return <Link2 className="h-3.5 w-3.5 text-blue-500" />;
      default: return <ChevronRight className="h-3.5 w-3.5" />;
    }
  };

  const getContentLabel = (type: string) => {
    switch (type) {
      case "video": return "Vídeo";
      case "document": return "Documento";
      case "form": return "Formulário";
      case "url": return "Link";
      default: return type;
    }
  };

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <BookOpen className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">Treinamentos</h1>
            <p className="text-sm text-muted-foreground">{paths.length} trilha{paths.length !== 1 ? "s" : ""}</p>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          {isAdmin && (
            <>
              <Link to="/treinamentos/alunos">
                <Button size="sm" variant="outline"><Users className="h-4 w-4 mr-1" /> Alunos</Button>
              </Link>
              <Link to="/treinamentos/notas">
                <Button size="sm" variant="outline"><ClipboardList className="h-4 w-4 mr-1" /> Notas</Button>
              </Link>
              <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogTrigger asChild>
                  <Button size="sm"><Plus className="h-4 w-4 mr-1" /> Nova Trilha</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>Nova Trilha</DialogTitle></DialogHeader>
                  <div className="space-y-3">
                    <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Nome da trilha" />
                    <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Descrição (opcional)" rows={3} />
                    <Button onClick={() => createPath.mutate()} disabled={!title.trim() || createPath.isPending} className="w-full">Criar Trilha</Button>
                  </div>
                </DialogContent>
              </Dialog>
            </>
          )}
        </div>
      </div>

      {paths.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <BookOpen className="h-12 w-12 text-muted-foreground/40 mb-4" />
            <p className="text-muted-foreground">Nenhuma trilha criada ainda.</p>
            {isAdmin && <p className="text-sm text-muted-foreground mt-1">Clique em "Nova Trilha" para criar a primeira.</p>}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {paths.map((path) => {
            const contents = pathContents
              .filter((c) => c.path_id === path.id)
              .sort((a, b) => a.sort_order - b.sort_order);
            const total = contents.length;
            const isCollapsed = collapsedPaths[path.id];

            return (
              <Card key={path.id} className="overflow-hidden">
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => togglePath(path.id)}
                      className="flex items-start gap-2 flex-1 text-left hover:opacity-80 transition-opacity"
                    >
                      {isCollapsed ? (
                        <ChevronRight className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                      ) : (
                        <ChevronDown className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                      )}
                      <div className="flex-1">
                        <h2 className="font-semibold text-foreground">{path.title}</h2>
                        {path.description && <p className="text-xs text-muted-foreground mt-1">{path.description}</p>}
                      </div>
                      {total > 0 && (
                        <Badge variant="secondary" className="text-xs shrink-0">{total}</Badge>
                      )}
                    </button>
                    {isAdmin && (
                      <div className="flex gap-1 shrink-0">
                        <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setAddContentDialog(path.id)}>
                          <Plus className="h-3 w-3 mr-1" /> Conteúdo
                        </Button>
                        <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => { if (confirm("Remover trilha?")) deletePath.mutate(path.id); }}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    )}
                  </div>

                  {!isCollapsed && (
                    <div className="space-y-1">
                      {contents.map((item) => (
                        <div
                          key={item.id}
                          className="flex items-center gap-3 py-2 px-3 rounded-lg border hover:bg-muted/50 cursor-pointer transition-colors"
                          onClick={async () => {
                            if (!item.url) return;
                            if (item.file_path) {
                              try {
                                const { data, error } = await supabase.storage.from("training-files").download(item.file_path);
                                if (error || !data) {
                                  toast.error("Erro ao baixar arquivo");
                                  return;
                                }
                                const blobUrl = URL.createObjectURL(data);
                                const a = document.createElement("a");
                                a.href = blobUrl;
                                a.target = "_blank";
                                a.rel = "noopener noreferrer";
                                if (item.content_type === "document") {
                                  a.download = item.title || "documento";
                                }
                                document.body.appendChild(a);
                                a.click();
                                document.body.removeChild(a);
                                setTimeout(() => URL.revokeObjectURL(blobUrl), 5000);
                              } catch {
                                toast.error("Erro ao abrir arquivo");
                              }
                            } else {
                              window.open(item.url, "_blank", "noopener,noreferrer");
                            }
                          }}
                        >
                          <div className="shrink-0 w-6 h-6 rounded-full flex items-center justify-center border">
                            {getContentIcon(item.content_type)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-foreground truncate">{item.title}</p>
                            <p className="text-[10px] text-muted-foreground">{getContentLabel(item.content_type)}</p>
                          </div>
                          {item.url && <ExternalLink className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
                          {isAdmin && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                if (confirm("Remover este conteúdo?")) removeContent.mutate(item.id);
                              }}
                              className="text-destructive hover:text-destructive/80"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Add content dialog */}
      <Dialog open={!!addContentDialog} onOpenChange={(o) => { if (!o) resetContentForm(); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Adicionar Conteúdo</DialogTitle></DialogHeader>
          <Tabs value={contentTab} onValueChange={setContentTab}>
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="url" className="text-xs gap-1"><Link2 className="h-3.5 w-3.5" /> URL</TabsTrigger>
              <TabsTrigger value="video" className="text-xs gap-1"><Upload className="h-3.5 w-3.5" /> Vídeo</TabsTrigger>
              <TabsTrigger value="document" className="text-xs gap-1"><FileText className="h-3.5 w-3.5" /> Doc</TabsTrigger>
              <TabsTrigger value="form" className="text-xs gap-1"><FormInput className="h-3.5 w-3.5" /> Form</TabsTrigger>
            </TabsList>

            <TabsContent value="url" className="space-y-3 mt-3">
              <Input value={contentTitle} onChange={(e) => setContentTitle(e.target.value)} placeholder="Título do conteúdo" />
              <Input value={contentUrl} onChange={(e) => setContentUrl(e.target.value)} placeholder="https://..." />
              <Button className="w-full" disabled={!contentTitle.trim() || !contentUrl.trim() || addContent.isPending} onClick={handleAddUrl}>
                Adicionar URL
              </Button>
            </TabsContent>

            <TabsContent value="video" className="space-y-3 mt-3">
              <Input value={contentTitle} onChange={(e) => setContentTitle(e.target.value)} placeholder="Título do vídeo (opcional)" />
              <input
                ref={fileInputRef}
                type="file"
                accept="video/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleFileUpload(file, "video");
                }}
              />
              <Button
                variant="outline"
                className="w-full h-20 border-dashed flex flex-col gap-1"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
              >
                {uploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Upload className="h-5 w-5" />}
                <span className="text-xs">{uploading ? "Enviando..." : "Clique para selecionar o vídeo"}</span>
              </Button>
            </TabsContent>

            <TabsContent value="document" className="space-y-3 mt-3">
              <Input value={contentTitle} onChange={(e) => setContentTitle(e.target.value)} placeholder="Título do documento (opcional)" />
              <input
                ref={docInputRef}
                type="file"
                accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleFileUpload(file, "document");
                }}
              />
              <Button
                variant="outline"
                className="w-full h-20 border-dashed flex flex-col gap-1"
                onClick={() => docInputRef.current?.click()}
                disabled={uploading}
              >
                {uploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <FileText className="h-5 w-5" />}
                <span className="text-xs">{uploading ? "Enviando..." : "Clique para selecionar o documento"}</span>
              </Button>
            </TabsContent>

            <TabsContent value="form" className="space-y-3 mt-3">
              <Input value={contentTitle} onChange={(e) => setContentTitle(e.target.value)} placeholder="Título do formulário" />
              <Input value={contentUrl} onChange={(e) => setContentUrl(e.target.value)} placeholder="URL do formulário (Google Forms, Typeform...)" />
              <Button className="w-full" disabled={!contentTitle.trim() || !contentUrl.trim() || addContent.isPending} onClick={handleAddForm}>
                Adicionar Formulário
              </Button>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>
    </div>
  );
}
