import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowUpRight, ArrowDownRight, Minus, GitCompareArrows } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, Legend, ReferenceLine,
} from "recharts";

interface Venda {
  vendedor: string;
  credito: string;
  data_venda: string;
}

interface GesconMonthCompareProps {
  vendas: Venda[];
}

function parseCredito(v: string) { return parseFloat(v) || 0; }
const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

function VariationBadge({ value }: { value: number | null }) {
  if (value === null) return <Badge variant="outline" className="text-[10px]">—</Badge>;
  const color = value > 0 ? "text-emerald-500" : value < 0 ? "text-red-500" : "text-muted-foreground";
  const Icon = value > 0 ? ArrowUpRight : value < 0 ? ArrowDownRight : Minus;
  return (
    <span className={`inline-flex items-center gap-0.5 text-xs font-semibold ${color}`}>
      <Icon className="h-3 w-3" />
      {Math.abs(value).toFixed(1)}%
    </span>
  );
}

interface MonthData {
  mes: string;
  qtd: number;
  credito: number;
  ticket: number;
  sellers: number;
  varQtd: number | null;
  varCredito: number | null;
  varTicket: number | null;
  sellerBreakdown: Map<string, { qtd: number; credito: number }>;
}

function useMonthlyData(vendas: Venda[]): MonthData[] {
  return useMemo(() => {
    const map = new Map<string, { qtd: number; credito: number; sellers: Set<string>; sellerBreakdown: Map<string, { qtd: number; credito: number }> }>();
    for (const v of vendas) {
      try {
        const parts = v.data_venda.split(/[/-]/);
        const key = `${parts[1]}/${parts[2]}`;
        const cur = map.get(key) || { qtd: 0, credito: 0, sellers: new Set<string>(), sellerBreakdown: new Map() };
        cur.qtd++;
        const cred = parseCredito(v.credito);
        cur.credito += cred;
        cur.sellers.add(v.vendedor);
        const sb = cur.sellerBreakdown.get(v.vendedor) || { qtd: 0, credito: 0 };
        sb.qtd++;
        sb.credito += cred;
        cur.sellerBreakdown.set(v.vendedor, sb);
        map.set(key, cur);
      } catch { }
    }

    const sorted = Array.from(map.entries())
      .map(([mes, d]) => ({ mes, qtd: d.qtd, credito: d.credito, ticket: d.qtd > 0 ? d.credito / d.qtd : 0, sellers: d.sellers.size, sellerBreakdown: d.sellerBreakdown }))
      .sort((a, b) => {
        const [ma, ya] = a.mes.split("/");
        const [mb, yb] = b.mes.split("/");
        return (ya + ma).localeCompare(yb + mb);
      });

    return sorted.map((m, i) => {
      const prev = i > 0 ? sorted[i - 1] : null;
      return {
        ...m,
        varQtd: prev ? ((m.qtd - prev.qtd) / prev.qtd) * 100 : null,
        varCredito: prev ? ((m.credito - prev.credito) / prev.credito) * 100 : null,
        varTicket: prev ? ((m.ticket - prev.ticket) / prev.ticket) * 100 : null,
      };
    });
  }, [vendas]);
}

