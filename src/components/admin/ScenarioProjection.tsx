import { useState, useCallback, useMemo } from "react";
import { TrendingUp, TrendingDown, Target, RefreshCw, AlertTriangle, DollarSign, Calculator } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";

// Installment rules per admin
const INSTALLMENTS: Record<string, number> = {
  magalu: 10,
  ancora: 16,
  canopus: 6,
  hs: 1, // à vista
};

const SCENARIO_FACTORS = {
  optimistic: 1.25,
  realistic: 1.0,
  pessimistic: 0.75,
};

interface ScenarioMonth {
  month: string;
  commission: number;
  growth: number;
  breakdown: { magalu: number; ancora: number; canopus: number; hs: number };
}

interface Scenario {
  label: string;
  description: string;
  months: ScenarioMonth[];
}

interface ProjectionData {
  scenarios: {
    optimistic: Scenario;
    realistic: Scenario;
    pessimistic: Scenario;
  };
}

interface ScenarioProjectionProps {
  getMonthRows: (year: number, month: number) => { valor: number; administradora: string }[];
  selectedMonth: number;
  selectedYear: number;
}

const MONTH_NAMES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

function formatCurrency(cents: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
}

function formatInputBRL(value: string) {
  const num = parseFloat(value.replace(/\D/g, "")) || 0;
  return new Intl.NumberFormat("pt-BR").format(num);
}

