import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Label } from "@/components/ui/label";
import { Trophy, Pencil, Sparkles, Loader2, Target, Flame, TrendingUp, ChevronDown, ChevronUp, Eye, HandHeart } from "lucide-react";
import { toast } from "sonner";
import { ALL_BROKERS, BROKER_TEAMS, normalizeName, isLeadership } from "@/lib/seller-names";
import { calculateAchievements, calcCurrentMonthTopTeam } from "@/lib/achievements";
import { AchievementBadges } from "@/components/AchievementBadges";
import { useCustomAchievements } from "@/hooks/useCustomAchievements";

// Líderes que devem aparecer no Hall (apenas com recorde, sem meta/vendas do mês)
const LEADERS_IN_HALL: string[] = ["Daniel Pedro", "Alan Melo", "Diego de Luca", "André"];
const LEADER_TEAM = "Liderança";
import type { SaleRow } from "@/hooks/useGoogleSheetsData";

interface SalesRecord {
  id: string;
  broker_name: string;
  record_value: number;
  record_count: number;
  record_month: string | null;
  notes: string | null;
}

interface Profile {
  user_id: string;
  display_name: string | null;
  avatar_url: string | null;
}

interface Goal {
  broker_name: string;
  meta: number;
}

interface IndividualGoal {
  user_id: string;
  meta: number;
}

interface RecordBreak {
  id: string;
  broker_name: string;
  previous_value: number;
  new_value: number;
  new_count: number;
  record_month: string;
  broken_at: string;
}

interface Props {
  allRows: SaleRow[];
  canEdit: boolean;
}

const MONTH_NAMES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];


function formatBRL(val: number) {
  return val.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
}

function parseBRDate(raw: string): Date | null {
  if (!raw) return null;
  const parts = raw.split("/");
  if (parts.length !== 3) return null;
  const [d, m, y] = parts.map(Number);
  return new Date(y, m - 1, d);
}

function formatRelativeDate(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}

