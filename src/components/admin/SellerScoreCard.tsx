import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Trophy, TrendingUp, Target, Layers, ShoppingCart, Star } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  ResponsiveContainer, Tooltip,
} from "recharts";

interface GesconVenda {
  vendedor: string;
  credito: string;
  situacao: string;
  administradora: string;
}

interface SellerScore {
  name: string;
  volume: number;
  ticketMedio: number;
  taxaConfirmacao: number;
  diversidadeAdm: number;
  scoreVolume: number;
  scoreTicket: number;
  scoreConfirmacao: number;
  scoreDiversidade: number;
  scoreFinal: number;
  totalCredito: number;
}

function parseCredito(v: string) { return parseFloat(v) || 0; }

const fmt = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

const WEIGHTS = { volume: 0.30, ticket: 0.25, confirmacao: 0.30, diversidade: 0.15 };

const MEDALS = ["🥇", "🥈", "🥉"];
const PODIUM_BG = [
  "from-[hsl(45,85%,50%)]/20 to-[hsl(45,85%,50%)]/5 border-[hsl(45,85%,50%)]/40",
  "from-[hsl(215,12%,60%)]/20 to-[hsl(215,12%,60%)]/5 border-[hsl(215,12%,60%)]/40",
  "from-[hsl(25,70%,50%)]/20 to-[hsl(25,70%,50%)]/5 border-[hsl(25,70%,50%)]/40",
];

function normalize(value: number, min: number, max: number): number {
  if (max === min) return 50;
  return ((value - min) / (max - min)) * 100;
}

export function useSellerScores(vendas: GesconVenda[]): SellerScore[] {
  return useMemo(() => {
    if (!vendas.length) return [];

    const map = new Map<string, { qtd: number; credito: number; confirmadas: number; admins: Set<string> }>();
    for (const v of vendas) {
      const cur = map.get(v.vendedor) || { qtd: 0, credito: 0, confirmadas: 0, admins: new Set<string>() };
      cur.qtd++;
      cur.credito += parseCredito(v.credito);
      if (v.situacao === "Confirmada") cur.confirmadas++;
      cur.admins.add(v.administradora);
      map.set(v.vendedor, cur);
    }

    const raw = Array.from(map.entries()).map(([name, d]) => ({
      name,
      volume: d.qtd,
      ticketMedio: d.qtd > 0 ? d.credito / d.qtd : 0,
      taxaConfirmacao: d.qtd > 0 ? (d.confirmadas / d.qtd) * 100 : 0,
      diversidadeAdm: d.admins.size,
      totalCredito: d.credito,
    }));

    const volumes = raw.map(r => r.volume);
    const tickets = raw.map(r => r.ticketMedio);
    const taxas = raw.map(r => r.taxaConfirmacao);
    const divs = raw.map(r => r.diversidadeAdm);

    const minV = Math.min(...volumes), maxV = Math.max(...volumes);
    const minT = Math.min(...tickets), maxT = Math.max(...tickets);
    const minC = Math.min(...taxas), maxC = Math.max(...taxas);
    const minD = Math.min(...divs), maxD = Math.max(...divs);

    return raw.map(r => {
      const scoreVolume = normalize(r.volume, minV, maxV);
      const scoreTicket = normalize(r.ticketMedio, minT, maxT);
      const scoreConfirmacao = normalize(r.taxaConfirmacao, minC, maxC);
      const scoreDiversidade = normalize(r.diversidadeAdm, minD, maxD);
      const scoreFinal =
        scoreVolume * WEIGHTS.volume +
        scoreTicket * WEIGHTS.ticket +
        scoreConfirmacao * WEIGHTS.confirmacao +
        scoreDiversidade * WEIGHTS.diversidade;
      return { ...r, scoreVolume, scoreTicket, scoreConfirmacao, scoreDiversidade, scoreFinal };
    }).sort((a, b) => b.scoreFinal - a.scoreFinal);
  }, [vendas]);
}

function ScoreBar({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="space-y-0.5">
      <div className="flex justify-between text-[10px]">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-semibold">{value.toFixed(0)}</span>
      </div>
      <div className="h-1.5 rounded-full bg-muted/40 overflow-hidden">
        <div className={cn("h-full rounded-full transition-all", color)} style={{ width: `${Math.min(value, 100)}%` }} />
      </div>
    </div>
  );
}

function ScoreRadar({ seller }: { seller: SellerScore }) {
  const data = [
    { axis: "Volume", value: seller.scoreVolume },
    { axis: "Ticket", value: seller.scoreTicket },
    { axis: "Confirmação", value: seller.scoreConfirmacao },
    { axis: "Diversidade", value: seller.scoreDiversidade },
  ];
  return (
    <ResponsiveContainer width="100%" height={200}>
      <RadarChart data={data}>
        <PolarGrid stroke="hsl(var(--border))" />
        <PolarAngleAxis dataKey="axis" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
        <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
        <Radar dataKey="value" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.25} strokeWidth={2} />
        <Tooltip formatter={(v: number) => v.toFixed(1)} />
      </RadarChart>
    </ResponsiveContainer>
  );
}

interface SellerScoreTabProps {
  scores: SellerScore[];
}

