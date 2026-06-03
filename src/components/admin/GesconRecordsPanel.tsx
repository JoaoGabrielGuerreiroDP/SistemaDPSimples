import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Trophy, Medal, Star, Flame, TrendingUp, Crown, Award, Target, Zap, Calendar } from "lucide-react";
import { Progress } from "@/components/ui/progress";

interface Venda {
  vendedor: string;
  credito: string;
  data_venda: string;
  administradora: string;
  situacao: string;
  cidade?: string | null;
  nome?: string;
}

interface GesconRecordsPanelProps {
  vendas: Venda[];
}

function parseCredito(v: string) { return parseFloat(v) || 0; }
const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

function parseDate(d: string) {
  const parts = d.split(/[/-]/);
  return new Date(+parts[2], +parts[1] - 1, +parts[0]);
}

export function GesconRecordsPanel({ vendas }: GesconRecordsPanelProps) {
  // ====== SALES RECORDS ======
  const salesRecords = useMemo(() => {
    if (!vendas.length) return null;

    // Biggest single sale
    let biggestSale = vendas[0];
    for (const v of vendas) {
      if (parseCredito(v.credito) > parseCredito(biggestSale.credito)) biggestSale = v;
    }

    // Best day (most sales)
    const dayMap = new Map<string, { date: string; qtd: number; credito: number }>();
    for (const v of vendas) {
      const cur = dayMap.get(v.data_venda) || { date: v.data_venda, qtd: 0, credito: 0 };
      cur.qtd++;
      cur.credito += parseCredito(v.credito);
      dayMap.set(v.data_venda, cur);
    }
    const bestDayQtd = Array.from(dayMap.values()).sort((a, b) => b.qtd - a.qtd)[0];
    const bestDayCredito = Array.from(dayMap.values()).sort((a, b) => b.credito - a.credito)[0];

    // Best month
    const monthMap = new Map<string, { mes: string; qtd: number; credito: number }>();
    for (const v of vendas) {
      try {
        const parts = v.data_venda.split(/[/-]/);
        const key = `${parts[1]}/${parts[2]}`;
        const cur = monthMap.get(key) || { mes: key, qtd: 0, credito: 0 };
        cur.qtd++;
        cur.credito += parseCredito(v.credito);
        monthMap.set(key, cur);
      } catch { }
    }
    const bestMonthQtd = Array.from(monthMap.values()).sort((a, b) => b.qtd - a.qtd)[0];
    const bestMonthCredito = Array.from(monthMap.values()).sort((a, b) => b.credito - a.credito)[0];

    return { biggestSale, bestDayQtd, bestDayCredito, bestMonthQtd, bestMonthCredito };
  }, [vendas]);

  // ====== SELLER STREAKS ======
  const sellerStreaks = useMemo(() => {
    const sellerDays = new Map<string, Set<string>>();
    for (const v of vendas) {
      const set = sellerDays.get(v.vendedor) || new Set();
      set.add(v.data_venda);
      sellerDays.set(v.vendedor, set);
    }

    return Array.from(sellerDays.entries()).map(([seller, days]) => {
      const sorted = Array.from(days).map(d => {
        const p = d.split(/[/-]/);
        return new Date(+p[2], +p[1] - 1, +p[0]);
      }).sort((a, b) => a.getTime() - b.getTime());

      let maxStreak = 1, currentStreak = 1;
      for (let i = 1; i < sorted.length; i++) {
        const diff = (sorted[i].getTime() - sorted[i - 1].getTime()) / 86400000;
        if (diff === 1) { currentStreak++; maxStreak = Math.max(maxStreak, currentStreak); }
        else { currentStreak = 1; }
      }
      return { seller, streak: maxStreak, totalDays: days.size };
    }).sort((a, b) => b.streak - a.streak);
  }, [vendas]);

  // ====== ALL-TIME RANKING ======
  const allTimeRanking = useMemo(() => {
    const map = new Map<string, { qtd: number; credito: number; firstSale: Date; lastSale: Date }>();
    for (const v of vendas) {
      const cur = map.get(v.vendedor) || { qtd: 0, credito: 0, firstSale: new Date(), lastSale: new Date(0) };
      cur.qtd++;
      cur.credito += parseCredito(v.credito);
      try {
        const d = parseDate(v.data_venda);
        if (d < cur.firstSale) cur.firstSale = d;
        if (d > cur.lastSale) cur.lastSale = d;
      } catch { }
      map.set(v.vendedor, cur);
    }
    return Array.from(map.entries())
      .map(([name, d]) => ({ name, ...d, ticket: d.qtd > 0 ? d.credito / d.qtd : 0 }))
      .sort((a, b) => b.credito - a.credito);
  }, [vendas]);

  const maxCredito = allTimeRanking[0]?.credito || 1;

  // ====== ACHIEVEMENTS / BADGES ======
  const achievements = useMemo(() => {
    const badges: { seller: string; badge: string; icon: React.ReactNode; description: string }[] = [];
    for (const s of allTimeRanking) {
      if (s.qtd >= 100) badges.push({ seller: s.name, badge: "Centenário", icon: <Crown className="h-4 w-4 text-yellow-500" />, description: "100+ vendas" });
      else if (s.qtd >= 50) badges.push({ seller: s.name, badge: "Veterano", icon: <Medal className="h-4 w-4 text-amber-500" />, description: "50+ vendas" });
      else if (s.qtd >= 20) badges.push({ seller: s.name, badge: "Experiente", icon: <Star className="h-4 w-4 text-blue-500" />, description: "20+ vendas" });

      if (s.credito >= 10000000) badges.push({ seller: s.name, badge: "10 Milhões", icon: <Zap className="h-4 w-4 text-purple-500" />, description: "R$ 10M+ em crédito" });
      else if (s.credito >= 5000000) badges.push({ seller: s.name, badge: "5 Milhões", icon: <TrendingUp className="h-4 w-4 text-emerald-500" />, description: "R$ 5M+ em crédito" });

      if (s.ticket >= 300000) badges.push({ seller: s.name, badge: "High Ticket", icon: <Target className="h-4 w-4 text-rose-500" />, description: "Ticket médio ≥ R$ 300k" });
    }

    for (const s of sellerStreaks) {
      if (s.streak >= 10) badges.push({ seller: s.seller, badge: "Em Chamas", icon: <Flame className="h-4 w-4 text-orange-500" />, description: `${s.streak} dias seguidos vendendo` });
      else if (s.streak >= 5) badges.push({ seller: s.seller, badge: "Sequência", icon: <Flame className="h-4 w-4 text-amber-400" />, description: `${s.streak} dias seguidos vendendo` });
    }

    return badges;
  }, [allTimeRanking, sellerStreaks]);

  // ====== KPI RECORDS ======
  const kpiRecords = useMemo(() => {
    const monthMap = new Map<string, { qtd: number; credito: number; sellers: Set<string> }>();
    for (const v of vendas) {
      try {
        const parts = v.data_venda.split(/[/-]/);
        const key = `${parts[1]}/${parts[2]}`;
        const cur = monthMap.get(key) || { qtd: 0, credito: 0, sellers: new Set<string>() };
        cur.qtd++;
        cur.credito += parseCredito(v.credito);
        cur.sellers.add(v.vendedor);
        monthMap.set(key, cur);
      } catch { }
    }

    const months = Array.from(monthMap.entries()).map(([mes, d]) => ({
      mes, qtd: d.qtd, credito: d.credito, ticket: d.qtd > 0 ? d.credito / d.qtd : 0, sellers: d.sellers.size,
    }));

    // Current month
    const now = new Date();
    const curKey = `${String(now.getMonth() + 1).padStart(2, "0")}/${now.getFullYear()}`;
    const current = months.find(m => m.mes === curKey);

    const recordQtd = months.sort((a, b) => b.qtd - a.qtd)[0];
    const recordCredito = months.sort((a, b) => b.credito - a.credito)[0];
    const recordTicket = months.sort((a, b) => b.ticket - a.ticket)[0];

    return { current, recordQtd, recordCredito, recordTicket, curKey };
  }, [vendas]);

  if (!vendas.length) {
    return <p className="text-sm text-muted-foreground text-center py-8">Sem dados para exibir recordes.</p>;
  }

  const podiumColors = ["text-yellow-500", "text-gray-400", "text-amber-700"];
  const podiumIcons = [Crown, Medal, Award];

  return (
    <div className="space-y-4">
      {/* KPI Records vs Current */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {[
          { label: "Recorde Vendas/Mês", record: kpiRecords.recordQtd, field: "qtd" as const, fmtFn: (v: number) => `${v} vendas`, current: kpiRecords.current?.qtd || 0 },
          { label: "Recorde Crédito/Mês", record: kpiRecords.recordCredito, field: "credito" as const, fmtFn: fmt, current: kpiRecords.current?.credito || 0 },
          { label: "Recorde Ticket Médio", record: kpiRecords.recordTicket, field: "ticket" as const, fmtFn: fmt, current: kpiRecords.current?.ticket || 0 },
        ].map(({ label, record, field, fmtFn, current }) => {
          const recordVal = record?.[field] || 0;
          const pct = recordVal > 0 ? (current / recordVal) * 100 : 0;
          return (
            <Card key={label}>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Trophy className="h-4 w-4 text-primary" />
                  <p className="text-[11px] font-medium text-muted-foreground uppercase">{label}</p>
                </div>
                <p className="text-lg font-bold">{fmtFn(recordVal)}</p>
                <p className="text-[10px] text-muted-foreground mb-2">em {record?.mes || "—"}</p>
                <div className="flex items-center gap-2">
                  <Progress value={Math.min(pct, 100)} className="h-1.5 flex-1" />
                  <span className="text-[10px] font-medium">{pct.toFixed(0)}%</span>
                </div>
                <p className="text-[10px] text-muted-foreground mt-1">
                  Mês atual: {fmtFn(current)}
                </p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Sales Records */}
      {salesRecords && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Star className="h-4 w-4 text-primary" />
              Recordes de Vendas
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <div className="p-3 rounded-lg bg-muted/50">
              <p className="text-[10px] text-muted-foreground uppercase font-medium">Maior Venda</p>
              <p className="text-base font-bold">{fmt(parseCredito(salesRecords.biggestSale.credito))}</p>
              <p className="text-xs text-muted-foreground">{salesRecords.biggestSale.vendedor} • {salesRecords.biggestSale.data_venda}</p>
            </div>
            <div className="p-3 rounded-lg bg-muted/50">
              <p className="text-[10px] text-muted-foreground uppercase font-medium">Melhor Dia (Qtd)</p>
              <p className="text-base font-bold">{salesRecords.bestDayQtd.qtd} vendas</p>
              <p className="text-xs text-muted-foreground">{salesRecords.bestDayQtd.date} • {fmt(salesRecords.bestDayQtd.credito)}</p>
            </div>
            <div className="p-3 rounded-lg bg-muted/50">
              <p className="text-[10px] text-muted-foreground uppercase font-medium">Melhor Dia (Crédito)</p>
              <p className="text-base font-bold">{fmt(salesRecords.bestDayCredito.credito)}</p>
              <p className="text-xs text-muted-foreground">{salesRecords.bestDayCredito.date} • {salesRecords.bestDayCredito.qtd} vendas</p>
            </div>
            <div className="p-3 rounded-lg bg-muted/50">
              <p className="text-[10px] text-muted-foreground uppercase font-medium">Melhor Mês (Qtd)</p>
              <p className="text-base font-bold">{salesRecords.bestMonthQtd.qtd} vendas</p>
              <p className="text-xs text-muted-foreground">{salesRecords.bestMonthQtd.mes}</p>
            </div>
            <div className="p-3 rounded-lg bg-muted/50">
              <p className="text-[10px] text-muted-foreground uppercase font-medium">Melhor Mês (Crédito)</p>
              <p className="text-base font-bold">{fmt(salesRecords.bestMonthCredito.credito)}</p>
              <p className="text-xs text-muted-foreground">{salesRecords.bestMonthCredito.mes}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Achievements */}
      {achievements.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Award className="h-4 w-4 text-primary" />
              Conquistas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {achievements.map((a, i) => (
                <div key={i} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-muted/50 border border-border/50">
                  {a.icon}
                  <span className="text-xs font-medium">{a.seller}</span>
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{a.badge}</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Streaks */}
      {sellerStreaks.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Flame className="h-4 w-4 text-primary" />
              Maiores Sequências (dias seguidos com vendas)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {sellerStreaks.slice(0, 10).map((s, i) => (
                <div key={s.seller} className="flex items-center gap-3">
                  <span className="text-xs font-mono text-muted-foreground w-5">{i + 1}.</span>
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-medium truncate block">{s.seller}</span>
                  </div>
                  <Badge variant={s.streak >= 10 ? "default" : s.streak >= 5 ? "secondary" : "outline"} className="text-xs">
                    {s.streak} dias
                  </Badge>
                  <span className="text-[10px] text-muted-foreground w-20 text-right">{s.totalDays} dias ativos</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* All-time Ranking */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Trophy className="h-4 w-4 text-primary" />
            Ranking All-Time
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {allTimeRanking.map((s, i) => {
              const PodiumIcon = i < 3 ? podiumIcons[i] : null;
              return (
                <div key={s.name} className="flex items-center gap-3">
                  <div className="w-6 flex justify-center">
                    {PodiumIcon ? (
                      <PodiumIcon className={`h-4 w-4 ${podiumColors[i]}`} />
                    ) : (
                      <span className="text-xs font-mono text-muted-foreground">{i + 1}</span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="text-sm font-medium truncate">{s.name}</span>
                      <span className="text-xs text-muted-foreground shrink-0 ml-2">{fmt(s.credito)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Progress value={(s.credito / maxCredito) * 100} className="h-1.5 flex-1" />
                      <span className="text-[10px] text-muted-foreground w-16 text-right">{s.qtd} vendas</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
