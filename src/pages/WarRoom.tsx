import { useMemo, useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  ArrowLeft, Eye, RefreshCw, Users2, Target, Trophy,
  Zap, Calendar, MessageSquare, AlertTriangle, Flame,
  Timer, Tv, Award, TrendingUp, TrendingDown, Swords,
} from "lucide-react";
import { useGoogleSheetsData, SaleRow } from "@/hooks/useGoogleSheetsData";
import { normalizeName, BROKER_TEAMS, isLeadership } from "@/lib/seller-names";
import { usePiperunUsers, usePiperunActivities } from "@/hooks/usePiperunData";
import { useHubSpotOwners } from "@/hooks/useHubSpotData";
import { useCrmProspections } from "@/hooks/useCrmProspections";
import teamSwatLogo from "@/assets/team-swat.jpeg";
import teamClosersLogo from "@/assets/team-closers.jpeg";
import teamEfraimLogo from "@/assets/team-efraim.jpeg";

const TEAM_LOGOS: Record<string, string> = {
  "Swat": teamSwatLogo,
  "The Closers": teamClosersLogo,
  "Efraim": teamEfraimLogo,
};
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";


/* ─── helpers ─── */
function fmt(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
}
function parseBR(raw: string): Date | null {
  if (!raw) return null;
  const p = raw.split("/");
  if (p.length !== 3) return null;
  const [d, m, y] = p.map(Number);
  return new Date(y, m - 1, d);
}


/* ─── types ─── */
interface Seller {
  name: string;
  team: string;
  monthSales: number;
  monthValue: number;
  weekSales: number;
  dailyGoal: number;
  dailyValue: number;
  monthGoal: number;
  prospCount: number;
  prospTarget: number;
  reunCount: number;
  reunTarget: number;
  followCount: number;
  leadsReceived: number;
  leadsCreated: number;
  pct: number;
  isHubPartner: boolean;
  hasWarning: boolean;
  hasRedCard: boolean;
  rank: number;
  sources: string[];
  // new fields
  streak: number;
  lastSaleDate: string | null;
  avgTicket: number;
  weekValuePrev: number;
  weekSalesPrev: number;
}

interface TeamGroup {
  name: string;
  sellers: Seller[];
  avgPct: number;
  totalProsp: number;
  totalValue: number;
}

/* ─── constants ─── */
const PROSP_TARGET = 15;
const REUN_TARGET = 2;
const DAILY_SALES_TARGET = 2;
const WEEKLY_SALES_TARGET = 5;

/* ─── Confetti component ─── */
function Confetti({ active }: { active: boolean }) {
  if (!active) return null;
  return (
    <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
      {Array.from({ length: 40 }).map((_, i) => (
        <div
          key={i}
          className="absolute animate-confetti"
          style={{
            left: `${Math.random() * 100}%`,
            top: "-10px",
            animationDelay: `${Math.random() * 2}s`,
            animationDuration: `${2 + Math.random() * 2}s`,
          }}
        >
          <div
            className="w-2 h-2 rounded-sm"
            style={{
              backgroundColor: ["#f59e0b", "#10b981", "#3b82f6", "#f43f5e", "#8b5cf6", "#06b6d4"][i % 6],
              transform: `rotate(${Math.random() * 360}deg)`,
            }}
          />
        </div>
      ))}
    </div>
  );
}

