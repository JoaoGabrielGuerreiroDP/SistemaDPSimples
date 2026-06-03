import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { addMonths, format } from "date-fns";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  AreaChart, Area, Legend,
} from "recharts";

interface GesconVenda {
  vendedor: string;
  credito: string;
  data_venda: string;
  administradora: string;
  situacao: string;
}

const COMMISSION_RULES: Record<string, { pct: number; parcelas: number; label: string }> = {
  "Magazine Luiza": { pct: 0.025, parcelas: 10, label: "Magalu" },
  "Magalu": { pct: 0.025, parcelas: 10, label: "Magalu" },
  "Âncora": { pct: 0.05, parcelas: 16, label: "Âncora" },
  "Ancora": { pct: 0.05, parcelas: 16, label: "Âncora" },
  "Canopus": { pct: 0.04, parcelas: 6, label: "Canopus" },
  "HS Consórcios": { pct: 0.02, parcelas: 1, label: "HS" },
  "HS": { pct: 0.02, parcelas: 1, label: "HS" },
};

function getRule(admin: string) {
  for (const [key, rule] of Object.entries(COMMISSION_RULES)) {
    if (admin.toLowerCase().includes(key.toLowerCase())) return rule;
  }
  return { pct: 0.025, parcelas: 10, label: admin };
}

function parseCredito(v: string) { return parseFloat(v) || 0; }
function parseDate(raw: string): Date | null {
  try { const p = raw.split(/[/-]/); return new Date(+p[2], +p[1] - 1, +p[0]); } catch { return null; }
}
const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const COLORS = ["hsl(var(--primary))", "#10b981", "#f59e0b", "#8b5cf6", "#ef4444", "#06b6d4", "#ec4899", "#84cc16"];

interface CommissionProjectionProps {
  vendas: GesconVenda[];
}

