import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, Legend,
} from "recharts";

interface GesconVenda {
  vendedor: string;
  credito: string;
  data_venda: string;
  situacao: string;
}

function parseCredito(v: string) { return parseFloat(v) || 0; }
const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

const WEEKDAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const WEEK_LABELS = ["Semana 1", "Semana 2", "Semana 3", "Semana 4", "Semana 5"];

function parseDate(raw: string): Date | null {
  try {
    const parts = raw.split(/[/-]/);
    return new Date(+parts[2], +parts[1] - 1, +parts[0]);
  } catch { return null; }
}

function weekOfMonth(d: Date): number {
  return Math.min(Math.ceil(d.getDate() / 7), 5);
}

interface SeasonalityTabProps {
  vendas: GesconVenda[];
}

export function SeasonalityTab({ vendas }: SeasonalityTabProps) {
  // By weekday
  const byWeekday = useMemo(() => {
    const data = WEEKDAYS.map((name, i) => ({ name, vendas: 0, credito: 0, confirmadas: 0 }));
    for (const v of vendas) {
      const d = parseDate(v.data_venda);
      if (!d) continue;
      const day = d.getDay();
      data[day].vendas++;
      data[day].credito += parseCredito(v.credito);
      if (v.situacao === "Confirmada") data[day].confirmadas++;
    }
    return data.map(d => ({ ...d, ticket: d.vendas > 0 ? d.credito / d.vendas : 0, taxaConv: d.vendas > 0 ? (d.confirmadas / d.vendas) * 100 : 0 }));
  }, [vendas]);

  // By week of month
  const byWeek = useMemo(() => {
    const data = WEEK_LABELS.map((name, i) => ({ name, vendas: 0, credito: 0, confirmadas: 0 }));
    for (const v of vendas) {
      const d = parseDate(v.data_venda);
      if (!d) continue;
      const w = weekOfMonth(d) - 1;
      data[w].vendas++;
      data[w].credito += parseCredito(v.credito);
      if (v.situacao === "Confirmada") data[w].confirmadas++;
    }
    return data.filter(d => d.vendas > 0).map(d => ({ ...d, ticket: d.vendas > 0 ? d.credito / d.vendas : 0, taxaConv: d.vendas > 0 ? (d.confirmadas / d.vendas) * 100 : 0 }));
  }, [vendas]);

  // Heatmap: weekday x week of month
  const heatmap = useMemo(() => {
    const grid: number[][] = Array.from({ length: 7 }, () => Array(5).fill(0));
    for (const v of vendas) {
      const d = parseDate(v.data_venda);
      if (!d) continue;
      grid[d.getDay()][weekOfMonth(d) - 1]++;
    }
    const maxVal = Math.max(1, ...grid.flat());
    return { grid, maxVal };
  }, [vendas]);

  // Best/worst insights
  const insights = useMemo(() => {
    const bestDay = [...byWeekday].sort((a, b) => b.vendas - a.vendas)[0];
    const worstDay = [...byWeekday].filter(d => d.vendas > 0).sort((a, b) => a.vendas - b.vendas)[0];
    const bestWeek = [...byWeek].sort((a, b) => b.vendas - a.vendas)[0];
    const bestTicketDay = [...byWeekday].filter(d => d.vendas > 0).sort((a, b) => b.ticket - a.ticket)[0];
    return { bestDay, worstDay, bestWeek, bestTicketDay };
  }, [byWeekday, byWeek]);

  // By seller x weekday
  const sellerWeekday = useMemo(() => {
    const map = new Map<string, number[]>();
    for (const v of vendas) {
      const d = parseDate(v.data_venda);
      if (!d) continue;
      const arr = map.get(v.vendedor) || Array(7).fill(0);
      arr[d.getDay()]++;
      map.set(v.vendedor, arr);
    }
    return Array.from(map.entries())
      .map(([name, days]) => {
        const total = days.reduce((s, d) => s + d, 0);
        const bestIdx = days.indexOf(Math.max(...days));
        return { name, total, bestDay: WEEKDAYS[bestIdx], bestDayCount: days[bestIdx] };
      })
      .sort((a, b) => b.total - a.total);
  }, [vendas]);

  if (!vendas.length) return <p className="text-sm text-muted-foreground text-center py-8">Sem dados.</p>;

  return (
    <div className="space-y-4">
      {/* Insight cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {[
          { label: "Melhor Dia", value: insights.bestDay?.name || "—", sub: `${insights.bestDay?.vendas || 0} vendas`, color: "text-[#10b981]" },
          { label: "Pior Dia", value: insights.worstDay?.name || "—", sub: `${insights.worstDay?.vendas || 0} vendas`, color: "text-destructive" },
          { label: "Melhor Semana", value: insights.bestWeek?.name || "—", sub: `${insights.bestWeek?.vendas || 0} vendas`, color: "text-primary" },
          { label: "Maior Ticket", value: insights.bestTicketDay?.name || "—", sub: fmt(insights.bestTicketDay?.ticket || 0), color: "text-[#f59e0b]" },
        ].map(c => (
          <Card key={c.label}>
            <CardContent className="p-3 text-center">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide">{c.label}</p>
              <p className={cn("text-xl font-bold", c.color)}>{c.value}</p>
              <p className="text-[10px] text-muted-foreground">{c.sub}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {/* Vendas por dia da semana */}
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">Vendas por Dia da Semana</CardTitle></CardHeader>
          <CardContent className="pt-0">
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={byWeekday}>
                <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip formatter={(v: number, name: string) => name === "credito" ? fmt(v) : v} />
                <Bar dataKey="vendas" name="Vendas" fill="hsl(var(--primary))" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Crédito por dia da semana */}
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">Crédito por Dia da Semana</CardTitle></CardHeader>
          <CardContent className="pt-0">
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={byWeekday}>
                <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(v: number) => fmt(v)} />
                <Bar dataKey="credito" name="Crédito" fill="#10b981" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Vendas por semana do mês */}
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">Vendas por Semana do Mês</CardTitle></CardHeader>
          <CardContent className="pt-0">
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={byWeek}>
                <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip formatter={(v: number, name: string) => name === "credito" ? fmt(v) : v} />
                <Legend fontSize={10} />
                <Bar dataKey="vendas" name="Vendas" fill="#8b5cf6" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Taxa de conversão por dia */}
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">Taxa de Conversão por Dia</CardTitle></CardHeader>
          <CardContent className="pt-0">
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={byWeekday}>
                <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 10 }} domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
                <Tooltip formatter={(v: number) => `${v.toFixed(1)}%`} />
                <Line type="monotone" dataKey="taxaConv" name="Conversão" stroke="#f59e0b" strokeWidth={2} dot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Heatmap */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">Mapa de Calor — Dia da Semana × Semana do Mês</CardTitle></CardHeader>
        <CardContent className="pt-0">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr>
                  <th className="text-left py-1 pr-2 text-muted-foreground">Dia</th>
                  {WEEK_LABELS.map(w => <th key={w} className="text-center py-1 px-1 text-muted-foreground">{w}</th>)}
                </tr>
              </thead>
              <tbody>
                {WEEKDAYS.map((day, di) => (
                  <tr key={day}>
                    <td className="py-1 pr-2 font-medium">{day}</td>
                    {Array.from({ length: 5 }).map((_, wi) => {
                      const val = heatmap.grid[di][wi];
                      const intensity = val / heatmap.maxVal;
                      return (
                        <td key={wi} className="text-center py-1 px-1">
                          <div
                            className="mx-auto w-10 h-8 rounded flex items-center justify-center text-[10px] font-bold"
                            style={{
                              backgroundColor: val === 0
                                ? "hsl(var(--muted) / 0.3)"
                                : `hsl(142 76% 36% / ${0.15 + intensity * 0.85})`,
                              color: intensity > 0.5 ? "white" : "hsl(var(--foreground))",
                            }}
                          >
                            {val || "—"}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Seller best day */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">Melhor Dia por Vendedor</CardTitle></CardHeader>
        <CardContent className="pt-0">
          <div className="space-y-1.5">
            {sellerWeekday.map((s, i) => (
              <div key={s.name} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2 min-w-0">
                  <span className={cn("w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold shrink-0",
                    i < 3 ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                  )}>{i + 1}</span>
                  <span className="font-semibold truncate max-w-[140px]">{s.name}</span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-muted-foreground">{s.total} vendas</span>
                  <span className="font-bold text-primary">{s.bestDay}</span>
                  <span className="text-[10px] text-muted-foreground">({s.bestDayCount})</span>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
