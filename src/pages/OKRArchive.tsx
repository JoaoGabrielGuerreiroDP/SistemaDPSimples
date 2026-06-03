import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Archive, RotateCcw, CheckCircle2, Trash2, Loader2, Trophy, Zap, Timer } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { differenceInDays, differenceInHours } from "date-fns";

interface ArchivedDept {
  id: string;
  name: string;
  icon: string;
  deleted_at: string | null;
  user_id: string | null;
}

interface ArchivedObj {
  id: string;
  title: string;
  department_id: string;
  deleted_at: string | null;
  created_at: string;
}

interface ArchivedKR {
  id: string;
  title: string;
  objective_id: string;
  status: string;
  deleted_at: string | null;
  status_changed_at: string;
  assigned_to: string | null;
  created_at: string;
}

interface ProfileInfo {
  user_id: string;
  display_name: string | null;
  avatar_url: string | null;
}

type ArchiveFilter = "all" | "deleted" | "completed" | "ranking";

export default function OKRArchive() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const requestedTab = searchParams.get("tab");
  const initialTab: ArchiveFilter =
    requestedTab === "deleted" || requestedTab === "completed" || requestedTab === "ranking"
      ? requestedTab
      : "all";
  const [filter, setFilter] = useState<ArchiveFilter>(initialTab);
  const [loading, setLoading] = useState(true);

  const [deletedDepts, setDeletedDepts] = useState<ArchivedDept[]>([]);
  const [deletedObjs, setDeletedObjs] = useState<ArchivedObj[]>([]);
  const [deletedKRs, setDeletedKRs] = useState<ArchivedKR[]>([]);
  const [profiles, setProfiles] = useState<ProfileInfo[]>([]);

  // Completed = active objectives where ALL KRs are done
  const [completedObjs, setCompletedObjs] = useState<{ obj: ArchivedObj; krs: ArchivedKR[]; deptName: string; deptIcon: string; daysToComplete: number }[]>([]);

  useEffect(() => {
    if (user) loadArchive();
  }, [user]);

  async function loadArchive() {
    setLoading(true);

    const [dRes, oRes, krRes, pRes] = await Promise.all([
      supabase.from("departments").select("id, name, icon, deleted_at, user_id"),
      supabase.from("objectives").select("id, title, department_id, deleted_at, created_at"),
      supabase.from("key_results").select("id, title, objective_id, status, deleted_at, status_changed_at, assigned_to, created_at"),
      supabase.from("profiles").select("user_id, display_name, avatar_url"),
    ]);

    const allDepts = (dRes.data || []) as ArchivedDept[];
    const allObjs = (oRes.data || []) as ArchivedObj[];
    const allKRs = (krRes.data || []) as ArchivedKR[];
    setProfiles((pRes.data || []) as ProfileInfo[]);

    // Deleted items
    setDeletedDepts(allDepts.filter((d) => d.deleted_at));
    setDeletedObjs(allObjs.filter((o) => o.deleted_at));
    setDeletedKRs(allKRs.filter((kr) => kr.deleted_at));

    // Completed objectives (not deleted, all KRs done, at least 1 KR)
    const activeObjs = allObjs.filter((o) => !o.deleted_at);
    const activeKRs = allKRs.filter((kr) => !kr.deleted_at);
    const activeDepts = allDepts.filter((d) => !d.deleted_at);

    const completed = activeObjs
      .map((obj) => {
        const objKRs = activeKRs.filter((kr) => kr.objective_id === obj.id);
        if (objKRs.length === 0) return null;
        if (objKRs.every((kr) => kr.status === "done")) {
          const dept = activeDepts.find((d) => d.id === obj.department_id);
          // Calculate days to complete: from obj creation to last KR status_changed_at
          const lastKRDone = objKRs.reduce((latest, kr) => {
            const d = new Date(kr.status_changed_at);
            return d > latest ? d : latest;
          }, new Date(0));
          const daysToComplete = Math.max(0, differenceInDays(lastKRDone, new Date(obj.created_at)));
          return { obj, krs: objKRs, deptName: dept?.name || "", deptIcon: dept?.icon || "📋", daysToComplete };
        }
        return null;
      })
      .filter(Boolean) as typeof completedObjs;

    // Sort by speed (fastest first)
    completed.sort((a, b) => a.daysToComplete - b.daysToComplete);

    setCompletedObjs(completed);
    setLoading(false);
  }

  // Build speed leaderboard by person
  function getPersonRanking() {
    const personMap = new Map<string, { totalHours: number; krCount: number; krs: { title: string; days: number; objTitle: string }[] }>();

    for (const { krs } of completedObjs) {
      for (const kr of krs) {
        if (kr.assigned_to && kr.status === "done") {
          const hours = Math.max(0, differenceInHours(new Date(kr.status_changed_at), new Date(kr.created_at)));
          const existing = personMap.get(kr.assigned_to) || { totalHours: 0, krCount: 0, krs: [] };
          existing.totalHours += hours;
          existing.krCount += 1;
          // Find objective title
          const parentCompleted = completedObjs.find((c) => c.krs.some((k) => k.id === kr.id));
          existing.krs.push({
            title: kr.title,
            days: Math.max(0, Math.round(hours / 24)),
            objTitle: parentCompleted?.obj.title || "",
          });
          personMap.set(kr.assigned_to, existing);
        }
      }
    }

    return Array.from(personMap.entries())
      .map(([userId, data]) => {
        const profile = profiles.find((p) => p.user_id === userId);
        const avgDays = Math.round(data.totalHours / data.krCount / 24);
        return {
          userId,
          name: profile?.display_name || "Sem nome",
          avatarUrl: profile?.avatar_url,
          krCount: data.krCount,
          avgDays,
          krs: data.krs.sort((a, b) => a.days - b.days),
        };
      })
      .sort((a, b) => a.avgDays - b.avgDays);
  }

  function getProfileName(userId: string) {
    return profiles.find((p) => p.user_id === userId)?.display_name || "—";
  }

  async function restoreDepartment(id: string) {
    await supabase.from("departments").update({ deleted_at: null } as any).eq("id", id);
    const childObjs = deletedObjs.filter((o) => o.department_id === id);
    for (const obj of childObjs) {
      await supabase.from("objectives").update({ deleted_at: null } as any).eq("id", obj.id);
      await supabase.from("key_results").update({ deleted_at: null } as any).eq("objective_id", obj.id);
    }
    toast.success("Departamento restaurado!");
    loadArchive();
  }

  async function restoreObjective(id: string) {
    await supabase.from("objectives").update({ deleted_at: null } as any).eq("id", id);
    await supabase.from("key_results").update({ deleted_at: null } as any).eq("objective_id", id);
    toast.success("Objetivo restaurado!");
    loadArchive();
  }

  async function restoreKR(id: string) {
    await supabase.from("key_results").update({ deleted_at: null } as any).eq("id", id);
    toast.success("Key Result restaurado!");
    loadArchive();
  }

  async function permanentDeleteDept(id: string) {
    if (!confirm("Excluir permanentemente? Esta ação não pode ser desfeita.")) return;
    await supabase.from("departments").delete().eq("id", id);
    toast.success("Departamento excluído permanentemente");
    loadArchive();
  }

  async function permanentDeleteObj(id: string) {
    if (!confirm("Excluir permanentemente? Esta ação não pode ser desfeita.")) return;
    await supabase.from("objectives").delete().eq("id", id);
    toast.success("Objetivo excluído permanentemente");
    loadArchive();
  }

  const showDeleted = filter === "all" || filter === "deleted";
  const showCompleted = filter === "all" || filter === "completed";
  const showRanking = filter === "all" || filter === "ranking";

  const hasDeletedItems = deletedDepts.length > 0 || deletedObjs.length > 0 || deletedKRs.length > 0;
  const hasCompletedItems = completedObjs.length > 0;

  const personRanking = getPersonRanking();
  const hasRankingItems = personRanking.length > 0;
  const hasVisibleContent =
    filter === "all"
      ? hasDeletedItems || hasCompletedItems || hasRankingItems
      : filter === "deleted"
        ? hasDeletedItems
        : filter === "completed"
          ? hasCompletedItems
          : hasRankingItems;
  const medalEmojis = ["🥇", "🥈", "🥉"];

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center text-muted-foreground">
        <Loader2 className="w-5 h-5 animate-spin mr-2" /> Carregando...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto px-4 py-8 sm:py-12 space-y-6">
        <div className="flex items-center gap-3">
          <h1 className="font-display text-xl font-bold text-foreground flex items-center gap-2">
            <Archive className="w-5 h-5" /> Arquivo de OKRs
          </h1>
        </div>

        {/* Filter tabs */}
        <div className="flex gap-2">
          {(["all", "deleted", "completed", "ranking"] as ArchiveFilter[]).map((f) => (
            <Button
              key={f}
              variant={filter === f ? "default" : "outline"}
              size="sm"
              onClick={() => setFilter(f)}
            >
              {f === "all"
                ? "Todos"
                : f === "deleted"
                  ? "🗑️ Excluídos"
                  : f === "completed"
                    ? "✅ Concluídos"
                    : "🏆 Ranking"}
            </Button>
          ))}
        </div>

        {!hasVisibleContent && (
          <div className="glass-card p-8 text-center text-muted-foreground">
            {filter === "ranking"
              ? "Ainda não há ranking. Conclua KRs com responsável definido para aparecer aqui."
              : "Nenhum item encontrado nesta aba."}
          </div>
        )}

        {/* Deleted departments */}
        {showDeleted && deletedDepts.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
              🗑️ Departamentos excluídos
            </h2>
            {deletedDepts.map((dept) => (
              <div key={dept.id} className="glass-card border border-destructive/20 p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-lg">{dept.icon}</span>
                  <div>
                    <p className="font-medium text-foreground">{dept.name}</p>
                    <p className="text-xs text-muted-foreground">
                      Excluído em {new Date(dept.deleted_at!).toLocaleDateString("pt-BR")}
                    </p>
                  </div>
                </div>
                <div className="flex gap-1">
                  <Button variant="ghost" size="sm" onClick={() => restoreDepartment(dept.id)} className="text-primary">
                    <RotateCcw className="w-4 h-4 mr-1" /> Restaurar
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => permanentDeleteDept(dept.id)} className="text-destructive">
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Deleted standalone objectives (whose dept is NOT deleted) */}
        {showDeleted && deletedObjs.filter((o) => !deletedDepts.some((d) => d.id === o.department_id)).length > 0 && (
          <div className="space-y-3">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
              🗑️ Objetivos excluídos
            </h2>
            {deletedObjs
              .filter((o) => !deletedDepts.some((d) => d.id === o.department_id))
              .map((obj) => (
                <div key={obj.id} className="glass-card border border-destructive/20 p-4 flex items-center justify-between">
                  <div>
                    <p className="font-medium text-foreground text-sm">{obj.title}</p>
                    <p className="text-xs text-muted-foreground">
                      Excluído em {new Date(obj.deleted_at!).toLocaleDateString("pt-BR")}
                    </p>
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="sm" onClick={() => restoreObjective(obj.id)} className="text-primary">
                      <RotateCcw className="w-4 h-4 mr-1" /> Restaurar
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => permanentDeleteObj(obj.id)} className="text-destructive">
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
          </div>
        )}

        {/* Deleted standalone KRs (whose objective is NOT deleted) */}
        {showDeleted && deletedKRs.filter((kr) => !deletedObjs.some((o) => o.id === kr.objective_id)).length > 0 && (
          <div className="space-y-3">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
              🗑️ Key Results excluídos
            </h2>
            {deletedKRs
              .filter((kr) => !deletedObjs.some((o) => o.id === kr.objective_id))
              .map((kr) => (
                <div key={kr.id} className="glass-card border border-destructive/20 p-4 flex items-center justify-between">
                  <div>
                    <p className="font-medium text-foreground text-sm">{kr.title}</p>
                    <p className="text-xs text-muted-foreground">
                      Excluído em {new Date(kr.deleted_at!).toLocaleDateString("pt-BR")}
                    </p>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => restoreKR(kr.id)} className="text-primary">
                    <RotateCcw className="w-4 h-4 mr-1" /> Restaurar
                  </Button>
                </div>
              ))}
          </div>
        )}

        {/* ===== COMPLETED SECTION ===== */}
        {(showCompleted || showRanking) && completedObjs.length > 0 && (
          <div className="space-y-5">
            {/* Speed Ranking - People */}
            {showRanking && personRanking.length > 0 && (
              <div className="glass-card border border-primary/20 p-5 space-y-4">
                <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider flex items-center gap-2">
                  <Trophy className="w-4 h-4 text-yellow-500" /> Ranking de Velocidade
                </h2>
                <div className="space-y-2">
                  {personRanking.map((person, i) => (
                    <Popover key={person.userId}>
                      <PopoverTrigger asChild>
                        <div className="flex items-center gap-3 py-2 cursor-pointer hover:bg-muted/30 rounded-lg px-2 -mx-2 transition-colors">
                          <span className="text-lg w-7 text-center shrink-0">
                            {i < 3 ? medalEmojis[i] : <span className="text-xs text-muted-foreground font-mono">{i + 1}º</span>}
                          </span>
                          {person.avatarUrl ? (
                            <img src={person.avatarUrl} alt={person.name} className="w-8 h-8 rounded-full object-cover shrink-0" />
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold text-primary shrink-0">
                              {person.name.charAt(0).toUpperCase()}
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-foreground truncate">{person.name}</p>
                            <p className="text-[10px] text-muted-foreground">
                              {person.krCount} KR{person.krCount > 1 ? "s" : ""} concluído{person.krCount > 1 ? "s" : ""}
                            </p>
                          </div>
                          <div className="flex items-center gap-1 text-primary">
                            <Zap className="w-3.5 h-3.5" />
                            <span className="text-sm font-bold">{person.avgDays}d</span>
                            <span className="text-[10px] text-muted-foreground">média</span>
                          </div>
                        </div>
                      </PopoverTrigger>
                      <PopoverContent className="w-80 max-h-64 overflow-y-auto p-4" side="bottom" align="start">
                        <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4 text-primary" />
                          KRs de {person.name.split(" ")[0]}
                        </h3>
                        <ul className="space-y-2">
                          {person.krs.map((kr, idx) => (
                            <li key={idx} className="text-xs border-b border-border/30 pb-2 last:border-0">
                              <p className="text-foreground font-medium">{kr.title}</p>
                              <div className="flex items-center justify-between mt-0.5">
                                <span className="text-muted-foreground truncate max-w-[60%]">{kr.objTitle}</span>
                                <span className="flex items-center gap-1 text-primary font-semibold whitespace-nowrap">
                                  <Zap className="w-3 h-3" /> {kr.days}d
                                </span>
                              </div>
                            </li>
                          ))}
                        </ul>
                      </PopoverContent>
                    </Popover>
                  ))}
                </div>
              </div>
            )}

            {/* Completed objectives ranked by speed */}
            {showCompleted && (
              <>
                <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                  <Timer className="w-4 h-4" /> Objetivos concluídos — mais rápidos primeiro
                </h2>
                {completedObjs.map(({ obj, krs, deptName, deptIcon, daysToComplete }, index) => (
                  <div key={obj.id} className="glass-card border border-primary/20 p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-sm">{deptIcon}</span>
                        <span className="text-xs text-muted-foreground">{deptName}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        {index < 3 && <span className="text-sm">{medalEmojis[index]}</span>}
                        <span className={cn(
                          "text-xs font-bold px-2 py-0.5 rounded-full flex items-center gap-1",
                          index === 0 ? "bg-yellow-500/15 text-yellow-500" :
                          index === 1 ? "bg-slate-300/15 text-slate-300" :
                          index === 2 ? "bg-amber-600/15 text-amber-600" :
                          "bg-muted/50 text-muted-foreground"
                        )}>
                          <Zap className="w-3 h-3" />
                          {daysToComplete}d
                        </span>
                      </div>
                    </div>
                    <p className="font-medium text-foreground text-sm flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />
                      {obj.title}
                    </p>
                    <ul className="mt-2 space-y-1 pl-6">
                      {krs.map((kr) => (
                        <li key={kr.id} className="text-xs text-muted-foreground line-through flex items-center justify-between">
                          <span>{kr.title}</span>
                          {kr.assigned_to && (
                            <span className="text-[10px] text-muted-foreground/60 ml-2 shrink-0">
                              {getProfileName(kr.assigned_to)}
                            </span>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