/* ── Side-by-side comparison panel ── */
function MonthVsMonth({ monthlyData }: { monthlyData: MonthData[] }) {
  const options = monthlyData.map(m => m.mes);
  const [mesA, setMesA] = useState(options.length > 1 ? options[options.length - 2] : options[0] ?? "");
  const [mesB, setMesB] = useState(options[options.length - 1] ?? "");

  const a = monthlyData.find(m => m.mes === mesA);
  const b = monthlyData.find(m => m.mes === mesB);

  const variation = (va: number, vb: number) => va > 0 ? ((vb - va) / va) * 100 : null;

  const metrics = a && b ? [
    { label: "Vendas", valA: a.qtd, valB: b.qtd, fmtFn: (v: number) => String(v), var: variation(a.qtd, b.qtd) },
    { label: "Crédito", valA: a.credito, valB: b.credito, fmtFn: fmt, var: variation(a.credito, b.credito) },
    { label: "Ticket Médio", valA: a.ticket, valB: b.ticket, fmtFn: fmt, var: variation(a.ticket, b.ticket) },
    { label: "Vendedores", valA: a.sellers, valB: b.sellers, fmtFn: (v: number) => String(v), var: variation(a.sellers, b.sellers) },
  ] : [];

  // Seller comparison chart data
  const sellerChartData = useMemo(() => {
    if (!a || !b) return [];
    const allSellers = new Set([...a.sellerBreakdown.keys(), ...b.sellerBreakdown.keys()]);
    return Array.from(allSellers).map(s => ({
      name: s.split(" ")[0],
      [mesA]: a.sellerBreakdown.get(s)?.qtd || 0,
      [mesB]: b.sellerBreakdown.get(s)?.qtd || 0,
    })).sort((x, y) => ((y as any)[mesB] || 0) - ((x as any)[mesB] || 0));
  }, [a, b, mesA, mesB]);

  if (options.length < 2) return <p className="text-sm text-muted-foreground text-center py-6">Necessário ao menos 2 meses de dados.</p>;

  return (
    <div className="space-y-4">
      {/* Selectors */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-3 flex-wrap">
            <GitCompareArrows className="h-5 w-5 text-primary shrink-0" />
            <span className="text-sm font-medium text-muted-foreground">Comparar:</span>
            <Select value={mesA} onValueChange={setMesA}>
              <SelectTrigger className="w-[130px] h-9 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {options.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
              </SelectContent>
            </Select>
            <span className="text-sm text-muted-foreground">vs</span>
            <Select value={mesB} onValueChange={setMesB}>
              <SelectTrigger className="w-[130px] h-9 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {options.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* KPI comparison */}
      {a && b && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {metrics.map(m => (
            <Card key={m.label}>
              <CardContent className="p-4">
                <p className="text-[10px] font-medium text-muted-foreground uppercase">{m.label}</p>
                <div className="flex items-baseline gap-2 mt-1">
                  <span className="text-sm text-muted-foreground">{mesA}</span>
                  <span className="text-base font-bold">{m.fmtFn(m.valA)}</span>
                </div>
                <div className="flex items-baseline gap-2 mt-0.5">
                  <span className="text-sm text-muted-foreground">{mesB}</span>
                  <span className="text-base font-bold">{m.fmtFn(m.valB)}</span>
                </div>
                <div className="mt-1 flex justify-end">
                  <VariationBadge value={m.var} />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Seller bar chart side-by-side */}
      {sellerChartData.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Vendas por Vendedor — {mesA} vs {mesB}</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={Math.max(220, sellerChartData.length * 30)}>
              <BarChart data={sellerChartData} layout="vertical" barGap={2}>
                <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                <XAxis type="number" tick={{ fontSize: 10 }} />
                <YAxis dataKey="name" type="category" tick={{ fontSize: 10 }} width={80} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey={mesA} fill="hsl(var(--primary))" radius={[0, 3, 3, 0]} />
                <Bar dataKey={mesB} fill="#10b981" radius={[0, 3, 3, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

/* ── Main component ── */
export function GesconMonthCompare({ vendas }: GesconMonthCompareProps) {
  const monthlyData = useMonthlyData(vendas);

  const chartData = monthlyData.map(m => ({
    mes: m.mes,
    Vendas: m.qtd,
    "Var. Vendas (%)": m.varQtd !== null ? +m.varQtd.toFixed(1) : 0,
    "Var. Crédito (%)": m.varCredito !== null ? +m.varCredito.toFixed(1) : 0,
    "Var. Ticket (%)": m.varTicket !== null ? +m.varTicket.toFixed(1) : 0,
    Crédito: m.credito,
    Ticket: m.ticket,
  }));

  // Current vs previous month
  const current = monthlyData.length > 0 ? monthlyData[monthlyData.length - 1] : null;
  const previous = monthlyData.length > 1 ? monthlyData[monthlyData.length - 2] : null;

  if (!vendas.length) {
    return <p className="text-sm text-muted-foreground text-center py-8">Sem dados para comparação.</p>;
  }

  return (
    <div className="space-y-4">
      {/* Side-by-side month selector */}
      <MonthVsMonth monthlyData={monthlyData} />

      {/* Current vs Previous KPIs */}
      {current && (
        <>
          <h3 className="text-sm font-semibold text-muted-foreground pt-2">Evolução Geral</h3>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Card>
              <CardContent className="p-4">
                <p className="text-[10px] font-medium text-muted-foreground uppercase">Vendas</p>
                <p className="text-lg font-bold">{current.qtd}</p>
                <div className="flex items-center justify-between mt-1">
                  <span className="text-[10px] text-muted-foreground">Ant: {previous?.qtd ?? "—"}</span>
                  <VariationBadge value={current.varQtd} />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-[10px] font-medium text-muted-foreground uppercase">Crédito</p>
                <p className="text-lg font-bold">{fmt(current.credito)}</p>
                <div className="flex items-center justify-between mt-1">
                  <span className="text-[10px] text-muted-foreground">Ant: {previous ? fmt(previous.credito) : "—"}</span>
                  <VariationBadge value={current.varCredito} />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-[10px] font-medium text-muted-foreground uppercase">Ticket Médio</p>
                <p className="text-lg font-bold">{fmt(current.ticket)}</p>
                <div className="flex items-center justify-between mt-1">
                  <span className="text-[10px] text-muted-foreground">Ant: {previous ? fmt(previous.ticket) : "—"}</span>
                  <VariationBadge value={current.varTicket} />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-[10px] font-medium text-muted-foreground uppercase">Vendedores Ativos</p>
                <p className="text-lg font-bold">{current.sellers}</p>
                <div className="flex items-center justify-between mt-1">
                  <span className="text-[10px] text-muted-foreground">Ant: {previous?.sellers ?? "—"}</span>
                  {previous && <VariationBadge value={((current.sellers - previous.sellers) / previous.sellers) * 100} />}
                </div>
              </CardContent>
            </Card>
          </div>
        </>
      )}

      {/* Variation chart */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">Variação Percentual Mês a Mês</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
              <XAxis dataKey="mes" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} tickFormatter={v => `${v}%`} />
              <Tooltip formatter={(v: number) => `${v.toFixed(1)}%`} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <ReferenceLine y={0} stroke="hsl(var(--muted-foreground))" strokeDasharray="3 3" />
              <Line type="monotone" dataKey="Var. Vendas (%)" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 3 }} />
              <Line type="monotone" dataKey="Var. Crédito (%)" stroke="#10b981" strokeWidth={2} dot={{ r: 3 }} />
              <Line type="monotone" dataKey="Var. Ticket (%)" stroke="#f59e0b" strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Absolute values charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Vendas por Mês</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                <XAxis dataKey="mes" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip />
                <Bar dataKey="Vendas" fill="hsl(var(--primary))" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Crédito por Mês</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                <XAxis dataKey="mes" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} tickFormatter={v => fmt(v)} />
                <Tooltip formatter={(v: number) => fmt(v)} />
                <Bar dataKey="Crédito" fill="#10b981" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Monthly table */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">Detalhamento Mensal</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-2 px-2 font-medium text-muted-foreground">Mês</th>
                <th className="text-right py-2 px-2 font-medium text-muted-foreground">Vendas</th>
                <th className="text-right py-2 px-2 font-medium text-muted-foreground">Var.</th>
                <th className="text-right py-2 px-2 font-medium text-muted-foreground">Crédito</th>
                <th className="text-right py-2 px-2 font-medium text-muted-foreground">Var.</th>
                <th className="text-right py-2 px-2 font-medium text-muted-foreground">Ticket</th>
                <th className="text-right py-2 px-2 font-medium text-muted-foreground">Var.</th>
              </tr>
            </thead>
            <tbody>
              {monthlyData.map(m => (
                <tr key={m.mes} className="border-b border-border/50 hover:bg-muted/30">
                  <td className="py-2 px-2 font-medium">{m.mes}</td>
                  <td className="py-2 px-2 text-right">{m.qtd}</td>
                  <td className="py-2 px-2 text-right"><VariationBadge value={m.varQtd} /></td>
                  <td className="py-2 px-2 text-right">{fmt(m.credito)}</td>
                  <td className="py-2 px-2 text-right"><VariationBadge value={m.varCredito} /></td>
                  <td className="py-2 px-2 text-right">{fmt(m.ticket)}</td>
                  <td className="py-2 px-2 text-right"><VariationBadge value={m.varTicket} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