export default function WarRoom() {
  const navigate = useNavigate();
  const now = new Date();
  const { allRows, loading: sheetsLoading, reload } = useGoogleSheetsData();
  const { data: piperunUsersData } = usePiperunUsers();
  const { data: piperunActivitiesData } = usePiperunActivities("200", true);
  const { data: hubspotOwnersData } = useHubSpotOwners();
  const { data: crmProspMap } = useCrmProspections();

  const [selectedTeam, setSelectedTeam] = useState<string | null>(null);
  const [tvMode, setTvMode] = useState(false);
  const [tvSection, setTvSection] = useState(0);
  const [showConfetti, setShowConfetti] = useState(false);
  const prevSalesCountRef = useRef<number | null>(null);

  const mesRef = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  const { data: generalGoalData } = useQuery({
    queryKey: ["sales-goals-general", mesRef],
    queryFn: async () => {
      const { data } = await supabase
        .from("sales_goals")
        .select("meta")
        .eq("mes_ref", mesRef)
        .maybeSingle();
      return data?.meta ? Number(data.meta) : 0;
    },
    staleTime: 60_000,
  });

  const { data: individualGoalsData } = useQuery({
    queryKey: ["sales-goals-byname", mesRef],
    queryFn: async () => {
      const { data } = await supabase
        .from("sales_goals_byname")
        .select("broker_name, meta")
        .eq("mes_ref", mesRef);
      const map: Record<string, number> = {};
      (data || []).forEach((d: any) => {
        // Normalize broker_name so it matches canonical seller names
        const canonical = normalizeName(d.broker_name);
        map[canonical] = Number(d.meta);
      });
      return map;
    },
    staleTime: 60_000,
  });

  const generalGoal = generalGoalData ?? 0;
  const individualGoals = individualGoalsData ?? {};

  // Auto-refresh every 60s in TV mode
  useEffect(() => {
    if (!tvMode) return;
    const interval = setInterval(() => {
      reload?.();
    }, 60_000);
    return () => clearInterval(interval);
  }, [tvMode, reload]);

  // TV section rotation
  const TV_SECTIONS = ["ranking", "desafio", "feed"];
  useEffect(() => {
    if (!tvMode) return;
    const interval = setInterval(() => {
      setTvSection((prev) => (prev + 1) % TV_SECTIONS.length);
    }, 15_000);
    return () => clearInterval(interval);
  }, [tvMode]);

  const { sellers, teams } = useMemo(() => {
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    const today = new Date(currentYear, now.getMonth(), now.getDate());
    const dayOfWeek = today.getDay();
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() + mondayOffset);
    const prevWeekStart = new Date(weekStart);
    prevWeekStart.setDate(prevWeekStart.getDate() - 7);
    const prevWeekEnd = new Date(weekStart);
    prevWeekEnd.setDate(prevWeekEnd.getDate() - 1);

    const TEAM_OVERRIDES = BROKER_TEAMS;

    // ── Build Piperun user ID → name map ──
    const piperunIdToName = new Map<number, string>();
    const piperunUsers = piperunUsersData?.data || piperunUsersData?.items || [];
    if (Array.isArray(piperunUsers)) {
      piperunUsers.forEach((u: any) => {
        const raw = (u.name || u.nome || "").trim();
        if (!raw || isLeadership(raw)) return;
        piperunIdToName.set(u.id, normalizeName(raw));
      });
    }

    // ── Count Piperun activities per seller (current month) ──
    const piperunProspMap = new Map<string, number>();
    const piperunReunMap = new Map<string, number>();
    const piperunFollowMap = new Map<string, number>();
    const piperunActivities = piperunActivitiesData?.data || [];
    if (Array.isArray(piperunActivities)) {
      piperunActivities.forEach((act: any) => {
        const startAt = act.start_at || act.created_at || "";
        const actDate = new Date(startAt.replace(" ", "T"));
        if (actDate.getFullYear() !== currentYear || actDate.getMonth() !== currentMonth) return;

        const sellerName = piperunIdToName.get(act.owner_id);
        if (!sellerName) return;

        const actType = act.type;
        if (actType === 3) {
          piperunReunMap.set(sellerName, (piperunReunMap.get(sellerName) || 0) + 1);
        } else if (actType === 1 || actType === 2) {
          piperunProspMap.set(sellerName, (piperunProspMap.get(sellerName) || 0) + 1);
        } else {
          piperunFollowMap.set(sellerName, (piperunFollowMap.get(sellerName) || 0) + 1);
        }
      });
    }

    // ── Build HubSpot owner ID → name map ──
    const hubspotOwnerToName = new Map<string, string>();
    const hubspotOwners = hubspotOwnersData?.results || hubspotOwnersData?.data || [];
    if (Array.isArray(hubspotOwners)) {
      hubspotOwners.forEach((o: any) => {
        const name = [o.firstName, o.lastName].filter(Boolean).join(" ").trim();
        if (name && !isLeadership(name)) {
          hubspotOwnerToName.set(String(o.id), normalizeName(name));
        }
      });
    }

    // ── CRM Prospections from synced table (replaces limited API calls) ──
    // crmProspMap is already available from the hook

    const sellerTeamMap = new Map<string, string>();
    const sellerSources = new Map<string, Set<string>>();

    allRows.forEach((r) => {
      if (!r.corretor?.trim() || isLeadership(r.corretor)) return;
      if (r.source !== "atual") return;
      const name = normalizeName(r.corretor);
      if (!sellerTeamMap.has(name)) {
        sellerTeamMap.set(name, r.time?.trim() || "Sem Time");
      }
      if (!sellerSources.has(name)) sellerSources.set(name, new Set());
      sellerSources.get(name)!.add("sheets");
    });

    if (Array.isArray(piperunUsers)) {
      piperunUsers.forEach((u: any) => {
        const raw = (u.name || u.nome || "").trim();
        if (!raw || isLeadership(raw)) return;
        if (u.active === 0) return;
        const name = normalizeName(raw);
        if (!sellerTeamMap.has(name)) {
          sellerTeamMap.set(name, "Piperun");
        }
        if (!sellerSources.has(name)) sellerSources.set(name, new Set());
        sellerSources.get(name)!.add("piperun");
      });
    }

    if (Array.isArray(hubspotOwners)) {
      hubspotOwners.forEach((o: any) => {
        const raw = [o.firstName, o.lastName].filter(Boolean).join(" ").trim();
        if (!raw || isLeadership(raw)) return;
        const name = normalizeName(raw);
        if (!sellerSources.has(name)) sellerSources.set(name, new Set());
        sellerSources.get(name)!.add("hubspot");
      });
    }

    for (const [name, team] of Object.entries(TEAM_OVERRIDES)) {
      sellerTeamMap.set(name, team);
      if (!sellerSources.has(name)) sellerSources.set(name, new Set());
      sellerSources.get(name)!.add("override");
    }

    // Include all sellers that have individual goals (even if zero sales)
    Object.keys(individualGoals).forEach((upperName) => {
      const name = normalizeName(upperName);
      if (isLeadership(name)) return;
      if (!sellerTeamMap.has(name)) {
        sellerTeamMap.set(name, "Sem Time");
      }
      if (!sellerSources.has(name)) sellerSources.set(name, new Set());
      sellerSources.get(name)!.add("goal");
    });

    const nameMap = new Map<string, { team: string; rows: SaleRow[] }>();
    sellerTeamMap.forEach((team, name) => {
      nameMap.set(name, { team, rows: [] });
    });

    allRows.forEach((r) => {
      if (!r.corretor?.trim() || isLeadership(r.corretor)) return;
      const name = normalizeName(r.corretor);
      if (nameMap.has(name)) {
        nameMap.get(name)!.rows.push(r);
      }
    });

    const allSellers: Seller[] = [];

    nameMap.forEach((data, name) => {
      const monthRows = data.rows.filter((r) => {
        const d = parseBR(r.dataVenda);
        return d && d.getFullYear() === currentYear && d.getMonth() === currentMonth;
      });
      const monthValue = monthRows.reduce((s, r) => s + r.valor, 0);

      const todayRows = monthRows.filter((r) => {
        const d = parseBR(r.dataVenda);
        return d && d.toDateString() === today.toDateString();
      });
      const dailyValue = todayRows.reduce((s, r) => s + r.valor, 0);

      const weekRows = data.rows.filter((r) => {
        const d = parseBR(r.dataVenda);
        return d && d >= weekStart && d <= today;
      });

      // Previous week data
      const prevWeekRows = data.rows.filter((r) => {
        const d = parseBR(r.dataVenda);
        return d && d >= prevWeekStart && d <= prevWeekEnd;
      });
      const weekValuePrev = prevWeekRows.reduce((s, r) => s + r.valor, 0);

      const dailyGoal = monthValue > 0 ? monthValue / Math.max(todayRows.length, 1) : 0;

      const sources = sellerSources.get(name) || new Set();
      const hasRealData = sources.has("sheets") || sources.has("piperun") || sources.has("hubspot");
      const hasWarning = hasRealData && monthRows.length === 0;
      const hasRedCard = hasRealData && monthRows.length === 0 && weekRows.length === 0;

      const isHubPartner = monthRows.some(
        (r) => r.origemVenda?.toLowerCase().includes("hub") || r.canalVenda?.toLowerCase().includes("hub")
      );

      const individualMeta = individualGoals[name];
      const monthGoal = individualMeta && individualMeta > 0 ? individualMeta : generalGoal;

      const crmData = crmProspMap?.get(name);
      const totalProsp = crmData?.total || 0;
      const prospFromPiperun = piperunProspMap.get(name) || 0;
      const reunFromPiperun = piperunReunMap.get(name) || 0;
      const followFromPiperun = piperunFollowMap.get(name) || 0;
      const leadsReceived = crmData?.open || 0;
      const leadsCreated = totalProsp;

      // Calculate streak (consecutive days with sales in this month)
      const saleDates = monthRows
        .map((r) => parseBR(r.dataVenda))
        .filter((d): d is Date => d !== null)
        .map((d) => d.toDateString());
      const uniqueDates = [...new Set(saleDates)].sort((a, b) => new Date(b).getTime() - new Date(a).getTime());
      
      let streak = 0;
      if (uniqueDates.length > 0) {
        let checkDate = new Date(today);
        // If no sale today, start from yesterday
        if (!uniqueDates.includes(today.toDateString())) {
          checkDate.setDate(checkDate.getDate() - 1);
        }
        while (uniqueDates.includes(checkDate.toDateString())) {
          streak++;
          checkDate.setDate(checkDate.getDate() - 1);
        }
      }

      const lastSaleDate = uniqueDates.length > 0 ? uniqueDates[0] : null;
      const avgTicket = monthRows.length > 0 ? monthValue / monthRows.length : 0;

      allSellers.push({
        name,
        team: data.team,
        monthSales: monthRows.length,
        monthValue,
        weekSales: weekRows.length,
        dailyGoal: dailyGoal || 105263.16,
        dailyValue,
        monthGoal,
        prospCount: totalProsp,
        prospTarget: PROSP_TARGET,
        reunCount: reunFromPiperun,
        reunTarget: REUN_TARGET,
        followCount: followFromPiperun,
        leadsReceived: leadsReceived,
        leadsCreated: leadsCreated,
        pct: 0,
        isHubPartner,
        hasWarning,
        hasRedCard,
        rank: 0,
        sources: [...(sources)],
        streak,
        lastSaleDate,
        avgTicket,
        weekValuePrev,
        weekSalesPrev: prevWeekRows.length,
      });
    });

    const topValue = Math.max(...allSellers.map((s) => s.monthValue), 1);
    allSellers.forEach((s) => {
      s.pct = Math.round((s.monthValue / topValue) * 100);
    });

    allSellers.sort((a, b) => b.monthValue - a.monthValue);
    allSellers.forEach((s, i) => (s.rank = i + 1));

    const teamMap = new Map<string, Seller[]>();
    allSellers.forEach((s) => {
      if (!teamMap.has(s.team)) teamMap.set(s.team, []);
      teamMap.get(s.team)!.push(s);
    });

    const teams: TeamGroup[] = [...teamMap.entries()].map(([name, sellers]) => ({
      name,
      sellers: sellers.sort((a, b) => {
        // Zero-sales sellers go to end within each team
        if (a.monthValue === 0 && b.monthValue > 0) return 1;
        if (b.monthValue === 0 && a.monthValue > 0) return -1;
        return a.rank - b.rank;
      }),
      avgPct: Math.round(sellers.reduce((s, x) => s + x.pct, 0) / sellers.length),
      totalProsp: sellers.reduce((s, x) => s + x.prospCount, 0),
      totalValue: sellers.reduce((s, x) => s + x.monthValue, 0),
    }));

    teams.sort((a, b) => b.avgPct - a.avgPct);

    return { sellers: allSellers, teams };
  }, [allRows, piperunUsersData, piperunActivitiesData, hubspotOwnersData, crmProspMap, generalGoal, individualGoals]);

  // Confetti on new sale detection
  useEffect(() => {
    const totalSales = sellers.reduce((s, x) => s + x.monthSales, 0);
    if (prevSalesCountRef.current !== null && totalSales > prevSalesCountRef.current) {
      setShowConfetti(true);
      setTimeout(() => setShowConfetti(false), 4000);
    }
    prevSalesCountRef.current = totalSales;
  }, [sellers]);

  const totalJogadores = sellers.length;
  const mediaGeral = sellers.length ? Math.round(sellers.reduce((s, x) => s + x.pct, 0) / sellers.length) : 0;
  const above80 = sellers.filter((s) => s.pct >= 80).length;
  const top3 = sellers.slice(0, 3);

  const filteredTeams = selectedTeam ? teams.filter((t) => t.name === selectedTeam) : teams;
  const filteredSellers = selectedTeam ? sellers.filter((s) => s.team === selectedTeam) : sellers;
  const totalProsp = filteredSellers.reduce((s, x) => s + x.prospCount, 0);
  const totalProspTarget = filteredSellers.length * PROSP_TARGET;
  const totalReun = filteredSellers.reduce((s, x) => s + x.reunCount, 0);
  const totalReunTarget = filteredSellers.length * REUN_TARGET;
  const totalVendas = filteredSellers.reduce((s, x) => s + x.monthSales, 0);

  const currentTime = now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

  // Countdown de meta
  const totalMonthValue = sellers.reduce((s, x) => s + x.monthValue, 0);
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const daysRemaining = daysInMonth - now.getDate();
  const metaGeral = generalGoal;
  const faltaMeta = Math.max(metaGeral - totalMonthValue, 0);
  const dailyNeeded = daysRemaining > 0 ? faltaMeta / daysRemaining : faltaMeta;
  const daysPassed = now.getDate();
  const dailyAvgSoFar = daysPassed > 0 ? totalMonthValue / daysPassed : 0;
  const projectedTotal = dailyAvgSoFar * daysInMonth;
  const willHitGoal = metaGeral > 0 && projectedTotal >= metaGeral;

  // Team challenge: top 2 teams by size
  const challengeTeams = teams.filter(t => ["Swat", "The Closers", "Efraim"].includes(t.name)).slice(0, 3);

  // Recent sales feed (today)
  const recentSales = useMemo(() => {
    const today = new Date();
    return allRows
      .filter((r) => {
        if (!r.corretor?.trim() || isLeadership(r.corretor)) return false;
        const d = parseBR(r.dataVenda);
        return d && d.toDateString() === today.toDateString();
      })
      .sort((a, b) => {
        const da = parseBR(a.dataVenda)?.getTime() || 0;
        const db = parseBR(b.dataVenda)?.getTime() || 0;
        return db - da;
      })
      .slice(0, 10);
  }, [allRows]);

  // Cadência metrics
  const totalAvgTicket = sellers.length > 0 
    ? sellers.filter(s => s.avgTicket > 0).reduce((s, x) => s + x.avgTicket, 0) / Math.max(sellers.filter(s => s.avgTicket > 0).length, 1) 
    : 0;
  const totalConversion = totalProsp > 0 ? Math.round((totalVendas / totalProsp) * 100) : 0;

  // Badges
  const bestStreak = sellers.reduce((best, s) => s.streak > best.streak ? s : best, sellers[0]);
  const biggestTicket = sellers.reduce((best, s) => s.avgTicket > best.avgTicket ? s : best, sellers[0]);
  const mostSales = sellers[0]; // already sorted

  return (
    <TooltipProvider delayDuration={200}>
    <Confetti active={showConfetti} />
    <div className={`mx-auto px-3 py-4 space-y-4 pb-20 ${tvMode ? "max-w-4xl" : "max-w-2xl"}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Eye className="w-5 h-5 text-red-500" />
          <h1 className={`font-black tracking-tight text-foreground ${tvMode ? "text-2xl" : "text-lg"}`}>
            WAR ROOM <span className="text-muted-foreground font-normal text-sm">TV</span>
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={tvMode ? "default" : "outline"}
            size="sm"
            className="h-7 text-xs gap-1"
            onClick={() => setTvMode(!tvMode)}
          >
            <Tv className="w-3.5 h-3.5" />
            {tvMode ? "Sair TV" : "Modo TV"}
          </Button>
          <Badge className="bg-emerald-600 text-white border-0 text-xs gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse inline-block" />
            {currentTime}
          </Badge>
          <Button variant="ghost" size="icon" className="w-8 h-8" onClick={() => reload?.()}>
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Stats bar */}
      <div className="flex items-center gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <Users2 className="w-3.5 h-3.5" />
          <strong className="text-foreground text-sm">{totalJogadores}</strong> jog.
        </span>
        <span className="flex items-center gap-1">
          <Target className="w-3.5 h-3.5" />
          <strong className="text-foreground text-sm">{mediaGeral}%</strong> média
        </span>
        <span className="flex items-center gap-1">
          <Trophy className="w-3.5 h-3.5" />
          <strong className="text-foreground text-sm">{above80}</strong> 80%+
        </span>
        {tvMode && (
          <Badge variant="outline" className="ml-auto text-[10px] gap-1 animate-pulse border-primary/50">
            <Tv className="w-3 h-3" /> Auto-refresh 60s
          </Badge>
        )}
        {!tvMode && <span className="ml-auto text-foreground">{currentTime}</span>}
      </div>

      {/* ═══ COUNTDOWN DE META GERAL ═══ */}
      {metaGeral > 0 && (
        <div className="rounded-xl border border-border/30 bg-card p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold flex items-center gap-2">
              <Timer className="w-4 h-4 text-orange-400" /> COUNTDOWN DE META
            </h2>
            <Badge className={`text-[10px] border-0 ${willHitGoal ? "bg-emerald-600/20 text-emerald-400" : "bg-red-600/20 text-red-400"}`}>
              {willHitGoal ? "✅ Vai bater!" : "❌ Ritmo insuficiente"}
            </Badge>
          </div>
          <div className="grid grid-cols-3 gap-3 text-center">
            <div>
              <p className="text-[10px] text-muted-foreground uppercase">Faltam</p>
              <p className="text-lg font-black text-foreground">{fmt(faltaMeta)}</p>
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground uppercase">Dias restantes</p>
              <p className="text-lg font-black text-orange-400">{daysRemaining}</p>
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground uppercase">R$/dia necessário</p>
              <p className="text-lg font-black text-foreground">{fmt(dailyNeeded)}</p>
            </div>
          </div>
          <div className="flex items-center justify-between text-[10px] text-muted-foreground">
            <span>Ritmo atual: {fmt(dailyAvgSoFar)}/dia</span>
            <span>Projeção: {fmt(projectedTotal)} de {fmt(metaGeral)}</span>
          </div>
          <div className="h-2 rounded-full bg-border/40 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${
                totalMonthValue >= metaGeral ? "bg-emerald-500" : totalMonthValue >= metaGeral * 0.6 ? "bg-amber-400" : "bg-red-400"
              }`}
              style={{ width: `${Math.min((totalMonthValue / metaGeral) * 100, 100)}%` }}
            />
          </div>
        </div>
      )}

      {/* Teams horizontal tabs */}
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-3 px-3 scrollbar-hide">
        <span className="text-[10px] text-muted-foreground uppercase self-center mr-1 shrink-0">TIMES:</span>
        {teams.map((t) => (
          <button
            key={t.name}
            onClick={() => setSelectedTeam(selectedTeam === t.name ? null : t.name)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs whitespace-nowrap border transition-colors shrink-0 ${
              selectedTeam === t.name
                ? "bg-primary/20 border-primary text-primary"
                : "bg-card border-border/40 text-muted-foreground hover:border-border"
            }`}
          >
            {TEAM_LOGOS[t.name] ? (
              <img src={TEAM_LOGOS[t.name]} alt={t.name} className="w-5 h-5 rounded-full object-cover" />
            ) : (
              <Users2 className="w-3 h-3" />
            )}
            {t.name}
            <strong className={t.avgPct > 0 ? "text-amber-400" : "text-muted-foreground"}>
              {t.avgPct}%
            </strong>
            <span className="text-muted-foreground">({t.sellers.length})</span>
          </button>
        ))}
      </div>

      {/* ═══ DESAFIO TIME VS TIME ═══ */}
      {challengeTeams.length >= 2 && (!tvMode || tvSection === 1) && (
        <div className="rounded-xl border border-border/30 bg-card p-4 space-y-3">
          <h2 className="text-sm font-bold flex items-center gap-2">
            <Swords className="w-4 h-4 text-purple-400" /> DESAFIO ENTRE TIMES
          </h2>
          <div className="space-y-3">
            {challengeTeams.map((team, idx) => {
              const maxValue = Math.max(...challengeTeams.map(t => t.totalValue), 1);
              const pct = Math.round((team.totalValue / maxValue) * 100);
              const isLeading = idx === 0;
              return (
                <div key={team.name} className="space-y-1">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {TEAM_LOGOS[team.name] ? (
                        <img src={TEAM_LOGOS[team.name]} alt={team.name} className="w-6 h-6 rounded-full object-cover" />
                      ) : (
                        <Users2 className="w-4 h-4" />
                      )}
                      <span className={`text-sm font-semibold ${isLeading ? "text-amber-400" : "text-foreground"}`}>
                        {isLeading && "👑 "}{team.name}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-sm font-bold">{fmt(team.totalValue)}</span>
                      <span className="text-[10px] text-muted-foreground ml-1">
                        ({team.sellers.reduce((s, x) => s + x.monthSales, 0)} vendas)
                      </span>
                    </div>
                  </div>
                  <div className="h-3 rounded-full bg-border/40 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        isLeading ? "bg-gradient-to-r from-amber-500 to-amber-400" : idx === 1 ? "bg-blue-500" : "bg-purple-500"
                      }`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ═══ FEED DE VITÓRIAS AO VIVO ═══ */}
      {(!tvMode || tvSection === 2) && recentSales.length > 0 && (
        <div className="rounded-xl border border-border/30 bg-card p-4 space-y-3">
          <h2 className="text-sm font-bold flex items-center gap-2">
            🎉 VENDAS DE HOJE
            <Badge className="bg-emerald-600/20 text-emerald-400 border-0 text-[10px]">
              {recentSales.length} vendas
            </Badge>
          </h2>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {recentSales.map((sale, i) => (
              <div key={i} className="flex items-center gap-3 p-2 rounded-lg bg-muted/30 animate-fade-in">
                <span className="text-lg">🎯</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate">
                    {normalizeName(sale.corretor || "")}
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    {sale.administradora} · {sale.origemVenda || sale.canalVenda || "Direto"}
                  </p>
                </div>
                <span className="text-sm font-bold text-emerald-400 shrink-0">{fmt(sale.valor)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ═══ MÉTRICAS DE CADÊNCIA ═══ */}
      <div className="rounded-xl border border-border/30 bg-card p-4 space-y-3">
        <h2 className="text-sm font-bold flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-blue-400" /> MÉTRICAS DE CADÊNCIA
        </h2>
        <div className="grid grid-cols-4 gap-3 text-center">
          <div>
            <p className="text-[9px] text-muted-foreground uppercase">Prospecções</p>
            <p className="text-lg font-black text-blue-400">{totalProsp}</p>
            <p className="text-[9px] text-muted-foreground">meta: {totalProspTarget}</p>
          </div>
          <div>
            <p className="text-[9px] text-muted-foreground uppercase">Conversão</p>
            <p className="text-lg font-black text-emerald-400">{totalConversion}%</p>
            <p className="text-[9px] text-muted-foreground">prosp→venda</p>
          </div>
          <div>
            <p className="text-[9px] text-muted-foreground uppercase">Ticket Médio</p>
            <p className="text-lg font-black text-amber-400">{fmt(totalAvgTicket)}</p>
            <p className="text-[9px] text-muted-foreground">por venda</p>
          </div>
          <div>
            <p className="text-[9px] text-muted-foreground uppercase">Reuniões</p>
            <p className="text-lg font-black text-purple-400">{totalReun}</p>
            <p className="text-[9px] text-muted-foreground">meta: {totalReunTarget}</p>
          </div>
        </div>
      </div>

      {/* ═══ STREAK & BADGES ═══ */}
      {sellers.length > 0 && bestStreak && (
        <div className="rounded-xl border border-border/30 bg-card p-4 space-y-3">
          <h2 className="text-sm font-bold flex items-center gap-2">
            <Award className="w-4 h-4 text-amber-400" /> DESTAQUES & CONQUISTAS
          </h2>
          <div className="grid grid-cols-3 gap-3">
            {mostSales && (
              <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-center">
                <span className="text-2xl">🏆</span>
                <p className="text-[10px] text-muted-foreground mt-1">Líder do mês</p>
                <p className="text-sm font-bold text-foreground truncate">{mostSales.name.split(" ")[0]}</p>
                <p className="text-[10px] text-amber-400">{mostSales.monthSales} vendas</p>
              </div>
            )}
            {bestStreak && bestStreak.streak > 0 && (
              <div className="rounded-lg border border-orange-500/30 bg-orange-500/5 p-3 text-center">
                <span className="text-2xl">🔥</span>
                <p className="text-[10px] text-muted-foreground mt-1">Maior streak</p>
                <p className="text-sm font-bold text-foreground truncate">{bestStreak.name.split(" ")[0]}</p>
                <p className="text-[10px] text-orange-400">{bestStreak.streak} dias seguidos</p>
              </div>
            )}
            {biggestTicket && biggestTicket.avgTicket > 0 && (
              <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3 text-center">
                <span className="text-2xl">💎</span>
                <p className="text-[10px] text-muted-foreground mt-1">Maior ticket</p>
                <p className="text-sm font-bold text-foreground truncate">{biggestTicket.name.split(" ")[0]}</p>
                <p className="text-[10px] text-emerald-400">{fmt(biggestTicket.avgTicket)}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Pódio do Dia */}
      {!selectedTeam && top3.length >= 3 && (!tvMode || tvSection === 0) && (
        <div className="rounded-xl border border-border/30 bg-card p-4 space-y-3">
          <h2 className="text-sm font-bold flex items-center gap-2">
            <Trophy className="w-4 h-4 text-amber-400" /> PÓDIO DO DIA
          </h2>

          {/* 1st place */}
          <div className="rounded-lg border-2 border-amber-500/40 bg-gradient-to-br from-amber-500/10 to-transparent p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-2xl">🥇</span>
              <div>
                <p className="font-bold text-foreground">{top3[0].name.split(" ")[0]}</p>
                <p className="text-[10px] text-muted-foreground">
                  {top3[0].monthSales} vendas · {fmt(top3[0].monthValue)}
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-2xl font-black text-amber-400">{top3[0].pct}%</p>
              <p className="text-[10px] text-muted-foreground">
                {top3[0].prospCount} prosp. • {top3[0].reunCount} reun.
              </p>
            </div>
          </div>

          {/* 2nd & 3rd */}
          <div className="grid grid-cols-2 gap-3">
            {[top3[1], top3[2]].map((s, i) => (
              <div key={s.name} className="rounded-lg border border-border/40 bg-card p-3 text-center">
                <span className="text-lg">{i === 0 ? "🥈" : "🥉"}</span>
                <p className="font-bold text-sm mt-1">{s.name.split(" ")[0]}</p>
                <p className="text-xl font-black text-foreground">{s.pct}%</p>
                <p className="text-[9px] text-muted-foreground">
                  {s.prospCount} prosp. • {s.reunCount} reun.
                </p>
                <p className="text-[9px] text-muted-foreground mt-0.5">
                  {s.monthSales} vendas · {fmt(s.monthValue)}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Atividades do Time */}
      <div className="rounded-xl border border-border/30 bg-card p-4 space-y-3">
        <h2 className="text-sm font-bold uppercase">Atividades do Time</h2>

        <ActivityRow icon={<Zap className="w-4 h-4 text-blue-400" />} label="Prospecções" value={totalProsp} target={totalProspTarget} />
        <ActivityRow icon={<Calendar className="w-4 h-4 text-purple-400" />} label="Reuniões" value={totalReun} target={totalReunTarget} />
        <ActivityRow icon={<Target className="w-4 h-4 text-emerald-400" />} label="Vendas" value={totalVendas} target={0} />
      </div>

      {/* Ranking por Times */}
      <div className="rounded-xl border border-border/30 bg-card p-4 space-y-4">
        <h2 className="text-sm font-bold flex items-center gap-2">
          <Trophy className="w-4 h-4" /> RANKING POR TIMES
          <span className="text-muted-foreground font-normal text-xs ml-1">{totalJogadores} jogadores</span>
        </h2>

        {filteredTeams.map((team) => (
          <div key={team.name} className="space-y-3">
            {/* Team header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {TEAM_LOGOS[team.name] ? (
                  <img src={TEAM_LOGOS[team.name]} alt={team.name} className="w-6 h-6 rounded-full object-cover" />
                ) : (
                  <Users2 className="w-4 h-4 text-muted-foreground" />
                )}
                <span className="font-semibold text-sm">{team.name}</span>
                <span className="text-xs text-muted-foreground">({team.sellers.length})</span>
              </div>
              <div className="flex gap-3 text-xs">
                <span className="text-amber-400 font-semibold">{team.avgPct}% avg</span>
                <span className="text-muted-foreground">{team.totalProsp} prosp.</span>
              </div>
            </div>

            {/* Seller cards */}
            {team.sellers.map((s) => (
              <SellerCard key={s.name} seller={s} onClick={() => navigate(`/meu-painel?name=${encodeURIComponent(s.name)}`)} daysRemaining={daysRemaining} />
            ))}
          </div>
        ))}
      </div>

      {sheetsLoading && sellers.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-8">Carregando vendedores...</p>
      )}
    </div>
    </TooltipProvider>
  );
}

/* ─── Sub-components ─── */

function ActivityRow({ icon, label, value, target }: { icon: React.ReactNode; label: string; value: number; target: number }) {
  const pct = target > 0 ? Math.min((value / target) * 100, 100) : 0;
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-2 text-sm text-muted-foreground">
          {icon} {label}
        </span>
        <span className="text-sm font-bold text-foreground">
          {target > 0 ? <>{value}<span className="text-muted-foreground font-normal">/{target}</span></> : value}
        </span>
      </div>
      <div className="h-1 rounded-full bg-border/40 overflow-hidden">
        <div
          className="h-full rounded-full bg-blue-500 transition-all"
          style={{ width: `${target > 0 ? pct : 0}%` }}
        />
      </div>
    </div>
  );
}

function CircularGauge({ pct, size = 44 }: { pct: number; size?: number }) {
  const r = (size - 6) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (pct / 100) * circ;
  const color = pct >= 80 ? "stroke-emerald-500" : pct >= 40 ? "stroke-amber-400" : pct > 0 ? "stroke-orange-500" : "stroke-muted-foreground/30";

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="currentColor" strokeWidth={3} className="text-border/30" />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={3}
          className={color}
          strokeDasharray={circ}
          strokeDashoffset={offset}
          strokeLinecap="round"
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-foreground">
        {pct}%
      </span>
    </div>
  );
}

function MiniProgress({ value, target, color = "bg-blue-500" }: { value: number; target: number; color?: string }) {
  const pct = target > 0 ? Math.min((value / target) * 100, 100) : 0;
  return (
    <div className="space-y-0.5">
      <span className={`text-xs font-bold ${value > 0 ? "text-blue-400" : "text-muted-foreground"}`}>
        {value}/{target}
      </span>
      <div className="h-0.5 rounded-full bg-border/40 w-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function SellerCard({ seller: s, onClick, daysRemaining }: { 
  seller: Seller; 
  onClick: () => void;
  daysRemaining: number;
}) {
  const goalPct = s.monthGoal > 0 ? Math.min(Math.round((s.monthValue / s.monthGoal) * 100), 100) : 0;
  const falta = s.monthGoal > 0 ? Math.max(s.monthGoal - s.monthValue, 0) : 0;
  const dailyNeeded = daysRemaining > 0 && falta > 0 ? falta / daysRemaining : 0;

  // Week comparison
  const weekChange = s.weekSalesPrev > 0 
    ? Math.round(((s.weekSales - s.weekSalesPrev) / s.weekSalesPrev) * 100)
    : s.weekSales > 0 ? 100 : 0;

  return (
    <div
      onClick={onClick}
      className={`rounded-lg border p-3 space-y-2 cursor-pointer transition-colors ${
        s.hasRedCard
          ? "border-red-500/50 bg-red-950/20 hover:border-red-400/60"
          : s.hasWarning
            ? "border-amber-500/40 bg-amber-950/10 hover:border-amber-400/50"
            : "border-border/30 bg-background/50 hover:border-primary/30"
      }`}
    >
      {/* Top row: rank + name + badges + gauge */}
      <div className="flex items-center gap-3">
        <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${
          s.rank <= 3 ? "bg-amber-500/20 text-amber-400 border border-amber-500/40" : "bg-muted/50 text-muted-foreground border border-border/30"
        }`}>
          {s.rank}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="font-semibold text-sm text-foreground truncate">{s.name}</span>
            {s.streak > 0 && (
              <Tooltip><TooltipTrigger asChild>
                <span className="text-xs cursor-help">🔥{s.streak}</span>
              </TooltipTrigger><TooltipContent side="bottom" className="text-xs">{s.streak} dias seguidos com venda</TooltipContent></Tooltip>
            )}
            {s.isHubPartner && (
              <Badge className="bg-emerald-600/20 text-emerald-400 border-emerald-600/30 text-[9px] px-1 py-0">HUB</Badge>
            )}
            {s.sources.includes("sheets") && (
              <Badge className="bg-green-600/20 text-green-400 border-green-600/30 text-[8px] px-1 py-0">Sheets</Badge>
            )}
            {s.sources.includes("piperun") && (
              <Badge className="bg-blue-600/20 text-blue-400 border-blue-600/30 text-[8px] px-1 py-0">Piperun</Badge>
            )}
            {s.sources.includes("hubspot") && (
              <Badge className="bg-purple-600/20 text-purple-400 border-purple-600/30 text-[8px] px-1 py-0">HubSpot</Badge>
            )}
            {s.sources.includes("override") && !s.sources.includes("sheets") && !s.sources.includes("piperun") && !s.sources.includes("hubspot") && (
              <Badge className="bg-orange-600/20 text-orange-400 border-orange-600/30 text-[8px] px-1 py-0">Override</Badge>
            )}
          </div>
          <p className="text-[10px] text-muted-foreground">
            {s.monthSales} vendas · {fmt(s.monthValue)}
            {weekChange !== 0 && (
              <span className={`ml-1 ${weekChange > 0 ? "text-emerald-400" : "text-red-400"}`}>
                {weekChange > 0 ? "↑" : "↓"}{Math.abs(weekChange)}% sem
              </span>
            )}
          </p>
        </div>
        <CircularGauge pct={s.monthGoal > 0 ? goalPct : s.pct} />
      </div>

      {/* Countdown de meta individual */}
      {s.monthGoal > 0 && falta > 0 && (
        <div className="flex items-center gap-2 text-[10px] bg-muted/20 rounded-md px-2 py-1">
          <Timer className="w-3 h-3 text-orange-400 shrink-0" />
          <span className="text-muted-foreground">
            Faltam <strong className="text-foreground">{fmt(falta)}</strong> · {fmt(dailyNeeded)}/dia nos próximos {daysRemaining}d
          </span>
        </div>
      )}
      {s.monthGoal > 0 && falta <= 0 && (
        <div className="flex items-center gap-2 text-[10px] bg-emerald-500/10 rounded-md px-2 py-1">
          <span>✅</span>
          <span className="text-emerald-400 font-semibold">Meta batida! +{fmt(Math.abs(s.monthValue - s.monthGoal))} acima</span>
        </div>
      )}

      {/* Meta mensal */}
      <div className="flex items-center justify-between bg-muted/30 rounded-md px-2 py-1.5">
        <div className="flex items-center gap-1.5">
          <Target className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="text-[10px] text-muted-foreground">Meta</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-bold text-foreground">
            {s.monthGoal > 0 ? fmt(s.monthGoal) : "—"}
          </span>
          {s.monthGoal > 0 && (
            <span className={`text-[10px] font-semibold ${goalPct >= 100 ? "text-emerald-400" : goalPct >= 60 ? "text-amber-400" : "text-red-400"}`}>
              {goalPct}%
            </span>
          )}
        </div>
      </div>

      {/* Progress bar for goal */}
      {s.monthGoal > 0 && (
        <div className="h-1 rounded-full bg-border/40 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${goalPct >= 100 ? "bg-emerald-500" : goalPct >= 60 ? "bg-amber-400" : "bg-red-400"}`}
            style={{ width: `${goalPct}%` }}
          />
        </div>
      )}

      {/* KPI row */}
      <div className="grid grid-cols-4 gap-2 pt-1">
        <div>
          <p className="text-[9px] text-muted-foreground">Prosp.</p>
          <MiniProgress value={s.prospCount} target={s.prospTarget} />
        </div>
        <div>
          <p className="text-[9px] text-muted-foreground">Reun.</p>
          <MiniProgress value={s.reunCount} target={s.reunTarget} color="bg-purple-500" />
        </div>
        <div>
          <p className="text-[9px] text-muted-foreground">Follow</p>
          <span className="text-xs font-bold text-muted-foreground">{s.followCount}</span>
        </div>
        <div>
          <p className="text-[9px] text-muted-foreground">Ticket</p>
          <span className="text-xs font-bold text-muted-foreground">{s.avgTicket > 0 ? fmt(s.avgTicket) : "—"}</span>
        </div>
      </div>

    </div>
  );
}
