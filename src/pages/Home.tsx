import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { useGoogleSheetsData } from "@/hooks/useGoogleSheetsData";
import { usePermissions } from "@/hooks/usePermissions";
import { normalizeName, BROKER_TEAMS } from "@/lib/seller-names";
import { HallOfRecords } from "@/components/HallOfRecords";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  TrendingUp, Target, Activity, Trophy, Wallet, Building2,
  GraduationCap, Globe, ChevronRight, Users, Zap, CalendarDays,
  ArrowUpRight, ArrowDownRight, Minus,
} from "lucide-react";
import { DailySalesChartCard } from "@/components/DailySalesChartCard";
import { TeamMoodPrompt } from "@/components/home/TeamMoodPrompt";
import { CompanyHealthWidget } from "@/components/home/CompanyHealthWidget";
import { DailyBetsRanking } from "@/components/home/DailyBetsRanking";
import { MetaPorGrupoSection } from "@/components/home/MetaPorGrupoSection";
import { CohortParcelasSection } from "@/components/home/CohortParcelasSection";
import { CopaDPSummary } from "@/components/home/CopaDPSummary";

const META_ANUAL_ATE_MES = 150_000_000;

function formatBRL(val: number) {
  return val.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
}

function parseBRDate(raw: string): Date | null {
  if (!raw) return null;
  const parts = raw.split("/");
  if (parts.length !== 3) return null;
  const [day, month, year] = parts.map(Number);
  return new Date(year, month - 1, day);
}

function getQuarter(month: number) {
  return Math.floor(month / 3) + 1;
}

function getQuarterMonths(quarter: number): number[] {
  const start = (quarter - 1) * 3;
  return [start, start + 1, start + 2];
}

const QUARTER_LABELS = ["Q1 (Jan–Mar)", "Q2 (Abr–Jun)", "Q3 (Jul–Set)", "Q4 (Out–Dez)"];
const MONTH_NAMES_SHORT = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

/**
 * Comparativos sempre usam janelas espelhadas:
 *  • Hoje    → mesmo dia/mês no mês anterior
 *  • Mês     → mês anterior até o mesmo dia (D)
 *  • Trim.   → trimestre anterior, mesmos dias decorridos
 *  • YTD     → ano anterior até o mesmo (mês, dia)
 * Helper único para evitar drift entre os cards.
 */
function isWithinAnchoredWindow(
  d: Date,
  anchorEnd: Date,
  startYear: number,
  startMonth: number,
  startDay = 1
): boolean {
  const start = new Date(startYear, startMonth, startDay);
  const end = new Date(anchorEnd);
  end.setHours(23, 59, 59, 999);
  return d >= start && d <= end;
}

