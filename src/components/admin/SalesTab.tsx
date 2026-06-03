import { useMemo, useState, useEffect } from "react";
import { normalizeName } from "@/lib/seller-names";
import { ALL_BROKERS, isLeadership as isLeadershipCentral } from "@/lib/seller-names";
import { SaleRow } from "@/hooks/useGoogleSheetsData";
import { Button } from "@/components/ui/button";
import { TrendingUp, ShoppingCart, Users, Trophy, Loader2, CreditCard, Target, Pencil, Check, X, UserCheck } from "lucide-react";
import { AnnualEvolutionChart } from "./AnnualEvolutionChart";
import { SalesGaugeCard } from "./SalesGaugeCard";
import { SalesDetailTable } from "./SalesDetailTable";
import { DailySalesChart } from "./DailySalesChart";
import { DailyCumulativeChart } from "./DailyCumulativeChart";
import { SalesActivityFeed } from "./SalesActivityFeed";
import { SalesProjection } from "./SalesProjection";
import { SalesPodium } from "./SalesPodium";
import { WeeklyRanking } from "./WeeklyRanking";
import { SalesHistoricalRanking } from "./SalesHistoricalRanking";
import { SalesStreakCard } from "./SalesStreakCard";
import { SalesChannelChart } from "./SalesChannelChart";
import { SalesAISuggestions } from "./SalesAISuggestions";
import { SalesDailySummary } from "./SalesDailySummary";
import { SalesChurnAlert } from "./SalesChurnAlert";
import { SalesSeasonality } from "./SalesSeasonality";
import { SalesAICoach } from "./SalesAICoach";
import { useUserRole } from "@/hooks/useUserRole";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { toast } from "@/hooks/use-toast";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  Legend,
} from "recharts";

// Use centralized leadership check
const CHART_COLORS = [
  "hsl(150, 60%, 45%)",
  "hsl(217, 85%, 55%)",
  "hsl(270, 60%, 58%)",
  "hsl(30, 90%, 55%)",
  "hsl(180, 55%, 45%)",
  "hsl(0, 72%, 55%)",
  "hsl(45, 85%, 50%)",
  "hsl(320, 60%, 55%)",
];