export function CommissionProjection({ vendas }: CommissionProjectionProps) {
  const [view, setView] = useState<"geral" | "vendedor" | "admin">("geral");

  const projection = useMemo(() => {
    if (!vendas.length) return null;

    // Overall monthly cashflow
    const totalMap = new Map<string, number>();
    // By seller
    const sellerMap = new Map<string, Map<string, number>>();
    // By admin
    const adminMap = new Map<string, Map<string, number>>();
    // Cumulative
    let totalComissao = 0;
    let totalParcelas = 0;

    const sellers = new Set<string>();
    const admins = new Set<string>();

    for (const v of vendas) {
      const rule = getRule(v.administradora);
      const cred = parseCredito(v.credito);
      const comm = cred * rule.pct;
      const parcelaVal = rule.parcelas > 0 ? comm / rule.parcelas : comm;
      const saleDate = parseDate(v.data_venda);
      if (!saleDate) continue;

      totalComissao += comm;
      totalParcelas += rule.parcelas;
      sellers.add(v.vendedor);
      admins.add(rule.label);

      for (let i = 0; i < rule.parcelas; i++) {
        const payDate = addMonths(saleDate, i + 1);
        const key = format(payDate, "MM/yyyy");

        totalMap.set(key, (totalMap.get(key) || 0) + parcelaVal);

        // seller
        if (!sellerMap.has(v.vendedor)) sellerMap.set(v.vendedor, new Map());
        const sm = sellerMap.get(v.vendedor)!;
        sm.set(key, (sm.get(key) || 0) + parcelaVal);

        // admin
        if (!adminMap.has(rule.label)) adminMap.set(rule.label, new Map());
        const am = adminMap.get(rule.label)!;
        am.set(key, (am.get(key) || 0) + parcelaVal);
      }
    }

    const sortKey = (m: string) => { const [mm, yy] = m.split("/"); return yy + mm; };
    const allMonths = Array.from(totalMap.keys()).sort((a, b) => sortKey(a).localeCompare(sortKey(b)));

    // Split past vs future
    const now = new Date();
    const currentKey = format(now, "MM/yyyy");

    // General chart data
    let acum = 0;
    const generalData = allMonths.map(m => {
      const val = totalMap.get(m) || 0;
      acum += val;
      const isFuture = sortKey(m) >= sortKey(currentKey);
      return { mes: m, valor: val, acumulado: acum, tipo: isFuture ? "Futuro" : "Recebido" };
    });

    // Future only
    const futureData = generalData.filter(d => d.tipo === "Futuro");
    const totalFuturo = futureData.reduce((s, d) => s + d.valor, 0);
    const totalRecebido = totalComissao - totalFuturo;

    // Seller stacked data
    const sellerNames = Array.from(sellers).sort();
    const sellerStackedData = allMonths.map(m => {
      const row: Record<string, any> = { mes: m };
      for (const s of sellerNames) {
        row[s] = sellerMap.get(s)?.get(m) || 0;
      }
      return row;
    });

    // Admin stacked data
    const adminNames = Array.from(admins).sort();
    const adminStackedData = allMonths.map(m => {
      const row: Record<string, any> = { mes: m };
      for (const a of adminNames) {
        row[a] = adminMap.get(a)?.get(m) || 0;
      }
      return row;
    });

    // Seller totals
    const sellerTotals = sellerNames.map(name => {
      let total = 0, futuro = 0;
      const sm = sellerMap.get(name)!;
      for (const [m, v] of sm) {
        total += v;
        if (sortKey(m) >= sortKey(currentKey)) futuro += v;
      }
      return { name, total, futuro, recebido: total - futuro };
    }).sort((a, b) => b.futuro - a.futuro);

    // Admin totals
    const adminTotals = adminNames.map(name => {
      let total = 0, futuro = 0;
      const am = adminMap.get(name)!;
      for (const [m, v] of am) {
        total += v;
        if (sortKey(m) >= sortKey(currentKey)) futuro += v;
      }
      return { name, total, futuro, parcelas: COMMISSION_RULES[name]?.parcelas || 10 };
    }).sort((a, b) => b.futuro - a.futuro);

    return {
      generalData, futureData, totalComissao, totalFuturo, totalRecebido,
      sellerStackedData, sellerNames, sellerTotals,
      adminStackedData, adminNames, adminTotals,
      nextMonthValue: futureData[0]?.valor || 0,
      avgMonthly: futureData.length > 0 ? totalFuturo / futureData.length : 0,
    };
  }, [vendas]);

  if (!projection) return <p className="text-sm text-muted-foreground text-center py-8">Sem dados.</p>;

  const { generalData, totalComissao, totalFuturo, totalRecebido, nextMonthValue, avgMonthly,
    sellerStackedData, sellerNames, sellerTotals, adminStackedData, adminNames, adminTotals } = projection;

  return (
    <div className="space-y-4">
      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {[
          { label: "Comissão Total", value: fmt(totalComissao), color: "text-primary" },
          { label: "A Receber", value: fmt(totalFuturo), color: "text-[#10b981]" },
          { label: "Próximo Mês", value: fmt(nextMonthValue), color: "text-[#f59e0b]" },
          { label: "Média Mensal", value: fmt(avgMonthly), color: "text-[#8b5cf6]" },
        ].map(c => (
          <Card key={c.label}>
            <CardContent className="p-3 text-center">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide">{c.label}</p>
              <p className={cn("text-lg font-bold", c.color)}>{c.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Sub-tabs */}
      <Tabs value={view} onValueChange={(v) => setView(v as any)}>
        <TabsList className="h-8">
          <TabsTrigger value="geral" className="text-xs">Geral</TabsTrigger>
          <TabsTrigger value="vendedor" className="text-xs">Por Vendedor</TabsTrigger>
          <TabsTrigger value="admin" className="text-xs">Por Administradora</TabsTrigger>
        </TabsList>

        {/* GERAL */}
        <TabsContent value="geral" className="space-y-3 mt-3">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">Projeção de Recebimentos — Mês a Mês</CardTitle></CardHeader>
            <CardContent className="pt-0">
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={generalData}>
                  <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                  <XAxis dataKey="mes" tick={{ fontSize: 9 }} angle={-45} textAnchor="end" height={50} />
                  <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                  <Tooltip formatter={(v: number) => fmt(v)} />
                  <Bar dataKey="valor" name="Parcela" fill="hsl(var(--primary))" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">Acumulado de Comissão</CardTitle></CardHeader>
            <CardContent className="pt-0">
              <ResponsiveContainer width="100%" height={240}>
                <AreaChart data={generalData}>
                  <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                  <XAxis dataKey="mes" tick={{ fontSize: 9 }} angle={-45} textAnchor="end" height={50} />
                  <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                  <Tooltip formatter={(v: number) => fmt(v)} />
                  <Area type="monotone" dataKey="acumulado" name="Acumulado" fill="#10b981" fillOpacity={0.2} stroke="#10b981" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        {/* POR VENDEDOR */}
        <TabsContent value="vendedor" className="space-y-3 mt-3">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">Recebimentos por Vendedor — Stacked</CardTitle></CardHeader>
            <CardContent className="pt-0">
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={sellerStackedData}>
                  <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                  <XAxis dataKey="mes" tick={{ fontSize: 9 }} angle={-45} textAnchor="end" height={50} />
                  <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                  <Tooltip formatter={(v: number) => fmt(v)} />
                  <Legend wrapperStyle={{ fontSize: 10 }} />
                  {sellerNames.map((s, i) => (
                    <Bar key={s} dataKey={s} stackId="a" fill={COLORS[i % COLORS.length]} />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">Resumo por Vendedor</CardTitle></CardHeader>
            <CardContent className="pt-0">
              <div className="space-y-2">
                {sellerTotals.map((s, i) => {
                  const maxFuturo = sellerTotals[0]?.futuro || 1;
                  return (
                    <div key={s.name} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className={cn("w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold shrink-0",
                            i < 3 ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                          )}>{i + 1}</span>
                          <span className="font-semibold truncate max-w-[130px]">{s.name}</span>
                        </div>
                        <div className="flex gap-3 shrink-0">
                          <span className="text-[#10b981] font-bold">{fmt(s.futuro)}</span>
                          <span className="text-[10px] text-muted-foreground">de {fmt(s.total)}</span>
                        </div>
                      </div>
                      <div className="h-1.5 rounded-full bg-muted/40 overflow-hidden ml-7">
                        <div className="h-full rounded-full bg-[#10b981] transition-all" style={{ width: `${(s.futuro / maxFuturo) * 100}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* POR ADMINISTRADORA */}
        <TabsContent value="admin" className="space-y-3 mt-3">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">Recebimentos por Administradora — Stacked</CardTitle></CardHeader>
            <CardContent className="pt-0">
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={adminStackedData}>
                  <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                  <XAxis dataKey="mes" tick={{ fontSize: 9 }} angle={-45} textAnchor="end" height={50} />
                  <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                  <Tooltip formatter={(v: number) => fmt(v)} />
                  <Legend wrapperStyle={{ fontSize: 10 }} />
                  {adminNames.map((a, i) => (
                    <Bar key={a} dataKey={a} stackId="a" fill={COLORS[i % COLORS.length]} />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">Resumo por Administradora</CardTitle></CardHeader>
            <CardContent className="pt-0">
              <div className="space-y-3">
                {adminTotals.map((a, i) => (
                  <div key={a.name} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold">{a.name}</span>
                      <div className="flex gap-3">
                        <span className="text-[#10b981] font-bold">{fmt(a.futuro)}</span>
                        <span className="text-[10px] text-muted-foreground">{a.parcelas} parcelas · Total {fmt(a.total)}</span>
                      </div>
                    </div>
                    <div className="h-2 rounded-full bg-muted/40 overflow-hidden">
                      <div className="h-full rounded-full transition-all" style={{
                        width: `${(a.futuro / (adminTotals[0]?.futuro || 1)) * 100}%`,
                        backgroundColor: COLORS[i % COLORS.length],
                      }} />
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
