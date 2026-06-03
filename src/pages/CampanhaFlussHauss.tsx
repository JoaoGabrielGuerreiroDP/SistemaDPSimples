import { useMemo, useState } from "react";
import { useGoogleSheetsData, type SaleRow } from "@/hooks/useGoogleSheetsData";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Palmtree, Trophy, Lock, Check, Crown } from "lucide-react";
import flussHauss1 from "@/assets/fluss-hauss-1.jpg";
import flussHauss2 from "@/assets/fluss-hauss-2.jpg";
import flussHauss3 from "@/assets/fluss-hauss-3.jpg";
import flussHauss4 from "@/assets/fluss-hauss-4.jpg";

const FOTOS: { src: string; alt: string }[] = [
  { src: flussHauss1, alt: "Pórtico de entrada da Fluss Haus Land" },
  { src: flussHauss2, alt: "Café da Fluss Haus Land" },
  { src: flussHauss3, alt: "Casas temáticas e área infantil da Fluss Haus Land" },
  { src: flussHauss4, alt: "Bolachas artesanais da Fluss Haus Land" },
];

const MARCOS: { valor: number; diarias: number; label: string }[] = [
  { valor: 3_500_000, diarias: 1, label: "R$ 3,5 mi" },
  { valor: 4_000_000, diarias: 1, label: "R$ 4 mi" },
  { valor: 5_000_000, diarias: 1, label: "R$ 5 mi" },
  { valor: 6_000_000, diarias: 1, label: "R$ 6 mi" },
  { valor: 8_000_000, diarias: 1, label: "R$ 8 mi" },
  { valor: 10_000_000, diarias: 2, label: "R$ 10 mi" },
];
const TOTAL_DIARIAS = MARCOS.reduce((s, m) => s + m.diarias, 0); // 7
const META_MAX = 10_000_000;

function parseBRDate(raw: string): Date | null {
  if (!raw) return null;
  const parts = raw.split("/");
  if (parts.length !== 3) return null;
  const [d, m, y] = parts.map(Number);
  return new Date(y, m - 1, d);
}

function fmtBRL(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
}

function startOfWeek(d: Date) {
  const x = new Date(d);
  const day = x.getDay(); // 0 = Sun
  const diff = day === 0 ? -6 : 1 - day; // back to Monday
  x.setDate(x.getDate() + diff);
  x.setHours(0, 0, 0, 0);
  return x;
}

function endOfWeek(start: Date) {
  const x = new Date(start);
  x.setDate(x.getDate() + 6);
  x.setHours(23, 59, 59, 999);
  return x;
}

function fmtRange(start: Date, end: Date) {
  const opt: Intl.DateTimeFormatOptions = { day: "2-digit", month: "2-digit" };
  return `${start.toLocaleDateString("pt-BR", opt)} – ${end.toLocaleDateString("pt-BR", opt)}`;
}