function formatBRL(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

function ComparisonBadge({ current, previous, prevLabel, isCurrency = false }: { current: number; previous: number; prevLabel?: string; isCurrency?: boolean }) {
  if (previous === 0) return null;
  const pct = ((current - previous) / previous) * 100;
  const isUp = pct >= 0;
  const formattedPrev = isCurrency ? formatBRL(previous) : previous.toLocaleString("pt-BR");
  return (
    <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
      <span
        className={`inline-flex items-center text-[9px] sm:text-[10px] font-medium ${isUp ? "text-emerald-400" : "text-red-400"}`}
      >
        {isUp ? "↑" : "↓"} {Math.abs(pct).toFixed(0)}%
      </span>
      <span className="inline-flex items-center gap-0.5 text-[9px] sm:text-[10px] font-medium px-1 sm:px-1.5 py-0.5 rounded-full bg-muted/50 text-muted-foreground border border-border/40">
        <span className="w-1 h-1 sm:w-1.5 sm:h-1.5 rounded-full bg-muted-foreground/60" />
        {formattedPrev} {prevLabel ? prevLabel : "ant."}
      </span>
    </div>
  );
}

interface SalesTabProps {
  rows: SaleRow[];
  allRows: SaleRow[];
  loading: boolean;
  error: string | null;
  monthLabel: string;
  getMonthRows: (year: number, month: number) => SaleRow[];
  selectedYear: number;
  selectedMonth: number;
}

const MONTH_NAMES_SHORT = [
  "Jan", "Fev", "Mar", "Abr", "Mai", "Jun",
  "Jul", "Ago", "Set", "Out", "Nov", "Dez",
];

const isLeadership = isLeadershipCentral;
const WAR_ROOM_BROKERS = ALL_BROKERS.map(normalizeName);

export function SalesTab({ rows, allRows, loading, error, monthLabel, getMonthRows, selectedYear, selectedMonth }: SalesTabProps) {
  const [selectedAdmin, setSelectedAdmin] = useState("Todas");
  const { isGestor } = useUserRole();
  const [coachBroker, setCoachBroker] = useState<string | null>(null);
  const mesRef = `${selectedYear}-${String(selectedMonth + 1).padStart(2, "0")}`;

  // Team meta for projection
  const [teamMeta, setTeamMeta] = useState<number>(0);
  useEffect(() => {
    supabase.from("sales_goals").select("meta").eq("mes_ref", mesRef).maybeSingle().then(({ data }) => {
      setTeamMeta(data?.meta ? Number(data.meta) : 0);
    });
  }, [mesRef]);

  // Individual goals state (by broker name)
  const [individualGoals, setIndividualGoals] = useState<Record<string, number>>({});
  const [editingGoalUser, setEditingGoalUser] = useState<string | null>(null);
  const [goalInput, setGoalInput] = useState("");

  // Load individual goals by broker name
  useEffect(() => {
    supabase
      .from("sales_goals_byname")
      .select("broker_name, meta")
      .eq("mes_ref", mesRef)
      .then(({ data }) => {
        const map: Record<string, number> = {};
        (data || []).forEach((d: any) => { map[normalizeName(d.broker_name)] = Number(d.meta); });
        setIndividualGoals(map);
      });
  }, [mesRef]);

  // Load profiles to map names to user_ids
  const [profileMap, setProfileMap] = useState<Record<string, { userId: string; name: string; avatarUrl: string | null }>>({});
  useEffect(() => {
    supabase
      .from("profiles")
      .select("user_id, display_name, avatar_url")
      .then(({ data }) => {
        const map: Record<string, { userId: string; name: string; avatarUrl: string | null }> = {};
        (data || []).forEach((p) => {
          if (p.display_name) {
            map[p.display_name.toLowerCase()] = { userId: p.user_id, name: p.display_name, avatarUrl: p.avatar_url };
          }
        });
        setProfileMap(map);
      });
  }, []);

  const findUserIdByName = (name: string) => {
    const key = name.toLowerCase();
    // Try exact match first
    if (profileMap[key]) return profileMap[key].userId;
    // Try partial match
    for (const [profileName, data] of Object.entries(profileMap)) {
      if (profileName.includes(key) || key.includes(profileName)) return data.userId;
    }
    return null;
  };

  const handleSaveIndividualGoal = async (corretorName: string) => {
    const newMeta = parseFloat(goalInput.replace(/\./g, "").replace(",", "."));
    if (isNaN(newMeta) || newMeta < 0) {
      toast({ title: "Valor inválido", variant: "destructive" });
      return;
    }
    const { error: err } = await supabase
      .from("sales_goals_byname")
      .upsert({ broker_name: corretorName.toUpperCase(), mes_ref: mesRef, meta: newMeta }, { onConflict: "broker_name,mes_ref" });
    if (err) {
      toast({ title: "Erro ao salvar meta", description: err.message, variant: "destructive" });
      return;
    }
    setIndividualGoals((prev) => ({ ...prev, [corretorName]: newMeta }));
    setEditingGoalUser(null);
    toast({ title: `Meta de ${corretorName} atualizada!` });
  };

  const uniqueAdmins = useMemo(() => {
    const set = new Set<string>();
    rows.forEach((r) => { if (r.administradora) set.add(r.administradora); });
    return Array.from(set).sort();
  }, [rows]);

  const filteredRows = useMemo(() => {
    if (selectedAdmin === "Todas") return rows;
    return rows.filter((r) => r.administradora === selectedAdmin);
  }, [rows, selectedAdmin]);

  const filteredGetMonthRows = useMemo(() => {
    if (selectedAdmin === "Todas") return getMonthRows;
    return (y: number, m: number) => getMonthRows(y, m).filter((r) => r.administradora === selectedAdmin);
  }, [getMonthRows, selectedAdmin]);

  const totalValor = useMemo(() => filteredRows.reduce((s, r) => s + r.valor, 0), [filteredRows]);
  const totalQtd = filteredRows.length;

  // Previous month comparison — only up to the same day for fair comparison
  const prevMonth = useMemo(() => {
    let y = selectedYear;
    let m = selectedMonth - 1;
    if (m < 0) { m = 11; y -= 1; }

    const now = new Date();
    const isCurrentMonth = selectedYear === now.getFullYear() && selectedMonth === now.getMonth();
    const cutoffDay = isCurrentMonth ? now.getDate() : new Date(selectedYear, selectedMonth + 1, 0).getDate();

    const prevRows = filteredGetMonthRows(y, m).filter((r) => {
      if (!r.dataVenda) return true;
      const parts = r.dataVenda.split("/");
      const day = parseInt(parts[0], 10);
      return day <= cutoffDay;
    });

    const prevMonthName = MONTH_NAMES_SHORT[m];
    const label = isCurrentMonth ? `${prevMonthName} 1-${cutoffDay}` : `${prevMonthName} inteiro`;

    return {
      total: prevRows.reduce((s, r) => s + r.valor, 0),
      count: prevRows.length,
      corretores: new Set(prevRows.map((r) => r.corretor).filter(Boolean)).size,
      label,
    };
  }, [filteredGetMonthRows, selectedYear, selectedMonth]);

  const sourceCounts = useMemo(() => {
    let atual = 0, historico = 0;
    filteredRows.forEach((r) => {
      if (r.source === "historico") historico++;
      else atual++;
    });
    return { atual, historico };
  }, [filteredRows]);

  const ranking = useMemo(() => {
    const map: Record<string, { total: number; count: number }> = {};
    filteredRows.forEach((r) => {
      if (!r.corretor || isLeadership(r.corretor)) return;
      const name = normalizeName(r.corretor);
      if (!map[name]) map[name] = { total: 0, count: 0 };
      map[name].total += r.valor;
      map[name].count += 1;
    });

    const brokerUniverse = new Set([...WAR_ROOM_BROKERS, ...Object.keys(individualGoals).map(normalizeName)]);

    // Include all brokers shown in War Room and all brokers with goals, even if zero sales
    brokerUniverse.forEach((name) => {
      if (!map[name] && !isLeadership(name)) {
        map[name] = { total: 0, count: 0 };
      }
    });

    return Object.entries(map)
      .map(([name, { total, count }]) => {
        const profile = profileMap[name.toLowerCase()];
        const avatarUrl = profile?.avatarUrl || null;
        return { name, total, count, avatarUrl };
      })
      .sort((a, b) => b.total - a.total);
  }, [filteredRows, profileMap, individualGoals]);

  // Leadership totals (separate from broker ranking)
  const leadershipData = useMemo(() => {
    const map: Record<string, { total: number; count: number }> = {};
    filteredRows.forEach((r) => {
      if (!r.corretor || !isLeadership(r.corretor)) return;
      if (!map[r.corretor]) map[r.corretor] = { total: 0, count: 0 };
      map[r.corretor].total += r.valor;
      map[r.corretor].count += 1;
    });
    return Object.entries(map)
      .map(([name, { total, count }]) => {
        const profile = profileMap[name.toLowerCase()];
        const avatarUrl = profile?.avatarUrl || null;
        return { name, total, count, avatarUrl };
      })
      .sort((a, b) => b.total - a.total);
  }, [filteredRows, profileMap]);

  const teamRanking = useMemo(() => {
    const map: Record<string, { total: number; count: number }> = {};
    filteredRows.forEach((r) => {
      if (r.corretor && isLeadership(r.corretor)) return; // exclude leadership from team totals
      const team = r.time || "Sem time";
      if (!map[team]) map[team] = { total: 0, count: 0 };
      map[team].total += r.valor;
      map[team].count += 1;
    });
    return Object.entries(map)
      .map(([name, { total, count }]) => ({ name, total, count }))
      .sort((a, b) => b.total - a.total);
  }, [filteredRows]);

  // 6-month evolution data
  const monthlyEvolution = useMemo(() => {
    const months: { label: string; total: number; count: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      let y = selectedYear;
      let m = selectedMonth - i;
      while (m < 0) { m += 12; y -= 1; }
      const mRows = filteredGetMonthRows(y, m);
      months.push({
        label: `${MONTH_NAMES_SHORT[m]}/${y.toString().slice(2)}`,
        total: mRows.reduce((s, r) => s + r.valor, 0),
        count: mRows.length,
      });
    }
    return months;
  }, [filteredGetMonthRows, selectedYear, selectedMonth]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground gap-2">
        <Loader2 className="w-5 h-5 animate-spin" />
        Carregando dados de vendas...
      </div>
    );
  }

  if (error) {
    return (
      <div className="glass-card p-4 border-destructive/50 bg-destructive/10 text-destructive text-sm">
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Coach Dialog */}
      {coachBroker && (
        <SalesAICoach
          brokerName={coachBroker}
          rows={filteredRows}
          allRows={allRows}
          getMonthRows={filteredGetMonthRows}
          selectedYear={selectedYear}
          selectedMonth={selectedMonth}
          open={!!coachBroker}
          onOpenChange={(open) => { if (!open) setCoachBroker(null); }}
        />
      )}

      {/* Administradora Filter */}
      <div className="flex gap-1.5 sm:gap-2 flex-wrap">
        <Button
          variant={selectedAdmin === "Todas" ? "default" : "outline"}
          size="sm"
          className="text-[11px] sm:text-sm h-7 sm:h-9 px-2 sm:px-3"
          onClick={() => setSelectedAdmin("Todas")}
        >
          Todas
        </Button>
        {uniqueAdmins.map((admin) => (
          <Button
            key={admin}
            variant={selectedAdmin === admin ? "default" : "outline"}
            size="sm"
            className="text-[11px] sm:text-sm h-7 sm:h-9 px-2 sm:px-3"
            onClick={() => setSelectedAdmin(admin)}
          >
            {admin}
          </Button>
        ))}
      </div>

      {/* Gauge Meta Card */}
      <SalesGaugeCard selectedYear={selectedYear} selectedMonth={selectedMonth} totalVendido={totalValor} totalPropostas={totalQtd} />

      {/* Metas Individuais */}

      {/* Ranking Table with Individual Goals */}
      {ranking.length > 0 && (
        <div className="glass-card p-3 sm:p-5 space-y-3">
          <div className="flex items-center gap-2">
            <Target className="w-4 h-4 sm:w-5 sm:h-5 text-[hsl(217,85%,55%)]" />
            <h2 className="font-display text-sm sm:text-lg font-semibold text-foreground">Metas Individuais</h2>
          </div>
          <div className="overflow-x-auto -mx-3 sm:mx-0">
            <table className="w-full text-xs sm:text-sm min-w-[400px]">
              <thead>
                <tr className="border-b border-border text-muted-foreground">
                  <th className="text-left py-2 pr-2 pl-3 sm:pl-0">#</th>
                  <th className="text-left py-2 pr-2">Corretor</th>
                  <th className="text-right py-2 pr-2">Total</th>
                  <th className="text-right py-2 pr-2">Meta</th>
                  <th className="text-right py-2 pr-2">% Meta</th>
                  <th className="text-center py-2 pr-3 sm:pr-0">Coach</th>
                </tr>
              </thead>
              <tbody>
                {ranking.map((r, i) => {
                  const goal = individualGoals[r.name] || 0;
                  const pct = goal > 0 ? Math.min((r.total / goal) * 100, 999) : 0;
                  const isEditing = editingGoalUser === r.name;
                  const isZero = r.total === 0;

                  return (
                    <tr key={r.name} className={`border-b border-border/50 ${isZero ? "opacity-50" : ""}`}>
                      <td className="py-2 pr-2 pl-3 sm:pl-0 font-bold text-muted-foreground">{i + 1}</td>
                      <td className="py-2 pr-2 font-medium truncate max-w-[120px] sm:max-w-none">
                        <span className={isZero ? "text-muted-foreground" : "text-foreground"}>{r.name}</span>
                        {isZero && (
                          <span className="ml-1.5 inline-flex items-center text-[9px] font-medium px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground border border-border/40">
                            sem vendas
                          </span>
                        )}
                      </td>
                      <td className={`py-2 pr-2 text-right font-semibold whitespace-nowrap ${isZero ? "text-muted-foreground" : "text-primary"}`}>{formatBRL(r.total)}</td>
                      <td className="py-2 pr-2 text-right whitespace-nowrap">
                        {isEditing ? (
                          <div className="flex items-center gap-1 justify-end">
                            <Input
                              value={goalInput}
                              onChange={(e) => setGoalInput(e.target.value)}
                              placeholder="Meta"
                              className="h-6 text-xs w-20"
                              autoFocus
                              onKeyDown={(e) => {
                                if (e.key === "Enter") handleSaveIndividualGoal(r.name);
                                if (e.key === "Escape") setEditingGoalUser(null);
                              }}
                            />
                            <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => handleSaveIndividualGoal(r.name)}>
                              <Check className="w-3 h-3" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => setEditingGoalUser(null)}>
                              <X className="w-3 h-3" />
                            </Button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1 justify-end">
                            <span className="text-muted-foreground">{goal > 0 ? formatBRL(goal) : "—"}</span>
                            {isGestor && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-5 w-5"
                                onClick={() => {
                                  setGoalInput(goal > 0 ? goal.toLocaleString("pt-BR", { maximumFractionDigits: 0 }) : "");
                                  setEditingGoalUser(r.name);
                                }}
                              >
                                <Pencil className="w-2.5 h-2.5 text-muted-foreground" />
                              </Button>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="py-2 pr-3 sm:pr-0 text-right">
                        {goal > 0 ? (
                          <div className="flex items-center gap-1.5 justify-end">
                            <div className="w-12 sm:w-16">
                              <Progress value={Math.min(pct, 100)} className="h-1.5" />
                            </div>
                            <span className={`text-[10px] font-medium ${pct >= 100 ? "text-emerald-400" : "text-muted-foreground"}`}>
                              {pct.toFixed(0)}%
                            </span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="py-2 pr-3 sm:pr-0 text-center">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => setCoachBroker(r.name)}
                          title="Coach IA"
                        >
                          <UserCheck className="w-3.5 h-3.5 text-primary" />
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Activity Feed */}
      <SalesActivityFeed rows={filteredRows} monthLabel={monthLabel} />

      {/* Sales Streak */}
      <SalesStreakCard rows={allRows} />

      {/* ═══════════════════════════════════════ */}
      {/* IAs */}
      {/* ═══════════════════════════════════════ */}

      {/* Daily Summary */}
      <SalesDailySummary
        rows={filteredRows}
        allRows={allRows}
        getMonthRows={filteredGetMonthRows}
        selectedYear={selectedYear}
        selectedMonth={selectedMonth}
      />

      {/* Churn Alert */}
      <SalesChurnAlert
        rows={filteredRows}
        getMonthRows={filteredGetMonthRows}
        selectedYear={selectedYear}
        selectedMonth={selectedMonth}
      />

      {/* AI Suggestions */}
      <SalesAISuggestions
        rows={filteredRows}
        allRows={allRows}
        monthLabel={monthLabel}
        getMonthRows={filteredGetMonthRows}
        selectedYear={selectedYear}
        selectedMonth={selectedMonth}
      />

      {/* Seasonality Analysis */}
      <SalesSeasonality
        allRows={allRows}
        getMonthRows={filteredGetMonthRows}
        selectedYear={selectedYear}
        selectedMonth={selectedMonth}
      />

      {/* ═══════════════════════════════════════ */}
      {/* RELATÓRIOS E GRÁFICOS */}
      {/* ═══════════════════════════════════════ */}


      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 sm:gap-4">
        <div className="glass-card p-3 sm:p-5 space-y-1.5 sm:space-y-2 border-l-4 border-l-primary">
          <div className="flex items-center gap-1.5 sm:gap-2">
            <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
            <span className="text-[10px] sm:text-sm text-muted-foreground font-medium">Total Vendido</span>
          </div>
          <div className="font-display text-base font-bold text-primary sm:text-base">
            {formatBRL(totalValor)}
          </div>
          <ComparisonBadge current={totalValor} previous={prevMonth.total} prevLabel={prevMonth.label} isCurrency />
        </div>
        <div className="glass-card p-3 sm:p-5 space-y-1.5 sm:space-y-2 border-l-4 border-l-[hsl(217,85%,55%)]">
          <div className="flex items-center gap-1.5 sm:gap-2">
            <ShoppingCart className="w-4 h-4 sm:w-5 sm:h-5 text-[hsl(217,85%,55%)]" />
            <span className="text-[10px] sm:text-sm text-muted-foreground font-medium">Propostas</span>
          </div>
          <div className="font-display text-base font-bold text-foreground sm:text-base">
            {totalQtd}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <ComparisonBadge current={totalQtd} previous={prevMonth.count} prevLabel={prevMonth.label} />
            {sourceCounts.atual > 0 && (
              <span className="inline-flex items-center gap-0.5 text-[9px] sm:text-[10px] font-medium px-1 sm:px-1.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/20">
                <span className="w-1 h-1 sm:w-1.5 sm:h-1.5 rounded-full bg-emerald-400" />
                {sourceCounts.atual} atual
              </span>
            )}
            {sourceCounts.historico > 0 && (
              <span className="inline-flex items-center gap-0.5 text-[9px] sm:text-[10px] font-medium px-1 sm:px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/20">
                <span className="w-1 h-1 sm:w-1.5 sm:h-1.5 rounded-full bg-amber-400" />
                {sourceCounts.historico} hist.
              </span>
            )}
          </div>
        </div>
        <div className="glass-card p-3 sm:p-5 space-y-1.5 sm:space-y-2 border-l-4 border-l-[hsl(270,60%,58%)]">
          <div className="flex items-center gap-1.5 sm:gap-2">
            <Users className="w-4 h-4 sm:w-5 sm:h-5 text-[hsl(270,60%,58%)]" />
            <span className="text-[10px] sm:text-sm text-muted-foreground font-medium">Corretores Ativos</span>
          </div>
          <div className="font-display text-base font-bold text-foreground sm:text-base">
            {ranking.length}
          </div>
          <ComparisonBadge current={ranking.length} previous={prevMonth.corretores} prevLabel={prevMonth.label} />
        </div>
        <div className="glass-card p-3 sm:p-5 space-y-1.5 sm:space-y-2 border-l-4 border-l-[hsl(30,90%,55%)]">
          <div className="flex items-center gap-1.5 sm:gap-2">
            <CreditCard className="w-4 h-4 sm:w-5 sm:h-5 text-[hsl(30,90%,55%)]" />
            <span className="text-[10px] sm:text-sm text-muted-foreground font-medium">Ticket Médio</span>
          </div>
          <div className="font-display text-base font-bold text-foreground sm:text-base">
            {totalQtd > 0 ? formatBRL(totalValor / totalQtd) : "R$ 0,00"}
          </div>
          <ComparisonBadge
            current={totalQtd > 0 ? totalValor / totalQtd : 0}
            previous={prevMonth.count > 0 ? prevMonth.total / prevMonth.count : 0}
            prevLabel={prevMonth.label}
            isCurrency
          />
        </div>
      </div>

      {/* Sales Projection */}
      <SalesProjection
        rows={filteredRows}
        allRows={allRows}
        meta={teamMeta}
        selectedYear={selectedYear}
        selectedMonth={selectedMonth}
        getMonthRows={filteredGetMonthRows}
      />

      {/* Daily Sales Chart */}
      <DailySalesChart rows={filteredRows} selectedYear={selectedYear} selectedMonth={selectedMonth} monthLabel={monthLabel} />

      {/* Daily Cumulative Evolution */}
      <DailyCumulativeChart rows={filteredRows} selectedYear={selectedYear} selectedMonth={selectedMonth} getMonthRows={filteredGetMonthRows} />

      {/* Sales Channel Chart */}
      <SalesChannelChart rows={filteredRows} />

      {/* 6-Month Sales Evolution */}
      <div className="glass-card p-3 sm:p-5 space-y-3 sm:space-y-4">
        <h2 className="font-display text-sm sm:text-lg font-semibold text-foreground">Evolução de Vendas (6 meses)</h2>
        {monthlyEvolution.some((m) => m.total > 0) ? (
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={monthlyEvolution} barGap={2} margin={{ left: -10, right: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 14%, 16%)" />
              <XAxis dataKey="label" tick={{ fill: "hsl(215, 12%, 50%)", fontSize: 10 }} />
              <YAxis
                yAxisId="left"
                tick={{ fill: "hsl(215, 12%, 50%)", fontSize: 10 }}
                tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
                width={45}
              />
              <YAxis
                yAxisId="right"
                orientation="right"
                tick={{ fill: "hsl(215, 12%, 50%)", fontSize: 10 }}
                allowDecimals={false}
                width={30}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(220, 18%, 10%)",
                  border: "1px solid hsl(220, 14%, 16%)",
                  borderRadius: "8px",
                  color: "hsl(210, 20%, 92%)",
                  fontSize: 12,
                }}
                formatter={(value: number, name: string) =>
                  name === "total" ? [formatBRL(value), "Valor Total"] : [value, "Propostas"]
                }
              />
              <Legend formatter={(value) => (value === "total" ? "Valor Total" : "Qtd Propostas")} wrapperStyle={{ fontSize: 11 }} />
              <Bar yAxisId="left" dataKey="total" fill="hsl(150, 60%, 45%)" radius={[4, 4, 0, 0]} name="total" />
              <Bar yAxisId="right" dataKey="count" fill="hsl(217, 85%, 55%)" radius={[4, 4, 0, 0]} name="count" />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-10">Sem dados para exibir</p>
        )}
      </div>

      {/* Sales Detail Table */}
      <SalesDetailTable rows={filteredRows} monthLabel={monthLabel} />

      {/* Annual Evolution Chart */}
      <AnnualEvolutionChart allRows={allRows} />
    </div>
  );
}
