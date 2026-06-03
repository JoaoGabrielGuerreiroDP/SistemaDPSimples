import { useEffect, useMemo, useState } from "react";
import { useGoogleSheetsData } from "@/hooks/useGoogleSheetsData";
import { normalizeName } from "@/lib/seller-names";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Trophy, Shirt, Target, Flame, Calendar, Users, Crown, TrendingUp, Swords, Medal } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import copaLogo from "@/assets/copa-mundo-vendas-logo.png.asset.json";

/* ────────────────────────────────────────────────────────────────────────── */
/*  CONFIG                                                                    */
/* ────────────────────────────────────────────────────────────────────────── */

const COMP_YEAR = 2026;
const COMP_MONTH = 5; // June (0-indexed)
const COMP_START = new Date(COMP_YEAR, COMP_MONTH, 1);
const COMP_END = new Date(COMP_YEAR, COMP_MONTH + 1, 0, 23, 59, 59);
const MES_REF = `${COMP_YEAR}-${String(COMP_MONTH + 1).padStart(2, "0")}`;

/** Weekly rounds (Mon → Sun). W4 extends to Jun 30 to cover the full month. */
const WEEKS: { n: number; label: string; start: Date; end: Date }[] = [
  { n: 1, label: "Semana 1", start: new Date(2026, 5, 1),  end: new Date(2026, 5, 7, 23, 59, 59) },
  { n: 2, label: "Semana 2", start: new Date(2026, 5, 8),  end: new Date(2026, 5, 14, 23, 59, 59) },
  { n: 3, label: "Semana 3", start: new Date(2026, 5, 15), end: new Date(2026, 5, 21, 23, 59, 59) },
  { n: 4, label: "Semana 4", start: new Date(2026, 5, 22), end: new Date(2026, 5, 30, 23, 59, 59) },
];

const DUELS: { id: number; a: string; b: string; aShort: string; bShort: string }[] = [
  { id: 1, a: "Gabriel Simão",           b: "Vinícius Oliveira",   aShort: "Simão",    bShort: "Vinícius"   },
  { id: 2, a: "Gustavo Machado Correa",  b: "Márcio Pereira",      aShort: "Gustavo",  bShort: "Márcio"     },
  { id: 3, a: "Alexander",               b: "Alessandro",          aShort: "Xandi",    bShort: "Alessandro" },
  { id: 4, a: "Gabriel Manenti",         b: "Guilherme Sutil",     aShort: "Manenti",  bShort: "Sutil"      },
  { id: 5, a: "Guilherme Melo",          b: "Luan",                aShort: "Melo",     bShort: "Luan"       },
  { id: 6, a: "Lucas Freitas",           b: "Patrick Bragato Rex", aShort: "Lucas",    bShort: "Patrick"    },
];

const ALL_PARTICIPANTS = DUELS.flatMap((d) => [d.a, d.b]);

/* ────────────────────────────────────────────────────────────────────────── */
/*  UTILS                                                                     */
/* ────────────────────────────────────────────────────────────────────────── */

function parseBRDate(raw: string): Date | null {
  if (!raw) return null;
  const [d, m, y] = raw.split("/").map(Number);
  if (!d || !m || !y) return null;
  return new Date(y, m - 1, d);
}

function formatBRL(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
}