function normalize(s: string) {
  return (s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
}

// Sócios excluídos da campanha
const SOCIOS_EXCLUIDOS = ["daniel", "diego", "alan", "andre", "andré"];
function isSocio(nome: string) {
  const n = normalize(nome);
  return SOCIOS_EXCLUIDOS.some((s) => n.includes(s));
}

export default function CampanhaFlussHauss() {
  const { allRows, loading, error } = useGoogleSheetsData();
  const [weekOffset, setWeekOffset] = useState(0); // 0 = current, -1 = previous

  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();

  const totalMes = useMemo(() => {
    return allRows.reduce((sum, r) => {
      const d = parseBRDate(r.dataVenda);
      if (!d) return sum;
      if (isSocio(r.corretor)) return sum;
      if (d.getFullYear() === year && d.getMonth() === month) return sum + r.valor;
      return sum;
    }, 0);
  }, [allRows, year, month]);

  const diariasConquistadas = MARCOS.reduce(
    (s, m) => s + (totalMes >= m.valor ? m.diarias : 0),
    0
  );
  const proximoMarco = MARCOS.find((m) => totalMes < m.valor);
  const progressPct = Math.min(100, (totalMes / META_MAX) * 100);

  // Ranking semanal
  const baseWeek = new Date(now);
  baseWeek.setDate(baseWeek.getDate() + weekOffset * 7);
  const weekStart = startOfWeek(baseWeek);
  const weekEnd = endOfWeek(weekStart);

  const ranking = useMemo(() => {
    const map = new Map<string, { nome: string; total: number; propostas: number }>();
    for (const r of allRows) {
      const d = parseBRDate(r.dataVenda);
      if (!d) continue;
      if (d < weekStart || d > weekEnd) continue;
      if (isSocio(r.corretor)) continue;
      const key = normalize(r.corretor);
      if (!key) continue;
      const cur = map.get(key) ?? { nome: r.corretor, total: 0, propostas: 0 };
      cur.total += r.valor;
      cur.propostas += 1;
      map.set(key, cur);
    }
    return [...map.values()].sort((a, b) => b.total - a.total).slice(0, 10);
  }, [allRows, weekStart, weekEnd]);

  const ganhador = ranking[0];

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-start gap-4">
        <div className="p-3 rounded-xl bg-gradient-to-br from-amber-500/20 to-orange-500/10 border border-amber-500/30">
          <Palmtree className="h-8 w-8 text-amber-500" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Campanha Fluss Hauss</h1>
          <p className="text-sm text-muted-foreground">
            Diárias no Fluss Hauss · Santa Catarina · meta coletiva mensal
          </p>
        </div>
      </div>

      {/* Galeria Fluss Hauss */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {FOTOS.map((f, i) => (
          <div
            key={f.src}
            className={`relative overflow-hidden rounded-xl border border-amber-500/20 group ${
              i === 0 ? "sm:col-span-2 sm:row-span-2 aspect-[16/9] sm:aspect-auto" : "aspect-[16/10]"
            }`}
          >
            <img
              src={f.src}
              alt={f.alt}
              loading="lazy"
              width={1280}
              height={768}
              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
            {i === 0 && (
              <div className="absolute bottom-3 left-4 right-4 text-white">
                <p className="text-xs uppercase tracking-wider opacity-80">Seu prêmio</p>
                <p className="text-lg font-bold">Fluss Hauss · Santa Catarina</p>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Hero progresso */}
      <Card className="overflow-hidden border-amber-500/20">
        <div className="bg-gradient-to-br from-amber-500/10 via-transparent to-orange-500/5 p-6 space-y-6">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-wider text-muted-foreground">
                Vendas do mês
              </p>
              <p className="text-4xl font-bold tabular-nums">{fmtBRL(totalMes)}</p>
              {proximoMarco && (
                <p className="text-sm text-muted-foreground mt-1">
                  Faltam <span className="font-semibold text-foreground">{fmtBRL(proximoMarco.valor - totalMes)}</span> para {proximoMarco.label}
                </p>
              )}
              {!proximoMarco && (
                <p className="text-sm text-amber-600 dark:text-amber-400 mt-1 font-semibold">
                  Meta máxima atingida! 🎉
                </p>
              )}
            </div>
            <div className="text-right">
              <p className="text-xs uppercase tracking-wider text-muted-foreground">
                Diárias conquistadas
              </p>
              <p className="text-4xl font-bold tabular-nums text-amber-500">
                {diariasConquistadas}
                <span className="text-xl text-muted-foreground font-normal"> / {TOTAL_DIARIAS}</span>
              </p>
            </div>
          </div>

          {/* Progress with markers */}
          <div className="relative pt-6 pb-10">
            <Progress value={progressPct} className="h-3" />
            {MARCOS.map((m) => {
              const left = (m.valor / META_MAX) * 100;
              const reached = totalMes >= m.valor;
              return (
                <div
                  key={m.valor}
                  className="absolute -translate-x-1/2 flex flex-col items-center"
                  style={{ left: `${left}%`, top: 0 }}
                >
                  <div
                    className={`w-3 h-3 rounded-full border-2 ${
                      reached
                        ? "bg-amber-500 border-amber-500"
                        : "bg-background border-muted-foreground/40"
                    }`}
                  />
                  <div
                    className={`mt-7 text-[10px] font-semibold whitespace-nowrap ${
                      reached ? "text-amber-500" : "text-muted-foreground"
                    }`}
                  >
                    {m.label}
                  </div>
                  <div className="text-[10px] text-muted-foreground">
                    +{m.diarias}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </Card>

      {/* Tabela de marcos */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Marcos da campanha</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y divide-border">
            {MARCOS.map((m, i) => {
              const reached = totalMes >= m.valor;
              const acumulado = MARCOS.slice(0, i + 1).reduce((s, x) => s + x.diarias, 0);
              const falta = m.valor - totalMes;
              return (
                <div
                  key={m.valor}
                  className={`flex items-center gap-4 p-4 ${
                    reached ? "bg-amber-500/5" : ""
                  }`}
                >
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                      reached
                        ? "bg-amber-500/20 text-amber-500"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {reached ? <Check className="h-5 w-5" /> : <Lock className="h-4 w-4" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold">{m.label}</div>
                    <div className="text-xs text-muted-foreground">
                      {reached
                        ? `Conquistado · ${acumulado} ${acumulado === 1 ? "diária" : "diárias"} acumuladas`
                        : `Faltam ${fmtBRL(falta)}`}
                    </div>
                  </div>
                  <Badge
                    variant={reached ? "default" : "secondary"}
                    className={reached ? "bg-amber-500 hover:bg-amber-500" : ""}
                  >
                    +{m.diarias} {m.diarias === 1 ? "diária" : "diárias"}
                  </Badge>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Ranking semanal */}
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                <Trophy className="h-5 w-5 text-amber-500" />
                Ranking da semana
              </CardTitle>
              <p className="text-xs text-muted-foreground mt-1">
                {fmtRange(weekStart, weekEnd)} · 1º lugar leva a diária da semana
              </p>
            </div>
            <div className="flex gap-1">
              <Button
                size="sm"
                variant={weekOffset === -1 ? "default" : "outline"}
                onClick={() => setWeekOffset(-1)}
              >
                Semana anterior
              </Button>
              <Button
                size="sm"
                variant={weekOffset === 0 ? "default" : "outline"}
                onClick={() => setWeekOffset(0)}
              >
                Semana atual
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          {loading && (
            <p className="text-sm text-muted-foreground py-4">Carregando vendas...</p>
          )}
          {error && (
            <p className="text-sm text-destructive py-4">{error}</p>
          )}
          {!loading && ranking.length === 0 && (
            <p className="text-sm text-muted-foreground py-4">
              Nenhuma venda registrada nesta semana ainda.
            </p>
          )}
          {ranking.map((r, idx) => {
            const isWinner = idx === 0;
            return (
              <div
                key={r.nome}
                className={`flex items-center gap-3 p-3 rounded-lg ${
                  isWinner
                    ? "bg-gradient-to-r from-amber-500/15 to-transparent border border-amber-500/30"
                    : "bg-muted/30"
                }`}
              >
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm shrink-0 ${
                    isWinner
                      ? "bg-amber-500 text-white"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {isWinner ? <Crown className="h-4 w-4" /> : idx + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{r.nome}</div>
                  <div className="text-xs text-muted-foreground">
                    {r.propostas} {r.propostas === 1 ? "proposta" : "propostas"}
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-semibold tabular-nums">{fmtBRL(r.total)}</div>
                  {isWinner && (
                    <div className="text-[10px] text-amber-600 dark:text-amber-400 font-semibold uppercase tracking-wider">
                      Ganhador da diária
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}