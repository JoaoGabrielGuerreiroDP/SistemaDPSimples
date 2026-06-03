import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { useCustomAchievements, type CustomAchievement } from "@/hooks/useCustomAchievements";
import { ALL_BROKERS } from "@/lib/seller-names";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger,
} from "@/components/ui/dialog";
import { Loader2, Sparkles, Trash2, Award, Plus, Trophy } from "lucide-react";
import { toast } from "sonner";
import { Navigate } from "react-router-dom";

export default function AdminAchievements() {
  const { user } = useAuth();
  const { role, loading: roleLoading } = useUserRole();
  const { achievements, assignments, loading, reload } = useCustomAchievements();

  // Acesso: admin, gestor ou líder de time
  const [isTeamManager, setIsTeamManager] = useState<boolean | null>(null);
  useEffect(() => {
    if (!user) { setIsTeamManager(false); return; }
    supabase
      .from("team_managers")
      .select("id")
      .eq("user_id", user.id)
      .limit(1)
      .then(({ data }) => setIsTeamManager((data?.length || 0) > 0));
  }, [user]);

  const canAccess = role === "admin" || role === "gestor" || isTeamManager === true;
  const loadingAccess = roleLoading || isTeamManager === null;

  // ─── Form: criar conquista ─────────────────────────────────
  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [generating, setGenerating] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const handleGenerateIcon = async () => {
    if (name.trim().length < 2) {
      toast.error("Dê um nome à conquista primeiro");
      return;
    }
    setGenerating(true);
    setPreviewUrl(null);
    try {
      const { data, error } = await supabase.functions.invoke("generate-achievement-icon", {
        body: { name: name.trim(), description: description.trim() },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setPreviewUrl(data.icon_url);
      toast.success("Ícone gerado! Revise e salve.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao gerar ícone");
    } finally {
      setGenerating(false);
    }
  };

  const handleSaveAchievement = async () => {
    if (!previewUrl || !name.trim()) return;
    setSaving(true);
    const { error } = await supabase.from("custom_achievements").insert({
      name: name.trim(),
      description: description.trim() || null,
      icon_url: previewUrl,
      created_by: user?.id,
    });
    setSaving(false);
    if (error) { toast.error("Erro: " + error.message); return; }
    toast.success("Conquista criada!");
    setName(""); setDescription(""); setPreviewUrl(null);
    setCreateOpen(false);
    reload();
  };

  const handleDeleteAchievement = async (id: string, name: string) => {
    if (!confirm(`Excluir "${name}"? As atribuições aos vendedores também serão removidas.`)) return;
    const { error } = await supabase.from("custom_achievements").delete().eq("id", id);
    if (error) { toast.error("Erro: " + error.message); return; }
    toast.success("Conquista excluída");
    reload();
  };

  // ─── Atribuir conquistas ───────────────────────────────────
  const [assignAchievement, setAssignAchievement] = useState<CustomAchievement | null>(null);
  const [assignBroker, setAssignBroker] = useState("");
  const [assignNote, setAssignNote] = useState("");
  const [assigning, setAssigning] = useState(false);

  const handleAssign = async () => {
    if (!assignAchievement || !assignBroker) return;
    setAssigning(true);
    const { error } = await supabase.from("broker_achievements").insert({
      achievement_id: assignAchievement.id,
      broker_name: assignBroker,
      note: assignNote.trim() || null,
      awarded_by: user?.id,
    });
    setAssigning(false);
    if (error) {
      if (error.code === "23505") toast.error("Esse vendedor já possui esta conquista");
      else toast.error("Erro: " + error.message);
      return;
    }
    toast.success(`${assignBroker} agora tem ${assignAchievement.name}!`);
    setAssignAchievement(null);
    setAssignBroker(""); setAssignNote("");
    reload();
  };

  const handleRevoke = async (assignmentId: string) => {
    if (!confirm("Remover esta conquista do vendedor?")) return;
    const { error } = await supabase.from("broker_achievements").delete().eq("id", assignmentId);
    if (error) { toast.error("Erro: " + error.message); return; }
    toast.success("Conquista removida");
    reload();
  };

  const assignmentsByAchievement = useMemo(() => {
    const map: Record<string, typeof assignments> = {};
    for (const a of assignments) {
      if (!map[a.achievement_id]) map[a.achievement_id] = [];
      map[a.achievement_id].push(a);
    }
    return map;
  }, [assignments]);

  if (loadingAccess) {
    return <div className="p-8 text-center text-muted-foreground">Carregando…</div>;
  }
  if (!canAccess) {
    return <Navigate to="/home" replace />;
  }

  return (
    <div className="container mx-auto p-4 sm:p-6 space-y-4 max-w-6xl">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-lg">
          <Trophy className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="font-display text-xl sm:text-2xl font-bold">Conquistas</h1>
          <p className="text-xs text-muted-foreground">Crie ícones com IA e premie seus vendedores</p>
        </div>
      </div>

      <Tabs defaultValue="catalog" className="space-y-4">
        <TabsList>
          <TabsTrigger value="catalog">Catálogo</TabsTrigger>
          <TabsTrigger value="assignments">Atribuições</TabsTrigger>
        </TabsList>

        {/* ───────── CATÁLOGO ───────── */}
        <TabsContent value="catalog" className="space-y-3">
          <div className="flex justify-end">
            <Dialog open={createOpen} onOpenChange={setCreateOpen}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <Plus className="w-4 h-4 mr-1" /> Nova conquista
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>Criar nova conquista</DialogTitle>
                </DialogHeader>
                <div className="space-y-3">
                  <div>
                    <Label htmlFor="ach-name">Nome *</Label>
                    <Input
                      id="ach-name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Ex: Vendedor do Mês"
                      maxLength={50}
                    />
                  </div>
                  <div>
                    <Label htmlFor="ach-desc">Descrição (orienta a IA)</Label>
                    <Textarea
                      id="ach-desc"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="Ex: estrela dourada brilhante com raios"
                      rows={2}
                    />
                  </div>
                  <Button
                    onClick={handleGenerateIcon}
                    disabled={generating || !name.trim()}
                    variant="secondary"
                    className="w-full"
                  >
                    {generating ? (
                      <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Gerando ícone…</>
                    ) : (
                      <><Sparkles className="w-4 h-4 mr-2" /> Gerar ícone com IA</>
                    )}
                  </Button>
                  {previewUrl && (
                    <div className="rounded-lg border border-amber-500/30 bg-gradient-to-br from-amber-500/5 to-orange-500/5 p-3 flex flex-col items-center gap-2">
                      <img src={previewUrl} alt="Preview" className="w-32 h-32 object-contain drop-shadow-lg" />
                      <p className="text-[11px] text-muted-foreground">Pré-visualização — clique em Salvar para confirmar</p>
                    </div>
                  )}
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancelar</Button>
                  <Button onClick={handleSaveAchievement} disabled={!previewUrl || saving}>
                    {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    Salvar conquista
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          {loading ? (
            <p className="text-center text-sm text-muted-foreground py-8">Carregando…</p>
          ) : achievements.length === 0 ? (
            <Card><CardContent className="text-center py-12 text-sm text-muted-foreground">
              Nenhuma conquista customizada ainda. Clique em "Nova conquista" para começar.
            </CardContent></Card>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {achievements.map((a) => {
                const count = assignmentsByAchievement[a.id]?.length || 0;
                return (
                  <Card key={a.id} className="border-amber-500/20">
                    <CardContent className="p-3 flex gap-3">
                      <img src={a.icon_url} alt={a.name} className="w-20 h-20 object-contain shrink-0 drop-shadow" />
                      <div className="flex-1 min-w-0 space-y-1">
                        <div className="flex items-start justify-between gap-1">
                          <h3 className="font-bold text-sm leading-tight truncate">{a.name}</h3>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-6 w-6 shrink-0"
                            onClick={() => handleDeleteAchievement(a.id, a.name)}
                          >
                            <Trash2 className="w-3 h-3 text-destructive" />
                          </Button>
                        </div>
                        {a.description && (
                          <p className="text-[10px] text-muted-foreground leading-snug line-clamp-2">{a.description}</p>
                        )}
                        <div className="flex items-center justify-between pt-1">
                          <Badge variant="secondary" className="text-[9px]">
                            {count} {count === 1 ? "vendedor" : "vendedores"}
                          </Badge>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-6 text-[10px] px-2"
                            onClick={() => setAssignAchievement(a)}
                          >
                            <Award className="w-3 h-3 mr-1" /> Atribuir
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* ───────── ATRIBUIÇÕES ───────── */}
        <TabsContent value="assignments" className="space-y-3">
          {assignments.length === 0 ? (
            <Card><CardContent className="text-center py-12 text-sm text-muted-foreground">
              Nenhuma conquista atribuída ainda.
            </CardContent></Card>
          ) : (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Histórico de atribuições</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {assignments.map((b) => {
                  const ach = achievements.find((a) => a.id === b.achievement_id);
                  if (!ach) return null;
                  return (
                    <div
                      key={b.id}
                      className="flex items-center gap-3 p-2 rounded-lg border border-border/40 bg-muted/20"
                    >
                      <img src={ach.icon_url} alt={ach.name} className="w-10 h-10 object-contain shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold truncate">{b.broker_name}</p>
                        <p className="text-[11px] text-muted-foreground truncate">
                          {ach.name}
                          {b.note && <> · <span className="italic">"{b.note}"</span></>}
                        </p>
                        <p className="text-[9px] text-muted-foreground/70">
                          {new Date(b.awarded_at).toLocaleDateString("pt-BR")}
                        </p>
                      </div>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 shrink-0"
                        onClick={() => handleRevoke(b.id)}
                      >
                        <Trash2 className="w-3.5 h-3.5 text-destructive" />
                      </Button>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* ───────── DIALOG ATRIBUIR ───────── */}
      <Dialog open={!!assignAchievement} onOpenChange={(o) => !o && setAssignAchievement(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Award className="w-4 h-4" /> Atribuir: {assignAchievement?.name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {assignAchievement && (
              <div className="flex justify-center">
                <img src={assignAchievement.icon_url} alt="" className="w-24 h-24 object-contain drop-shadow-lg" />
              </div>
            )}
            <div>
              <Label>Vendedor *</Label>
              <Select value={assignBroker} onValueChange={setAssignBroker}>
                <SelectTrigger>
                  <SelectValue placeholder="Escolha o vendedor" />
                </SelectTrigger>
                <SelectContent>
                  {ALL_BROKERS.map((b) => (
                    <SelectItem key={b} value={b}>{b}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="assign-note">Nota (opcional)</Label>
              <Textarea
                id="assign-note"
                value={assignNote}
                onChange={(e) => setAssignNote(e.target.value)}
                placeholder="Ex: por bater meta 3 meses seguidos"
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignAchievement(null)}>Cancelar</Button>
            <Button onClick={handleAssign} disabled={!assignBroker || assigning}>
              {assigning && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Atribuir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