export function SellerScoreTab({ scores }: SellerScoreTabProps) {
  if (!scores.length) return <p className="text-sm text-muted-foreground text-center py-8">Sem dados para calcular scores.</p>;

  const top3 = scores.slice(0, 3);
  const rest = scores.slice(3);

  return (
    <div className="space-y-4">
      {/* Explanation */}
      <Card>
        <CardContent className="pt-4 pb-3">
          <div className="flex items-start gap-2">
            <Star className="h-4 w-4 text-[hsl(45,85%,50%)] mt-0.5 shrink-0" />
            <div className="text-xs text-muted-foreground space-y-1">
              <p className="font-semibold text-foreground">Como funciona o Score</p>
              <p>Nota composta de 0–100 baseada em 4 critérios normalizados entre os vendedores:</p>
              <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 mt-1">
                <span><strong>Volume (30%)</strong> — qtd de vendas</span>
                <span><strong>Ticket (25%)</strong> — crédito médio</span>
                <span><strong>Confirmação (30%)</strong> — taxa de confirmação</span>
                <span><strong>Diversidade (15%)</strong> — administradoras distintas</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Podium Top 3 */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {top3.map((s, i) => (
          <Card key={s.name} className={cn("border bg-gradient-to-b overflow-hidden", PODIUM_BG[i])}>
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">{MEDALS[i]}</span>
                  <div>
                    <p className="font-bold text-sm truncate max-w-[120px]">{s.name}</p>
                    <p className="text-[10px] text-muted-foreground">{s.volume} vendas · {fmt(s.totalCredito)}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-black text-primary">{s.scoreFinal.toFixed(0)}</p>
                  <p className="text-[9px] text-muted-foreground uppercase tracking-wider">Score</p>
                </div>
              </div>
              <ScoreRadar seller={s} />
              <div className="space-y-1.5">
                <ScoreBar label="Volume" value={s.scoreVolume} color="bg-primary" />
                <ScoreBar label="Ticket Médio" value={s.scoreTicket} color="bg-[#10b981]" />
                <ScoreBar label="Confirmação" value={s.scoreConfirmacao} color="bg-[#f59e0b]" />
                <ScoreBar label="Diversidade" value={s.scoreDiversidade} color="bg-[#8b5cf6]" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Full Ranking */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Trophy className="h-4 w-4 text-[hsl(45,85%,50%)]" />
            Ranking Completo — Score de Vendedor
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="space-y-2">
            {scores.map((s, i) => {
              const maxScore = scores[0]?.scoreFinal || 1;
              const barPct = (s.scoreFinal / maxScore) * 100;
              return (
                <div key={s.name} className="space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className={cn(
                        "w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0",
                        i < 3 ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                      )}>
                        {i + 1}
                      </span>
                      <span className="text-xs font-semibold truncate">{s.name}</span>
                    </div>
                    <div className="flex items-center gap-3 shrink-0 text-right">
                      <div className="hidden sm:flex gap-2 text-[10px] text-muted-foreground">
                        <span title="Volume">{s.volume}v</span>
                        <span title="Ticket">T{(s.ticketMedio / 1000).toFixed(0)}k</span>
                        <span title="Confirmação">{s.taxaConfirmacao.toFixed(0)}%✓</span>
                        <span title="Admins">{s.diversidadeAdm}adm</span>
                      </div>
                      <span className="text-sm font-bold text-primary min-w-[40px]">{s.scoreFinal.toFixed(0)}</span>
                    </div>
                  </div>
                  <div className="h-1.5 rounded-full bg-muted/40 overflow-hidden ml-8">
                    <div
                      className={cn("h-full rounded-full transition-all",
                        i === 0 ? "bg-[hsl(45,85%,50%)]" : i === 1 ? "bg-[hsl(217,85%,55%)]" : i === 2 ? "bg-[hsl(25,70%,50%)]" : "bg-primary"
                      )}
                      style={{ width: `${barPct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Stats cards */}
      {rest.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <Card>
            <CardContent className="p-3 text-center">
              <ShoppingCart className="h-4 w-4 mx-auto mb-1 text-primary" />
              <p className="text-lg font-bold">{scores.reduce((s, r) => s + r.volume, 0)}</p>
              <p className="text-[10px] text-muted-foreground">Total Vendas</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3 text-center">
              <TrendingUp className="h-4 w-4 mx-auto mb-1 text-[#10b981]" />
              <p className="text-lg font-bold">{fmt(scores.reduce((s, r) => s + r.totalCredito, 0) / scores.reduce((s, r) => s + r.volume, 0))}</p>
              <p className="text-[10px] text-muted-foreground">Ticket Médio Geral</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3 text-center">
              <Target className="h-4 w-4 mx-auto mb-1 text-[#f59e0b]" />
              <p className="text-lg font-bold">{(scores.reduce((s, r) => s + r.taxaConfirmacao, 0) / scores.length).toFixed(0)}%</p>
              <p className="text-[10px] text-muted-foreground">Confirmação Média</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3 text-center">
              <Layers className="h-4 w-4 mx-auto mb-1 text-[#8b5cf6]" />
              <p className="text-lg font-bold">{(scores.reduce((s, r) => s + r.diversidadeAdm, 0) / scores.length).toFixed(1)}</p>
              <p className="text-[10px] text-muted-foreground">Admins Média</p>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