function shortName(name: string): string {
  const d = DUELS.find((x) => x.a === name || x.b === name);
  if (!d) return name;
  return d.a === name ? d.aShort : d.bShort;
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  MAIN PAGE                                                                 */
/* ────────────────────────────────────────────────────────────────────────── */

export default function CopaDP2026() {
  const { allRows, loading } = useGoogleSheetsData();
  const { isAdmin, isGestor } = useUserRole();
  const canEdit = isAdmin || isGestor;

  const [prospections, setProspections] = useState<Record<string, number>>({});

  useEffect(() => {
    supabase
      .from("copa_prospections")
      .select("broker_name, prospections")
      .eq("mes_ref", MES_REF)
      .then(({ data }) => {
        const map: Record<string, number> = {};
        (data || []).forEach((r: any) => (map[r.broker_name] = Number(r.prospections) || 0));
        setProspections(map);
      });
  }, []);

  /* ─── Filter competition sales (only participants, within June 2026) ─── */
  const compRows = useMemo(() => {
    return allRows
      .map((r) => {
        const d = parseBRDate(r.dataVenda);
        if (!d || d < COMP_START || d > COMP_END) return null;
        const canonical = normalizeName(r.corretor || "");
        if (!ALL_PARTICIPANTS.includes(canonical)) return null;
        return { ...r, canonical, date: d };
      })
      .filter(Boolean) as Array<typeof allRows[number] & { canonical: string; date: Date }>;
  }, [allRows]);

  /* ─── Per-broker totals ─── */
  const totalsByBroker = useMemo(() => {
    const out: Record<string, { value: number; count: number; topSale: number }> = {};
    ALL_PARTICIPANTS.forEach((n) => (out[n] = { value: 0, count: 0, topSale: 0 }));
    compRows.forEach((r) => {
      out[r.canonical].value += r.valor;
      out[r.canonical].count += 1;
      if (r.valor > out[r.canonical].topSale) out[r.canonical].topSale = r.valor;
    });
    return out;
  }, [compRows]);

  /* ─── Weekly totals per broker ─── */
  const weeklyByBroker = useMemo(() => {
    const out: Record<string, number[]> = {};
    ALL_PARTICIPANTS.forEach((n) => (out[n] = [0, 0, 0, 0]));
    compRows.forEach((r) => {
      const wIdx = WEEKS.findIndex((w) => r.date >= w.start && r.date <= w.end);
      if (wIdx >= 0) out[r.canonical][wIdx] += r.valor;
    });
    return out;
  }, [compRows]);

  const now = new Date();
  const currentWeekIdx = WEEKS.findIndex((w) => now >= w.start && now <= w.end);
  const diasRestantes = Math.max(
    Math.ceil((COMP_END.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)),
    0
  );
  const totalCompetition = useMemo(
    () => Object.values(totalsByBroker).reduce((s, x) => s + x.value, 0),
    [totalsByBroker]
  );

  /* ─── Duel results ─── */
  const duelResults = useMemo(() => {
    return DUELS.map((d) => {
      const aWeekly = weeklyByBroker[d.a];
      const bWeekly = weeklyByBroker[d.b];
      const aTotal = totalsByBroker[d.a].value;
      const bTotal = totalsByBroker[d.b].value;
      const aTop = totalsByBroker[d.a].topSale;
      const bTop = totalsByBroker[d.b].topSale;

      // Placar ao vivo: quem tiver a MAIOR VENDA INDIVIDUAL leva 1, o outro 0.
      const aWins = aTop > bTop ? 1 : 0;
      const bWins = bTop > aTop ? 1 : 0;
      const draws = 0;

      // Status por semana (apenas informativo na aba Rodadas).
      const weekStatus: ("a" | "b" | "draw" | "pending")[] = WEEKS.map((w, i) => {
        if (now < w.start) return "pending";
        if (aWeekly[i] > bWeekly[i]) return "a";
        if (bWeekly[i] > aWeekly[i]) return "b";
        return "draw";
      });

      const compEnded = now > COMP_END;
      let champion: string | null = null;
      let tiebreakNote: string | null = null;
      if (compEnded) {
        if (aTop > bTop) champion = d.a;
        else if (bTop > aTop) champion = d.b;
        else {
          // Empate na maior venda → desempates
          const aP = prospections[d.a] || 0;
          const bP = prospections[d.b] || 0;
          if (aP !== bP) {
            champion = aP > bP ? d.a : d.b;
            tiebreakNote = `Decidido por prospecções (${aP} x ${bP})`;
          } else if (aTotal !== bTotal) {
            champion = aTotal > bTotal ? d.a : d.b;
            tiebreakNote = `Decidido pelo volume acumulado`;
          }
        }
      }
      return { duel: d, aWins, bWins, draws, weekStatus, aTotal, bTotal, champion, tiebreakNote };
    });
  }, [weeklyByBroker, totalsByBroker, prospections, now]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-muted-foreground">
        Carregando Copa do Mundo de Vendas...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[hsl(0,0%,4%)] via-[hsl(140,40%,6%)] to-[hsl(0,0%,4%)] text-white">
      <CopaHeader
        diasRestantes={diasRestantes}
        currentWeek={currentWeekIdx + 1}
        totalCompetition={totalCompetition}
        totalParticipants={ALL_PARTICIPANTS.length}
      />

      <div className="max-w-7xl mx-auto px-3 sm:px-6 pb-12">
        <Tabs defaultValue="dashboard" className="w-full">
          <TabsList className="bg-black/40 border border-[hsl(45,90%,55%)]/30 p-1 h-auto flex flex-wrap gap-1 mb-6 w-full justify-start">
            <CopaTab value="dashboard" icon={<Trophy className="w-3.5 h-3.5" />}>Dashboard</CopaTab>
            <CopaTab value="duelos" icon={<Swords className="w-3.5 h-3.5" />}>Partidas</CopaTab>
            <CopaTab value="rodadas" icon={<Calendar className="w-3.5 h-3.5" />}>Rodadas</CopaTab>
            <CopaTab value="ranking" icon={<Users className="w-3.5 h-3.5" />}>Ranking Geral</CopaTab>
            <CopaTab value="artilharia" icon={<Target className="w-3.5 h-3.5" />}>Artilharia</CopaTab>
            <CopaTab value="premiacao" icon={<Shirt className="w-3.5 h-3.5" />}>Premiação</CopaTab>
            {canEdit && (
              <CopaTab value="admin" icon={<TrendingUp className="w-3.5 h-3.5" />}>Prospecções (Admin)</CopaTab>
            )}
          </TabsList>

          <TabsContent value="dashboard"><DashboardTab duelResults={duelResults} totalsByBroker={totalsByBroker} /></TabsContent>
          <TabsContent value="duelos"><DuelosTab duelResults={duelResults} weeklyByBroker={weeklyByBroker} prospections={prospections} /></TabsContent>
          <TabsContent value="rodadas"><RodadasTab duelResults={duelResults} weeklyByBroker={weeklyByBroker} /></TabsContent>
          <TabsContent value="ranking"><RankingTab totalsByBroker={totalsByBroker} duelResults={duelResults} prospections={prospections} /></TabsContent>
          <TabsContent value="artilharia"><ArtilhariaTab totalsByBroker={totalsByBroker} /></TabsContent>
          <TabsContent value="premiacao"><PremiacaoTab duelResults={duelResults} /></TabsContent>
          {canEdit && (
            <TabsContent value="admin">
              <AdminProspections prospections={prospections} setProspections={setProspections} />
            </TabsContent>
          )}
        </Tabs>

        <Slogan />
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  HEADER                                                                    */
/* ────────────────────────────────────────────────────────────────────────── */

function CopaHeader({ diasRestantes, currentWeek, totalCompetition, totalParticipants }: {
  diasRestantes: number; currentWeek: number; totalCompetition: number; totalParticipants: number;
}) {
  return (
    <header className="relative overflow-hidden border-b border-[hsl(45,90%,55%)]/30">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,hsl(45,90%,55%)/15%,transparent_60%)]" />
      <div className="absolute inset-0 opacity-[0.04] bg-[linear-gradient(90deg,hsl(140,60%,40%)_0%,transparent_50%,hsl(140,60%,40%)_100%)]" />
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div className="flex items-center gap-4 sm:gap-6">
            <img
              src={copaLogo.url}
              alt="Copa do Mundo de Vendas DP 2026"
              className="w-24 sm:w-32 lg:w-40 h-auto drop-shadow-[0_8px_24px_rgba(218,165,32,0.35)] shrink-0"
            />
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Trophy className="w-5 h-5 text-[hsl(45,90%,55%)]" />
                <span className="text-xs sm:text-sm tracking-[0.3em] text-[hsl(45,90%,55%)] uppercase font-bold">
                  DP Consórcios · Junho 2026
                </span>
              </div>
              <h1 className="font-display text-2xl sm:text-4xl lg:text-5xl font-black leading-none">
                <span className="bg-gradient-to-r from-[hsl(45,90%,55%)] via-[hsl(45,95%,70%)] to-[hsl(45,90%,55%)] bg-clip-text text-transparent">
                  COPA DO MUNDO
                </span>
                <br />
                <span className="text-white">DE VENDAS DP <span className="text-[hsl(140,60%,45%)]">2026</span></span>
              </h1>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-3 min-w-[260px]">
            <StatPill label="Dias restantes" value={String(diasRestantes)} accent="gold" />
            <StatPill label="Rodada atual" value={currentWeek > 0 && currentWeek <= 4 ? `${currentWeek}/4` : "Encerrada"} accent="green" />
            <StatPill label="Total vendido" value={formatBRL(totalCompetition).replace("R$", "R$ ")} accent="white" small />
            <StatPill label="Participantes" value={String(totalParticipants)} accent="green" />
          </div>
        </div>
      </div>
    </header>
  );
}

function StatPill({ label, value, accent, small }: { label: string; value: string; accent: "gold" | "green" | "white"; small?: boolean }) {
  const color =
    accent === "gold" ? "text-[hsl(45,90%,55%)] border-[hsl(45,90%,55%)]/40"
    : accent === "green" ? "text-[hsl(140,60%,55%)] border-[hsl(140,60%,55%)]/40"
    : "text-white border-white/20";
  return (
    <div className={`rounded-lg border bg-black/40 backdrop-blur px-3 py-2 ${color}`}>
      <div className="text-[9px] uppercase tracking-wider text-white/60">{label}</div>
      <div className={`font-display font-black ${small ? "text-base" : "text-xl sm:text-2xl"}`}>{value}</div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  TAB TRIGGER                                                               */
/* ────────────────────────────────────────────────────────────────────────── */

function CopaTab({ value, icon, children }: { value: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <TabsTrigger
      value={value}
      className="data-[state=active]:bg-[hsl(45,90%,55%)] data-[state=active]:text-black data-[state=active]:shadow-[0_0_20px_hsl(45,90%,55%)/40%] text-white/70 hover:text-white font-bold uppercase text-[10px] sm:text-xs tracking-wider px-3 py-1.5 gap-1.5"
    >
      {icon}{children}
    </TabsTrigger>
  );
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  DASHBOARD TAB                                                             */
/* ────────────────────────────────────────────────────────────────────────── */

function DashboardTab({ duelResults, totalsByBroker }: any) {
  return (
    <div className="space-y-6">
      {/* ─── Resumo geral ─── */}
      <ResumoGeral duelResults={duelResults} totalsByBroker={totalsByBroker} />

      {/* ─── Prévia da Vitória — por duelo ─── */}
      <ChampionsPreview duelResults={duelResults} totalsByBroker={totalsByBroker} />

      {/* Leading duels strip */}
      <div>
        <h2 className="font-display text-lg sm:text-xl font-bold mb-3 flex items-center gap-2 text-[hsl(45,90%,55%)]">
          <Flame className="w-5 h-5" /> Líderes das Partidas
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {duelResults.map((dr: any) => (
            <MiniDuelCard key={dr.duel.id} dr={dr} />
          ))}
        </div>
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  RESUMO GERAL — visão consolidada da Copa                                  */
/* ────────────────────────────────────────────────────────────────────────── */

function ResumoGeral({ duelResults, totalsByBroker }: {
  duelResults: any[];
  totalsByBroker: Record<string, { value: number; count: number; topSale: number }>;
}) {
  const entries = Object.entries(totalsByBroker);
  const totalVendido = entries.reduce((s, [, x]) => s + x.value, 0);
  const totalVendas = entries.reduce((s, [, x]) => s + x.count, 0);
  const ticketMedio = totalVendas > 0 ? totalVendido / totalVendas : 0;

  const artilheiro = entries.reduce<{ name: string; value: number } | null>((acc, [name, x]) => {
    if (!acc || x.value > acc.value) return { name, value: x.value };
    return acc;
  }, null);

  const maiorVenda = entries.reduce<{ name: string; value: number } | null>((acc, [name, x]) => {
    if (!acc || x.topSale > acc.value) return { name, value: x.topSale };
    return acc;
  }, null);

  const partidasAtivas = duelResults.filter(
    (dr: any) => (dr.aTotal || 0) > 0 || (dr.bTotal || 0) > 0
  ).length;

  const partidasDecididas = duelResults.filter((dr: any) => {
    const aTop = totalsByBroker[dr.duel.a].topSale;
    const bTop = totalsByBroker[dr.duel.b].topSale;
    return aTop !== bTop && (aTop > 0 || bTop > 0);
  }).length;

  return (
    <div className="relative overflow-hidden rounded-2xl border border-[hsl(140,60%,40%)]/40 bg-gradient-to-br from-[hsl(140,40%,8%)] via-black to-[hsl(45,40%,8%)] shadow-[0_0_60px_-20px_hsl(140,60%,45%)/40%]">
      <div className="absolute -top-24 -left-24 w-[420px] h-[420px] rounded-full bg-[hsl(140,60%,40%)]/10 blur-3xl pointer-events-none" />
      <div className="absolute -bottom-24 -right-24 w-[420px] h-[420px] rounded-full bg-[hsl(45,90%,55%)]/10 blur-3xl pointer-events-none" />

      <div className="relative p-5 sm:p-8">
        <div className="flex items-center justify-center gap-2 mb-6">
          <div className="h-px flex-1 bg-gradient-to-r from-transparent to-[hsl(140,60%,55%)]/60" />
          <span className="text-[10px] sm:text-xs uppercase tracking-[0.4em] text-[hsl(140,60%,65%)] font-black">
            Resumo da Copa
          </span>
          <div className="h-px flex-1 bg-gradient-to-l from-transparent to-[hsl(140,60%,55%)]/60" />
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
          <ResumoCard
            icon={<Trophy className="w-4 h-4" />}
            label="Total vendido"
            value={formatBRL(totalVendido)}
            accent="gold"
          />
          <ResumoCard
            icon={<TrendingUp className="w-4 h-4" />}
            label="Vendas registradas"
            value={String(totalVendas)}
            sub={totalVendas > 0 ? `Ticket médio ${formatBRL(ticketMedio)}` : undefined}
            accent="green"
          />
          <ResumoCard
            icon={<Swords className="w-4 h-4" />}
            label="Partidas em jogo"
            value={`${partidasAtivas}/${duelResults.length}`}
            sub={`${partidasDecididas} com placar`}
            accent="white"
          />
          <ResumoCard
            icon={<Flame className="w-4 h-4" />}
            label="Maior venda"
            value={maiorVenda && maiorVenda.value > 0 ? formatBRL(maiorVenda.value) : "—"}
            sub={maiorVenda && maiorVenda.value > 0 ? shortName(maiorVenda.name) : undefined}
            accent="gold"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <DestaqueCard
            icon={<Medal className="w-5 h-5" />}
            label="Artilheiro da Copa"
            name={artilheiro && artilheiro.value > 0 ? shortName(artilheiro.name) : "A definir"}
            value={artilheiro && artilheiro.value > 0 ? formatBRL(artilheiro.value) : "—"}
            tone="green"
          />
          <DestaqueCard
            icon={<Crown className="w-5 h-5" />}
            label="Maior venda individual"
            name={maiorVenda && maiorVenda.value > 0 ? shortName(maiorVenda.name) : "A definir"}
            value={maiorVenda && maiorVenda.value > 0 ? formatBRL(maiorVenda.value) : "—"}
            tone="gold"
          />
        </div>
      </div>
    </div>
  );
}

function ResumoCard({ icon, label, value, sub, accent }: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  accent: "gold" | "green" | "white";
}) {
  const color =
    accent === "gold" ? "text-[hsl(45,95%,70%)] border-[hsl(45,90%,55%)]/40"
    : accent === "green" ? "text-[hsl(140,60%,65%)] border-[hsl(140,60%,55%)]/40"
    : "text-white border-white/20";
  return (
    <div className={`rounded-xl border bg-black/40 backdrop-blur p-3 sm:p-4 ${color}`}>
      <div className="flex items-center gap-1.5 text-[9px] uppercase tracking-wider text-white/60 mb-1">
        <span className={color.split(" ")[0]}>{icon}</span>
        {label}
      </div>
      <div className="font-display font-black text-lg sm:text-2xl leading-tight">{value}</div>
      {sub && <div className="text-[10px] text-white/50 mt-0.5 truncate">{sub}</div>}
    </div>
  );
}

function DestaqueCard({ icon, label, name, value, tone }: {
  icon: React.ReactNode;
  label: string;
  name: string;
  value: string;
  tone: "gold" | "green";
}) {
  const isGold = tone === "gold";
  const ring = isGold ? "ring-[hsl(45,90%,55%)]/40" : "ring-[hsl(140,60%,45%)]/40";
  const bg = isGold
    ? "from-[hsl(45,80%,15%)]/60 to-black/40"
    : "from-[hsl(140,40%,12%)]/60 to-black/40";
  const iconBg = isGold
    ? "bg-gradient-to-br from-[hsl(45,95%,70%)] to-[hsl(40,80%,45%)]"
    : "bg-gradient-to-br from-[hsl(140,60%,55%)] to-[hsl(140,60%,30%)]";
  const labelColor = isGold ? "text-[hsl(45,95%,70%)]" : "text-[hsl(140,60%,65%)]";
  return (
    <div className={`relative overflow-hidden rounded-xl ring-1 ${ring} bg-gradient-to-br ${bg} p-4 flex items-center gap-3`}>
      <div className={`shrink-0 w-11 h-11 rounded-full ${iconBg} flex items-center justify-center text-black shadow-lg`}>
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <div className={`text-[9px] uppercase tracking-widest font-bold ${labelColor}`}>{label}</div>
        <div className="font-display text-lg sm:text-xl font-black text-white truncate leading-tight">{name}</div>
        <div className="text-xs font-display font-black text-white/80">{value}</div>
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  CHAMPION PREVIEW — Prévia da Vitória                                      */
/* ────────────────────────────────────────────────────────────────────────── */

function ChampionsPreview({ duelResults, totalsByBroker }: {
  duelResults: any[];
  totalsByBroker: Record<string, { value: number; count: number; topSale: number }>;
}) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-[hsl(45,90%,55%)]/60 bg-gradient-to-br from-[hsl(45,80%,12%)] via-black to-[hsl(140,40%,8%)] shadow-[0_0_60px_-15px_hsl(45,90%,55%)/60%]">
      <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full bg-[hsl(45,90%,55%)]/15 blur-3xl pointer-events-none" />
      <div className="absolute inset-0 opacity-[0.07] bg-[radial-gradient(circle_at_center,hsl(45,90%,55%)_0%,transparent_70%)] pointer-events-none" />

      <div className="relative p-5 sm:p-8">
        <div className="flex items-center justify-center gap-2 mb-2">
          <div className="h-px flex-1 bg-gradient-to-r from-transparent to-[hsl(45,90%,55%)]/60" />
          <span className="text-[10px] sm:text-xs uppercase tracking-[0.4em] text-[hsl(45,95%,70%)] font-black">
            Prévia dos Campeões
          </span>
          <div className="h-px flex-1 bg-gradient-to-l from-transparent to-[hsl(45,90%,55%)]/60" />
        </div>
        <p className="text-center text-[10px] sm:text-xs text-white/50 uppercase tracking-widest mb-6">
          Cada partida, um campeão provisório — decidido no fim do mês
        </p>

        {(() => {
          const activeDuels = duelResults.filter((dr: any) => (dr.aTotal || 0) > 0 || (dr.bTotal || 0) > 0);
          if (activeDuels.length === 0) {
            return (
              <div className="py-10 text-center">
                <div className="text-white/60 text-xs uppercase tracking-widest">
                  Nenhuma partida iniciada
                </div>
                <div className="text-white/40 text-[11px] mt-1">
                  A prévia aparece quando o primeiro lance for registrado
                </div>
              </div>
            );
          }
          return (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
          {activeDuels.map((dr: any) => {
            const aTop = totalsByBroker[dr.duel.a].topSale;
            const bTop = totalsByBroker[dr.duel.b].topSale;
            const aTotal = dr.aTotal;
            const bTotal = dr.bTotal;
            const leader =
              aTop > bTop ? dr.duel.a : bTop > aTop ? dr.duel.b : aTotal > bTotal ? dr.duel.a : bTotal > aTotal ? dr.duel.b : null;
            const challenger = leader === dr.duel.a ? dr.duel.b : leader === dr.duel.b ? dr.duel.a : null;
            const leaderTotal = leader === dr.duel.a ? aTotal : leader === dr.duel.b ? bTotal : 0;
            const challengerTotal = challenger === dr.duel.a ? aTotal : challenger === dr.duel.b ? bTotal : 0;
            const gap = leaderTotal - challengerTotal;
            return (
              <ProvisionalChampionCard
                key={dr.duel.id}
                duelId={dr.duel.id}
                leaderName={leader ? shortName(leader) : null}
                challengerName={challenger ? shortName(challenger) : null}
                leaderTotal={leaderTotal}
                challengerTotal={challengerTotal}
                gap={gap}
              />
            );
          })}
        </div>
          );
        })()}
      </div>
    </div>
  );
}

function ProvisionalChampionCard({
  duelId, leaderName, challengerName, leaderTotal, challengerTotal, gap,
}: {
  duelId: number;
  leaderName: string | null;
  challengerName: string | null;
  leaderTotal: number;
  challengerTotal: number;
  gap: number;
}) {
  const hasLeader = !!leaderName && leaderTotal > 0;
  return (
    <div className="relative rounded-xl border border-[hsl(45,90%,55%)]/40 bg-gradient-to-br from-black/70 to-[hsl(45,80%,10%)]/40 p-4 overflow-hidden">
      {hasLeader && (
        <div className="absolute -top-10 -right-10 w-32 h-32 rounded-full bg-[hsl(45,90%,55%)]/15 blur-2xl pointer-events-none" />
      )}
      <div className="relative">
        <div className="flex items-center justify-between mb-3">
          <span className="text-[9px] uppercase tracking-[0.25em] text-[hsl(45,90%,55%)] font-bold">
            Partida {duelId}
          </span>
          <span className="text-[9px] uppercase tracking-widest text-white/40">Provisório</span>
        </div>

        {hasLeader ? (
          <>
            <div className="flex items-center gap-3 mb-3">
              <div className="relative shrink-0">
                <div className="absolute inset-0 -m-1 rounded-full bg-[hsl(45,90%,55%)]/40 blur-md animate-pulse" />
                <div className="relative w-12 h-12 rounded-full bg-gradient-to-br from-[hsl(45,95%,70%)] to-[hsl(40,80%,45%)] flex items-center justify-center shadow-[0_0_18px_hsl(45,90%,55%)/60%] ring-2 ring-[hsl(45,95%,70%)]/40">
                  <Trophy className="w-6 h-6 text-black" strokeWidth={2.5} />
                </div>
                <Crown className="absolute -top-2 left-1/2 -translate-x-1/2 w-4 h-4 text-[hsl(45,95%,70%)] drop-shadow-[0_0_6px_hsl(45,95%,70%)]" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[9px] uppercase tracking-widest text-[hsl(45,95%,70%)] font-bold">
                  Campeão Provisório
                </div>
                <div className="font-display text-xl sm:text-2xl font-black text-white truncate leading-tight">
                  {leaderName}
                </div>
                <div className="text-sm font-display font-black text-[hsl(45,95%,70%)]">
                  {formatBRL(leaderTotal)}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between text-[10px] pt-2 border-t border-white/10">
              <span className="text-white/60">
                vs <span className="text-white/90 font-semibold">{challengerName || "—"}</span>{" "}
                <span className="text-white/40">{formatBRL(challengerTotal)}</span>
              </span>
              {gap > 0 && (
                <span className="text-[hsl(140,60%,55%)] font-bold">+{formatBRL(gap)}</span>
              )}
            </div>
          </>
        ) : (
          <div className="py-6 text-center">
            <div className="text-white/50 text-xs uppercase tracking-widest mb-1">
              Sem vendas ainda
            </div>
            <div className="text-white/70 text-sm">A definir</div>
          </div>
        )}
      </div>
    </div>
  );
}

function MiniDuelCard({ dr }: { dr: any }) {
  const { duel, aWins, bWins, aTotal, bTotal, champion } = dr;
  const leader = champion ? champion : aWins > bWins ? duel.a : bWins > aWins ? duel.b : aTotal > bTotal ? duel.a : bTotal > aTotal ? duel.b : null;
  const statusLabel = champion ? "🏆 Campeão" : leader ? `${shortName(leader)} lidera` : "Em disputa";
  return (
    <Card className="bg-black/50 border-white/10 hover:border-[hsl(45,90%,55%)]/60 transition-colors">
      <CardContent className="p-3 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-[10px] uppercase tracking-widest text-[hsl(140,60%,55%)] font-bold">Partida {duel.id}</span>
          <span className="text-[10px] text-white/60">{statusLabel}</span>
        </div>
        <div className="flex items-center justify-between gap-2">
          <Side name={duel.aShort} score={aWins} value={aTotal} highlight={leader === duel.a} />
          <div className="font-display font-black text-white/40 text-lg">VS</div>
          <Side name={duel.bShort} score={bWins} value={bTotal} highlight={leader === duel.b} align="right" />
        </div>
      </CardContent>
    </Card>
  );
}

function Side({ name, score, value, highlight, align = "left" }: { name: string; score: number; value: number; highlight: boolean; align?: "left" | "right" }) {
  const isLeading = score === 1;
  const label = isLeading ? "Levando a partida" : "Em busca da vitória";
  const color = isLeading ? "text-[hsl(140,65%,55%)]" : "text-[hsl(0,75%,60%)]";
  const bgClass = isLeading
    ? "bg-gradient-to-t from-[hsl(140,60%,35%)]/30 via-[hsl(140,60%,50%)]/10 to-transparent"
    : "bg-gradient-to-t from-[hsl(0,70%,35%)]/30 via-[hsl(0,70%,50%)]/10 to-transparent";
  return (
    <div className={`flex-1 relative overflow-hidden rounded-lg p-2 ${align === "right" ? "text-right" : ""} ${bgClass}`}>
      {isLeading ? (
        <>
          <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 w-24 h-24 rounded-full bg-[hsl(140,60%,45%)]/25 blur-2xl pointer-events-none" />
          <div className="absolute -top-4 left-1/2 -translate-x-1/2 w-16 h-16 rounded-full bg-[hsl(140,60%,55%)]/20 blur-xl pointer-events-none" />
        </>
      ) : (
        <>
          <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 w-24 h-24 rounded-full bg-[hsl(0,70%,45%)]/25 blur-2xl pointer-events-none" />
          <div className="absolute -top-4 left-1/2 -translate-x-1/2 w-16 h-16 rounded-full bg-[hsl(0,70%,55%)]/20 blur-xl pointer-events-none" />
        </>
      )}
      <div className={`font-display font-bold text-sm sm:text-base ${highlight ? "text-[hsl(45,90%,55%)]" : "text-white"}`}>{name}</div>
      <div className="text-[10px] text-white/60">{formatBRL(value)}</div>
      <div className={`text-[10px] sm:text-xs font-bold uppercase tracking-wide mt-1 ${color}`}>{label}</div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  DUELOS TAB                                                                */
/* ────────────────────────────────────────────────────────────────────────── */

function DuelosTab({ duelResults, weeklyByBroker, prospections }: any) {
  return (
    <div className="space-y-4">
      {duelResults.map((dr: any) => (
        <Card key={dr.duel.id} className="bg-gradient-to-br from-black/60 to-[hsl(140,40%,8%)]/60 border-[hsl(45,90%,55%)]/30">
          <CardContent className="p-4 sm:p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div className="text-[10px] uppercase tracking-[0.3em] text-[hsl(45,90%,55%)] font-bold">
                Partida {dr.duel.id}
              </div>
              {dr.champion ? (
                <Badge className="bg-[hsl(45,90%,55%)] text-black font-bold gap-1">
                  <Trophy className="w-3 h-3" /> Campeão: {shortName(dr.champion)}
                </Badge>
              ) : (
                <Badge variant="outline" className="border-[hsl(140,60%,55%)]/50 text-[hsl(140,60%,55%)]">
                  Em disputa
                </Badge>
              )}
            </div>

            <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 sm:gap-6">
              <PlayerBlock name={dr.duel.aShort} wins={dr.aWins} total={dr.aTotal} prospections={prospections[dr.duel.a] || 0} isChamp={dr.champion === dr.duel.a} />
              <div className="font-display font-black text-white/30 text-2xl sm:text-4xl">×</div>
              <PlayerBlock name={dr.duel.bShort} wins={dr.bWins} total={dr.bTotal} prospections={prospections[dr.duel.b] || 0} isChamp={dr.champion === dr.duel.b} />
            </div>

            {dr.tiebreakNote && (
              <div className="text-center text-xs text-[hsl(45,90%,55%)] italic">{dr.tiebreakNote}</div>
            )}

            {/* Week-by-week */}
            <div className="grid grid-cols-4 gap-2 pt-2 border-t border-white/10">
              {WEEKS.map((w, i) => {
                const status = dr.weekStatus[i];
                const av = weeklyByBroker[dr.duel.a][i];
                const bv = weeklyByBroker[dr.duel.b][i];
                return (
                  <div key={w.n} className="text-center">
                    <div className="text-[9px] uppercase text-white/50 mb-1">S{w.n}</div>
                    <div className={`text-[10px] ${status === "a" ? "text-[hsl(45,90%,55%)] font-bold" : "text-white/70"}`}>{formatBRL(av).replace("R$", "")}</div>
                    <div className="text-[9px] text-white/30 my-0.5">vs</div>
                    <div className={`text-[10px] ${status === "b" ? "text-[hsl(45,90%,55%)] font-bold" : "text-white/70"}`}>{formatBRL(bv).replace("R$", "")}</div>
                    <div className="text-[9px] mt-0.5">
                      {status === "pending" ? <span className="text-white/30">—</span>
                        : status === "draw" ? <span className="text-white/60">empate</span>
                        : <span className="text-[hsl(140,60%,55%)] font-bold">✓</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function PlayerBlock({ name, wins, total, prospections, isChamp }: { name: string; wins: number; total: number; prospections: number; isChamp: boolean }) {
  const isLeading = wins === 1;
  const label = isChamp ? "Campeão" : isLeading ? "Levando a partida" : "Em busca da vitória";
  const color = isChamp
    ? "text-[hsl(45,90%,55%)]"
    : isLeading
    ? "text-[hsl(140,65%,55%)]"
    : "text-[hsl(0,75%,60%)]";
  const bgClass = isChamp
    ? "bg-[hsl(45,90%,55%)]/15 ring-2 ring-[hsl(45,90%,55%)]"
    : isLeading
    ? "bg-gradient-to-t from-[hsl(140,60%,35%)]/40 via-[hsl(140,60%,50%)]/15 to-transparent ring-1 ring-[hsl(140,60%,45%)]/30"
    : "bg-gradient-to-t from-[hsl(0,70%,35%)]/40 via-[hsl(0,70%,50%)]/15 to-transparent ring-1 ring-[hsl(0,70%,45%)]/30";
  return (
    <div className={`relative overflow-hidden rounded-lg p-3 sm:p-4 text-center ${bgClass}`}>
      {isLeading && !isChamp && (
        <>
          <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 w-32 h-32 rounded-full bg-[hsl(140,60%,45%)]/30 blur-3xl pointer-events-none" />
          <div className="absolute -top-6 left-1/2 -translate-x-1/2 w-24 h-24 rounded-full bg-[hsl(140,60%,55%)]/20 blur-2xl pointer-events-none" />
        </>
      )}
      {!isLeading && !isChamp && (
        <>
          <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 w-32 h-32 rounded-full bg-[hsl(0,70%,45%)]/30 blur-3xl pointer-events-none" />
          <div className="absolute -top-6 left-1/2 -translate-x-1/2 w-24 h-24 rounded-full bg-[hsl(0,70%,55%)]/20 blur-2xl pointer-events-none" />
        </>
      )}
      {isChamp && <Trophy className="w-5 h-5 text-[hsl(45,90%,55%)] mx-auto mb-1" />}
      <div className="relative font-display font-black text-base sm:text-2xl text-white">{name}</div>
      <div className={`relative font-display font-black text-sm sm:text-lg my-2 ${color} uppercase tracking-wide leading-tight`}>{label}</div>
      <div className="relative mt-2 text-[11px] sm:text-sm text-white/80 font-medium">{formatBRL(total)}</div>
      <div className="relative text-[9px] text-white/50">{prospections} prospecções</div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  RODADAS TAB                                                               */
/* ────────────────────────────────────────────────────────────────────────── */

function RodadasTab({ duelResults, weeklyByBroker }: any) {
  const now = new Date();
  return (
    <div className="space-y-4">
      {WEEKS.map((w, i) => {
        const ended = now > w.end;
        const inProgress = now >= w.start && now <= w.end;
        return (
          <Card key={w.n} className={`bg-black/50 border ${inProgress ? "border-[hsl(140,60%,55%)]/60 shadow-[0_0_20px_hsl(140,60%,55%)/15%]" : "border-white/10"}`}>
            <CardContent className="p-4 sm:p-5">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <div className="font-display text-lg font-black text-white">{w.label}</div>
                  <div className="text-[10px] text-white/50">
                    {w.start.toLocaleDateString("pt-BR")} → {w.end.toLocaleDateString("pt-BR")}
                  </div>
                </div>
                {inProgress && <Badge className="bg-[hsl(140,60%,45%)] text-white">Em andamento</Badge>}
                {ended && <Badge variant="outline" className="border-white/30 text-white/70">Encerrada</Badge>}
                {!ended && !inProgress && <Badge variant="outline" className="border-white/20 text-white/50">Aguardando</Badge>}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {duelResults.map((dr: any) => {
                  const av = weeklyByBroker[dr.duel.a][i];
                  const bv = weeklyByBroker[dr.duel.b][i];
                  const status = dr.weekStatus[i];
                  return (
                    <div key={dr.duel.id} className="flex items-center justify-between gap-2 px-3 py-2 rounded bg-white/5 text-sm">
                      <span className={status === "a" ? "text-[hsl(45,90%,55%)] font-bold" : "text-white/80"}>
                        {dr.duel.aShort} {formatBRL(av)}
                      </span>
                      <span className="text-white/30 text-xs">×</span>
                      <span className={status === "b" ? "text-[hsl(45,90%,55%)] font-bold" : "text-white/80"}>
                        {formatBRL(bv)} {dr.duel.bShort}
                      </span>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  RANKING TAB                                                               */
/* ────────────────────────────────────────────────────────────────────────── */

function RankingTab({ totalsByBroker, duelResults, prospections }: any) {
  const winsByBroker: Record<string, number> = {};
  duelResults.forEach((dr: any) => {
    winsByBroker[dr.duel.a] = dr.aWins;
    winsByBroker[dr.duel.b] = dr.bWins;
  });

  const ranked = ALL_PARTICIPANTS
    .map((n) => ({
      name: n,
      value: totalsByBroker[n].value,
      wins: winsByBroker[n] || 0,
      prospections: prospections[n] || 0,
    }))
    .sort((a, b) => b.value - a.value || b.wins - a.wins);

  return (
    <Card className="bg-black/50 border-white/10 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-[hsl(45,90%,55%)]/10 border-b border-[hsl(45,90%,55%)]/30">
            <tr className="text-left text-[10px] uppercase tracking-widest text-[hsl(45,90%,55%)]">
              <th className="px-4 py-3">#</th>
              <th className="px-4 py-3">Vendedor</th>
              <th className="px-4 py-3 text-right">Volume</th>
              <th className="px-4 py-3 text-right">Vitórias</th>
              <th className="px-4 py-3 text-right">Prospecções</th>
            </tr>
          </thead>
          <tbody>
            {ranked.map((r, i) => (
              <tr key={r.name} className="border-b border-white/5 hover:bg-white/5">
                <td className="px-4 py-3 font-display font-black text-white/60">{i + 1}º</td>
                <td className="px-4 py-3 font-bold text-white">{shortName(r.name)}</td>
                <td className="px-4 py-3 text-right text-white font-medium">{formatBRL(r.value)}</td>
                <td className="px-4 py-3 text-right text-[hsl(45,90%,55%)] font-bold">{r.wins}</td>
                <td className="px-4 py-3 text-right text-white/70">{r.prospections}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  ARTILHARIA TAB                                                            */
/* ────────────────────────────────────────────────────────────────────────── */

function ArtilhariaTab({ totalsByBroker }: any) {
  const ranked = ALL_PARTICIPANTS
    .map((n) => ({ name: n, ...totalsByBroker[n] }))
    .sort((a, b) => b.value - a.value);
  const maxValue = ranked[0]?.value || 1;

  return (
    <div className="space-y-3">
      {/* Full list */}
      <Card className="bg-black/50 border-white/10">
        <CardContent className="p-2 sm:p-3 space-y-2">
          {ranked.map((r, i) => (
            <div key={r.name} className="flex items-center gap-3 p-2 rounded hover:bg-white/5">
              <div className="w-8 text-center font-display font-black text-white/60">{i + 1}</div>
              <div className="flex-1">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-bold text-white">{shortName(r.name)}</span>
                  <span className="text-[hsl(45,90%,55%)] font-bold">{formatBRL(r.value)}</span>
                </div>
                <Progress value={(r.value / maxValue) * 100} className="h-1.5 mt-1 bg-white/10" />
                <div className="text-[10px] text-white/40 mt-0.5">{r.count} vendas · ticket médio {formatBRL(r.count ? r.value / r.count : 0)}</div>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  PREMIAÇÃO TAB                                                             */
/* ────────────────────────────────────────────────────────────────────────── */

function PremiacaoTab({ duelResults }: any) {
  return (
    <div className="space-y-4">
      <Card className="bg-gradient-to-br from-[hsl(140,60%,15%)]/60 to-black/60 border-[hsl(140,60%,45%)]/40">
        <CardContent className="p-5 text-center">
          <Shirt className="w-12 h-12 mx-auto text-[hsl(140,60%,55%)] mb-2" />
          <div className="font-display text-xl sm:text-2xl font-black text-white">6 Camisas Oficiais da Seleção Brasileira</div>
          <div className="text-sm text-white/70 mt-1">Uma para cada campeão de partida</div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {duelResults.map((dr: any) => {
          const status = dr.champion ? "Campeão" : (dr.aWins > 0 || dr.bWins > 0) ? "Em disputa" : "Aguardando";
          const leader = dr.champion ?? (dr.aWins > dr.bWins ? dr.duel.a : dr.bWins > dr.aWins ? dr.duel.b : null);
          return (
            <Card key={dr.duel.id} className={`border ${dr.champion ? "bg-[hsl(45,90%,55%)]/10 border-[hsl(45,90%,55%)]" : "bg-black/40 border-white/10"}`}>
              <CardContent className="p-4 flex items-center gap-3">
                <div className={`w-12 h-12 rounded-full flex items-center justify-center shrink-0 ${dr.champion ? "bg-[hsl(45,90%,55%)] text-black" : "bg-white/10 text-white/60"}`}>
                  <Shirt className="w-6 h-6" />
                </div>
                <div className="flex-1">
                  <div className="text-[10px] uppercase tracking-widest text-[hsl(140,60%,55%)] font-bold">Partida {dr.duel.id}</div>
                  <div className="font-display font-bold text-white">
                    {dr.duel.aShort} × {dr.duel.bShort}
                  </div>
                  <div className="text-xs mt-0.5">
                    {dr.champion ? (
                      <span className="text-[hsl(45,90%,55%)] font-bold">🏆 {shortName(dr.champion)}</span>
                    ) : leader ? (
                      <span className="text-white/70">{shortName(leader)} classificado</span>
                    ) : (
                      <span className="text-white/50">{status}</span>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  ADMIN PROSPECTIONS                                                        */
/* ────────────────────────────────────────────────────────────────────────── */

function AdminProspections({ prospections, setProspections }: { prospections: Record<string, number>; setProspections: (p: Record<string, number>) => void }) {
  const [local, setLocal] = useState<Record<string, string>>(() => {
    const out: Record<string, string> = {};
    ALL_PARTICIPANTS.forEach((n) => (out[n] = String(prospections[n] || 0)));
    return out;
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const out: Record<string, string> = {};
    ALL_PARTICIPANTS.forEach((n) => (out[n] = String(prospections[n] || 0)));
    setLocal(out);
  }, [prospections]);

  async function save() {
    setSaving(true);
    const rows = ALL_PARTICIPANTS.map((n) => ({
      broker_name: n,
      mes_ref: MES_REF,
      prospections: parseInt(local[n] || "0", 10) || 0,
    }));
    const { error } = await supabase
      .from("copa_prospections")
      .upsert(rows, { onConflict: "broker_name,mes_ref" });
    setSaving(false);
    if (error) {
      toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
      return;
    }
    const newMap: Record<string, number> = {};
    rows.forEach((r) => (newMap[r.broker_name] = r.prospections));
    setProspections(newMap);
    toast({ title: "Prospecções salvas!" });
  }

  return (
    <Card className="bg-black/50 border-white/10">
      <CardContent className="p-4 sm:p-6 space-y-4">
        <div>
          <div className="font-display text-lg font-bold text-white">Prospecções do Mês</div>
          <div className="text-xs text-white/60">Usado como 1º critério de desempate</div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {ALL_PARTICIPANTS.map((n) => (
            <div key={n} className="space-y-1">
              <label className="text-xs text-white/70">{shortName(n)} <span className="text-white/40">({n})</span></label>
              <Input
                type="number"
                min={0}
                value={local[n] || ""}
                onChange={(e) => setLocal({ ...local, [n]: e.target.value })}
                className="bg-black/40 border-white/20 text-white"
              />
            </div>
          ))}
        </div>
        <Button onClick={save} disabled={saving} className="bg-[hsl(45,90%,55%)] text-black hover:bg-[hsl(45,90%,65%)] font-bold">
          {saving ? "Salvando..." : "Salvar prospecções"}
        </Button>
      </CardContent>
    </Card>
  );
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  SLOGAN                                                                    */
/* ────────────────────────────────────────────────────────────────────────── */

function Slogan() {
  return (
    <div className="mt-10 text-center border-t border-[hsl(45,90%,55%)]/20 pt-6 space-y-2">
      <div className="text-[10px] uppercase tracking-[0.4em] text-[hsl(45,90%,55%)]">Copa do Mundo de Vendas DP 2026</div>
      <div className="font-display text-sm sm:text-base text-white/70 leading-relaxed">
        22 dias úteis · 30 dias de competição · 6 partidas · 6 camisas · 1 história para contar.
      </div>
      <div className="font-display text-lg sm:text-xl font-black text-white">
        Venda como campeão. <span className="text-[hsl(140,60%,55%)]">Jogue pela história.</span>
      </div>
    </div>
  );
}