export function HallOfRecords({ allRows, canEdit }: Props) {
  const [records, setRecords] = useState<SalesRecord[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [individualGoals, setIndividualGoals] = useState<IndividualGoal[]>([]);
  const [breaks, setBreaks] = useState<RecordBreak[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<SalesRecord | null>(null);
  const [editValue, setEditValue] = useState("");
  const [editCount, setEditCount] = useState("");
  const [editMonth, setEditMonth] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const { byBroker: customByBroker } = useCustomAchievements();

  const now = new Date();
  const currentMesRef = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const currentMonthLabel = `${MONTH_NAMES[now.getMonth()]}/${now.getFullYear()}`;

  const loadAll = async () => {
    setLoading(true);
    const [recRes, profRes, goalRes, indGoalRes, brkRes] = await Promise.all([
      supabase.from("sales_records").select("*").order("record_value", { ascending: false }),
      supabase.from("profiles").select("user_id, display_name, avatar_url"),
      supabase.from("sales_goals_byname").select("broker_name, meta").eq("mes_ref", currentMesRef),
      supabase.from("sales_goals_individual").select("user_id, meta").eq("mes_ref", currentMesRef),
      supabase.from("sales_record_breaks").select("*").order("broken_at", { ascending: false }).limit(50),
    ]);
    if (recRes.error) toast.error("Erro ao carregar recordes");
    setRecords(recRes.data || []);
    setProfiles(profRes.data || []);
    setGoals(goalRes.data || []);
    setIndividualGoals(indGoalRes.data || []);
    setBreaks(brkRes.data || []);
    setLoading(false);
  };

  useEffect(() => { loadAll(); }, []);

  const avatarMap = useMemo(() => {
    const map: Record<string, string> = {};
    for (const p of profiles) {
      if (!p.display_name || !p.avatar_url) continue;
      const canonical = normalizeName(p.display_name);
      if (!map[canonical]) map[canonical] = p.avatar_url;
    }
    return map;
  }, [profiles]);

  const goalMap = useMemo(() => {
    const map: Record<string, number> = {};
    // 1) Meta por nome (sales_goals_byname) — fallback
    for (const g of goals) {
      const canonical = normalizeName(g.broker_name);
      map[canonical] = Number(g.meta) || 0;
    }
    // 2) Meta individual (sales_goals_individual) por user_id — prioritária,
    //    mesma fonte usada na aba "Vendas em Tempo Real"
    const userIdToName: Record<string, string> = {};
    for (const p of profiles) {
      if (!p.user_id || !p.display_name) continue;
      userIdToName[p.user_id] = normalizeName(p.display_name);
    }
    for (const ig of individualGoals) {
      const canonical = userIdToName[ig.user_id];
      if (!canonical) continue;
      map[canonical] = Number(ig.meta) || 0;
    }
    return map;
  }, [goals, individualGoals, profiles]);

  // Current month sales per broker
  const monthSalesMap = useMemo(() => {
    const map: Record<string, { value: number; count: number }> = {};
    for (const row of allRows) {
      const d = parseBRDate(row.dataVenda);
      if (!d || d.getFullYear() !== now.getFullYear() || d.getMonth() !== now.getMonth()) continue;
      const name = normalizeName(row.corretor || "");
      if (!ALL_BROKERS.includes(name)) continue;
      if (!map[name]) map[name] = { value: 0, count: 0 };
      map[name].value += row.valor;
      map[name].count += 1;
    }
    return map;
  }, [allRows]);

  // Best historical month per broker
  const historicalBest = useMemo(() => {
    const byBrokerMonth: Record<string, Record<string, { value: number; count: number }>> = {};
    for (const row of allRows) {
      const rawName = (row.corretor || "").trim();
      const name = normalizeName(rawName);
      // Aceita brokers ATIVOS ou líderes definidos
      const isLeaderRow = isLeadership(rawName);
      let canonical = name;
      if (isLeaderRow) {
        // Mapeia o nome do líder para o nome canônico definido em LEADERS_IN_HALL
        const matched = LEADERS_IN_HALL.find(
          (l) => l.toLowerCase().includes(name.toLowerCase()) || name.toLowerCase().includes(l.toLowerCase())
        );
        if (!matched) continue;
        canonical = matched;
      } else if (!ALL_BROKERS.includes(name)) {
        continue;
      }
      const d = parseBRDate(row.dataVenda);
      if (!d) continue;
      // Recorde histórico NÃO inclui o mês corrente — o mês atual é o que está
      // tentando bater o recorde.
      if (d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()) continue;
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      if (!byBrokerMonth[canonical]) byBrokerMonth[canonical] = {};
      if (!byBrokerMonth[canonical][key]) byBrokerMonth[canonical][key] = { value: 0, count: 0 };
      byBrokerMonth[canonical][key].value += row.valor;
      byBrokerMonth[canonical][key].count += 1;
    }
    const best: Record<string, { value: number; count: number; month: string }> = {};
    for (const [name, months] of Object.entries(byBrokerMonth)) {
      let bestK = ""; let bestV = 0; let bestC = 0;
      for (const [k, v] of Object.entries(months)) {
        if (v.value > bestV) { bestV = v.value; bestC = v.count; bestK = k; }
      }
      if (bestK) {
        const [y, m] = bestK.split("-");
        best[name] = { value: bestV, count: bestC, month: `${MONTH_NAMES[parseInt(m) - 1]}/${y}` };
      }
    }
    return best;
  }, [allRows]);

  // Display: brokers who broke their own record THIS month go on top
  const display = useMemo(() => {
    const buildEntry = (name: string, isLeader: boolean) => {
      const saved = records.find((r) => r.broker_name === name);
      const hist = historicalBest[name];
      const month = isLeader ? { value: 0, count: 0 } : (monthSalesMap[name] || { value: 0, count: 0 });
      const meta = isLeader ? 0 : (goalMap[name] || 0);
      const pct = meta > 0 ? (month.value / meta) * 100 : 0;
      const recordValue = saved?.record_value ?? hist?.value ?? 0;
      // Mínimo de R$ 500k para considerar quebra de recorde
      const MIN_RECORD = 500_000;
      const beatRecord =
        !isLeader && month.value >= MIN_RECORD && recordValue > 0 && month.value >= recordValue;
      const beatBy = beatRecord ? month.value - recordValue : 0;
      const recordPct = recordValue > 0 ? (month.value / recordValue) * 100 : 0;
      const closeToRecord =
        !isLeader && !beatRecord && recordPct >= 80 && month.value >= MIN_RECORD * 0.8;

      return {
        broker_name: name,
        team: isLeader ? LEADER_TEAM : (BROKER_TEAMS[name] || ""),
        avatar: avatarMap[name],
        isLeader,
        saved,
        hist,
        monthValue: month.value,
        monthCount: month.count,
        meta,
        pct,
        recordValue,
        beatRecord,
        beatBy,
        recordPct,
        closeToRecord,
      };
    };

    const brokerEntries = ALL_BROKERS.map((n) => buildEntry(n, false));
    const leaderEntries = LEADERS_IN_HALL.map((n) => buildEntry(n, true));

    // Brokers ordenados pela lógica original; líderes vão pro fim, ordenados pelo recorde
    const sortedBrokers = brokerEntries.sort((a, b) => {
      if (a.beatRecord && !b.beatRecord) return -1;
      if (!a.beatRecord && b.beatRecord) return 1;
      if (a.beatRecord && b.beatRecord) return b.beatBy - a.beatBy;
      if (a.closeToRecord && !b.closeToRecord) return -1;
      if (!a.closeToRecord && b.closeToRecord) return 1;
      if (a.closeToRecord && b.closeToRecord) return b.recordPct - a.recordPct;
      return b.recordValue - a.recordValue;
    });
    const sortedLeaders = leaderEntries.sort((a, b) => b.recordValue - a.recordValue);

    return [...sortedBrokers, ...sortedLeaders];
  }, [records, historicalBest, avatarMap, goalMap, monthSalesMap]);

  // ─── Conquistas dinâmicas ───────────────────────────────────────────
  // Conta quantas vezes cada broker aparece em sales_record_breaks
  const recordBreakersByBroker = useMemo(() => {
    const map: Record<string, number> = {};
    for (const b of breaks) {
      const name = normalizeName(b.broker_name);
      map[name] = (map[name] || 0) + 1;
    }
    return map;
  }, [breaks]);

  const currentMonthTopTeam = useMemo(
    () => calcCurrentMonthTopTeam(allRows),
    [allRows]
  );

  const achievementsByBroker = useMemo(
    () => calculateAchievements({
      allRows,
      recordBreakersByBroker,
      currentMonthTopTeam,
      // goalsByMonth: TODO carregar histórico de sales_goals_byname p/ ativar goal-streak/perfect-year
    }),
    [allRows, recordBreakersByBroker, currentMonthTopTeam]
  );

  // Auto-register record breaks for current month (one per broker per month)
  useEffect(() => {
    if (loading) return;
    const breakers = display.filter((d) => d.beatRecord);
    if (breakers.length === 0) return;

    (async () => {
      for (const b of breakers) {
        const already = breaks.find(
          (br) => br.broker_name === b.broker_name && br.record_month === currentMonthLabel
        );
        if (already) continue;
        await supabase.from("sales_record_breaks").insert({
          broker_name: b.broker_name,
          previous_value: b.recordValue,
          new_value: b.monthValue,
          new_count: b.monthCount,
          record_month: currentMonthLabel,
        });
      }
      // refresh breaks list silently
      const { data } = await supabase
        .from("sales_record_breaks")
        .select("*")
        .order("broken_at", { ascending: false })
        .limit(50);
      if (data) setBreaks(data);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, display.map((d) => `${d.broker_name}:${d.beatRecord}`).join("|")]);

  const handleImportAll = async () => {
    if (!canEdit) return;
    setImporting(true);
    const rows = ALL_BROKERS
      .map((name) => {
        const h = historicalBest[name];
        if (!h) return null;
        return {
          broker_name: name,
          record_value: h.value,
          record_count: h.count,
          record_month: h.month,
          notes: "Importado automaticamente do histórico",
        };
      })
      .filter(Boolean) as SalesRecord[];

    if (rows.length === 0) {
      toast.warning("Nenhum dado histórico encontrado");
      setImporting(false);
      return;
    }

    const { error } = await supabase
      .from("sales_records")
      .upsert(rows, { onConflict: "broker_name" });
    if (error) toast.error("Erro ao importar: " + error.message);
    else {
      toast.success(`${rows.length} recordes importados!`);
      loadAll();
    }
    setImporting(false);
  };

  const openEdit = (broker: string, current?: SalesRecord, hist?: { value: number; count: number; month: string }) => {
    const base = current || {
      id: "",
      broker_name: broker,
      record_value: hist?.value || 0,
      record_count: hist?.count || 0,
      record_month: hist?.month || "",
      notes: "",
    };
    setEditing(base);
    setEditValue(String(base.record_value));
    setEditCount(String(base.record_count));
    setEditMonth(base.record_month || "");
    setEditNotes(base.notes || "");
  };

  const handleSave = async () => {
    if (!editing) return;
    setSaving(true);
    const payload = {
      broker_name: editing.broker_name,
      record_value: parseFloat(editValue) || 0,
      record_count: parseInt(editCount) || 0,
      record_month: editMonth || null,
      notes: editNotes || null,
    };
    const { error } = await supabase
      .from("sales_records")
      .upsert(payload, { onConflict: "broker_name" });
    if (error) toast.error("Erro ao salvar: " + error.message);
    else {
      toast.success("Recorde salvo!");
      setEditing(null);
      loadAll();
    }
    setSaving(false);
  };

  const medals = ["🥇", "🥈", "🥉"];

  return (
    <TooltipProvider delayDuration={150}>
    <div className="space-y-4">
      {/* ─── HALL DOS RECORDES ─── */}
      <Card className="border-amber-500/30 bg-gradient-to-br from-amber-500/10 via-yellow-500/5 to-orange-500/10 overflow-hidden">
        <CardContent className="p-4 sm:p-5">
          {/* CABEÇALHO TEASER — sempre visível, clicável */}
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="w-full flex items-center justify-between gap-2 group"
            aria-expanded={expanded}
          >
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-lg shadow-amber-500/30 shrink-0 group-hover:scale-110 transition-transform">
                <Trophy className="w-4 h-4 text-white" />
              </div>
              <div className="text-left min-w-0">
                <h2 className="font-display text-sm sm:text-base font-bold text-foreground flex items-center gap-1.5">
                  🏆 Hall dos Recordes
                  {(() => {
                    const breakers = display.filter((d) => d.beatRecord).length;
                    const close = display.filter((d) => d.closeToRecord).length;
                    if (breakers > 0) {
                      return (
                        <span className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-emerald-500 text-white font-bold animate-pulse">
                          🔥 {breakers} quebr{breakers > 1 ? "aram" : "ou"}
                        </span>
                      );
                    }
                    if (close > 0) {
                      return (
                        <span className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-orange-500 text-white font-bold">
                          🎯 {close} perto
                        </span>
                      );
                    }
                    return null;
                  })()}
                </h2>
                <span className="text-[10px] sm:text-xs text-muted-foreground block truncate">
                  {expanded
                    ? "Quem quebrou (ou está perto de bater) o recorde fica no topo"
                    : "👀 Quem está mais perto de virar lenda este mês? Toque pra descobrir…"}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {/* Mini avatares preview (top 3) */}
              {!expanded && (
                <div className="hidden sm:flex -space-x-2">
                  {display.slice(0, 3).map((d) => {
                    const initials = d.broker_name.split(" ").map((s) => s[0]).slice(0, 2).join("");
                    return (
                      <Avatar key={d.broker_name} className="w-6 h-6 ring-2 ring-amber-500/40 border-0">
                        <AvatarImage src={d.avatar} alt={d.broker_name} />
                        <AvatarFallback className="text-[8px] bg-amber-500/20 text-amber-700 dark:text-amber-300 font-bold">
                          {initials}
                        </AvatarFallback>
                      </Avatar>
                    );
                  })}
                </div>
              )}
              <div className="w-7 h-7 rounded-full bg-amber-500/20 flex items-center justify-center group-hover:bg-amber-500/30 transition-colors">
                {expanded ? (
                  <ChevronUp className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                )}
              </div>
            </div>
          </button>

          {/* AÇÕES (admin) — só quando expandido */}
          {expanded && canEdit && (
            <div className="flex justify-end mt-3">
              <Button
                size="sm"
                variant="outline"
                onClick={handleImportAll}
                disabled={importing}
                className="h-8 text-[11px] gap-1"
              >
                {importing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                Importar tudo
              </Button>
            </div>
          )}

          {/* GRID DE CARDS — só quando expandido */}
          {expanded && (loading ? (
            <div className="flex items-center justify-center py-6 text-muted-foreground text-sm mt-4">
              <Loader2 className="w-4 h-4 animate-spin mr-2" /> Carregando…
            </div>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2 mt-4 animate-in fade-in slide-in-from-top-2 duration-300">
              {display.map((item, idx) => {
                const recordMonth = item.saved?.record_month || item.hist?.month || "—";
                const medal = idx < 3 ? medals[idx] : null;
                const initials = item.broker_name.split(" ").map(s => s[0]).slice(0, 2).join("");
                const pctClamped = Math.min(item.pct, 100);
                const firstName = item.broker_name.split(" ")[0];

                return (
                  <div
                    key={item.broker_name}
                    className={`rounded-lg backdrop-blur-sm border p-2 transition-all group relative flex flex-col ${
                      item.isLeader
                        ? "bg-black border-purple-500/40 hover:border-purple-400/70 shadow-lg shadow-purple-500/10"
                        : item.beatRecord
                        ? "bg-gradient-to-br from-emerald-500/15 via-amber-500/10 to-orange-500/15 border-emerald-500/50 shadow-lg shadow-emerald-500/20"
                        : item.closeToRecord
                        ? "bg-gradient-to-br from-orange-500/15 via-amber-500/10 to-yellow-500/10 border-orange-500/50 shadow-md shadow-orange-500/15"
                        : "bg-background/70 border-amber-500/20 hover:border-amber-500/50"
                    }`}
                  >
                    {/* ─────────── LÍDERES — design limpo e centralizado ─────────── */}
                    {item.isLeader ? (
                      <div className="flex flex-col items-center justify-center text-center gap-2 py-2">
                        {canEdit && (
                          <button
                            onClick={() => openEdit(item.broker_name, item.saved, item.hist)}
                            className="absolute top-1 right-1 p-1 rounded bg-purple-500/20 hover:bg-purple-500/40 transition-colors"
                            title="Editar recorde do líder"
                          >
                            <Pencil className="w-3 h-3 text-purple-200" />
                          </button>
                        )}
                        {/* Ícone de servir — liderança servidora */}
                        <HandHeart className="w-4 h-4 text-purple-300" strokeWidth={2.2} />

                        {/* Avatar com anel roxo + glow */}
                        <Avatar className="w-14 h-14 ring-2 ring-purple-400/70 shadow-lg shadow-purple-500/30">
                          <AvatarImage src={item.avatar} alt={item.broker_name} />
                          <AvatarFallback className="text-xs bg-purple-500/20 text-purple-300 font-bold">
                            {initials}
                          </AvatarFallback>
                        </Avatar>

                        {/* Nome em branco */}
                        <p
                          className="text-[12px] font-bold text-white truncate w-full leading-tight"
                          title={item.broker_name}
                        >
                          {firstName}
                        </p>

                        {/* Linha decorativa dourada */}
                        <div className="w-8 h-px bg-gradient-to-r from-transparent via-amber-400/60 to-transparent" />

                        {/* Recorde histórico em dourado */}
                        <div className="flex flex-col items-center gap-0.5">
                          <span className="text-[8px] uppercase tracking-[0.15em] text-purple-300/80 font-semibold">
                            Recorde
                          </span>
                          <span className="text-[13px] font-bold text-amber-400 leading-none">
                            {item.recordValue > 0 ? formatBRL(item.recordValue) : "—"}
                          </span>
                          <span className="text-[8px] text-white/50 font-medium mt-0.5">
                            {recordMonth}
                          </span>
                        </div>
                      </div>
                    ) : (
                    <>
                    {/* Header: avatar + nome (centralizado) */}
                    <div className="flex flex-col items-center text-center gap-1 mb-1.5">
                      <div className="relative">
                        <Avatar
                          className={`w-11 h-11 ring-2 ${
                            item.beatRecord
                              ? "ring-emerald-500/60"
                              : item.closeToRecord
                              ? "ring-orange-500/60"
                              : "ring-amber-500/30"
                          }`}
                        >
                          <AvatarImage src={item.avatar} alt={item.broker_name} />
                          <AvatarFallback className="text-[10px] bg-amber-500/20 text-amber-700 dark:text-amber-300 font-bold">
                            {initials}
                          </AvatarFallback>
                        </Avatar>
                      </div>
                      <p className="text-[11px] font-bold text-foreground truncate w-full leading-tight" title={item.broker_name}>
                        {firstName}
                      </p>
                    </div>

                    {canEdit && (
                      <button
                        onClick={() => openEdit(item.broker_name, item.saved, item.hist)}
                        className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-accent"
                        title="Editar recorde"
                      >
                        <Pencil className="w-3 h-3 text-muted-foreground" />
                      </button>
                    )}

                    {/* Recorde — compacto */}
                    <div
                      className={`rounded-md px-1.5 py-1 mb-1 text-center ${
                        item.beatRecord
                          ? "bg-emerald-500/15"
                          : item.closeToRecord
                          ? "bg-orange-500/12"
                          : "bg-amber-500/10"
                      }`}
                    >
                      <p
                        className={`text-[9px] uppercase tracking-wider font-bold leading-none ${
                          item.beatRecord
                            ? "text-emerald-700 dark:text-emerald-400"
                            : item.closeToRecord
                            ? "text-orange-700 dark:text-orange-400"
                            : "text-amber-700 dark:text-amber-400"
                        }`}
                      >
                        🏆 {recordMonth}
                      </p>
                      <p
                        className={`text-[11px] font-bold leading-tight ${
                          item.beatRecord
                            ? "text-emerald-600 dark:text-emerald-400"
                            : item.closeToRecord
                            ? "text-orange-600 dark:text-orange-400"
                            : "text-amber-600 dark:text-amber-400"
                        }`}
                      >
                        {item.recordValue > 0 ? formatBRL(item.recordValue) : "—"}
                      </p>

                      {/* Conquistas — apenas customizadas (atribuídas manualmente em /admin/conquistas) */}
                      {(customByBroker[item.broker_name]?.length || 0) > 0 && (
                        <div className="mt-1 pt-1 border-t border-amber-500/25">
                          <p className="text-[7px] uppercase tracking-wider font-bold text-amber-700 dark:text-amber-400/90 leading-none mb-0.5">
                            👑 Conquistas
                          </p>
                          <AchievementBadges
                            achievements={[]}
                            customAchievements={customByBroker[item.broker_name] || []}
                            size={20}
                            max={6}
                          />
                        </div>
                      )}
                    </div>
                    </>
                    )}


                    {/* Mês atual + barras (recorde + meta) — apenas vendedores ativos */}
                    {!item.isLeader && (
                    <div className="space-y-1 mt-auto">
                      <div className="flex items-baseline justify-between gap-1">
                        <span className="text-[8px] uppercase tracking-wider text-muted-foreground font-semibold">Mês</span>
                        <span className="text-[10px] font-bold text-foreground leading-none">
                          {formatBRL(item.monthValue)}
                        </span>
                      </div>

                      {/* Barra do RECORDE — azul */}
                      {item.recordValue > 0 && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div className="space-y-0.5 cursor-help">
                              <div className="h-1 w-full rounded-full bg-blue-500/15 overflow-hidden">
                                <div
                                  className="h-full bg-gradient-to-r from-blue-500 to-cyan-400 transition-all"
                                  style={{ width: `${Math.min(item.recordPct, 100)}%` }}
                                />
                              </div>
                              <div className="flex items-baseline justify-between text-[8px]">
                                <span className="text-blue-500/80 font-semibold uppercase tracking-wider">Recorde</span>
                                <span className={`font-bold shrink-0 ${item.recordPct >= 100 ? "text-emerald-500" : "text-blue-500"}`}>
                                  {item.recordPct.toFixed(0)}%
                                </span>
                              </div>
                            </div>
                          </TooltipTrigger>
                          <TooltipContent side="top" className="text-xs">
                            <div className="space-y-0.5">
                              <p className="font-bold">🏆 Recorde: {formatBRL(item.recordValue)}</p>
                              <p>Atual: {formatBRL(item.monthValue)}</p>
                              {item.monthValue >= item.recordValue ? (
                                <p className="text-emerald-500 font-bold">
                                  🔥 Superou em {formatBRL(item.monthValue - item.recordValue)}
                                </p>
                              ) : (
                                <p className="text-blue-400">
                                  Faltam <span className="font-bold">{formatBRL(item.recordValue - item.monthValue)}</span> para bater
                                </p>
                              )}
                            </div>
                          </TooltipContent>
                        </Tooltip>
                      )}

                      {/* Barra da META — âmbar (cor atual) */}
                      {item.meta > 0 ? (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div className="space-y-0.5 cursor-help">
                              <Progress value={pctClamped} className="h-1" />
                              <div className="flex items-baseline justify-between text-[8px]">
                                <span className="text-amber-600/80 dark:text-amber-400/80 font-semibold uppercase tracking-wider">Meta</span>
                                <span className={`font-bold shrink-0 ${item.pct >= 100 ? "text-emerald-500" : item.pct >= 75 ? "text-amber-500" : "text-muted-foreground"}`}>
                                  {item.pct.toFixed(0)}%
                                </span>
                              </div>
                            </div>
                          </TooltipTrigger>
                          <TooltipContent side="top" className="text-xs">
                            <div className="space-y-0.5">
                              <p className="font-bold">🎯 Meta: {formatBRL(item.meta)}</p>
                              <p>Atual: {formatBRL(item.monthValue)}</p>
                              {item.monthValue >= item.meta ? (
                                <p className="text-emerald-500 font-bold">
                                  ✅ Superou em {formatBRL(item.monthValue - item.meta)}
                                </p>
                              ) : (
                                <p className="text-amber-400">
                                  Faltam <span className="font-bold">{formatBRL(item.meta - item.monthValue)}</span> para bater
                                </p>
                              )}
                            </div>
                          </TooltipContent>
                        </Tooltip>
                      ) : (
                        <p className="text-[8px] text-muted-foreground italic text-center">Sem meta</p>
                      )}

                    </div>
                    )}

                    {item.beatRecord ? (
                      <div className="absolute -top-1.5 -right-1.5 bg-emerald-500 text-white text-[8px] font-bold px-1.5 py-0.5 rounded-full shadow-lg animate-pulse">
                        🔥
                      </div>
                    ) : item.closeToRecord ? (
                      <div className="absolute -top-1.5 -right-1.5 bg-orange-500 text-white text-[8px] font-bold px-1.5 py-0.5 rounded-full shadow-lg">
                        🎯 {item.recordPct.toFixed(0)}%
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          ))}

          {/* ─── LEGENDA DAS CONQUISTAS ─── */}
          {expanded && (
            <div className="mt-5 pt-4 border-t border-amber-500/20">
              <h3 className="text-[10px] uppercase tracking-wider font-bold text-amber-600 dark:text-amber-400 mb-2 flex items-center gap-1.5">
                <Sparkles className="w-3 h-3" />
                Legenda das conquistas
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1.5">
                {[
                  { emoji: "🏆", name: "Campeão Anual", desc: "Top 1 em vendas no ano" },
                  { emoji: "🥈", name: "Vice-campeão Anual", desc: "Top 2 em vendas no ano" },
                  { emoji: "👑", name: "Campeão do Mês", desc: "Foi #1 em pelo menos um mês" },
                  { emoji: "🎩", name: "Hat-Trick", desc: "3 meses seguidos como #1" },
                  { emoji: "💰", name: "Million Club", desc: "Vendeu R$ 1M+ em um único mês" },
                  { emoji: "🚀", name: "Primeiro Milhão", desc: "Atingiu R$ 1M acumulado em vendas" },
                  { emoji: "⚡", name: "1M em 90 dias", desc: "Atingiu R$ 1M acumulado em até 90 dias desde a 1ª venda" },
                  { emoji: "💥", name: "Quebrou Recorde", desc: "Superou seu próprio recorde mensal" },
                  { emoji: "🔥", name: "Sequência de Metas", desc: "3+ meses seguidos batendo a meta" },
                  { emoji: "🌟", name: "Ano Perfeito", desc: "Bateu meta em todos os 12 meses" },
                  { emoji: "🤝", name: "Time Campeão", desc: "Está no time #1 do mês corrente" },
                ].map((a) => (
                  <div key={a.name} className="flex items-start gap-2 text-[10px] sm:text-[11px] leading-snug">
                    <span className="text-sm shrink-0">{a.emoji}</span>
                    <div className="min-w-0">
                      <span className="font-bold text-foreground">{a.name}</span>
                      <span className="text-muted-foreground"> — {a.desc}</span>
                    </div>
                  </div>
                ))}
              </div>
              <p className="text-[9px] text-muted-foreground/70 italic mt-2">
                As conquistas são calculadas automaticamente a partir do histórico de vendas.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit dialog */}
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Editar recorde — {editing?.broker_name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label htmlFor="rec-value">Valor recorde (R$)</Label>
              <Input
                id="rec-value"
                type="number"
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                placeholder="500000"
              />
            </div>
            <div>
              <Label htmlFor="rec-count">Quantidade de contratos</Label>
              <Input
                id="rec-count"
                type="number"
                value={editCount}
                onChange={(e) => setEditCount(e.target.value)}
                placeholder="15"
              />
            </div>
            <div>
              <Label htmlFor="rec-month">Mês de referência</Label>
              <Input
                id="rec-month"
                value={editMonth}
                onChange={(e) => setEditMonth(e.target.value)}
                placeholder="Ex: Mar/2024"
              />
            </div>
            <div>
              <Label htmlFor="rec-notes">Observações</Label>
              <Input
                id="rec-notes"
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
                placeholder="Comentário opcional"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)} disabled={saving}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
    </TooltipProvider>
  );
}
