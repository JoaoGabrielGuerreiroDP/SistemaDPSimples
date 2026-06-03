import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Target, CheckCircle2, Clock, PlayCircle } from "lucide-react";

interface OKRStats {
  totalDepartments: number;
  totalObjectives: number;
  totalKRs: number;
  done: number;
  inProgress: number;
  pending: number;
}

export function OKRSummaryWidget() {
  const { user } = useAuth();
  const [stats, setStats] = useState<OKRStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    async function load() {
      const [deptRes, objRes, krRes] = await Promise.all([
        supabase.from("departments").select("id").is("user_id", null),
        supabase.from("objectives").select("id, department_id"),
        supabase.from("key_results").select("id, status, objective_id"),
      ]);

      const deptIds = new Set((deptRes.data || []).map((d) => d.id));
      const objectives = (objRes.data || []).filter((o) => deptIds.has(o.department_id));
      const objIds = new Set(objectives.map((o) => o.id));
      const krs = (krRes.data || []).filter((kr) => objIds.has(kr.objective_id));

      setStats({
        totalDepartments: deptIds.size,
        totalObjectives: objectives.length,
        totalKRs: krs.length,
        done: krs.filter((kr) => kr.status === "done").length,
        inProgress: krs.filter((kr) => kr.status === "in_progress").length,
        pending: krs.filter((kr) => kr.status === "pending").length,
      });
      setLoading(false);
    }

    load();
  }, [user]);

  if (loading || !stats) {
    return (
      <div className="glass-card p-5 space-y-3 animate-pulse">
        <div className="h-5 bg-muted/30 rounded w-40" />
        <div className="h-16 bg-muted/30 rounded" />
      </div>
    );
  }

  const total = stats.totalKRs || 1;
  const donePercent = Math.round((stats.done / total) * 100);
  const inProgressPercent = Math.round((stats.inProgress / total) * 100);
  const pendingPercent = 100 - donePercent - inProgressPercent;

  return (
    <div className="glass-card p-5 space-y-4">
      <div className="flex items-center gap-2">
        <Target className="w-5 h-5 text-primary" />
        <h2 className="font-display text-lg font-semibold text-foreground">OKRs da Empresa</h2>
      </div>

      {/* Progress bar */}
      <div className="space-y-2">
        <div className="flex h-3 rounded-full overflow-hidden bg-muted/30">
          {donePercent > 0 && (
            <div
              className="bg-primary transition-all"
              style={{ width: `${donePercent}%` }}
            />
          )}
          {inProgressPercent > 0 && (
            <div
              className="bg-dept-solucoes transition-all"
              style={{ width: `${inProgressPercent}%` }}
            />
          )}
          {pendingPercent > 0 && (
            <div
              className="bg-muted/50 transition-all"
              style={{ width: `${pendingPercent}%` }}
            />
          )}
        </div>
        <div className="text-xs text-muted-foreground text-right">
          {donePercent}% concluído
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-primary" />
          <div>
            <div className="font-display text-lg font-bold text-primary">{stats.done}</div>
            <div className="text-xs text-muted-foreground">Concluídos</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <PlayCircle className="w-4 h-4 text-dept-solucoes" />
          <div>
            <div className="font-display text-lg font-bold text-dept-solucoes">{stats.inProgress}</div>
            <div className="text-xs text-muted-foreground">Em andamento</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-muted-foreground" />
          <div>
            <div className="font-display text-lg font-bold text-muted-foreground">{stats.pending}</div>
            <div className="text-xs text-muted-foreground">Pendentes</div>
          </div>
        </div>
      </div>

      <div className="text-xs text-muted-foreground">
        {stats.totalDepartments} áreas · {stats.totalObjectives} objetivos · {stats.totalKRs} key results
      </div>
    </div>
  );
}
