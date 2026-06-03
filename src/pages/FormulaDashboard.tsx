import { useMemo, useState } from "react";
import { useFormulaConsorcio } from "@/hooks/useFormulaConsorcio";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Loader2, TrendingUp, Users, DollarSign, Target, BarChart3, Percent,
  ArrowUpRight, ArrowDownRight, Minus, Zap, Award, CalendarRange,
  FileText, Building2, CheckCircle2, Search,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Area, AreaChart, ComposedChart, Cell, PieChart, Pie, Legend, Line, LineChart,
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar,
} from "recharts";

const fmt = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

const fmtCompact = (v: number) => {
  if (v >= 1_000_000) return `R$ ${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `R$ ${(v / 1_000).toFixed(0)}k`;
  return fmt(v);
};

const CHART_COLORS = [
  "hsl(142, 76%, 36%)", "hsl(217, 91%, 60%)", "hsl(45, 93%, 47%)",
  "hsl(280, 67%, 55%)", "hsl(350, 89%, 60%)", "hsl(190, 95%, 39%)",
  "hsl(25, 95%, 53%)", "hsl(160, 84%, 39%)",
];

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border bg-popover px-3 py-2 text-sm shadow-md">
      <p className="font-medium text-popover-foreground mb-1">{label}</p>
      {payload.map((p: any, i: number) => (
        <p key={i} style={{ color: p.color }}>
          {p.name}: {typeof p.value === "number" ? p.value.toLocaleString("pt-BR") : p.value}
        </p>
      ))}
    </div>
  );
}

function parseBRL(raw: string): number {
  if (!raw) return 0;
  return parseFloat(raw.replace(/[R$\s.]/g, "").replace(",", ".")) || 0;
}

type PeriodFilter = "all" | "3" | "6" | "12";

export default function FormulaDashboard() {
  const { data, isLoading, error } = useFormulaConsorcio();
  const [period, setPeriod] = useState<PeriodFilter>("all");
  const [searchVendas, setSearchVendas] = useState("");

  const derived = useMemo(() => {
    if (!data) return null;

    const vendasRaw = [...data.vendas].filter((v) => parseFloat(v.valor) > 0).reverse();
    const allVendas = vendasRaw.map((v) => {
      const d = new Date(v.date);
      return {
        mes: d.toLocaleDateString("pt-BR", { month: "short", year: "2-digit" }),
        mesLong: d.toLocaleDateString("pt-BR", { month: "long", year: "numeric" }),
        valor: parseFloat(v.valor),
        date: d,
      };
    });

    const limit = period === "all" ? allVendas.length : parseInt(period);
    const vendasChart = allVendas.slice(-limit);

    const allLeadsData = [...data.array_leads].reverse().map((l) => ({
      mes: l.year,
      leads: parseInt(l.income, 10),
    }));
    const leadsChart = allLeadsData.slice(-limit);

    const vendasWithGrowth = vendasChart.map((v, i) => {
      const prev = i > 0 ? vendasChart[i - 1].valor : v.valor;
      const growthPct = prev > 0 ? ((v.valor - prev) / prev) * 100 : 0;
      return { ...v, growthPct, prev };
    });

    const leadsWithGrowth = leadsChart.map((l, i) => {
      const prev = i > 0 ? leadsChart[i - 1].leads : l.leads;
      const growthPct = prev > 0 ? ((l.leads - prev) / prev) * 100 : 0;
      return { ...l, growthPct };
    });

    const combinedChart = vendasChart.map((v) => {
      const matchLead = leadsChart.find((l) => {
        const [mesV] = v.mes.split("/");
        return l.mes.toLowerCase().includes(mesV.trim().toLowerCase());
      });
      const leads = matchLead?.leads || 0;
      const convRate = leads > 0 ? (v.valor / leads) : 0;
      return { mes: v.mes, vendas: v.valor, leads, ticketPorLead: convRate };
    });

    const ticketChart = vendasChart.map((v) => {
      const totalVendas = parseInt(data.num_vendas, 10) || 1;
      const months = vendasChart.length || 1;
      const avgPerMonth = totalVendas / months;
      const ticket = avgPerMonth > 0 ? v.valor / avgPerMonth : 0;
      return { mes: v.mes, ticket };
    });

    const sorted = [...vendasChart].sort((a, b) => b.valor - a.valor);
    const bestMonth = sorted[0];
    const worstMonth = sorted[sorted.length - 1];
    const top5 = sorted.slice(0, 5);

    const current = vendasChart[vendasChart.length - 1];
    const previous = vendasChart.length > 1 ? vendasChart[vendasChart.length - 2] : null;
    const growthPct = previous && previous.valor > 0
      ? ((current.valor - previous.valor) / previous.valor) * 100 : 0;

    const currentLeads = leadsChart[leadsChart.length - 1]?.leads || 0;
    const prevLeads = leadsChart.length > 1 ? leadsChart[leadsChart.length - 2]?.leads || 0 : 0;
    const leadsGrowth = prevLeads > 0 ? ((currentLeads - prevLeads) / prevLeads) * 100 : 0;

    const avgVendas = vendasChart.reduce((s, v) => s + v.valor, 0) / (vendasChart.length || 1);
    const avgLeads = leadsChart.reduce((s, l) => s + l.leads, 0) / (leadsChart.length || 1);

    let cumulative = 0;
    const cumulativeChart = vendasChart.map((v) => {
      cumulative += v.valor;
      return { mes: v.mes, acumulado: cumulative };
    });

    const totalVal = parseBRL(data.valor_total);
    const totalNeg = parseBRL(data.negociacoes);
    const ticketMedio = parseBRL(data.valor_media);

    const radarData = [
      { metric: "Vendas", value: Math.min((parseInt(data.num_vendas) / 500) * 100, 100) },
      { metric: "Valor Total", value: Math.min((totalVal / 100_000_000) * 100, 100) },
      { metric: "Leads", value: Math.min((data.total_leads / 400) * 100, 100) },
      { metric: "Conversão", value: Math.min(data.taxa_conv, 100) },
      { metric: "Ticket Médio", value: Math.min((ticketMedio / 300_000) * 100, 100) },
      { metric: "Negociações", value: Math.min((totalNeg / 60_000_000) * 100, 100) },
    ];

    // Vendas detalhadas analysis
    const vd = data.vendas_detalhadas || [];
    const adminBreakdown: Record<string, { count: number; total: number }> = {};
    const statusBreakdown: Record<string, number> = {};
    
    vd.forEach((v) => {
      const val = parseBRL(v.valorTotalVenda);
      const admin = v.administradora || "Outros";
      if (!adminBreakdown[admin]) adminBreakdown[admin] = { count: 0, total: 0 };
      adminBreakdown[admin].count++;
      adminBreakdown[admin].total += val;

      const st = v.status || "Sem status";
      statusBreakdown[st] = (statusBreakdown[st] || 0) + 1;
    });

    const adminChart = Object.entries(adminBreakdown)
      .map(([name, d]) => ({ name, vendas: d.count, valor: d.total }))
      .sort((a, b) => b.valor - a.valor);

    const statusChart = Object.entries(statusBreakdown)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);

    const totalDetalhado = vd.reduce((s, v) => s + parseBRL(v.valorTotalVenda), 0);

    return {
      vendasChart, leadsChart, vendasWithGrowth, leadsWithGrowth,
      combinedChart, ticketChart, bestMonth, worstMonth, top5,
      current, previous, growthPct, currentLeads, prevLeads, leadsGrowth,
      avgVendas, avgLeads, cumulativeChart, radarData,
      totalVal, totalNeg, ticketMedio,
      adminChart, statusChart, totalDetalhado,
    };
  }, [data, period]);

  const filteredVendas = useMemo(() => {
    if (!data?.vendas_detalhadas) return [];
    const q = searchVendas.toLowerCase();
    if (!q) return data.vendas_detalhadas;
    return data.vendas_detalhadas.filter(
      (v) =>
        v.nome?.toLowerCase().includes(q) ||
        v.administradora?.toLowerCase().includes(q) ||
        v.numero_contrato?.includes(q) ||
        v.status?.toLowerCase().includes(q)
    );
  }, [data?.vendas_detalhadas, searchVendas]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Carregando dados da Fórmula…</p>
        </div>
      </div>
    );
  }

  if (error || !data || !derived) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        Erro ao carregar dados da Fórmula do Consórcio.
      </div>
    );
  }

  const kpis = [
    { label: "Total de Vendas", value: data.num_vendas, icon: TrendingUp, color: "emerald" },
    { label: "Valor Total", value: data.valor_total, icon: DollarSign, color: "blue" },
    { label: "Ticket Médio", value: data.valor_media, icon: Target, color: "amber" },
    { label: "Negociações", value: data.negociacoes, icon: BarChart3, color: "purple" },
    { label: "Total Leads", value: String(data.total_leads), icon: Users, color: "rose" },
    { label: "Conversão", value: `${data.taxa_conv}%`, icon: Percent, color: "cyan" },
  ];

  return (
    <div className="space-y-6 pb-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Fórmula do Consórcio</h1>
          <p className="text-sm text-muted-foreground">
            Painel completo de vendas, leads e conversões
            {data.vendas_periodo && (
              <span className="ml-2 text-xs">
                <Badge variant="outline" className="text-[10px]">Período: {data.vendas_periodo}</Badge>
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2 self-start sm:self-auto">
          {(["3", "6", "12", "all"] as PeriodFilter[]).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                period === p
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
            >
              {p === "all" ? "Todos" : `${p}m`}
            </button>
          ))}
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {kpis.map((kpi) => (
          <Card key={kpi.label} className={`relative overflow-hidden border border-${kpi.color}-500/20`}>
            <div className={`absolute inset-0 bg-gradient-to-br from-${kpi.color}-500/20 to-${kpi.color}-500/5 pointer-events-none`} />
            <CardContent className="p-4 relative">
              <div className="flex items-center gap-1.5 mb-2">
                <kpi.icon className={`h-4 w-4 text-${kpi.color}-500`} />
                <p className="text-[10px] text-muted-foreground uppercase font-semibold tracking-wider truncate">{kpi.label}</p>
              </div>
              <p className="text-lg font-bold truncate">{kpi.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Growth + highlight cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className={`rounded-full p-2 ${derived.growthPct >= 0 ? "bg-emerald-500/10" : "bg-rose-500/10"}`}>
              {derived.growthPct >= 0 ? <ArrowUpRight className="h-5 w-5 text-emerald-500" /> : <ArrowDownRight className="h-5 w-5 text-rose-500" />}
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground uppercase">Variação Mensal</p>
              <p className={`text-lg font-bold ${derived.growthPct >= 0 ? "text-emerald-500" : "text-rose-500"}`}>
                {derived.growthPct >= 0 ? "+" : ""}{derived.growthPct.toFixed(1)}%
              </p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className={`rounded-full p-2 ${derived.leadsGrowth >= 0 ? "bg-emerald-500/10" : "bg-rose-500/10"}`}>
              {derived.leadsGrowth >= 0 ? <ArrowUpRight className="h-5 w-5 text-emerald-500" /> : <ArrowDownRight className="h-5 w-5 text-rose-500" />}
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground uppercase">Leads Variação</p>
              <p className={`text-lg font-bold ${derived.leadsGrowth >= 0 ? "text-emerald-500" : "text-rose-500"}`}>
                {derived.leadsGrowth >= 0 ? "+" : ""}{derived.leadsGrowth.toFixed(1)}%
              </p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="rounded-full p-2 bg-amber-500/10">
              <Award className="h-5 w-5 text-amber-500" />
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground uppercase">Melhor Mês</p>
              <p className="text-sm font-bold">{derived.bestMonth?.mes}</p>
              <p className="text-[10px] text-muted-foreground">{fmtCompact(derived.bestMonth?.valor || 0)}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="rounded-full p-2 bg-blue-500/10">
              <CalendarRange className="h-5 w-5 text-blue-500" />
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground uppercase">Média Mensal</p>
              <p className="text-sm font-bold">{fmtCompact(derived.avgVendas)}</p>
              <p className="text-[10px] text-muted-foreground">{derived.avgLeads.toFixed(0)} leads/mês</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="vendas" className="space-y-4">
        <TabsList className="flex-wrap">
          <TabsTrigger value="vendas">💰 Vendas</TabsTrigger>
          <TabsTrigger value="leads">👥 Leads</TabsTrigger>
          <TabsTrigger value="performance">📊 Performance</TabsTrigger>
          <TabsTrigger value="detalhadas">🏢 Vendas Detalhadas</TabsTrigger>
          <TabsTrigger value="detalhes">📋 Evolução</TabsTrigger>
        </TabsList>

        {/* ── Tab: Vendas ── */}
        <TabsContent value="vendas" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <DollarSign className="h-4 w-4 text-primary" /> Vendas por Mês
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={derived.vendasChart}>
                      <defs>
                        <linearGradient id="vendasGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="hsl(217, 91%, 60%)" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="hsl(217, 91%, 60%)" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" className="opacity-20" />
                      <XAxis dataKey="mes" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 10 }} tickFormatter={fmtCompact} />
                      <Tooltip content={<CustomTooltip />} formatter={(v: number) => fmt(v)} />
                      <Area type="monotone" dataKey="valor" name="Vendas (R$)" stroke="hsl(217, 91%, 60%)" strokeWidth={2.5} fill="url(#vendasGrad)" dot={{ r: 3, fill: "hsl(217, 91%, 60%)" }} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-primary" /> Acumulado
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={derived.cumulativeChart}>
                      <defs>
                        <linearGradient id="cumGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="hsl(142, 76%, 36%)" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="hsl(142, 76%, 36%)" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" className="opacity-20" />
                      <XAxis dataKey="mes" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 10 }} tickFormatter={fmtCompact} />
                      <Tooltip content={<CustomTooltip />} formatter={(v: number) => fmt(v)} />
                      <Area type="monotone" dataKey="acumulado" name="Acumulado (R$)" stroke="hsl(142, 76%, 36%)" strokeWidth={2.5} fill="url(#cumGrad)" dot={{ r: 3 }} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Zap className="h-4 w-4 text-primary" /> Crescimento Mensal (%)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={derived.vendasWithGrowth.slice(1)}>
                    <CartesianGrid strokeDasharray="3 3" className="opacity-20" />
                    <XAxis dataKey="mes" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `${v.toFixed(0)}%`} />
                    <Tooltip content={<CustomTooltip />} formatter={(v: number) => `${v.toFixed(1)}%`} />
                    <Bar dataKey="growthPct" name="Crescimento %" radius={[4, 4, 0, 0]} maxBarSize={35}>
                      {derived.vendasWithGrowth.slice(1).map((entry, i) => (
                        <Cell key={i} fill={entry.growthPct >= 0 ? "hsl(142, 76%, 36%)" : "hsl(350, 89%, 60%)"} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Tab: Leads ── */}
        <TabsContent value="leads" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Users className="h-4 w-4 text-primary" /> Leads por Mês
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={derived.leadsChart}>
                      <defs>
                        <linearGradient id="leadsGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="hsl(280, 67%, 55%)" stopOpacity={0.9} />
                          <stop offset="100%" stopColor="hsl(280, 67%, 55%)" stopOpacity={0.4} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" className="opacity-20" />
                      <XAxis dataKey="mes" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 10 }} />
                      <Tooltip content={<CustomTooltip />} />
                      <Bar dataKey="leads" name="Leads" fill="url(#leadsGrad)" radius={[6, 6, 0, 0]} maxBarSize={40} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 text-primary" /> Vendas vs Leads
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={derived.combinedChart}>
                      <CartesianGrid strokeDasharray="3 3" className="opacity-20" />
                      <XAxis dataKey="mes" tick={{ fontSize: 10 }} />
                      <YAxis yAxisId="left" tick={{ fontSize: 10 }} tickFormatter={fmtCompact} />
                      <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10 }} />
                      <Tooltip content={<CustomTooltip />} />
                      <Bar yAxisId="left" dataKey="vendas" name="Vendas (R$)" fill="hsl(217, 91%, 60%)" radius={[4, 4, 0, 0]} opacity={0.7} maxBarSize={30} />
                      <Line yAxisId="right" type="monotone" dataKey="leads" name="Leads" stroke="hsl(350, 89%, 60%)" strokeWidth={2.5} dot={{ r: 4 }} />
                      <Legend wrapperStyle={{ fontSize: 10 }} />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Zap className="h-4 w-4 text-primary" /> Variação de Leads (%)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={derived.leadsWithGrowth.slice(1)}>
                    <CartesianGrid strokeDasharray="3 3" className="opacity-20" />
                    <XAxis dataKey="mes" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `${v.toFixed(0)}%`} />
                    <Tooltip content={<CustomTooltip />} formatter={(v: number) => `${v.toFixed(1)}%`} />
                    <Bar dataKey="growthPct" name="Variação %" radius={[4, 4, 0, 0]} maxBarSize={35}>
                      {derived.leadsWithGrowth.slice(1).map((entry, i) => (
                        <Cell key={i} fill={entry.growthPct >= 0 ? "hsl(142, 76%, 36%)" : "hsl(350, 89%, 60%)"} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Tab: Performance ── */}
        <TabsContent value="performance" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Target className="h-4 w-4 text-primary" /> Radar de Performance
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <RadarChart data={derived.radarData}>
                      <PolarGrid stroke="hsl(var(--border))" opacity={0.3} />
                      <PolarAngleAxis dataKey="metric" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                      <PolarRadiusAxis tick={false} axisLine={false} domain={[0, 100]} />
                      <Radar name="Performance" dataKey="value" stroke="hsl(217, 91%, 60%)" fill="hsl(217, 91%, 60%)" fillOpacity={0.2} strokeWidth={2} />
                    </RadarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Award className="h-4 w-4 text-primary" /> Top 5 Meses
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={derived.top5} dataKey="valor" nameKey="mes" cx="50%" cy="50%" innerRadius={40} outerRadius={75} paddingAngle={3} strokeWidth={0}>
                        {derived.top5.map((_, i) => (
                          <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(v: number) => fmtCompact(v)} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="space-y-1.5 mt-2">
                  {derived.top5.map((m, i) => (
                    <div key={m.mes} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full" style={{ background: CHART_COLORS[i % CHART_COLORS.length] }} />
                        <span className="text-muted-foreground">{m.mes}</span>
                      </div>
                      <span className="font-medium">{fmtCompact(m.valor)}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-primary" /> Ticket Médio Estimado por Mês
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={derived.ticketChart}>
                    <CartesianGrid strokeDasharray="3 3" className="opacity-20" />
                    <XAxis dataKey="mes" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} tickFormatter={fmtCompact} />
                    <Tooltip content={<CustomTooltip />} formatter={(v: number) => fmt(v)} />
                    <Line type="monotone" dataKey="ticket" name="Ticket Médio" stroke="hsl(45, 93%, 47%)" strokeWidth={2.5} dot={{ r: 4, fill: "hsl(45, 93%, 47%)" }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Tab: Vendas Detalhadas ── */}
        <TabsContent value="detalhadas" className="space-y-4">
          {/* Summary cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Card>
              <CardContent className="p-4 flex items-center gap-3">
                <div className="rounded-full p-2 bg-blue-500/10">
                  <FileText className="h-5 w-5 text-blue-500" />
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase">Contratos</p>
                  <p className="text-lg font-bold">{data.vendas_detalhadas?.length || 0}</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 flex items-center gap-3">
                <div className="rounded-full p-2 bg-emerald-500/10">
                  <DollarSign className="h-5 w-5 text-emerald-500" />
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase">Valor Total</p>
                  <p className="text-lg font-bold">{fmtCompact(derived.totalDetalhado)}</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 flex items-center gap-3">
                <div className="rounded-full p-2 bg-purple-500/10">
                  <Building2 className="h-5 w-5 text-purple-500" />
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase">Administradoras</p>
                  <p className="text-lg font-bold">{derived.adminChart.length}</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 flex items-center gap-3">
                <div className="rounded-full p-2 bg-amber-500/10">
                  <CheckCircle2 className="h-5 w-5 text-amber-500" />
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase">Período</p>
                  <p className="text-lg font-bold">{data.vendas_periodo || "—"}</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Charts: Admin + Status */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-primary" /> Vendas por Administradora
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={derived.adminChart} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" className="opacity-20" />
                      <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={fmtCompact} />
                      <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={80} />
                      <Tooltip content={<CustomTooltip />} formatter={(v: number) => fmt(v)} />
                      <Bar dataKey="valor" name="Valor (R$)" radius={[0, 6, 6, 0]} maxBarSize={28}>
                        {derived.adminChart.map((_, i) => (
                          <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="space-y-1.5 mt-3">
                  {derived.adminChart.map((a, i) => (
                    <div key={a.name} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full" style={{ background: CHART_COLORS[i % CHART_COLORS.length] }} />
                        <span className="text-muted-foreground">{a.name}</span>
                      </div>
                      <span className="font-medium">{a.vendas} vendas · {fmtCompact(a.valor)}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-primary" /> Status das Vendas
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={derived.statusChart} dataKey="count" nameKey="name" cx="50%" cy="50%" innerRadius={45} outerRadius={80} paddingAngle={3} strokeWidth={0}>
                        {derived.statusChart.map((_, i) => (
                          <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="space-y-1.5 mt-3">
                  {derived.statusChart.map((s, i) => (
                    <div key={s.name} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full" style={{ background: CHART_COLORS[i % CHART_COLORS.length] }} />
                        <span className="text-muted-foreground">{s.name}</span>
                      </div>
                      <Badge variant="secondary" className="text-[10px]">{s.count}</Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Detailed sales table */}
          <Card>
            <CardHeader className="pb-2">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <FileText className="h-4 w-4 text-primary" /> Vendas do Período
                </CardTitle>
                <div className="relative w-full sm:w-64">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar cliente, contrato, admin…"
                    value={searchVendas}
                    onChange={(e) => setSearchVendas(e.target.value)}
                    className="pl-9 h-9 text-sm"
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 pr-3 text-muted-foreground font-medium text-xs">Contrato</th>
                      <th className="text-left py-2 px-3 text-muted-foreground font-medium text-xs">Cliente</th>
                      <th className="text-left py-2 px-3 text-muted-foreground font-medium text-xs">Administradora</th>
                      <th className="text-right py-2 px-3 text-muted-foreground font-medium text-xs">Valor</th>
                      <th className="text-left py-2 px-3 text-muted-foreground font-medium text-xs">Data</th>
                      <th className="text-left py-2 pl-3 text-muted-foreground font-medium text-xs">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredVendas.map((v) => (
                      <tr key={v.numero_contrato} className="border-b last:border-0 hover:bg-muted/50 transition-colors">
                        <td className="py-2 pr-3 text-xs font-mono">{v.numero_contrato}</td>
                        <td className="py-2 px-3 text-xs max-w-[180px] truncate" title={v.nome}>{v.nome}</td>
                        <td className="py-2 px-3">
                          <Badge variant="outline" className="text-[10px]">{v.administradora}</Badge>
                        </td>
                        <td className="py-2 px-3 text-right text-xs font-medium tabular-nums">{v.valorTotalVenda}</td>
                        <td className="py-2 px-3 text-xs text-muted-foreground">{v.dataVendido}</td>
                        <td className="py-2 pl-3">
                          <Badge
                            className="text-[10px]"
                            variant={v.status?.toLowerCase().includes("aprovada") ? "default" : "secondary"}
                          >
                            {v.status || "—"}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                    {filteredVendas.length === 0 && (
                      <tr>
                        <td colSpan={6} className="py-8 text-center text-muted-foreground text-sm">
                          Nenhuma venda encontrada.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Tab: Evolução ── */}
        <TabsContent value="detalhes">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-primary" /> Evolução Mensal Detalhada
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 pr-4 text-muted-foreground font-medium">Mês</th>
                      <th className="text-right py-2 px-4 text-muted-foreground font-medium">Vendas (R$)</th>
                      <th className="text-right py-2 px-4 text-muted-foreground font-medium">Variação</th>
                      <th className="text-left py-2 pl-4 text-muted-foreground font-medium">Performance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {derived.vendasWithGrowth.map((v, i) => {
                      const maxVal = Math.max(...derived.vendasChart.map((x) => x.valor));
                      const pct = maxVal > 0 ? (v.valor / maxVal) * 100 : 0;
                      return (
                        <tr key={v.mes} className="border-b last:border-0 hover:bg-muted/50 transition-colors">
                          <td className="py-2.5 pr-4 font-medium">{v.mes}</td>
                          <td className="py-2.5 px-4 text-right tabular-nums">{fmt(v.valor)}</td>
                          <td className="py-2.5 px-4 text-right">
                            {i > 0 ? (
                              <span className={`inline-flex items-center gap-0.5 text-xs font-medium ${v.growthPct >= 0 ? "text-emerald-500" : "text-rose-500"}`}>
                                {v.growthPct >= 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                                {Math.abs(v.growthPct).toFixed(1)}%
                              </span>
                            ) : (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                          </td>
                          <td className="py-2.5 pl-4 min-w-[120px]">
                            <div className="flex items-center gap-2">
                              <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                                <div className="h-full rounded-full bg-primary transition-all duration-500" style={{ width: `${pct}%` }} />
                              </div>
                              <span className="text-[10px] text-muted-foreground w-8 text-right">{pct.toFixed(0)}%</span>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
