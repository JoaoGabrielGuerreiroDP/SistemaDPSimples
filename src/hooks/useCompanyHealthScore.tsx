import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useTeamMoodAggregate } from "./useTeamMood";

export interface HealthScoreBreakdown {
  goalVsActual: number;
  pipelineHealth: number;
  churn: number;
  teamActive: number;
  mood: number;
  total: number;
  loading: boolean;
  details: {
    salesMonth: number;
    goalMonth: number;
    activeProspections: number;
    cancellationsRecent: number;
    bettorsLast7d: number;
    moodScore: number;
  };
}

export function useCompanyHealthScore(): HealthScoreBreakdown {
  const { score: moodScore, loading: moodLoading } = useTeamMoodAggregate(7);
  const [data, setData] = useState<HealthScoreBreakdown>({
    goalVsActual: 0, pipelineHealth: 0, churn: 0, teamActive: 0, mood: 0, total: 0, loading: true,
    details: { salesMonth: 0, goalMonth: 0, activeProspections: 0, cancellationsRecent: 0, bettorsLast7d: 0, moodScore: 50 },
  });

  useEffect(() => {
    if (moodLoading) return;
    (async () => {
      const now = new Date();
      const mesRef = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
      const startMonth = `${mesRef}-01`;
      const since30 = new Date(); since30.setDate(since30.getDate() - 30);
      const since7 = new Date(); since7.setDate(since7.getDate() - 7);
      const since30Str = since30.toISOString().split("T")[0];
      const since7Str = since7.toISOString().split("T")[0];

      const [prospRes, goalRes, cancRes, betsRes] = await Promise.all([
        supabase.from("crm_prospections").select("amount, stage").gte("created_at_crm", startMonth),
        supabase.from("sales_goals").select("meta").eq("mes_ref", mesRef).maybeSingle(),
        supabase.from("crm_canceladas").select("id").gte("created_at", since30Str),
        supabase.from("daily_bets").select("user_id, status").gte("bet_date", since7Str),
      ]);

      const prospections = prospRes.data || [];
      const closedWon = prospections.filter((p) => (p.stage || "").toLowerCase().includes("closedwon"));
      const activeProspections = prospections.filter((p) => {
        const s = (p.stage || "").toLowerCase();
        return !s.includes("closedwon") && !s.includes("closedlost");
      }).length;

      const salesMonth = closedWon.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
      const goalMonth = Number(goalRes.data?.meta) || 0;

      // 1. Meta vs realizado (30 pts) — 100% atingida = 30
      const goalVsActual = goalMonth > 0
        ? Math.min(30, (salesMonth / goalMonth) * 30)
        : 15;

      // 2. Pipeline saudável (20 pts) — referência: 50 prospecções ativas = 20
      const pipelineHealth = Math.min(20, (activeProspections / 50) * 20);

      // 3. Churn (20 pts) — invertido: 0 cancelamentos = 20, 20+ = 0
      const cancellationsRecent = (cancRes.data || []).length;
      const churn = Math.max(0, 20 - cancellationsRecent);

      // 4. Equipe ativa (15 pts) — % vendedores que apostaram nos últimos 7d
      const uniqueBettors = new Set((betsRes.data || []).map((b) => b.user_id)).size;
      const bettorsLast7d = uniqueBettors;
      const teamActive = Math.min(15, uniqueBettors * 1.5); // 10 vendedores ativos = 15

      // 5. Humor (15 pts)
      const mood = (moodScore / 100) * 15;

      const total = Math.round(goalVsActual + pipelineHealth + churn + teamActive + mood);

      setData({
        goalVsActual: Math.round(goalVsActual),
        pipelineHealth: Math.round(pipelineHealth),
        churn: Math.round(churn),
        teamActive: Math.round(teamActive),
        mood: Math.round(mood),
        total,
        loading: false,
        details: { salesMonth, goalMonth, activeProspections, cancellationsRecent, bettorsLast7d, moodScore },
      });
    })();
  }, [moodScore, moodLoading]);

  return data;
}