function ScenarioCard({ scenario, color, icon: Icon }: { scenario: Scenario; color: string; icon: any }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Icon className={`w-4 h-4 ${color}`} />
        <span className={`text-sm font-semibold ${color}`}>{scenario.label}</span>
      </div>
      <p className="text-[10px] sm:text-xs text-muted-foreground">{scenario.description}</p>
      <div className="space-y-2">
        {scenario.months.map((m, i) => (
          <div key={i} className="glass-card p-2.5 sm:p-3 space-y-1.5">
            <div className="flex items-center justify-between">
              <div className="text-[10px] sm:text-xs font-medium text-foreground">{m.month}</div>
              <div className={`text-xs sm:text-sm font-bold ${m.growth >= 0 ? "text-emerald-500" : "text-red-400"}`}>
                {m.growth >= 0 ? "+" : ""}{m.growth.toFixed(1)}%
              </div>
            </div>
            <div className="text-sm sm:text-base font-bold text-primary">
              {formatCurrency(m.commission)}
            </div>
            <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 pt-1 border-t border-border/30">
              {(["magalu", "ancora", "canopus", "hs"] as const).map((adm) => (
                <div key={adm} className="flex justify-between">
                  <span className="text-[9px] text-muted-foreground capitalize">{adm === "ancora" ? "Âncora" : adm === "hs" ? "HS" : adm.charAt(0).toUpperCase() + adm.slice(1)}</span>
                  <span className="text-[9px] font-medium text-foreground">{formatCurrency(m.breakdown[adm])}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function ScenarioProjection({ getMonthRows, selectedMonth, selectedYear }: ScenarioProjectionProps) {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<ProjectionData | null>(null);
  const [step, setStep] = useState<"input" | "result">("input");

  // Sales estimates in R$ (display value, not cents)
  const [salesMagalu, setSalesMagalu] = useState("");
  const [salesAncora, setSalesAncora] = useState("");
  const [salesCanopus, setSalesCanopus] = useState("");
  const [salesHS, setSalesHS] = useState("");
  const [obsInadimplencia, setObsInadimplencia] = useState("");

  // Commission % per administrator
  const [pctMagalu, setPctMagalu] = useState("2.5");
  const [pctAncora, setPctAncora] = useState("5");
  const [pctCanopus, setPctCanopus] = useState("4");
  const [pctHS, setPctHS] = useState("2");

  const parseToCents = (val: string) => Math.round((parseFloat(val.replace(/\D/g, "")) || 0) * 100);

  // Calculate past months' sales from Google Sheets (last 6 months)
  const pastMonthsSales = useMemo(() => {
    const months: { label: string; total: number; byAdmin: Record<string, number> }[] = [];
    for (let i = 6; i >= 1; i--) {
      const d = new Date(selectedYear, selectedMonth - i, 1);
      const y = d.getFullYear();
      const m = d.getMonth();
      const rows = getMonthRows(y, m);
      const byAdmin: Record<string, number> = {};
      let total = 0;
      for (const r of rows) {
        const v = (r.valor || 0) * 100; // to cents
        total += v;
        const adm = (r.administradora || "").toLowerCase().trim();
        if (adm.includes("magalu")) byAdmin.magalu = (byAdmin.magalu || 0) + v;
        else if (adm.includes("âncora") || adm.includes("ancora")) byAdmin.ancora = (byAdmin.ancora || 0) + v;
        else if (adm.includes("canopus")) byAdmin.canopus = (byAdmin.canopus || 0) + v;
        else if (adm.includes("hs")) byAdmin.hs = (byAdmin.hs || 0) + v;
      }
      months.push({ label: `${MONTH_NAMES[m]}/${y}`, total: Math.round(total), byAdmin });
    }
    return months;
  }, [getMonthRows, selectedMonth, selectedYear]);

  // Average of past sales (in cents) - total and per admin
  const avgPastSales = useMemo(() => {
    const nonZero = pastMonthsSales.filter((m) => m.total > 0);
    if (nonZero.length === 0) return 0;
    return Math.round(nonZero.reduce((a, b) => a + b.total, 0) / nonZero.length);
  }, [pastMonthsSales]);

  const avgByAdmin = useMemo(() => {
    const nonZero = pastMonthsSales.filter((m) => m.total > 0);
    if (nonZero.length === 0) return { magalu: 0, ancora: 0, canopus: 0, hs: 0 };
    const sum = { magalu: 0, ancora: 0, canopus: 0, hs: 0 };
    for (const m of nonZero) {
      sum.magalu += m.byAdmin.magalu || 0;
      sum.ancora += m.byAdmin.ancora || 0;
      sum.canopus += m.byAdmin.canopus || 0;
      sum.hs += m.byAdmin.hs || 0;
    }
    return {
      magalu: Math.round(sum.magalu / nonZero.length),
      ancora: Math.round(sum.ancora / nonZero.length),
      canopus: Math.round(sum.canopus / nonZero.length),
      hs: Math.round(sum.hs / nonZero.length),
    };
  }, [pastMonthsSales]);

  const fillWithAverage = useCallback(() => {
    const fmt = (cents: number) => formatInputBRL(String(Math.round(cents / 100)));
    setSalesMagalu(avgByAdmin.magalu > 0 ? fmt(avgByAdmin.magalu) : "");
    setSalesAncora(avgByAdmin.ancora > 0 ? fmt(avgByAdmin.ancora) : "");
    setSalesCanopus(avgByAdmin.canopus > 0 ? fmt(avgByAdmin.canopus) : "");
    setSalesHS(avgByAdmin.hs > 0 ? fmt(avgByAdmin.hs) : "");
  }, [avgByAdmin]);

  // Last month's sales for growth calculation
  const lastMonthSales = useMemo(() => {
    const last = pastMonthsSales[pastMonthsSales.length - 1];
    return last?.total || 0;
  }, [pastMonthsSales]);

  const generateProjection = useCallback(() => {
    const pct = {
      magalu: (parseFloat(pctMagalu) || 0) / 100,
      ancora: (parseFloat(pctAncora) || 0) / 100,
      canopus: (parseFloat(pctCanopus) || 0) / 100,
      hs: (parseFloat(pctHS) || 0) / 100,
    };

    // Use user input if provided, otherwise fall back to average past sales split equally
    const inputMagalu = parseToCents(salesMagalu);
    const inputAncora = parseToCents(salesAncora);
    const inputCanopus = parseToCents(salesCanopus);
    const inputHS = parseToCents(salesHS);
    const totalInput = inputMagalu + inputAncora + inputCanopus + inputHS;

    // Sales per admin (in cents) — the credit sold
    const salesCents = {
      magalu: inputMagalu,
      ancora: inputAncora,
      canopus: inputCanopus,
      hs: inputHS,
    };

    // Commission = sales × commission%
    const commissionCents = {
      magalu: Math.round(salesCents.magalu * pct.magalu),
      ancora: Math.round(salesCents.ancora * pct.ancora),
      canopus: Math.round(salesCents.canopus * pct.canopus),
      hs: Math.round(salesCents.hs * pct.hs),
    };
    const totalCommission = commissionCents.magalu + commissionCents.ancora + commissionCents.canopus + commissionCents.hs;
    const inadCents = parseToCents(obsInadimplencia);

    function buildScenario(factor: number, label: string, description: string): Scenario {
      const months: ScenarioMonth[] = [];
      let prevCommission = 0;

      for (let i = 1; i <= 3; i++) {
        const d = new Date(selectedYear, selectedMonth + i, 1);
        const monthName = `${MONTH_NAMES[d.getMonth()]}/${d.getFullYear()}`;

        // Each admin's monthly commission installment
        // Magalu: commission / 10 parcels, Âncora: /16, Canopus: /6, HS: 100% month 1
        const breakdown = {
          magalu: i <= INSTALLMENTS.magalu ? Math.round((commissionCents.magalu * factor) / INSTALLMENTS.magalu) : 0,
          ancora: i <= INSTALLMENTS.ancora ? Math.round((commissionCents.ancora * factor) / INSTALLMENTS.ancora) : 0,
          canopus: i <= INSTALLMENTS.canopus ? Math.round((commissionCents.canopus * factor) / INSTALLMENTS.canopus) : 0,
          hs: i === 1 ? Math.round(commissionCents.hs * factor) : 0,
        };

        // Total commission received this month = sum of all admin installments - inadimplência
        const total = Math.max(0, breakdown.magalu + breakdown.ancora + breakdown.canopus + breakdown.hs - inadCents);

        const growth = prevCommission > 0 ? ((total - prevCommission) / prevCommission) * 100 : 0;
        prevCommission = total;

        months.push({ month: monthName, commission: total, growth, breakdown });
      }

      return { label, description, months };
    }

    const totalSales = formatCurrency(totalInput);
    const totalComm = formatCurrency(totalCommission);

    const scenarios = {
      optimistic: buildScenario(SCENARIO_FACTORS.optimistic, "Otimista", `Vendas +25% sobre a estimativa. Comissão total: ${formatCurrency(Math.round(totalCommission * 1.25))}`),
      realistic: buildScenario(SCENARIO_FACTORS.realistic, "Realista", `Vendas conforme estimativa. Comissão total: ${totalComm}`),
      pessimistic: buildScenario(SCENARIO_FACTORS.pessimistic, "Pessimista", `Vendas -25% sobre a estimativa. Comissão total: ${formatCurrency(Math.round(totalCommission * 0.75))}`),
    };

    setData({ scenarios });
    setStep("result");
  }, [salesMagalu, salesAncora, salesCanopus, salesHS, obsInadimplencia, selectedMonth, selectedYear, pctMagalu, pctAncora, pctCanopus, pctHS]);

  const handleOpenChange = (v: boolean) => {
    setOpen(v);
    if (!v) {
      setStep("input");
      setData(null);
    }
  };

  const totalEstimated = parseToCents(salesMagalu) + parseToCents(salesAncora) + parseToCents(salesCanopus) + parseToCents(salesHS);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          className="w-full h-auto py-3 sm:py-4 gap-2 sm:gap-3 border-primary/30 hover:border-primary/50 hover:bg-primary/5"
          size="lg"
        >
          <DollarSign className="w-5 h-5 sm:w-6 sm:h-6 text-primary" />
          <div className="text-left">
            <div className="font-display text-sm sm:text-base font-bold text-foreground">Projeção de Comissão</div>
            <div className="text-[10px] sm:text-xs text-muted-foreground">Magalu • Âncora • Canopus • HS</div>
          </div>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl h-[90vh] flex flex-col p-0">
        <DialogHeader className="px-4 sm:px-6 pt-4 sm:pt-6 pb-2 border-b border-border shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 sm:gap-3">
              <DollarSign className="w-5 h-5 sm:w-6 sm:h-6 text-primary" />
              <div>
                <DialogTitle className="font-display text-base sm:text-xl font-bold">
                  Projeção de Comissão
                </DialogTitle>
                <p className="text-[10px] sm:text-xs text-muted-foreground">
                  {step === "input"
                    ? "Informe suas estimativas de vendas por administradora"
                    : "Próximos 3 meses • Cálculo determinístico"}
                </p>
              </div>
            </div>
            {data && step === "result" && (
              <Button variant="outline" size="sm" onClick={() => setStep("input")} className="text-[11px] sm:text-xs h-7 sm:h-8">
                <RefreshCw className="w-3 h-3 sm:w-3.5 sm:h-3.5 mr-1" />
                Nova Projeção
              </Button>
            )}
          </div>
        </DialogHeader>

        <ScrollArea className="flex-1 px-4 sm:px-6 py-4">
          {/* Step 1: Sales Input */}
          {step === "input" && (
            <div className="space-y-5 max-w-md mx-auto">
              <div className="text-center space-y-2">
                <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto">
                  <Calculator className="w-7 h-7 sm:w-8 sm:h-8 text-primary" />
                </div>
                <h3 className="font-display text-sm sm:text-base font-semibold text-foreground">
                  Quanto você espera vender?
                </h3>
                <p className="text-[10px] sm:text-xs text-muted-foreground leading-relaxed">
                  Informe a estimativa de crédito vendido para o próximo mês.
                  A comissão é calculada: vendas × % da administradora, dividida pelas parcelas.
                  {avgPastSales > 0 && <> Média realizada: <strong>{formatCurrency(avgPastSales)}</strong>.</>}
                </p>
              </div>

              {avgPastSales > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full text-xs h-8 border-primary/30 hover:bg-primary/10"
                  onClick={fillWithAverage}
                >
                  <TrendingUp className="w-3.5 h-3.5 mr-1.5 text-primary" />
                  Usar média dos últimos meses ({formatCurrency(avgPastSales)})
                </Button>
              )}

              <div className="space-y-3">
                {[
                  { label: "Magalu", sub: "Comissão em 10x", value: salesMagalu, set: setSalesMagalu, pct: pctMagalu, setPct: setPctMagalu, color: "text-blue-500" },
                  { label: "Âncora", sub: "Comissão em 16x", value: salesAncora, set: setSalesAncora, pct: pctAncora, setPct: setPctAncora, color: "text-orange-500" },
                  { label: "Canopus", sub: "Comissão em 6x", value: salesCanopus, set: setSalesCanopus, pct: pctCanopus, setPct: setPctCanopus, color: "text-purple-500" },
                  { label: "HS Consórcios", sub: "Comissão à vista", value: salesHS, set: setSalesHS, pct: pctHS, setPct: setPctHS, color: "text-emerald-500" },
                ].map(({ label, sub, value, set, pct, setPct, color }) => {
                  const salesCents = parseToCents(value);
                  const commPreview = Math.round(salesCents * ((parseFloat(pct) || 0) / 100));
                  return (
                    <div key={label} className="glass-card p-3 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <div>
                          <span className={`text-xs sm:text-sm font-semibold ${color}`}>{label}</span>
                          <span className="text-[9px] sm:text-[10px] text-muted-foreground ml-2">{sub}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">R$</span>
                        <Input
                          type="text"
                          inputMode="numeric"
                          placeholder="0"
                          value={value}
                          onChange={(e) => {
                            const raw = e.target.value.replace(/\D/g, "");
                            set(raw ? formatInputBRL(raw) : "");
                          }}
                          className="h-9 text-sm text-right font-mono flex-1"
                        />
                        <div className="flex items-center gap-1 shrink-0">
                          <Input
                            type="number"
                            step="0.1"
                            min="0"
                            max="100"
                            value={pct}
                            onChange={(e) => setPct(e.target.value)}
                            className="h-9 w-16 text-sm text-right font-mono"
                          />
                          <span className="text-xs text-muted-foreground">%</span>
                        </div>
                      </div>
                      {salesCents > 0 && commPreview > 0 && (
                        <div className="text-[9px] text-muted-foreground text-right">
                          Comissão: {formatCurrency(commPreview)}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Observação sobre inadimplência */}
              <div className="glass-card p-3 space-y-1.5 border-l-2 border-l-amber-500/50">
                <div className="flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                  <span className="text-xs font-semibold text-amber-500">Inadimplência / Pula Parcela / Grupo Novo</span>
                </div>
                <p className="text-[9px] sm:text-[10px] text-muted-foreground leading-relaxed">
                  Quanto você estima perder/atrasar por mês? (R$)
                </p>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">R$</span>
                  <Input
                    type="text"
                    inputMode="numeric"
                    placeholder="0"
                    value={obsInadimplencia}
                    onChange={(e) => {
                      const raw = e.target.value.replace(/\D/g, "");
                      setObsInadimplencia(raw ? formatInputBRL(raw) : "");
                    }}
                    className="h-9 text-sm text-right font-mono"
                  />
                </div>
              </div>

              {totalEstimated > 0 && (
                <div className="glass-card p-3 border-l-2 border-l-primary">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Total estimado de vendas</span>
                    <span className="text-sm font-bold text-primary">{formatCurrency(totalEstimated)}</span>
                  </div>
                  {parseToCents(obsInadimplencia) > 0 && (
                    <div className="flex items-center justify-between mt-1 pt-1 border-t border-border/30">
                      <span className="text-[10px] text-amber-500">Perda estimada/mês</span>
                      <span className="text-xs font-semibold text-amber-500">- {formatCurrency(parseToCents(obsInadimplencia))}</span>
                    </div>
                  )}
                </div>
              )}

              {/* Premissa explicativa */}
              <div className="glass-card p-3 space-y-1 bg-muted/30">
                <div className="flex items-center gap-1.5">
                  <Calculator className="w-3 h-3 text-muted-foreground" />
                  <span className="text-[10px] font-semibold text-muted-foreground">Como é calculado</span>
                </div>
                <p className="text-[9px] text-muted-foreground leading-relaxed">
                  <strong>Comissão/mês</strong> = (Vendas × % comissão) ÷ parcelas por administradora − Inadimplência.
                  Magalu 2.5%/10x, Âncora 5%/16x, Canopus 4%/6x, HS 2% à vista.
                  Otimista (+25%), Realista (base), Pessimista (−25%).
                </p>
              </div>

              <Button
                onClick={generateProjection}
                disabled={totalEstimated === 0}
                className="w-full gap-2 bg-gradient-to-r from-primary to-primary/80"
                size="lg"
              >
                <Target className="w-4 h-4" />
                Calcular Projeção
              </Button>
            </div>
          )}

          {/* Step 2: Results */}
          {data && step === "result" && (
            <div className="space-y-6">
              <Tabs defaultValue="all" className="w-full">
                <TabsList className="grid w-full grid-cols-4 h-8 sm:h-9">
                  <TabsTrigger value="all" className="text-[10px] sm:text-xs">Todos</TabsTrigger>
                  <TabsTrigger value="optimistic" className="text-[10px] sm:text-xs text-emerald-500">Otimista</TabsTrigger>
                  <TabsTrigger value="realistic" className="text-[10px] sm:text-xs text-yellow-500">Realista</TabsTrigger>
                  <TabsTrigger value="pessimistic" className="text-[10px] sm:text-xs text-red-400">Pessimista</TabsTrigger>
                </TabsList>

                <TabsContent value="all" className="mt-4">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <ScenarioCard scenario={data.scenarios.optimistic} color="text-emerald-500" icon={TrendingUp} />
                    <ScenarioCard scenario={data.scenarios.realistic} color="text-yellow-500" icon={Target} />
                    <ScenarioCard scenario={data.scenarios.pessimistic} color="text-red-400" icon={TrendingDown} />
                  </div>
                </TabsContent>

                <TabsContent value="optimistic" className="mt-4">
                  <ScenarioCard scenario={data.scenarios.optimistic} color="text-emerald-500" icon={TrendingUp} />
                </TabsContent>
                <TabsContent value="realistic" className="mt-4">
                  <ScenarioCard scenario={data.scenarios.realistic} color="text-yellow-500" icon={Target} />
                </TabsContent>
                <TabsContent value="pessimistic" className="mt-4">
                  <ScenarioCard scenario={data.scenarios.pessimistic} color="text-red-400" icon={TrendingDown} />
                </TabsContent>
              </Tabs>

              {/* Gráfico Comparativo */}
              <div className="glass-card p-3 sm:p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-primary" />
                  <span className="text-xs sm:text-sm font-semibold text-foreground">Comparativo de Comissão</span>
                </div>
                <div className="h-[220px] sm:h-[280px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                      data={data.scenarios.realistic.months.map((m, i) => ({
                        name: m.month,
                        otimista: Math.round((data!.scenarios.optimistic.months[i]?.commission || 0) / 100),
                        realista: Math.round((data!.scenarios.realistic.months[i]?.commission || 0) / 100),
                        pessimista: Math.round((data!.scenarios.pessimistic.months[i]?.commission || 0) / 100),
                      }))}
                      margin={{ top: 5, right: 10, left: 0, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="name" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                      <YAxis
                        tick={{ fontSize: 9 }}
                        stroke="hsl(var(--muted-foreground))"
                        tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "hsl(var(--card))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: "8px",
                          fontSize: "11px",
                        }}
                        formatter={(value: number) =>
                          new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value)
                        }
                      />
                      <Legend wrapperStyle={{ fontSize: "10px" }} />
                      <Line type="monotone" dataKey="otimista" name="Otimista" stroke="#10b981" strokeWidth={2.5} dot={{ r: 4, fill: "#10b981" }} />
                      <Line type="monotone" dataKey="realista" name="Realista" stroke="#eab308" strokeWidth={2.5} dot={{ r: 4, fill: "#eab308" }} />
                      <Line type="monotone" dataKey="pessimista" name="Pessimista" stroke="#f87171" strokeWidth={2.5} strokeDasharray="5 5" dot={{ r: 4, fill: "#f87171" }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Premissas do cálculo */}
              <div className="glass-card p-3 sm:p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <Calculator className="w-4 h-4 text-muted-foreground" />
                  <span className="text-xs sm:text-sm font-semibold text-foreground">Premissas do Cálculo</span>
                </div>
                <ul className="space-y-1.5">
                  <li className="text-[10px] sm:text-xs text-muted-foreground flex items-start gap-2">
                    <span className="text-primary mt-0.5">•</span>
                    <span>Magalu: {formatCurrency(parseToCents(salesMagalu))} × {pctMagalu}% = <strong className="text-foreground">{formatCurrency(Math.round(parseToCents(salesMagalu) * (parseFloat(pctMagalu) || 0) / 100))}</strong> ÷ 10 = <strong className="text-foreground">{formatCurrency(Math.round(parseToCents(salesMagalu) * (parseFloat(pctMagalu) || 0) / 100 / 10))}/mês</strong></span>
                  </li>
                  <li className="text-[10px] sm:text-xs text-muted-foreground flex items-start gap-2">
                    <span className="text-primary mt-0.5">•</span>
                    <span>Âncora: {formatCurrency(parseToCents(salesAncora))} × {pctAncora}% = <strong className="text-foreground">{formatCurrency(Math.round(parseToCents(salesAncora) * (parseFloat(pctAncora) || 0) / 100))}</strong> ÷ 16 = <strong className="text-foreground">{formatCurrency(Math.round(parseToCents(salesAncora) * (parseFloat(pctAncora) || 0) / 100 / 16))}/mês</strong></span>
                  </li>
                  <li className="text-[10px] sm:text-xs text-muted-foreground flex items-start gap-2">
                    <span className="text-primary mt-0.5">•</span>
                    <span>Canopus: {formatCurrency(parseToCents(salesCanopus))} × {pctCanopus}% = <strong className="text-foreground">{formatCurrency(Math.round(parseToCents(salesCanopus) * (parseFloat(pctCanopus) || 0) / 100))}</strong> ÷ 6 = <strong className="text-foreground">{formatCurrency(Math.round(parseToCents(salesCanopus) * (parseFloat(pctCanopus) || 0) / 100 / 6))}/mês</strong></span>
                  </li>
                  <li className="text-[10px] sm:text-xs text-muted-foreground flex items-start gap-2">
                    <span className="text-primary mt-0.5">•</span>
                    <span>HS: {formatCurrency(parseToCents(salesHS))} × {pctHS}% = <strong className="text-foreground">{formatCurrency(Math.round(parseToCents(salesHS) * (parseFloat(pctHS) || 0) / 100))}</strong> à vista (apenas mês 1)</span>
                  </li>
                  {parseToCents(obsInadimplencia) > 0 && (
                    <li className="text-[10px] sm:text-xs text-amber-500 flex items-start gap-2">
                      <span className="mt-0.5">⚠</span>
                      <span>Inadimplência estimada: <strong>- {formatCurrency(parseToCents(obsInadimplencia))}/mês</strong></span>
                    </li>
                  )}
                </ul>
              </div>
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
