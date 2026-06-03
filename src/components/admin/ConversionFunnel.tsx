import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowDown, AlertTriangle, CheckCircle2, Clock, XCircle, TrendingDown } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart as RechartsPie, Pie, Cell,
} from "recharts";

interface GesconVenda {
  vendedor: string;
  credito: string;
  situacao: string;
  administradora: string;
}

function parseCredito(v: string) { return parseFloat(v) || 0; }
const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const fmtPct = (v: number) => `${v.toFixed(1)}%`;

const STATUS_CONFIG: Record<string, { color: string; icon: typeof CheckCircle2; label: string }> = {
  "Confirmada": { color: "#10b981", icon: CheckCircle2, label: "Confirmada" },
  "Pendente": { color: "#f59e0b", icon: Clock, label: "Pendente" },
  "Cancelada": { color: "#ef4444", icon: XCircle, label: "Cancelada" },
};

interface ConversionFunnelProps {
  vendas: GesconVenda[];
}

export function ConversionFunnel({ vendas }: ConversionFunnelProps) {
  const funnelData = useMemo(() => {
    if (!vendas.length) return null;

    const byStatus = new Map<string, { qtd: number; credito: number }>();
    for (const v of vendas) {
      const cur = byStatus.get(v.situacao) || { qtd: 0, credito: 0 };
      cur.qtd++;
      cur.credito += parseCredito(v.credito);
      byStatus.set(v.situacao, cur);
    }

    const total = vendas.length;
    const totalCredito = vendas.reduce((s, v) => s + parseCredito(v.credito), 0);

    const confirmada = byStatus.get("Confirmada") || { qtd: 0, credito: 0 };
    const pendente = byStatus.get("Pendente") || { qtd: 0, credito: 0 };
    const cancelada = byStatus.get("Cancelada") || { qtd: 0, credito: 0 };

    const otherQtd = total - confirmada.qtd - pendente.qtd - cancelada.qtd;
    const otherCredito = totalCredito - confirmada.credito - pendente.credito - cancelada.credito;

    const taxaConversao = total > 0 ? (confirmada.qtd / total) * 100 : 0;
    const taxaCancelamento = total > 0 ? (cancelada.qtd / total) * 100 : 0;
    const creditoPerdido = cancelada.credito;
    const creditoEmRisco = pendente.credito;

    const sellerMap = new Map<string, { name: string; total: number; confirmadas: number; canceladas: number; pendentes: number; creditoPerdido: number }>();
    for (const v of vendas) {
      const cur = sellerMap.get(v.vendedor) || { name: v.vendedor, total: 0, confirmadas: 0, canceladas: 0, pendentes: 0, creditoPerdido: 0 };
      cur.total++;
      if (v.situacao === "Confirmada") cur.confirmadas++;
      else if (v.situacao === "Cancelada") { cur.canceladas++; cur.creditoPerdido += parseCredito(v.credito); }
      else if (v.situacao === "Pendente") cur.pendentes++;
      sellerMap.set(v.vendedor, cur);
    }
    const sellerList = Array.from(sellerMap.values())
      .map(s => ({ ...s, taxaConv: s.total > 0 ? (s.confirmadas / s.total) * 100 : 0, taxaCanc: s.total > 0 ? (s.canceladas / s.total) * 100 : 0 }))
      .sort((a, b) => b.taxaConv - a.taxaConv);

    const adminMap = new Map<string, { name: string; total: number; confirmadas: number; canceladas: number; creditoPerdido: number }>();
    for (const v of vendas) {
      const cur = adminMap.get(v.administradora) || { name: v.administradora, total: 0, confirmadas: 0, canceladas: 0, creditoPerdido: 0 };
      cur.total++;
      if (v.situacao === "Confirmada") cur.confirmadas++;
      else if (v.situacao === "Cancelada") { cur.canceladas++; cur.creditoPerdido += parseCredito(v.credito); }
      adminMap.set(v.administradora, cur);
    }
    const adminList = Array.from(adminMap.values())
      .map(a => ({ ...a, taxaConv: a.total > 0 ? (a.confirmadas / a.total) * 100 : 0 }))
      .sort((a, b) => b.total - a.total);

    const pieData = [
      { name: "Confirmada", value: confirmada.qtd },
      { name: "Pendente", value: pendente.qtd },
      { name: "Cancelada", value: cancelada.qtd },
      ...(otherQtd > 0 ? [{ name: "Outras", value: otherQtd }] : []),
    ];
    const pieColors = ["#10b981", "#f59e0b", "#ef4444", "#6366f1"];

    return {
      total, totalCredito, confirmada, pendente, cancelada,
      otherQtd, otherCredito,
      taxaConversao, taxaCancelamento, creditoPerdido, creditoEmRisco,
      sellerList, adminList, pieData, pieColors,
    };
  }, [vendas]);

  if (!funnelData) return <p className="text-sm text-muted-foreground text-center py-8">Sem dados.</p>;

  const { total, totalCredito, confirmada, pendente, cancelada, taxaConversao, taxaCancelamento, creditoPerdido, creditoEmRisco, sellerList, adminList, pieData, pieColors } = funnelData;

  const funnelSteps = [
    { label: "Total de Vendas", value: total, credito: totalCredito, pct: 100, color: "bg-primary", textColor: "text-primary" },
    { label: "Confirmadas", value: confirmada.qtd, credito: confirmada.credito, pct: total > 0 ? (confirmada.qtd / total) * 100 : 0, color: "bg-[#10b981]", textColor: "text-[#10b981]" },
    { label: "Pendentes", value: pendente.qtd, credito: pendente.credito, pct: total > 0 ? (pendente.qtd / total) * 100 : 0, color: "bg-[#f59e0b]", textColor: "text-[#f59e0b]" },
    { label: "Canceladas", value: cancelada.qtd, credito: cancelada.credito, pct: total > 0 ? (cancelada.qtd / total) * 100 : 0, color: "bg-[#ef4444]", textColor: "text-[#ef4444]" },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <Card>
          <CardContent className="p-3 text-center">
            <CheckCircle2 className="h-4 w-4 mx-auto mb-1 text-[#10b981]" />
            <p className="text-xl font-bold text-[#10b981]">{fmtPct(taxaConversao)}</p>
            <p className="text-[10px] text-muted-foreground">Taxa de Conversão</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <XCircle className="h-4 w-4 mx-auto mb-1 text-destructive" />
            <p className="text-xl font-bold text-destructive">{fmtPct(taxaCancelamento)}</p>
            <p className="text-[10px] text-muted-foreground">Taxa de Cancelamento</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <TrendingDown className="h-4 w-4 mx-auto mb-1 text-destructive" />
            <p className="text-xl font-bold text-destructive">{fmt(creditoPerdido)}</p>
            <p className="text-[10px] text-muted-foreground">Crédito Perdido</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <AlertTriangle className="h-4 w-4 mx-auto mb-1 text-[#f59e0b]" />
            <p className="text-xl font-bold text-[#f59e0b]">{fmt(creditoEmRisco)}</p>
            <p className="text-[10px] text-muted-foreground">Crédito em Risco (Pendente)</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Funil de Conversão</CardTitle>
          </CardHeader>
          <CardContent className="pt-0 space-y-1">
            {funnelSteps.map((step, i) => (
              <div key={step.label}>
                <div className="flex items-center justify-between text-xs mb-0.5">
                  <span className="font-medium">{step.label}</span>
                  <span className={cn("font-bold", step.textColor)}>{step.value} ({fmtPct(step.pct)})</span>
                </div>
                <div className="relative mx-auto" style={{ width: `${Math.max(step.pct, 20)}%` }}>
                  <div className={cn("h-8 rounded-md flex items-center justify-center", step.color, "bg-opacity-80")}>
                    <span className="text-[10px] font-semibold text-background">{fmt(step.credito)}</span>
                  </div>
                </div>
                {i < funnelSteps.length - 1 && (
                  <div className="flex justify-center py-0.5">
                    <ArrowDown className="h-3 w-3 text-muted-foreground" />
                  </div>
                )}
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Distribuição por Situação</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <ResponsiveContainer width="100%" height={220}>
              <RechartsPie>
                <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} innerRadius={40}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false} fontSize={10}>
                  {pieData.map((_, i) => <Cell key={i} fill={pieColors[i % pieColors.length]} />)}
                </Pie>
                <Tooltip />
              </RechartsPie>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">Conversão por Vendedor</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <ResponsiveContainer width="100%" height={Math.max(sellerList.length * 32, 200)}>
            <BarChart data={sellerList} layout="vertical" margin={{ left: 10 }}>
              <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
              <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 10 }} tickFormatter={(v) => `${v}%`} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={100} />
              <Tooltip formatter={(v: number) => `${v.toFixed(1)}%`} />
              <Bar dataKey="taxaConv" name="Confirmação" fill="#10b981" radius={[0, 3, 3, 0]} stackId="a" />
              <Bar dataKey="taxaCanc" name="Cancelamento" fill="#ef4444" radius={[0, 3, 3, 0]} stackId="b" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">Conversão por Administradora</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="space-y-2">
            {adminList.map(a => (
              <div key={a.name} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium">{a.name}</span>
                  <div className="flex gap-3 text-[10px]">
                    <span className="text-[#10b981] font-semibold">{a.confirmadas}✓ ({fmtPct(a.taxaConv)})</span>
                    <span className="text-destructive font-semibold">{a.canceladas}✗ ({fmt(a.creditoPerdido)})</span>
                    <span className="text-muted-foreground">{a.total} total</span>
                  </div>
                </div>
                <div className="h-2 rounded-full bg-muted/40 overflow-hidden flex">
                  <div className="h-full bg-[#10b981]" style={{ width: `${a.taxaConv}%` }} />
                  <div className="h-full bg-[#ef4444]" style={{ width: `${a.total > 0 ? (a.canceladas / a.total) * 100 : 0}%` }} />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">Detalhamento por Vendedor</CardTitle>
        </CardHeader>
        <CardContent className="pt-0 overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b text-muted-foreground">
                <th className="text-left py-1.5 pr-2">#</th>
                <th className="text-left py-1.5 pr-2">Vendedor</th>
                <th className="text-center py-1.5 px-1">Total</th>
                <th className="text-center py-1.5 px-1">✓</th>
                <th className="text-center py-1.5 px-1">⏳</th>
                <th className="text-center py-1.5 px-1">✗</th>
                <th className="text-center py-1.5 px-1">Conv.</th>
                <th className="text-right py-1.5 pl-1">Perdido</th>
              </tr>
            </thead>
            <tbody>
              {sellerList.map((s, i) => (
                <tr key={s.name} className="border-b border-border/30">
                  <td className="py-1.5 pr-2 font-medium text-muted-foreground">{i + 1}</td>
                  <td className="py-1.5 pr-2 font-semibold truncate max-w-[120px]">{s.name}</td>
                  <td className="text-center py-1.5 px-1">{s.total}</td>
                  <td className="text-center py-1.5 px-1 text-[#10b981] font-semibold">{s.confirmadas}</td>
                  <td className="text-center py-1.5 px-1 text-[#f59e0b] font-semibold">{s.pendentes}</td>
                  <td className="text-center py-1.5 px-1 text-destructive font-semibold">{s.canceladas}</td>
                  <td className={cn("text-center py-1.5 px-1 font-bold", s.taxaConv >= 80 ? "text-[#10b981]" : s.taxaConv >= 50 ? "text-[#f59e0b]" : "text-destructive")}>
                    {fmtPct(s.taxaConv)}
                  </td>
                  <td className="text-right py-1.5 pl-1 text-destructive">{fmt(s.creditoPerdido)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
