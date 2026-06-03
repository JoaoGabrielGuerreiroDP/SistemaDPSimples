import { useState, useMemo, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useSearchParams } from "react-router-dom";
import { normalizeName, isLeadership } from "@/lib/seller-names";
import { useUserRole } from "@/hooks/useUserRole";
import { useGoogleSheetsData, type SaleRow } from "@/hooks/useGoogleSheetsData";
import { useOKRData } from "@/hooks/useOKRData";
import { useQuery } from "@tanstack/react-query";
import { DepartmentCard } from "@/components/DepartmentCard";
import { StatsHeader } from "@/components/StatsHeader";
import { DailyBetCard } from "@/components/seller/DailyBetCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  ArrowLeft, ChevronLeft, ChevronRight, TrendingUp, ShoppingCart,
  CreditCard, Target, Loader2, Plus, BarChart3, Users2, Clock, CheckCircle2, XCircle,
  Trophy, Calendar
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, PieChart, Pie, Cell,
} from "recharts";

function formatBRL(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

const MONTH_NAMES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

const MONTH_NAMES_SHORT = [
  "Jan", "Fev", "Mar", "Abr", "Mai", "Jun",
  "Jul", "Ago", "Set", "Out", "Nov", "Dez",
];

const STAGE_LABELS: Record<string, string> = {
  open: "Aberto",
  appointmentscheduled: "Agendado",
  qualifiedtobuy: "Qualificado",
  presentationscheduled: "Apresentação",
  decisionmakerboughtin: "Decisor",
  contractsent: "Proposta Enviada",
  closedwon: "Ganho",
  closedlost: "Perdido",
};

const STAGE_COLORS: Record<string, string> = {
  open: "hsl(217, 85%, 55%)",
  appointmentscheduled: "hsl(270, 60%, 58%)",
  qualifiedtobuy: "hsl(30, 90%, 55%)",
  presentationscheduled: "hsl(200, 70%, 50%)",
  decisionmakerboughtin: "hsl(340, 70%, 55%)",
  contractsent: "hsl(45, 85%, 50%)",
  closedwon: "hsl(150, 60%, 45%)",
  closedlost: "hsl(0, 60%, 50%)",
};

function CRMPerformanceTab({ userName, selectedYear, selectedMonth }: { userName: string; selectedYear: number; selectedMonth: number }) {
  const canonical = normalizeName(userName);

  // Build all name variations for this seller from the aliases map
  const searchTerms = useMemo(() => {
    const terms = new Set<string>();
    terms.add(canonical.toLowerCase());
    terms.add(userName.toLowerCase());
    // Also add common CRM variations
    const parts = canonical.split(" ");
    if (parts.length > 0) terms.add(parts[0].toLowerCase());
    return Array.from(terms);
  }, [canonical, userName]);

  // Date range for selected month
  const monthStart = `${selectedYear}-${String(selectedMonth + 1).padStart(2, "0")}-01`;
  const nextMonth = selectedMonth === 11 ? `${selectedYear + 1}-01-01` : `${selectedYear}-${String(selectedMonth + 2).padStart(2, "0")}-01`;

  const { data: crmRows, isLoading } = useQuery({
    queryKey: ["crm-seller", canonical, selectedYear, selectedMonth],
    queryFn: async () => {
      const allResults: any[] = [];
      const seen = new Set<string>();

      for (const term of searchTerms) {
        const { data } = await supabase
          .from("crm_prospections")
          .select("*")
          .ilike("seller_name", `%${term}%`)
          .gte("created_at_crm", monthStart)
          .lt("created_at_crm", nextMonth);
        if (data) {
          for (const row of data) {
            if (!seen.has(row.id)) {
              seen.add(row.id);
              allResults.push(row);
            }
          }
        }
      }

      // Also try without date filter on created_at_crm (some rows may have null)
      // but filter by synced_at as fallback
      const { data: fallback } = await supabase
        .from("crm_prospections")
        .select("*")
        .ilike("seller_name", `%${searchTerms[0]}%`)
        .is("created_at_crm", null);
      if (fallback) {
        for (const row of fallback) {
          if (!seen.has(row.id)) {
            seen.add(row.id);
            allResults.push(row);
          }
        }
      }

      return allResults;
    },
    staleTime: 2 * 60 * 1000,
  });

  // Also fetch ALL TIME data for the "total" overview
  const { data: crmAllTime } = useQuery({
    queryKey: ["crm-seller-alltime", canonical],
    queryFn: async () => {
      const { data } = await supabase
        .from("crm_prospections")
        .select("*")
        .ilike("seller_name", `%${searchTerms[0]}%`);
      return data || [];
    },
    staleTime: 5 * 60 * 1000,
  });

  const stats = useMemo(() => {
    if (!crmRows) return null;

    const byStage: Record<string, { count: number; total: number }> = {};
    crmRows.forEach((r: any) => {
      const stage = r.stage || "open";
      if (!byStage[stage]) byStage[stage] = { count: 0, total: 0 };
      byStage[stage].count++;
      byStage[stage].total += Number(r.amount) || 0;
    });

    const totalLeads = crmRows.length;
    const won = byStage["closedwon"] || { count: 0, total: 0 };
    const lost = byStage["closedlost"] || { count: 0, total: 0 };
    const open = totalLeads - won.count - lost.count;
    const conversionRate = totalLeads > 0 ? ((won.count / totalLeads) * 100) : 0;

    // All-time stats
    const allTimeWon = (crmAllTime || []).filter((r: any) => r.stage === "closedwon");
    const allTimeTotal = allTimeWon.reduce((s: number, r: any) => s + (Number(r.amount) || 0), 0);

    const funnelData = Object.entries(byStage)
      .filter(([stage]) => stage !== "closedlost")
      .map(([stage, data]) => ({
        name: STAGE_LABELS[stage] || stage,
        value: data.count,
        total: data.total,
        fill: STAGE_COLORS[stage] || "hsl(215, 12%, 50%)",
      }))
      .sort((a, b) => b.value - a.value);

    const pieData = [
      { name: "Ganhos", value: won.count, fill: "hsl(150, 60%, 45%)" },
      { name: "Perdidos", value: lost.count, fill: "hsl(0, 60%, 50%)" },
      { name: "Em aberto", value: open, fill: "hsl(217, 85%, 55%)" },
    ].filter((d) => d.value > 0);

    return { byStage, totalLeads, won, lost, open, conversionRate, funnelData, pieData, allTimeWon: allTimeWon.length, allTimeTotal };
  }, [crmRows, crmAllTime]);

  const monthLabel = `${MONTH_NAMES[selectedMonth]} ${selectedYear}`;

  return (
    <TabsContent value="desempenho" className="space-y-6">
      {isLoading ? (
        <div className="flex items-center justify-center py-12 text-muted-foreground gap-2">
          <Loader2 className="w-5 h-5 animate-spin" /> Carregando CRM...
        </div>
      ) : !stats || stats.totalLeads === 0 ? (
        <div className="glass-card p-6 text-center text-muted-foreground">
          Nenhum dado de CRM encontrado para {canonical} em {monthLabel}.
          {stats && stats.allTimeWon > 0 && (
            <p className="mt-2 text-sm">
              Total geral: {stats.allTimeWon} ganhos ({formatBRL(stats.allTimeTotal)})
            </p>
          )}
        </div>
      ) : (
        <>
          <p className="text-xs text-muted-foreground text-center">CRM — {monthLabel}</p>

          {/* KPI cards */}
          <div className="grid grid-cols-2 gap-3">
            <div className="glass-card p-4 space-y-1 border-l-4 border-l-[hsl(217,85%,55%)]">
              <div className="flex items-center gap-2">
                <Users2 className="w-4 h-4 text-[hsl(217,85%,55%)]" />
                <span className="text-xs text-muted-foreground">Leads no mês</span>
              </div>
              <div className="font-display text-xl font-bold text-foreground">{stats.totalLeads}</div>
            </div>
            <div className="glass-card p-4 space-y-1 border-l-4 border-l-[hsl(150,60%,45%)]">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-[hsl(150,60%,45%)]" />
                <span className="text-xs text-muted-foreground">Ganhos</span>
              </div>
              <div className="font-display text-xl font-bold text-emerald-500">
                {stats.won.count}
                <span className="text-sm font-normal text-muted-foreground ml-1">
                  ({formatBRL(stats.won.total)})
                </span>
              </div>
            </div>
            <div className="glass-card p-4 space-y-1 border-l-4 border-l-[hsl(0,60%,50%)]">
              <div className="flex items-center gap-2">
                <XCircle className="w-4 h-4 text-[hsl(0,60%,50%)]" />
                <span className="text-xs text-muted-foreground">Perdidos</span>
              </div>
              <div className="font-display text-xl font-bold text-foreground">{stats.lost.count}</div>
            </div>
            <div className="glass-card p-4 space-y-1 border-l-4 border-l-primary">
              <div className="flex items-center gap-2">
                <Target className="w-4 h-4 text-primary" />
                <span className="text-xs text-muted-foreground">Conversão</span>
              </div>
              <div className="font-display text-xl font-bold text-primary">
                {stats.conversionRate.toFixed(1)}%
              </div>
            </div>
          </div>

          {/* Pie chart */}
          {stats.pieData.length > 0 && (
            <div className="glass-card p-5 space-y-4">
              <h2 className="font-display text-lg font-semibold text-foreground">Distribuição de Leads</h2>
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie
                    data={stats.pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={3}
                    dataKey="value"
                    label={({ name, value }) => `${name}: ${value}`}
                    labelLine={false}
                  >
                    {stats.pieData.map((entry, i) => (
                      <Cell key={i} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(220, 18%, 10%)",
                      border: "1px solid hsl(220, 14%, 16%)",
                      borderRadius: "8px",
                      color: "hsl(210, 20%, 92%)",
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Funnel breakdown */}
          <div className="glass-card p-5 space-y-4">
            <h2 className="font-display text-lg font-semibold text-foreground">Funil por Etapa</h2>
            <ResponsiveContainer width="100%" height={Math.max(200, stats.funnelData.length * 40)}>
              <BarChart data={stats.funnelData} layout="vertical" barSize={20}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 14%, 16%)" horizontal={false} />
                <XAxis type="number" tick={{ fill: "hsl(215, 12%, 50%)", fontSize: 11 }} />
                <YAxis
                  dataKey="name"
                  type="category"
                  width={110}
                  tick={{ fill: "hsl(215, 12%, 50%)", fontSize: 11 }}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(220, 18%, 10%)",
                    border: "1px solid hsl(220, 14%, 16%)",
                    borderRadius: "8px",
                    color: "hsl(210, 20%, 92%)",
                  }}
                  formatter={(value: number) => [`${value} leads`, "Quantidade"]}
                />
                <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                  {stats.funnelData.map((entry, i) => (
                    <Cell key={i} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Recent pipeline list */}
          <div className="glass-card p-5 space-y-3">
            <h2 className="font-display text-lg font-semibold text-foreground">Pipeline Ativo</h2>
            <div className="space-y-2 max-h-[300px] overflow-y-auto">
              {(crmRows || [])
                .filter((r: any) => r.stage !== "closedlost" && r.stage !== "closedwon")
                .sort((a: any, b: any) => (Number(b.amount) || 0) - (Number(a.amount) || 0))
                .slice(0, 20)
                .map((r: any) => (
                  <div key={r.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/30 text-sm">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-foreground truncate">{r.lead_name || "—"}</p>
                      <p className="text-xs text-muted-foreground">
                        {STAGE_LABELS[r.stage] || r.stage}
                      </p>
                    </div>
                    <span className="font-display font-semibold text-primary shrink-0 ml-3">
                      {formatBRL(Number(r.amount) || 0)}
                    </span>
                  </div>
                ))}
            </div>
          </div>
        </>
      )}
    </TabsContent>
  );
}

export default function VendedorDashboard() {
  const now = new Date();
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth());
  const isCurrentMonth = selectedYear === now.getFullYear() && selectedMonth === now.getMonth();

  const { user } = useAuth();
  const { role, loading: roleLoading } = useUserRole();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const sheetsData = useGoogleSheetsData();

  // OKR data - personal + company (filtered for assigned KRs)
  const { departments: companyDepts, loading: companyLoading, toggleStatus: companyToggle } = useOKRData("company");
  const { departments: personalDepts, loading: personalLoading, toggleStatus: personalToggle, reload: reloadPersonal } = useOKRData("personal");

  // Filter company OKRs to only show KRs assigned to this user
  const myCompanyDepts = useMemo(() => {
    if (!user) return [];
    return companyDepts.map((dept) => ({
      ...dept,
      objectives: dept.objectives.map((obj) => ({
        ...obj,
        keyResults: obj.keyResults.filter((kr) => kr.assigned_to === user.id),
      })).filter((obj) => obj.keyResults.length > 0),
    })).filter((dept) => dept.objectives.length > 0);
  }, [companyDepts, user]);

  // Inline KR creation state
  const [newKrTitle, setNewKrTitle] = useState("");
  const [creatingKr, setCreatingKr] = useState(false);

  const handleCreateKr = useCallback(async () => {
    if (!user || !newKrTitle.trim()) return;
    setCreatingKr(true);
    try {
      // Ensure user has a personal department
      let deptId: string;
      if (personalDepts.length > 0) {
        deptId = personalDepts[0].id;
      } else {
        // Create personal department
        deptId = `personal-${user.id}`;
        const { error: deptErr } = await supabase.from("departments").insert({
          id: deptId,
          name: "Meus Objetivos",
          icon: "🎯",
          user_id: user.id,
          sort_order: 0,
        });
        if (deptErr && !deptErr.message.includes("duplicate")) throw deptErr;
      }

      // Ensure there's an objective
      let objId: string;
      if (personalDepts[0]?.objectives?.length > 0) {
        objId = personalDepts[0].objectives[0].id;
      } else {
        objId = `obj-${Date.now()}`;
        const { error: objErr } = await supabase.from("objectives").insert({
          id: objId,
          department_id: deptId,
          title: "Tarefas Pessoais",
          sort_order: 0,
        });
        if (objErr) throw objErr;
      }

      // Create the KR
      const krId = `kr-${Date.now()}`;
      const { error: krErr } = await supabase.from("key_results").insert({
        id: krId,
        objective_id: objId,
        title: newKrTitle.trim(),
        status: "pending",
        priority: "medium",
        assigned_to: user.id,
        sort_order: 0,
      });
      if (krErr) throw krErr;

      setNewKrTitle("");
      toast.success("KR criado!");
      reloadPersonal();
    } catch (err: any) {
      toast.error("Erro ao criar KR", { description: err.message });
    } finally {
      setCreatingKr(false);
    }
  }, [user, newKrTitle, personalDepts, reloadPersonal]);

  const queryName = searchParams.get("name");
  const loggedName = user?.user_metadata?.display_name || user?.email || "";
  const userName = queryName || loggedName;
  const isViewingOther = !!queryName && normalizeName(queryName) !== normalizeName(loggedName);

  const allMonthRows = useMemo(
    () => sheetsData.getMonthRows(selectedYear, selectedMonth),
    [sheetsData, selectedYear, selectedMonth]
  );

  // Filter rows for this vendedor using normalizeName for accurate matching
  const normalizedTarget = normalizeName(userName);
  const myRows = useMemo(
    () => allMonthRows.filter((r) => r.corretor && normalizeName(r.corretor) === normalizedTarget),
    [allMonthRows, normalizedTarget]
  );

  const monthLabel = `${MONTH_NAMES[selectedMonth]} ${selectedYear}`;

  // Fetch individual goal from sales_goals_byname
  const mesRef = `${selectedYear}-${String(selectedMonth + 1).padStart(2, "0")}`;
  const { data: goalData } = useQuery({
    queryKey: ["sales-goal-byname", normalizedTarget, mesRef],
    queryFn: async () => {
      const { data } = await supabase
        .from("sales_goals_byname")
        .select("meta")
        .eq("mes_ref", mesRef)
        .ilike("broker_name", `%${normalizedTarget.split(" ")[0]}%`);
      return data?.[0]?.meta ?? null;
    },
    staleTime: 5 * 60 * 1000,
  });

  // KPIs
  const myTotal = useMemo(() => myRows.reduce((s, r) => s + r.valor, 0), [myRows]);
  const myCount = myRows.length;
  const myTicket = myCount > 0 ? myTotal / myCount : 0;
  const myGoal = goalData ? Number(goalData) : 0;
  const goalPercent = myGoal > 0 ? Math.min((myTotal / myGoal) * 100, 150) : 0;

  // General KPIs (all sales)
  const allTotal = useMemo(() => allMonthRows.reduce((s, r) => s + r.valor, 0), [allMonthRows]);
  const allCount = allMonthRows.length;

  // My rank + full ranking for comparison
  const { myRank, fullRanking } = useMemo(() => {
    const map: Record<string, number> = {};
    allMonthRows.forEach((r) => {
      if (!r.corretor) return;
      const n = normalizeName(r.corretor);
      if (isLeadership(n)) return;
      map[n] = (map[n] || 0) + r.valor;
    });
    const sorted = Object.entries(map).sort((a, b) => b[1] - a[1]);
    const idx = sorted.findIndex(([name]) => name === normalizedTarget);
    return {
      myRank: idx >= 0 ? idx + 1 : null,
      fullRanking: sorted.map(([name, total], i) => ({ rank: i + 1, name, total, isMe: name === normalizedTarget })),
    };
  }, [allMonthRows, normalizedTarget]);

  // Activity heatmap: count sales per day in the selected month
  const activityHeatmap = useMemo(() => {
    const daysInMonth = new Date(selectedYear, selectedMonth + 1, 0).getDate();
    const dayMap: Record<number, number> = {};
    for (let d = 1; d <= daysInMonth; d++) dayMap[d] = 0;
    myRows.forEach((r) => {
      if (!r.dataVenda) return;
      const parts = r.dataVenda.split("/");
      if (parts.length >= 1) {
        const day = parseInt(parts[0], 10);
        if (day >= 1 && day <= daysInMonth) dayMap[day]++;
      }
    });
    const maxCount = Math.max(...Object.values(dayMap), 1);
    return { daysInMonth, dayMap, maxCount };
  }, [myRows, selectedYear, selectedMonth]);

  // 6-month personal evolution
  const monthlyEvolution = useMemo(() => {
    const months: { label: string; total: number; count: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      let y = selectedYear;
      let m = selectedMonth - i;
      while (m < 0) { m += 12; y -= 1; }
      const mRows = sheetsData.getMonthRows(y, m).filter(
        (r) => r.corretor && normalizeName(r.corretor) === normalizedTarget
      );
      months.push({
        label: `${MONTH_NAMES_SHORT[m]}/${y.toString().slice(2)}`,
        total: mRows.reduce((s, r) => s + r.valor, 0),
        count: mRows.length,
      });
    }
    return months;
  }, [sheetsData, selectedYear, selectedMonth, userName]);

  // Month navigation
  const goToPrevMonth = () => {
    if (selectedMonth === 0) { setSelectedMonth(11); setSelectedYear((y) => y - 1); }
    else setSelectedMonth((m) => m - 1);
  };
  const goToNextMonth = () => {
    if (isCurrentMonth) return;
    if (selectedMonth === 11) { setSelectedMonth(0); setSelectedYear((y) => y + 1); }
    else setSelectedMonth((m) => m + 1);
  };

  if (roleLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center text-muted-foreground">
        <Loader2 className="w-5 h-5 animate-spin mr-2" /> Carregando...
      </div>
    );
  }

  // Allow access: any authenticated user can view their own panel,
  // and admin/gestor can view any seller via ?name= param
  if (!role && !queryName) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <p className="text-destructive font-medium">Acesso restrito. Solicite um papel ao administrador.</p>
          <Button variant="outline" onClick={() => navigate("/")}>Voltar</Button>
        </div>
      </div>
    );
  }

  // My share of total sales
  const sharePercent = allTotal > 0 ? ((myTotal / allTotal) * 100).toFixed(1) : "0";

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
        {/* Breadcrumbs + Header */}
        {isViewingOther && (
          <nav className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <button onClick={() => navigate("/war-room")} className="hover:text-foreground transition-colors">War Room</button>
            <span>/</span>
            <span className="text-foreground font-medium truncate">{userName}</span>
          </nav>
        )}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div>
              <h1 className="font-display text-2xl font-bold text-foreground">
                {isViewingOther ? userName : "Meu Painel"}
              </h1>
              <p className="text-sm text-muted-foreground">
                {isViewingOther ? "Painel do vendedor" : `Olá, ${userName}`}
              </p>
            </div>
          </div>
        </div>

        {/* Month Selector */}
        <div className="glass-card p-4 flex items-center justify-between">
          <Button variant="ghost" size="icon" onClick={goToPrevMonth}>
            <ChevronLeft className="w-5 h-5" />
          </Button>
          <div className="flex items-center gap-3">
            <span className="font-display text-lg font-semibold text-foreground">
              {monthLabel}
            </span>
            {!isCurrentMonth && (
              <Button variant="outline" size="sm" onClick={() => { setSelectedMonth(now.getMonth()); setSelectedYear(now.getFullYear()); }} className="text-xs">
                Ir para Mês Atual
              </Button>
            )}
          </div>
          <Button variant="ghost" size="icon" onClick={goToNextMonth} disabled={isCurrentMonth}>
            <ChevronRight className="w-5 h-5" />
          </Button>
        </div>

        {/* Aposta diária + Forecast de comissão (apenas no próprio painel, mês atual) */}
        {!isViewingOther && isCurrentMonth && (
          <div className="grid grid-cols-1 gap-4">
            <DailyBetCard brokerName={normalizeName(loggedName)} />
          </div>
        )}

        <Tabs defaultValue="vendas" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="vendas">Vendas</TabsTrigger>
            <TabsTrigger value="desempenho">Desempenho</TabsTrigger>
            <TabsTrigger value="okrs">OKRs</TabsTrigger>
          </TabsList>

          <TabsContent value="vendas" className="space-y-6">
            {sheetsData.loading ? (
              <div className="flex items-center justify-center py-12 text-muted-foreground gap-2">
                <Loader2 className="w-5 h-5 animate-spin" /> Carregando...
              </div>
            ) : (
              <>
                {/* Personal KPIs */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="glass-card p-4 space-y-1 border-l-4 border-l-primary">
                    <div className="flex items-center gap-2">
                      <TrendingUp className="w-4 h-4 text-primary" />
                      <span className="text-xs text-muted-foreground">Meu Total</span>
                    </div>
                    <div className="font-display text-xl sm:text-2xl font-bold text-primary">
                      {formatBRL(myTotal)}
                    </div>
                  </div>
                  <div className="glass-card p-4 space-y-1 border-l-4 border-l-[hsl(217,85%,55%)]">
                    <div className="flex items-center gap-2">
                      <ShoppingCart className="w-4 h-4 text-[hsl(217,85%,55%)]" />
                      <span className="text-xs text-muted-foreground">Propostas</span>
                    </div>
                    <div className="font-display text-xl sm:text-2xl font-bold text-foreground">
                      {myCount}
                    </div>
                  </div>
                  <div className="glass-card p-4 space-y-1 border-l-4 border-l-[hsl(30,90%,55%)]">
                    <div className="flex items-center gap-2">
                      <CreditCard className="w-4 h-4 text-[hsl(30,90%,55%)]" />
                      <span className="text-xs text-muted-foreground">Ticket Médio</span>
                    </div>
                    <div className="font-display text-xl sm:text-2xl font-bold text-foreground">
                      {formatBRL(myTicket)}
                    </div>
                  </div>
                  <div className="glass-card p-4 space-y-1 border-l-4 border-l-[hsl(270,60%,58%)]">
                    <div className="flex items-center gap-2">
                      <Target className="w-4 h-4 text-[hsl(270,60%,58%)]" />
                      <span className="text-xs text-muted-foreground">Ranking / Participação</span>
                    </div>
                    <div className="font-display text-xl sm:text-2xl font-bold text-foreground">
                      {myRank ? `#${myRank}` : "—"}
                      <span className="text-sm font-normal text-muted-foreground ml-1">({sharePercent}%)</span>
                    </div>
                  </div>
                </div>

                {/* Goal comparison */}
                {myGoal > 0 && (
                  <div className="glass-card p-5 space-y-3">
                    <div className="flex items-center justify-between">
                      <h2 className="font-display text-sm font-semibold text-foreground flex items-center gap-2">
                        <Target className="w-4 h-4 text-primary" /> Meta do Mês
                      </h2>
                      <span className="text-xs text-muted-foreground">
                        {formatBRL(myTotal)} / {formatBRL(myGoal)}
                      </span>
                    </div>
                    <div className="relative w-full h-4 rounded-full bg-muted/50 overflow-hidden">
                      <div
                        className="absolute inset-y-0 left-0 rounded-full transition-all duration-700"
                        style={{
                          width: `${Math.min(goalPercent, 100)}%`,
                          background: goalPercent >= 100
                            ? "linear-gradient(90deg, hsl(150, 60%, 45%), hsl(150, 70%, 55%))"
                            : goalPercent >= 70
                            ? "linear-gradient(90deg, hsl(45, 85%, 50%), hsl(30, 90%, 55%))"
                            : "linear-gradient(90deg, hsl(0, 60%, 50%), hsl(0, 70%, 55%))",
                        }}
                      />
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className={`font-bold ${goalPercent >= 100 ? "text-emerald-500" : goalPercent >= 70 ? "text-amber-500" : "text-destructive"}`}>
                        {goalPercent.toFixed(1)}%
                      </span>
                      <span className="text-muted-foreground">
                        {goalPercent >= 100 ? "🎉 Meta atingida!" : `Faltam ${formatBRL(myGoal - myTotal)}`}
                      </span>
                    </div>
                  </div>
                )}

                {/* Context: general numbers */}
                <div className="glass-card p-4 flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Vendas da empresa em {monthLabel}:</span>
                  <span className="font-display font-semibold text-foreground">
                    {formatBRL(allTotal)} <span className="text-xs text-muted-foreground">({allCount} propostas)</span>
                  </span>
                </div>

                {/* Personal 6-month evolution */}
                <div className="glass-card p-5 space-y-4">
                  <h2 className="font-display text-lg font-semibold text-foreground">Minha Evolução (6 meses)</h2>
                  {monthlyEvolution.some((m) => m.total > 0) ? (
                    <ResponsiveContainer width="100%" height={280}>
                      <BarChart data={monthlyEvolution} barGap={4}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 14%, 16%)" />
                        <XAxis dataKey="label" tick={{ fill: "hsl(215, 12%, 50%)", fontSize: 12 }} />
                        <YAxis
                          yAxisId="left"
                          tick={{ fill: "hsl(215, 12%, 50%)", fontSize: 11 }}
                          tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
                        />
                        <YAxis yAxisId="right" orientation="right" tick={{ fill: "hsl(215, 12%, 50%)", fontSize: 11 }} allowDecimals={false} />
                        <Tooltip
                          contentStyle={{ backgroundColor: "hsl(220, 18%, 10%)", border: "1px solid hsl(220, 14%, 16%)", borderRadius: "8px", color: "hsl(210, 20%, 92%)" }}
                          formatter={(value: number, name: string) =>
                            name === "total" ? [formatBRL(value), "Valor"] : [value, "Propostas"]
                          }
                        />
                        <Legend formatter={(value) => (value === "total" ? "Valor" : "Propostas")} />
                        <Bar yAxisId="left" dataKey="total" fill="hsl(150, 60%, 45%)" radius={[4, 4, 0, 0]} name="total" />
                        <Bar yAxisId="right" dataKey="count" fill="hsl(217, 85%, 55%)" radius={[4, 4, 0, 0]} name="count" />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-10">Sem dados para exibir</p>
                  )}
                </div>

                {/* My sales list */}
                {myRows.length > 0 && (
                  <div className="glass-card p-5 space-y-3">
                    <h2 className="font-display text-lg font-semibold text-foreground">Minhas Vendas — {monthLabel}</h2>
                    <div className="space-y-2">
                      {myRows.map((r, i) => (
                        <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-muted/30 text-sm">
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-foreground truncate">{r.cliente || "—"}</p>
                            <p className="text-xs text-muted-foreground">{r.administradora} • {r.dataVenda}</p>
                          </div>
                          <span className="font-display font-semibold text-primary shrink-0 ml-3">
                            {formatBRL(r.valor)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Ranking comparativo */}
                {fullRanking.length > 1 && (
                  <div className="glass-card p-5 space-y-3">
                    <h2 className="font-display text-lg font-semibold text-foreground flex items-center gap-2">
                      <Trophy className="w-4 h-4 text-amber-500" /> Ranking — {monthLabel}
                    </h2>
                    <div className="space-y-1.5 max-h-[320px] overflow-y-auto">
                      {fullRanking.slice(0, 15).map((r) => (
                        <div
                          key={r.name}
                          className={`flex items-center gap-3 p-2.5 rounded-lg text-sm transition-colors ${
                            r.isMe ? "bg-primary/10 border border-primary/30" : "bg-muted/20"
                          }`}
                        >
                          <span className={`w-7 text-center font-bold text-xs ${
                            r.rank === 1 ? "text-amber-500" : r.rank === 2 ? "text-slate-400" : r.rank === 3 ? "text-orange-600" : "text-muted-foreground"
                          }`}>
                            {r.rank <= 3 ? ["🥇", "🥈", "🥉"][r.rank - 1] : `#${r.rank}`}
                          </span>
                          <span className={`flex-1 truncate ${r.isMe ? "font-semibold text-foreground" : "text-foreground/80"}`}>
                            {r.name}{r.isMe ? " (eu)" : ""}
                          </span>
                          <span className="font-display font-semibold text-foreground shrink-0">
                            {formatBRL(r.total)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Calendário de atividades */}
                <div className="glass-card p-5 space-y-3">
                  <h2 className="font-display text-lg font-semibold text-foreground flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-primary" /> Atividade Diária — {monthLabel}
                  </h2>
                  <div className="grid grid-cols-7 gap-1.5">
                    {["D", "S", "T", "Q", "Q", "S", "S"].map((d, i) => (
                      <div key={i} className="text-[10px] text-muted-foreground text-center font-medium">{d}</div>
                    ))}
                    {Array.from({ length: new Date(selectedYear, selectedMonth, 1).getDay() }).map((_, i) => (
                      <div key={`empty-${i}`} />
                    ))}
                    {Array.from({ length: activityHeatmap.daysInMonth }).map((_, i) => {
                      const day = i + 1;
                      const count = activityHeatmap.dayMap[day] || 0;
                      const intensity = count > 0 ? Math.max(0.2, count / activityHeatmap.maxCount) : 0;
                      const isToday = selectedYear === now.getFullYear() && selectedMonth === now.getMonth() && day === now.getDate();
                      return (
                        <div
                          key={day}
                          className={`aspect-square rounded-md flex items-center justify-center text-[10px] font-medium ${
                            isToday ? "ring-1 ring-primary" : ""
                          }`}
                          style={{
                            backgroundColor: count > 0
                              ? `hsla(150, 60%, 45%, ${intensity})`
                              : "hsla(215, 12%, 50%, 0.08)",
                          }}
                          title={`${day}/${selectedMonth + 1}: ${count} venda(s)`}
                        >
                          <span className={count > 0 ? "text-foreground" : "text-muted-foreground/60"}>{day}</span>
                        </div>
                      );
                    })}
                  </div>
                  <div className="flex items-center justify-end gap-2 text-[10px] text-muted-foreground">
                    <span>Menos</span>
                    {[0, 0.2, 0.4, 0.7, 1].map((op, i) => (
                      <div
                        key={i}
                        className="w-3 h-3 rounded-sm"
                        style={{ backgroundColor: op === 0 ? "hsla(215, 12%, 50%, 0.08)" : `hsla(150, 60%, 45%, ${op})` }}
                      />
                    ))}
                    <span>Mais</span>
                  </div>
                </div>
              </>
            )}
          </TabsContent>

          <CRMPerformanceTab userName={userName} selectedYear={selectedYear} selectedMonth={selectedMonth} />

          <TabsContent value="okrs" className="space-y-6">
            {/* KRs assigned to me from company */}
            <div className="space-y-4">
              <h2 className="font-display text-lg font-semibold text-foreground">KRs Atribuídos a Mim</h2>
              {companyLoading ? (
                <div className="flex items-center justify-center py-8 text-muted-foreground">
                  <Loader2 className="w-5 h-5 animate-spin mr-2" /> Carregando...
                </div>
              ) : myCompanyDepts.length === 0 ? (
                <div className="glass-card p-6 text-center text-muted-foreground">Nenhum KR atribuído a você.</div>
              ) : (
                <>
                  <StatsHeader departments={myCompanyDepts} />
                  {myCompanyDepts.map((dept) => (
                    <DepartmentCard key={dept.id} department={dept} onToggleStatus={companyToggle} />
                  ))}
                </>
              )}
            </div>

            {/* Personal OKRs */}
            <div className="space-y-4">
              <h2 className="font-display text-lg font-semibold text-foreground">Meus OKRs Pessoais</h2>

              {/* Inline creation */}
              <div className="flex gap-2">
                <Input
                  value={newKrTitle}
                  onChange={(e) => setNewKrTitle(e.target.value)}
                  placeholder="Nova tarefa pessoal..."
                  className="flex-1"
                  onKeyDown={(e) => e.key === "Enter" && handleCreateKr()}
                />
                <Button
                  size="sm"
                  onClick={handleCreateKr}
                  disabled={creatingKr || !newKrTitle.trim()}
                >
                  {creatingKr ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                </Button>
              </div>

              {personalLoading ? (
                <div className="flex items-center justify-center py-8 text-muted-foreground">
                  <Loader2 className="w-5 h-5 animate-spin mr-2" /> Carregando...
                </div>
              ) : personalDepts.length === 0 ? (
                <div className="glass-card p-6 text-center text-muted-foreground">
                  Crie sua primeira tarefa acima.
                </div>
              ) : (
                <>
                  <StatsHeader departments={personalDepts} />
                  {personalDepts.map((dept) => (
                    <DepartmentCard key={dept.id} department={dept} onToggleStatus={personalToggle} />
                  ))}
                </>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