export default function Home() {
  const { user } = useAuth();
  const { role, isAdmin, isGestor } = useUserRole();
  const { hasPermission } = usePermissions();
  const canEditRecords = isAdmin || isGestor;
  const navigate = useNavigate();
  const { allRows, loading } = useGoogleSheetsData();

  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();
  const currentQuarter = getQuarter(currentMonth);
  const userName = user?.user_metadata?.display_name || user?.email?.split("@")[0] || "";

  // Match logged user to broker name
  const userDisplayName = user?.user_metadata?.full_name || user?.user_metadata?.display_name || "";
  const userBrokerName = useMemo(() => {
    if (!userDisplayName) return "";
    return normalizeName(userDisplayName);
  }, [userDisplayName]);

  const userTeam = BROKER_TEAMS[userBrokerName] || null;

  // Current month rows
  const monthRows = useMemo(() =>
    allRows.filter((r) => {
      const d = parseBRDate(r.dataVenda);
      return d && d.getFullYear() === currentYear && d.getMonth() === currentMonth;
    }),
    [allRows, currentYear, currentMonth]
  );

  // Previous month rows — limitado à MESMA janela de dias já decorridos no mês atual,
  // para comparar "maçã com maçã" (ex.: até dia 3 de junho vs até dia 3 de maio).
  const prevMonthRows = useMemo(() => {
    const prevM = currentMonth === 0 ? 11 : currentMonth - 1;
    const prevY = currentMonth === 0 ? currentYear - 1 : currentYear;
    const cutoffDay = now.getDate();
    return allRows.filter((r) => {
      const d = parseBRDate(r.dataVenda);
      return d && d.getFullYear() === prevY && d.getMonth() === prevM && d.getDate() <= cutoffDay;
    });
  }, [allRows, currentYear, currentMonth, now]);

  // Vendas no mesmo dia do mês anterior (para comparar com "Vendas Hoje").
  const prevSameDayRows = useMemo(() => {
    const prevM = currentMonth === 0 ? 11 : currentMonth - 1;
    const prevY = currentMonth === 0 ? currentYear - 1 : currentYear;
    const day = now.getDate();
    return allRows.filter((r) => {
      const d = parseBRDate(r.dataVenda);
      return d && d.getFullYear() === prevY && d.getMonth() === prevM && d.getDate() === day;
    });
  }, [allRows, currentYear, currentMonth, now]);
  const prevSameDayValue = useMemo(
    () => prevSameDayRows.reduce((s, r) => s + r.valor, 0),
    [prevSameDayRows]
  );

  // ─── Individual broker stats ───
  const myStats = useMemo(() => {
    if (!userBrokerName || !BROKER_TEAMS[userBrokerName]) return null;

    const mySales = monthRows.filter((r) => normalizeName(r.corretor || "") === userBrokerName);
    const myValue = mySales.reduce((s, r) => s + r.valor, 0);
    const myCount = mySales.length;

    const prevMySales = prevMonthRows.filter((r) => normalizeName(r.corretor || "") === userBrokerName);
    const prevMyValue = prevMySales.reduce((s, r) => s + r.valor, 0);
    const prevMyCount = prevMySales.length;

    const valuePctChange = prevMyValue > 0 ? ((myValue - prevMyValue) / prevMyValue) * 100 : 0;

    // My ranking position
    const sellers: Record<string, number> = {};
    monthRows.forEach((r) => {
      const name = normalizeName(r.corretor || "");
      if (!BROKER_TEAMS[name]) return;
      sellers[name] = (sellers[name] || 0) + r.valor;
    });
    const sorted = Object.entries(sellers).sort((a, b) => b[1] - a[1]);
    const rankPos = sorted.findIndex(([name]) => name === userBrokerName) + 1;
    const totalSellers = sorted.length;

    // Today's sales
    const todaySales = mySales.filter((r) => {
      const d = parseBRDate(r.dataVenda);
      return d && d.getDate() === now.getDate();
    });

    // Avg ticket
    const avgTicket = myCount > 0 ? myValue / myCount : 0;

    return {
      value: myValue, count: myCount,
      prevValue: prevMyValue, prevCount: prevMyCount,
      valuePctChange,
      rankPos, totalSellers,
      todayCount: todaySales.length,
      todayValue: todaySales.reduce((s, r) => s + r.valor, 0),
      avgTicket,
    };
  }, [monthRows, prevMonthRows, userBrokerName, now]);

  // Sales summary
  const totalVendas = useMemo(() => monthRows.reduce((s, r) => s + r.valor, 0), [monthRows]);
  const totalContratos = monthRows.length;
  const totalVendasPrevMonth = useMemo(() => prevMonthRows.reduce((s, r) => s + r.valor, 0), [prevMonthRows]);
  const monthPctChange = totalVendasPrevMonth > 0
    ? ((totalVendas - totalVendasPrevMonth) / totalVendasPrevMonth) * 100
    : 0;

  // Today's sales
  const todayRows = useMemo(() =>
    monthRows.filter((r) => {
      const d = parseBRDate(r.dataVenda);
      return d && d.getDate() === now.getDate();
    }),
    [monthRows]
  );
  const todayValue = useMemo(() => todayRows.reduce((s, r) => s + r.valor, 0), [todayRows]);

  // Recent 5 sales
  const recentSales = useMemo(() => {
    return [...monthRows]
      .sort((a, b) => {
        const da = parseBRDate(a.dataVenda)?.getTime() || 0;
        const db = parseBRDate(b.dataVenda)?.getTime() || 0;
        return db - da;
      })
      .slice(0, 5);
  }, [monthRows]);

  // Team ranking
  const teamRanking = useMemo(() => {
    const teams: Record<string, { count: number; value: number }> = {};
    monthRows.forEach((r) => {
      const canonical = normalizeName(r.corretor || "");
      const team = BROKER_TEAMS[canonical];
      if (!team) return;
      if (!teams[team]) teams[team] = { count: 0, value: 0 };
      teams[team].count++;
      teams[team].value += r.valor;
    });
    return Object.entries(teams)
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.value - a.value);
  }, [monthRows]);

  // Top sellers
  const topSellers = useMemo(() => {
    const sellers: Record<string, { count: number; value: number }> = {};
    monthRows.forEach((r) => {
      const name = normalizeName(r.corretor || "");
      if (!BROKER_TEAMS[name]) return;
      if (!sellers[name]) sellers[name] = { count: 0, value: 0 };
      sellers[name].count++;
      sellers[name].value += r.valor;
    });
    return Object.entries(sellers)
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);
  }, [monthRows]);

  // ─── Quarter Analysis ───
  const quarterData = useMemo(() => {
    const qMonths = getQuarterMonths(currentQuarter);
    const prevQ = currentQuarter > 1 ? currentQuarter - 1 : 4;
    const prevQYear = currentQuarter > 1 ? currentYear : currentYear - 1;
    const prevQMonths = getQuarterMonths(prevQ);

    // Quarter start dates
    const qStart = new Date(currentYear, qMonths[0], 1);
    const prevQStart = new Date(prevQYear, prevQMonths[0], 1);

    // Days elapsed in current quarter (from quarter start to today, inclusive)
    const MS_PER_DAY = 1000 * 60 * 60 * 24;
    const daysElapsed = Math.floor((now.getTime() - qStart.getTime()) / MS_PER_DAY) + 1;

    // Cutoff for previous quarter: same number of days from its start
    const prevQCutoff = new Date(prevQStart);
    prevQCutoff.setDate(prevQCutoff.getDate() + daysElapsed - 1);
    prevQCutoff.setHours(23, 59, 59, 999);

    // Current quarter (full so far — already only has elapsed data)
    const qRows = allRows.filter((r) => {
      const d = parseBRDate(r.dataVenda);
      return d && d.getFullYear() === currentYear && qMonths.includes(d.getMonth());
    });

    // Previous quarter — only same elapsed window for fair comparison
    const prevQRows = allRows.filter((r) => {
      const d = parseBRDate(r.dataVenda);
      if (!d) return false;
      return d >= prevQStart && d <= prevQCutoff;
    });

    // Previous quarter FULL (used only for monthly breakdown / context)
    const prevQRowsFull = allRows.filter((r) => {
      const d = parseBRDate(r.dataVenda);
      return d && d.getFullYear() === prevQYear && prevQMonths.includes(d.getMonth());
    });

    const qTotal = qRows.reduce((s, r) => s + r.valor, 0);
    const qCount = qRows.length;
    const prevQTotal = prevQRows.reduce((s, r) => s + r.valor, 0);
    const prevQCount = prevQRows.length;
    const prevQTotalFull = prevQRowsFull.reduce((s, r) => s + r.valor, 0);
    const pctChange = prevQTotal > 0 ? ((qTotal - prevQTotal) / prevQTotal) * 100 : 0;
    const countChange = prevQCount > 0 ? ((qCount - prevQCount) / prevQCount) * 100 : 0;

    // Monthly breakdown in current quarter
    const monthlyBreakdown = qMonths.map((m) => {
      const mRows = allRows.filter((r) => {
        const d = parseBRDate(r.dataVenda);
        return d && d.getFullYear() === currentYear && d.getMonth() === m;
      });
      return {
        month: m,
        label: MONTH_NAMES_SHORT[m],
        value: mRows.reduce((s, r) => s + r.valor, 0),
        count: mRows.length,
        isCurrent: m === currentMonth,
        isFuture: m > currentMonth,
      };
    });

    // Top team of the quarter
    const qTeams: Record<string, number> = {};
    qRows.forEach((r) => {
      const team = BROKER_TEAMS[normalizeName(r.corretor || "")];
      if (team) qTeams[team] = (qTeams[team] || 0) + r.valor;
    });
    const topTeam = Object.entries(qTeams).sort((a, b) => b[1] - a[1])[0];

    // Top seller of the quarter
    const qSellers: Record<string, number> = {};
    qRows.forEach((r) => {
      const name = normalizeName(r.corretor || "");
      if (BROKER_TEAMS[name]) qSellers[name] = (qSellers[name] || 0) + r.valor;
    });
    const topSeller = Object.entries(qSellers).sort((a, b) => b[1] - a[1])[0];

    // Avg ticket
    const avgTicket = qCount > 0 ? qTotal / qCount : 0;
    const prevAvgTicket = prevQCount > 0 ? prevQTotal / prevQCount : 0;
    const ticketChange = prevAvgTicket > 0 ? ((avgTicket - prevAvgTicket) / prevAvgTicket) * 100 : 0;

    return {
      qTotal, qCount, prevQTotal, prevQCount, pctChange, countChange,
      monthlyBreakdown, topTeam, topSeller, avgTicket, ticketChange,
      prevQ, prevQYear,
    };
  }, [allRows, currentYear, currentMonth, currentQuarter]);

  // ─── Year-to-date quarters comparison ───
  // ─── YTD total (ano todo até hoje) ───
  const ytdTotal = useMemo(() => {
    return allRows.reduce((sum, r) => {
      const d = parseBRDate(r.dataVenda);
      if (!d || d.getFullYear() !== currentYear) return sum;
      return sum + r.valor;
    }, 0);
  }, [allRows, currentYear]);

  const ytdCount = useMemo(() => {
    return allRows.reduce((c, r) => {
      const d = parseBRDate(r.dataVenda);
      if (!d || d.getFullYear() !== currentYear) return c;
      return c + 1;
    }, 0);
  }, [allRows, currentYear]);

  // YTD do ano anterior limitado à MESMA data-âncora (mesmo mês/dia),
  // para comparar maçã com maçã (ex.: 1/jan → 3/jun de 2026 vs 1/jan → 3/jun de 2025).
  const prevYearYTD = useMemo(() => {
    const prevAnchor = new Date(currentYear - 1, currentMonth, now.getDate());
    return allRows.reduce(
      (acc, r) => {
        const d = parseBRDate(r.dataVenda);
        if (!d) return acc;
        if (!isWithinAnchoredWindow(d, prevAnchor, currentYear - 1, 0, 1)) return acc;
        return { value: acc.value + r.valor, count: acc.count + 1 };
      },
      { value: 0, count: 0 }
    );
  }, [allRows, currentYear, currentMonth, now]);

  const ytdPctChange = prevYearYTD.value > 0
    ? ((ytdTotal - prevYearYTD.value) / prevYearYTD.value) * 100
    : 0;

  const allQuartersYTD = useMemo(() => {
    const quarters: { quarter: number; label: string; value: number; count: number }[] = [];
    // Days elapsed in current quarter (inclusive)
    const currentQStart = new Date(currentYear, (currentQuarter - 1) * 3, 1);
    const msPerDay = 1000 * 60 * 60 * 24;
    const daysElapsed = Math.floor((now.getTime() - currentQStart.getTime()) / msPerDay) + 1;
    for (let q = 1; q <= currentQuarter; q++) {
      const qMonths = getQuarterMonths(q);
      const qStart = new Date(currentYear, qMonths[0], 1);
      const qCutoff = new Date(qStart);
      qCutoff.setDate(qCutoff.getDate() + daysElapsed - 1);
      qCutoff.setHours(23, 59, 59, 999);
      const qRows = allRows.filter((r) => {
        const d = parseBRDate(r.dataVenda);
        return (
          d &&
          d.getFullYear() === currentYear &&
          qMonths.includes(d.getMonth()) &&
          d.getTime() <= qCutoff.getTime()
        );
      });
      quarters.push({
        quarter: q,
        label: `Q${q}`,
        value: qRows.reduce((s, r) => s + r.valor, 0),
        count: qRows.length,
      });
    }
    return quarters;
  }, [allRows, currentYear, currentQuarter, now]);

  const MONTH_NAMES = [
    "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
  ];

  const greeting = now.getHours() < 12 ? "Bom dia" : now.getHours() < 18 ? "Boa tarde" : "Boa noite";

  const quickLinks = [
    { label: "Vendas", icon: TrendingUp, url: "/vendas", show: hasPermission("vendas") || hasPermission("meu_painel") },
    { label: "Tarefas e OKR", icon: Building2, url: "/okr", show: true },
    { label: "Financeiro", icon: Wallet, url: "/financeiro", show: hasPermission("financeiro") || hasPermission("dashboard") },
    { label: "HUB", icon: Globe, url: "/hub", show: hasPermission("hub") },
    { label: "Treinamentos", icon: GraduationCap, url: "/treinamentos", show: true },
  ].filter((l) => l.show);

  const teamMedals = ["🥇", "🥈", "🥉"];

  function TrendIcon({ pct }: { pct: number }) {
    if (pct > 1) return <ArrowUpRight className="w-3.5 h-3.5 text-emerald-500" />;
    if (pct < -1) return <ArrowDownRight className="w-3.5 h-3.5 text-destructive" />;
    return <Minus className="w-3.5 h-3.5 text-muted-foreground" />;
  }

  function trendColor(pct: number) {
    if (pct > 1) return "text-emerald-500";
    if (pct < -1) return "text-destructive";
    return "text-muted-foreground";
  }

  return (
    <div className="max-w-5xl mx-auto px-3 sm:px-4 py-4 sm:py-8 space-y-5">
      {/* Greeting */}
      <div>
        <h1 className="font-display text-xl sm:text-3xl font-bold text-foreground">
          {greeting}, {userName.split(" ")[0]} 👋
        </h1>
        <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
          {MONTH_NAMES[currentMonth]} {currentYear} — Resumo geral
        </p>
      </div>

      {/* Mood prompt (1x/dia) */}
      <TeamMoodPrompt />

      {/* ─── Meta Anual ─── */}
      {(() => {
        const pct = Math.min((ytdTotal / META_ANUAL_ATE_MES) * 100, 100);
        const faltam = Math.max(META_ANUAL_ATE_MES - ytdTotal, 0);
        const lastDay = new Date(currentYear, currentMonth + 1, 0);
        const diasRestantes = Math.max(
          Math.ceil((lastDay.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)),
          0
        );
        const ritmoDiario = diasRestantes > 0 ? faltam / diasRestantes : 0;
        const batida = ytdTotal >= META_ANUAL_ATE_MES;
        return (
          <Card className="border-l-4 border-l-[hsl(45,85%,50%)] bg-gradient-to-br from-[hsl(45,85%,50%)]/10 to-transparent overflow-hidden">
            <CardContent className="p-4 sm:p-5 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div className="w-9 h-9 rounded-full bg-[hsl(45,85%,50%)]/20 flex items-center justify-center">
                    <Target className="w-4 h-4 text-[hsl(45,85%,50%)]" />
                  </div>
                  <div>
                    <h2 className="font-display text-sm sm:text-base font-bold text-foreground">
                      Meta Anual {currentYear}
                    </h2>
                    <p className="text-[10px] sm:text-xs text-muted-foreground">
                      R$ 150 milhões até o fim de {MONTH_NAMES[currentMonth]}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-display text-lg sm:text-2xl font-bold text-foreground">
                    {pct.toFixed(1)}%
                  </p>
                  {batida && (
                    <span className="text-[10px] text-emerald-500 font-semibold">🎉 Batida!</span>
                  )}
                </div>
              </div>

              <Progress value={pct} className="h-2.5 sm:h-3" />

              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="rounded-lg bg-background/60 p-2">
                  <p className="text-[9px] sm:text-[10px] text-muted-foreground uppercase">Realizado</p>
                  <p className="text-xs sm:text-sm font-bold text-foreground">{formatBRL(ytdTotal)}</p>
                  {prevYearYTD.value > 0 && (
                    <div className="flex items-center justify-center gap-0.5 mt-0.5">
                      <TrendIcon pct={ytdPctChange} />
                      <span className={`text-[9px] font-medium ${trendColor(ytdPctChange)}`}>
                        {ytdPctChange >= 0 ? "+" : ""}{ytdPctChange.toFixed(0)}% vs {currentYear - 1}
                      </span>
                    </div>
                  )}
                </div>
                <div className="rounded-lg bg-background/60 p-2">
                  <p className="text-[9px] sm:text-[10px] text-muted-foreground uppercase">Faltam</p>
                  <p className="text-xs sm:text-sm font-bold text-foreground">{formatBRL(faltam)}</p>
                </div>
                <div className="rounded-lg bg-background/60 p-2">
                  <p className="text-[9px] sm:text-[10px] text-muted-foreground uppercase">Ritmo/dia</p>
                  <p className="text-xs sm:text-sm font-bold text-foreground">
                    {diasRestantes > 0 ? formatBRL(ritmoDiario) : "—"}
                  </p>
                  <p className="text-[9px] text-muted-foreground">{diasRestantes}d restantes</p>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })()}

      {/* Ranking de apostas do dia */}
      <DailyBetsRanking />

      {/* ─── Copa do Mundo de Vendas DP 2026 ─── */}
      <CopaDPSummary />

      {/* ─── Hall dos Recordes ─── */}
      <HallOfRecords allRows={allRows} canEdit={canEditRecords} />

      {/* ─── Individual Broker Section ─── */}
      {myStats && !loading && (
        <Card className="border-primary/30 bg-primary/5 overflow-hidden">
          <CardContent className="p-4 sm:p-5">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
                <Users className="w-4 h-4 text-primary" />
              </div>
              <div>
                <h2 className="font-display text-sm sm:text-base font-bold text-foreground">
                  Meus Resultados — {userBrokerName}
                </h2>
                {userTeam && (
                  <span className="text-[10px] sm:text-xs text-muted-foreground">
                    Time {userTeam} · {myStats.rankPos > 0 ? `${myStats.rankPos}º de ${myStats.totalSellers}` : "—"}
                  </span>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="rounded-lg bg-background/60 p-3 space-y-1">
                <span className="text-[10px] sm:text-xs text-muted-foreground uppercase tracking-wider">Vendas Mês</span>
                <p className="text-base sm:text-xl font-bold text-foreground">{formatBRL(myStats.value)}</p>
                <div className="flex items-center gap-1">
                  <TrendIcon pct={myStats.valuePctChange} />
                  <span className={`text-[10px] font-medium ${trendColor(myStats.valuePctChange)}`}>
                    {myStats.valuePctChange >= 0 ? "+" : ""}{myStats.valuePctChange.toFixed(0)}% vs mês anterior
                  </span>
                </div>
              </div>

              <div className="rounded-lg bg-background/60 p-3 space-y-1">
                <span className="text-[10px] sm:text-xs text-muted-foreground uppercase tracking-wider">Contratos</span>
                <p className="text-base sm:text-xl font-bold text-foreground">{myStats.count}</p>
                <span className="text-[10px] text-muted-foreground">
                  Mês anterior: {myStats.prevCount}
                </span>
              </div>

              <div className="rounded-lg bg-background/60 p-3 space-y-1">
                <span className="text-[10px] sm:text-xs text-muted-foreground uppercase tracking-wider">Ticket Médio</span>
                <p className="text-base sm:text-xl font-bold text-foreground">{formatBRL(myStats.avgTicket)}</p>
              </div>

              <div className="rounded-lg bg-background/60 p-3 space-y-1">
                <span className="text-[10px] sm:text-xs text-muted-foreground uppercase tracking-wider">Hoje</span>
                <p className="text-base sm:text-xl font-bold text-foreground">{myStats.todayCount} vendas</p>
                {myStats.todayValue > 0 && (
                  <span className="text-[10px] text-primary font-medium">{formatBRL(myStats.todayValue)}</span>
                )}
              </div>
            </div>

            {myStats.rankPos > 0 && myStats.rankPos <= 3 && (
              <div className="mt-3 text-center">
                <span className="text-sm font-medium text-primary">
                  {myStats.rankPos === 1 ? "🥇 Você está em 1º lugar!" : myStats.rankPos === 2 ? "🥈 Você está em 2º lugar!" : "🥉 Você está em 3º lugar!"}
                </span>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="border-border/30">
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp className="w-4 h-4 text-primary" />
              <span className="text-[10px] sm:text-xs text-muted-foreground uppercase tracking-wider">Vendas Mês</span>
            </div>
            <p className="text-lg sm:text-2xl font-bold text-foreground">
              {loading ? "..." : formatBRL(totalVendas)}
            </p>
            {!loading && totalVendasPrevMonth > 0 && (
              <div className="flex items-center gap-1 mt-1">
                <TrendIcon pct={monthPctChange} />
                <span className={`text-[10px] font-medium ${trendColor(monthPctChange)}`}>
                  {monthPctChange >= 0 ? "+" : ""}{monthPctChange.toFixed(0)}% vs {MONTH_NAMES_SHORT[(currentMonth + 11) % 12]} (até dia {now.getDate()})
                </span>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-border/30">
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center gap-2 mb-1">
              <Target className="w-4 h-4 text-emerald-500" />
              <span className="text-[10px] sm:text-xs text-muted-foreground uppercase tracking-wider">Contratos</span>
            </div>
            <p className="text-lg sm:text-2xl font-bold text-foreground">
              {loading ? "..." : totalContratos}
            </p>
            {!loading && prevMonthRows.length > 0 && (
              <span className="text-[10px] text-muted-foreground block mt-1">
                {MONTH_NAMES_SHORT[(currentMonth + 11) % 12]} até dia {now.getDate()}: {prevMonthRows.length}
              </span>
            )}
          </CardContent>
        </Card>

        <Card className="border-border/30">
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center gap-2 mb-1">
              <Zap className="w-4 h-4 text-amber-500" />
              <span className="text-[10px] sm:text-xs text-muted-foreground uppercase tracking-wider">Vendas Hoje</span>
            </div>
            <p className="text-lg sm:text-2xl font-bold text-foreground">
              {loading ? "..." : formatBRL(todayValue)}
            </p>
            <span className="text-[10px] text-muted-foreground block mt-1">
              {loading ? "" : `${todayRows.length} ${todayRows.length === 1 ? "contrato" : "contratos"}`}
            </span>
            {!loading && prevSameDayValue > 0 && (() => {
              const pct = ((todayValue - prevSameDayValue) / prevSameDayValue) * 100;
              return (
                <div className="flex items-center gap-1 mt-1">
                  <TrendIcon pct={pct} />
                  <span className={`text-[10px] font-medium ${trendColor(pct)}`}>
                    {pct >= 0 ? "+" : ""}{pct.toFixed(0)}% vs {MONTH_NAMES_SHORT[(currentMonth + 11) % 12]} dia {now.getDate()}
                  </span>
                </div>
              );
            })()}
          </CardContent>
        </Card>

        <Card className="border-border/30">
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center gap-2 mb-1">
              <Users className="w-4 h-4 text-violet-500" />
              <span className="text-[10px] sm:text-xs text-muted-foreground uppercase tracking-wider">Times</span>
            </div>
            <p className="text-lg sm:text-2xl font-bold text-foreground">
              {teamRanking.length}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* ─── Vendas Diárias do Mês ─── */}
      {!loading && (
        <DailySalesChartCard
          rows={monthRows}
          selectedYear={currentYear}
          selectedMonth={currentMonth}
          monthLabel={`${MONTH_NAMES[currentMonth]} ${currentYear}`}
        />
      )}

      {/* Quick Links */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
        {quickLinks.map((link) => (
          <Button
            key={link.url}
            variant="outline"
            className="h-auto py-3 flex flex-col items-center gap-1.5 hover:bg-primary/5 hover:border-primary/30 transition-colors"
            onClick={() => navigate(link.url)}
          >
            <link.icon className="w-5 h-5 text-primary" />
            <span className="text-[10px] sm:text-xs font-medium">{link.label}</span>
          </Button>
        ))}
      </div>

      {/* ─── Quarter Analysis Section ─── */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <CalendarDays className="w-5 h-5 text-primary" />
          <h2 className="font-display text-base sm:text-lg font-bold text-foreground">
            Análise Trimestral — {QUARTER_LABELS[currentQuarter - 1]}
          </h2>
        </div>

        {/* Quarter KPIs */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Card className="border-border/30 bg-primary/5">
            <CardContent className="p-3 sm:p-4">
              <span className="text-[10px] sm:text-xs text-muted-foreground uppercase tracking-wider">Total Quarter</span>
              <p className="text-base sm:text-xl font-bold text-foreground mt-1">
                {loading ? "..." : formatBRL(quarterData.qTotal)}
              </p>
              <div className="flex items-center gap-1 mt-1">
                <TrendIcon pct={quarterData.pctChange} />
                <span className={`text-[10px] sm:text-xs font-medium ${trendColor(quarterData.pctChange)}`}>
                  {quarterData.pctChange >= 0 ? "+" : ""}{quarterData.pctChange.toFixed(1)}% vs Q{quarterData.prevQ} (mesmo período)
                </span>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/30">
            <CardContent className="p-3 sm:p-4">
              <span className="text-[10px] sm:text-xs text-muted-foreground uppercase tracking-wider">Contratos Quarter</span>
              <p className="text-base sm:text-xl font-bold text-foreground mt-1">
                {loading ? "..." : quarterData.qCount}
              </p>
              <div className="flex items-center gap-1 mt-1">
                <TrendIcon pct={quarterData.countChange} />
                <span className={`text-[10px] sm:text-xs font-medium ${trendColor(quarterData.countChange)}`}>
                  {quarterData.countChange >= 0 ? "+" : ""}{quarterData.countChange.toFixed(1)}%
                </span>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/30">
            <CardContent className="p-3 sm:p-4">
              <span className="text-[10px] sm:text-xs text-muted-foreground uppercase tracking-wider">Ticket Médio</span>
              <p className="text-base sm:text-xl font-bold text-foreground mt-1">
                {loading ? "..." : formatBRL(quarterData.avgTicket)}
              </p>
              <div className="flex items-center gap-1 mt-1">
                <TrendIcon pct={quarterData.ticketChange} />
                <span className={`text-[10px] sm:text-xs font-medium ${trendColor(quarterData.ticketChange)}`}>
                  {quarterData.ticketChange >= 0 ? "+" : ""}{quarterData.ticketChange.toFixed(1)}%
                </span>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/30">
            <CardContent className="p-3 sm:p-4">
              <span className="text-[10px] sm:text-xs text-muted-foreground uppercase tracking-wider">Destaques</span>
              <div className="mt-1 space-y-1">
                {quarterData.topTeam && (
                  <p className="text-[10px] sm:text-xs text-foreground">
                    🏆 <span className="font-medium">{quarterData.topTeam[0]}</span>
                  </p>
                )}
                {quarterData.topSeller && (
                  <p className="text-[10px] sm:text-xs text-foreground">
                    ⭐ <span className="font-medium">{quarterData.topSeller[0].split(" ")[0]}</span>
                    <span className="text-muted-foreground ml-1">{formatBRL(quarterData.topSeller[1])}</span>
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Monthly breakdown bar chart */}
        <Card className="border-border/30 overflow-hidden">
          <CardHeader className="pb-1">
            <CardTitle className="text-sm flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-primary" />
              Evolução Mensal no Quarter
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 sm:p-6">
            {loading ? (
              <p className="text-xs text-muted-foreground text-center py-4">Carregando...</p>
            ) : (
              <div className="space-y-4">
                {/* Grid lines background */}
                <div className="relative">
                  <div className="absolute inset-0 flex flex-col justify-between pointer-events-none">
                    {[...Array(4)].map((_, i) => (
                      <div key={i} className="border-t border-border/20 w-full" />
                    ))}
                  </div>

                  <div className="flex items-end gap-4 sm:gap-8 h-40 sm:h-52 relative">
                    {quarterData.monthlyBreakdown.map((m) => {
                      const maxVal = Math.max(...quarterData.monthlyBreakdown.map((x) => x.value), 1);
                      const heightPct = (m.value / maxVal) * 100;
                      return (
                        <div key={m.month} className="flex-1 flex flex-col items-center gap-2 group">
                          {/* Value label */}
                          <div className={`px-2 py-1 rounded-md text-[10px] sm:text-xs font-bold transition-all ${
                            m.isCurrent
                              ? "bg-primary text-primary-foreground shadow-lg shadow-primary/25"
                              : m.isFuture
                              ? "text-muted-foreground"
                              : "text-foreground"
                          }`}>
                            {m.value > 0 ? formatBRL(m.value) : "—"}
                          </div>

                          {/* Bar */}
                          <div className="w-full relative flex-1 flex items-end">
                            <div
                              className={`w-full rounded-xl transition-all duration-500 relative overflow-hidden ${
                                m.isCurrent
                                  ? "bg-gradient-to-t from-primary to-primary/70 shadow-lg shadow-primary/20"
                                  : m.isFuture
                                  ? "bg-muted/30 border-2 border-dashed border-border/50"
                                  : "bg-gradient-to-t from-primary/50 to-primary/25"
                              }`}
                              style={{ height: `${Math.max(heightPct, 6)}%` }}
                            >
                              {/* Shimmer effect for current month */}
                              {m.isCurrent && (
                                <div className="absolute inset-0 bg-gradient-to-t from-transparent via-white/10 to-transparent" />
                              )}
                            </div>
                          </div>

                          {/* Label */}
                          <div className="text-center space-y-0.5">
                            <div className={`text-xs sm:text-sm font-bold px-3 py-0.5 rounded-full ${
                              m.isCurrent
                                ? "bg-primary/10 text-primary"
                                : "text-muted-foreground"
                            }`}>
                              {m.label}
                            </div>
                            <p className="text-[10px] text-muted-foreground font-medium">
                              {m.count} {m.count === 1 ? "venda" : "vendas"}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Legend */}
                <div className="flex items-center justify-center gap-4 pt-1">
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded-sm bg-gradient-to-t from-primary/50 to-primary/25" />
                    <span className="text-[10px] text-muted-foreground">Concluído</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded-sm bg-gradient-to-t from-primary to-primary/70" />
                    <span className="text-[10px] text-muted-foreground">Mês Atual</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded-sm border-2 border-dashed border-border/50 bg-muted/30" />
                    <span className="text-[10px] text-muted-foreground">Futuro</span>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* YTD quarters comparison */}
        {allQuartersYTD.length > 1 && (
          <Card className="border-border/30 overflow-hidden">
            <CardHeader className="pb-1">
              <CardTitle className="text-sm flex items-center gap-2">
                <CalendarDays className="w-4 h-4 text-primary" />
                Comparativo Trimestral {currentYear}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 sm:p-6">
              <div className="space-y-4">
                {/* Grid lines */}
                <div className="relative">
                  <div className="absolute inset-0 flex flex-col justify-between pointer-events-none">
                    {[...Array(4)].map((_, i) => (
                      <div key={i} className="border-t border-border/20 w-full" />
                    ))}
                  </div>

                  <div className="flex items-end gap-5 sm:gap-8 h-36 sm:h-48 relative">
                    {allQuartersYTD.map((q, idx) => {
                      const maxVal = Math.max(...allQuartersYTD.map((x) => x.value), 1);
                      const heightPct = (q.value / maxVal) * 100;
                      const isActive = q.quarter === currentQuarter;
                      const prevQ = allQuartersYTD[idx - 1];
                      const growth = prevQ && prevQ.value > 0 ? ((q.value - prevQ.value) / prevQ.value) * 100 : null;

                      return (
                        <div key={q.quarter} className="flex-1 flex flex-col items-center gap-2">
                          {/* Value + growth badge */}
                          <div className="flex flex-col items-center gap-0.5">
                            <span className={`text-[10px] sm:text-xs font-bold ${isActive ? "text-primary" : "text-foreground"}`}>
                              {formatBRL(q.value)}
                            </span>
                            {growth !== null && (
                              <span className={`text-[9px] sm:text-[10px] font-medium flex items-center gap-0.5 px-1.5 py-0.5 rounded-full ${
                                growth > 0
                                  ? "bg-emerald-500/10 text-emerald-500"
                                  : growth < 0
                                  ? "bg-destructive/10 text-destructive"
                                  : "bg-muted text-muted-foreground"
                              }`}>
                                {growth > 0 ? <ArrowUpRight className="w-3 h-3" /> : growth < 0 ? <ArrowDownRight className="w-3 h-3" /> : null}
                                {growth >= 0 ? "+" : ""}{growth.toFixed(0)}%
                              </span>
                            )}
                          </div>

                          {/* Bar */}
                          <div className="w-full relative flex-1 flex items-end">
                            <div
                              className={`w-full rounded-xl transition-all duration-500 relative overflow-hidden ${
                                isActive
                                  ? "bg-gradient-to-t from-primary to-primary/60 shadow-lg shadow-primary/25"
                                  : "bg-gradient-to-t from-primary/35 to-primary/15 hover:from-primary/45 hover:to-primary/25 transition-colors"
                              }`}
                              style={{ height: `${Math.max(heightPct, 6)}%` }}
                            >
                              {isActive && (
                                <div className="absolute inset-0 bg-gradient-to-t from-transparent via-white/10 to-transparent" />
                              )}
                            </div>
                          </div>

                          {/* Label */}
                          <div className="text-center space-y-0.5">
                            <div className={`text-sm sm:text-base font-black px-3 py-0.5 rounded-full ${
                              isActive
                                ? "bg-primary text-primary-foreground shadow-md shadow-primary/25"
                                : "text-muted-foreground"
                            }`}>
                              {q.label}
                            </div>
                            <p className="text-[10px] text-muted-foreground font-medium">
                              {q.count} {q.count === 1 ? "venda" : "vendas"}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Summary footer */}
                <div className="flex items-center justify-between pt-2 border-t border-border/30">
                  <span className="text-[10px] sm:text-xs text-muted-foreground">
                    Total YTD: <span className="font-bold text-foreground">{formatBRL(ytdTotal)}</span>
                  </span>
                  <span className="text-[10px] sm:text-xs text-muted-foreground">
                    {ytdCount} vendas no ano
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Team Ranking */}
        <Card className="border-border/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Trophy className="w-4 h-4 text-amber-500" /> Ranking de Times
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3 sm:p-4 space-y-3">
            {loading ? (
              <p className="text-xs text-muted-foreground text-center py-4">Carregando...</p>
            ) : teamRanking.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-4">Sem dados no mês</p>
            ) : (
              teamRanking.map((team, i) => {
                const maxVal = teamRanking[0]?.value || 1;
                return (
                  <div key={team.name} className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs sm:text-sm font-medium text-foreground flex items-center gap-1.5">
                        {teamMedals[i] || `${i + 1}º`} {team.name}
                      </span>
                      <span className="text-[10px] sm:text-xs text-muted-foreground">
                        {team.count} vendas · {formatBRL(team.value)}
                      </span>
                    </div>
                    <Progress value={(team.value / maxVal) * 100} className="h-2" />
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>

        {/* Top Sellers */}
        <Card className="border-border/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-primary" /> Top Vendedores
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3 sm:p-4 space-y-2">
            {loading ? (
              <p className="text-xs text-muted-foreground text-center py-4">Carregando...</p>
            ) : topSellers.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-4">Sem dados no mês</p>
            ) : (
              topSellers.map((seller, i) => (
                <div
                  key={seller.name}
                  className="flex items-center justify-between p-2 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-muted-foreground w-5 text-center">
                      {teamMedals[i] || `${i + 1}º`}
                    </span>
                    <span className="text-xs sm:text-sm font-medium text-foreground">{seller.name}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-xs sm:text-sm font-bold text-primary">{formatBRL(seller.value)}</span>
                    <span className="text-[9px] sm:text-[10px] text-muted-foreground ml-1.5">{seller.count}x</span>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity */}
      <Card className="border-border/30">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm flex items-center gap-2">
              <Activity className="w-4 h-4 text-primary" /> Atividades Recentes
            </CardTitle>
            <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => navigate("/vendas")}>
              Ver todas <ChevronRight className="w-3.5 h-3.5 ml-0.5" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-3 sm:p-4 space-y-1.5">
          {loading ? (
            <p className="text-xs text-muted-foreground text-center py-4">Carregando...</p>
          ) : recentSales.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-4">Sem vendas recentes</p>
          ) : (
            recentSales.map((sale, i) => (
              <div
                key={i}
                className="flex items-center justify-between p-2 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-xs">✨</span>
                  <span className="text-xs sm:text-sm font-medium text-foreground truncate">
                    {normalizeName(sale.corretor || "Corretor")}
                  </span>
                  <span className="text-[10px] text-muted-foreground shrink-0">vendeu</span>
                  <span className="text-xs sm:text-sm font-bold text-primary shrink-0">
                    {formatBRL(sale.valor)}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  {sale.administradora && (
                    <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                      {sale.administradora}
                    </span>
                  )}
                  <span className="text-[9px] text-muted-foreground">{sale.dataVenda}</span>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {/* Health score — só gestor/admin (final da página) */}
      {(isAdmin || isGestor) && <CompanyHealthWidget />}

      {/* ─── Meta do mês por grupo (Sócios / Novos / Velhos) ─── */}
      <MetaPorGrupoSection />

      {/* ─── Cohort: mês da venda × parcelas pagas ─── */}
      <CohortParcelasSection />
    </div>
  );
}