import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { TrendingUp, Loader2 } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, BarChart, Bar,
  ComposedChart, Area,
} from "recharts";

const MONTH_NAMES = [
  "Jan", "Fev", "Mar", "Abr", "Mai", "Jun",
  "Jul", "Ago", "Set", "Out", "Nov", "Dez",
];

const EXCLUDED_CATEGORIES = ["Entre Contas", "Operação"];

function formatCurrency(cents: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(cents / 100);
}

interface BudgetAnnualChartProps {
  selectedYear: number;
}

export function BudgetAnnualChart({ selectedYear }: BudgetAnnualChartProps) {
  const { session } = useAuth();

  const { data: budgetLines = [], isLoading: budgetLoading } = useQuery({
    queryKey: ["budget-lines", selectedYear],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("budget_lines")
        .select("*")
        .eq("year", selectedYear);
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch full year of Procfy transactions in a single bulk call
  const { data: yearTransactions = [], isLoading: txLoading } = useQuery({
    queryKey: ["procfy-year", selectedYear],
    enabled: !!session?.access_token,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const startDate = `${selectedYear}-01-01`;
      const endDate = `${selectedYear}-12-31`;

      const params = new URLSearchParams({
        endpoint: "transactions",
        start_date: startDate,
        end_date: endDate,
      });

      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/procfy-bulk?${params}`;
      const res = await fetch(url, {
        headers: {
          Authorization: `Bearer ${session!.access_token}`,
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
      });

      if (!res.ok) return [];
      const result = await res.json();
      return result.data || [];
    },
  });

  // Aggregate actuals by month
  const monthlyActuals = useMemo(() => {
    const map: Record<number, { revenue: number; expenses: number }> = {};
    for (let i = 1; i <= 12; i++) map[i] = { revenue: 0, expenses: 0 };

    yearTransactions.forEach((t: any) => {
      if (t.transaction_type === "transfer") return;
      if (EXCLUDED_CATEGORIES.includes(t.category?.name || "")) return;

      const dueDate = t.due_date || t.paid_at;
      if (!dueDate) return;
      const month = new Date(dueDate).getMonth() + 1;
      if (month < 1 || month > 12) return;

      if (t.transaction_type === "revenue" && t.category?.name === "Comissão") {
        map[month].revenue += t.amount_cents;
      } else if (t.transaction_type !== "revenue") {
        map[month].expenses += t.amount_cents;
      }
    });

    return map;
  }, [yearTransactions]);

  const chartData = useMemo(() => {
    if (!budgetLines.length) return [];

    return MONTH_NAMES.map((name, i) => {
      const month = i + 1;
      const monthLines = budgetLines.filter((b: any) => b.month === month);
      const get = (cat: string) => (monthLines.find((b: any) => b.category === cat)?.amount_cents || 0) / 100;

      const budgetReceita = get("Receita Estimada");
      const custoOp = get("Custo da Operação");
      const custosNaoOp = get("Custos Não Operacionais");
      const comissoes = get("Total Comissões");
      const imposto = get("Imposto");
      const budgetDespesas = custoOp + custosNaoOp + comissoes + imposto;
      const budgetLucro = get("Lucro Líquido");
      const budgetEbitda = get("EBITDA");

      const actual = monthlyActuals[month] || { revenue: 0, expenses: 0 };
      const hasActual = actual.revenue > 0 || actual.expenses > 0;

      return {
        name,
        budgetReceita,
        budgetDespesas,
        budgetLucro,
        budgetEbitda,
        realizadoReceita: hasActual ? actual.revenue / 100 : undefined,
        realizadoDespesas: hasActual ? actual.expenses / 100 : undefined,
        realizadoLucro: hasActual ? (actual.revenue - actual.expenses) / 100 : undefined,
      };
    });
  }, [budgetLines, monthlyActuals]);

  // YTD accumulated data
  const ytdData = useMemo(() => {
    if (!chartData.length) return [];
    let accBudgetRec = 0, accBudgetDesp = 0, accRealRec = 0, accRealDesp = 0;
    return chartData.map((d) => {
      accBudgetRec += d.budgetReceita;
      accBudgetDesp += d.budgetDespesas;
      if (d.realizadoReceita !== undefined) accRealRec += d.realizadoReceita;
      if (d.realizadoDespesas !== undefined) accRealDesp += d.realizadoDespesas;
      const hasActual = d.realizadoReceita !== undefined;
      return {
        name: d.name,
        budgetReceitaAcum: accBudgetRec,
        budgetDespesasAcum: accBudgetDesp,
        realizadoReceitaAcum: hasActual ? accRealRec : undefined,
        realizadoDespesasAcum: hasActual ? accRealDesp : undefined,
      };
    });
  }, [chartData]);

  if (budgetLoading || !budgetLines.length) return null;

  const loading = txLoading;

  return (
    <div className="space-y-3 sm:space-y-4">
      {/* Loading indicator */}
      {loading && (
        <div className="glass-card p-3 sm:p-4 border-l-4 border-l-primary">
          <div className="flex items-center gap-2 mb-2">
            <Loader2 className="w-4 h-4 text-primary animate-spin" />
            <span className="text-xs sm:text-sm text-muted-foreground font-medium">
              Carregando dados do Procfy para {selectedYear}...
            </span>
          </div>
          <Progress value={undefined} className="h-1.5 animate-pulse" />
        </div>
      )}

      {/* Revenue: Budget vs Realizado */}
      <div className="glass-card p-4 sm:p-5 space-y-3">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-primary" />
          <h3 className="font-display text-sm sm:text-base font-semibold text-foreground">
            Receita: Budget vs Realizado — {selectedYear}
          </h3>
        </div>
        <div className="h-56 sm:h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} barGap={2}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="name" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} />
              <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} />
              <Tooltip
                formatter={(v: number) => v !== undefined ? formatCurrency(v * 100) : "—"}
                contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, color: "hsl(var(--foreground))", fontSize: 12 }}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="budgetReceita" name="Budget" fill="hsl(var(--primary))" opacity={0.4} radius={[4, 4, 0, 0]} />
              <Bar dataKey="realizadoReceita" name="Realizado" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Expenses: Budget vs Realizado */}
      <div className="glass-card p-4 sm:p-5 space-y-3">
        <h3 className="font-display text-sm sm:text-base font-semibold text-foreground">
          Despesas: Budget vs Realizado — {selectedYear}
        </h3>
        <div className="h-56 sm:h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} barGap={2}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="name" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} />
              <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} />
              <Tooltip
                formatter={(v: number) => v !== undefined ? formatCurrency(v * 100) : "—"}
                contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, color: "hsl(var(--foreground))", fontSize: 12 }}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="budgetDespesas" name="Budget" fill="hsl(var(--destructive))" opacity={0.4} radius={[4, 4, 0, 0]} />
              <Bar dataKey="realizadoDespesas" name="Realizado" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Lucro: Budget vs Realizado */}
      <div className="glass-card p-4 sm:p-5 space-y-3">
        <h3 className="font-display text-sm sm:text-base font-semibold text-foreground">
          Lucro Líquido: Budget vs Realizado — {selectedYear}
        </h3>
        <div className="h-48 sm:h-64">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="name" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} />
              <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} />
              <Tooltip
                formatter={(v: number) => v !== undefined ? formatCurrency(v * 100) : "—"}
                contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, color: "hsl(var(--foreground))", fontSize: 12 }}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Line type="monotone" dataKey="budgetLucro" name="Budget" stroke="hsl(var(--primary))" strokeWidth={2} strokeDasharray="6 3" dot={{ r: 3 }} />
              <Line type="monotone" dataKey="realizadoLucro" name="Realizado" stroke="hsl(var(--primary))" strokeWidth={2.5} dot={{ r: 4 }} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* EBITDA & Lucro Projeção */}
      <div className="glass-card p-4 sm:p-5 space-y-3">
        <h3 className="font-display text-sm sm:text-base font-semibold text-foreground">
          Projeção EBITDA & Lucro Líquido — {selectedYear}
        </h3>
        <div className="h-48 sm:h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="name" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} />
              <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} />
              <Tooltip
                formatter={(v: number) => formatCurrency(v * 100)}
                contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, color: "hsl(var(--foreground))", fontSize: 12 }}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Line type="monotone" dataKey="budgetEbitda" name="EBITDA" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 3 }} />
              <Line type="monotone" dataKey="budgetLucro" name="Lucro Líquido" stroke="hsl(var(--accent-foreground))" strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* YTD Acumulado */}
      <div className="glass-card p-4 sm:p-5 space-y-3">
        <h3 className="font-display text-sm sm:text-base font-semibold text-foreground">
          Acumulado YTD: Budget vs Realizado — {selectedYear}
        </h3>
        <div className="h-48 sm:h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={ytdData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="name" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} />
              <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} />
              <Tooltip
                formatter={(v: number) => v !== undefined ? formatCurrency(v * 100) : "—"}
                contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, color: "hsl(var(--foreground))", fontSize: 12 }}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Line type="monotone" dataKey="budgetReceitaAcum" name="Receita Budget" stroke="hsl(var(--primary))" strokeWidth={2} strokeDasharray="6 3" dot={{ r: 3 }} />
              <Line type="monotone" dataKey="realizadoReceitaAcum" name="Receita Real" stroke="hsl(var(--primary))" strokeWidth={2.5} dot={{ r: 4 }} />
              <Line type="monotone" dataKey="budgetDespesasAcum" name="Despesas Budget" stroke="hsl(var(--destructive))" strokeWidth={2} strokeDasharray="6 3" dot={{ r: 3 }} />
              <Line type="monotone" dataKey="realizadoDespesasAcum" name="Despesas Real" stroke="hsl(var(--destructive))" strokeWidth={2.5} dot={{ r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Tabela Resumo Mensal com Variância */}
      <div className="glass-card p-4 sm:p-5 space-y-3">
        <h3 className="font-display text-sm sm:text-base font-semibold text-foreground">
          Resumo Mensal — Budget vs Realizado {selectedYear}
        </h3>
        <div className="overflow-x-auto -mx-2 px-2">
          <table className="w-full text-[10px] sm:text-xs">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-2 px-1 text-muted-foreground font-medium">Mês</th>
                <th className="text-right py-2 px-1 text-muted-foreground font-medium">Receita Budget</th>
                <th className="text-right py-2 px-1 text-muted-foreground font-medium">Receita Real</th>
                <th className="text-right py-2 px-1 text-muted-foreground font-medium">Var. Receita</th>
                <th className="text-right py-2 px-1 text-muted-foreground font-medium">Desp. Budget</th>
                <th className="text-right py-2 px-1 text-muted-foreground font-medium">Desp. Real</th>
                <th className="text-right py-2 px-1 text-muted-foreground font-medium">Var. Desp.</th>
                <th className="text-right py-2 px-1 text-muted-foreground font-medium">Lucro Budget</th>
                <th className="text-right py-2 px-1 text-muted-foreground font-medium">Lucro Real</th>
                <th className="text-right py-2 px-1 text-muted-foreground font-medium">Var. Lucro</th>
              </tr>
            </thead>
            <tbody>
              {chartData.map((d, i) => {
                const varReceita = d.realizadoReceita !== undefined ? d.realizadoReceita - d.budgetReceita : undefined;
                const varDespesas = d.realizadoDespesas !== undefined ? d.realizadoDespesas - d.budgetDespesas : undefined;
                const varLucro = d.realizadoLucro !== undefined ? d.realizadoLucro - d.budgetLucro : undefined;
                const hasActual = d.realizadoReceita !== undefined;

                return (
                  <tr key={d.name} className="border-b border-border/30 hover:bg-muted/20">
                    <td className="py-1.5 px-1 font-medium text-foreground">{d.name}</td>
                    <td className="text-right py-1.5 px-1 text-muted-foreground">{formatCurrency(d.budgetReceita * 100)}</td>
                    <td className="text-right py-1.5 px-1 text-foreground">{hasActual ? formatCurrency(d.realizadoReceita! * 100) : "—"}</td>
                    <td className={`text-right py-1.5 px-1 font-medium ${varReceita === undefined ? "text-muted-foreground" : varReceita >= 0 ? "text-primary" : "text-destructive"}`}>
                      {varReceita !== undefined ? `${varReceita >= 0 ? "+" : ""}${formatCurrency(varReceita * 100)}` : "—"}
                    </td>
                    <td className="text-right py-1.5 px-1 text-muted-foreground">{formatCurrency(d.budgetDespesas * 100)}</td>
                    <td className="text-right py-1.5 px-1 text-foreground">{hasActual ? formatCurrency(d.realizadoDespesas! * 100) : "—"}</td>
                    <td className={`text-right py-1.5 px-1 font-medium ${varDespesas === undefined ? "text-muted-foreground" : varDespesas <= 0 ? "text-primary" : "text-destructive"}`}>
                      {varDespesas !== undefined ? `${varDespesas > 0 ? "+" : ""}${formatCurrency(varDespesas * 100)}` : "—"}
                    </td>
                    <td className="text-right py-1.5 px-1 text-muted-foreground">{formatCurrency(d.budgetLucro * 100)}</td>
                    <td className="text-right py-1.5 px-1 text-foreground">{hasActual ? formatCurrency(d.realizadoLucro! * 100) : "—"}</td>
                    <td className={`text-right py-1.5 px-1 font-medium ${varLucro === undefined ? "text-muted-foreground" : varLucro >= 0 ? "text-primary" : "text-destructive"}`}>
                      {varLucro !== undefined ? `${varLucro >= 0 ? "+" : ""}${formatCurrency(varLucro * 100)}` : "—"}
                    </td>
                  </tr>
                );
              })}
              {/* Totais YTD */}
              {(() => {
                const totals = chartData.reduce((acc, d) => {
                  acc.budgetRec += d.budgetReceita;
                  acc.budgetDesp += d.budgetDespesas;
                  acc.budgetLucro += d.budgetLucro;
                  if (d.realizadoReceita !== undefined) {
                    acc.realRec += d.realizadoReceita;
                    acc.realDesp += d.realizadoDespesas!;
                    acc.realLucro += d.realizadoLucro!;
                    acc.hasActual = true;
                  }
                  return acc;
                }, { budgetRec: 0, budgetDesp: 0, budgetLucro: 0, realRec: 0, realDesp: 0, realLucro: 0, hasActual: false });

                return (
                  <tr className="border-t-2 border-border font-semibold">
                    <td className="py-2 px-1 text-foreground">Total</td>
                    <td className="text-right py-2 px-1 text-muted-foreground">{formatCurrency(totals.budgetRec * 100)}</td>
                    <td className="text-right py-2 px-1 text-foreground">{totals.hasActual ? formatCurrency(totals.realRec * 100) : "—"}</td>
                    <td className={`text-right py-2 px-1 ${!totals.hasActual ? "text-muted-foreground" : (totals.realRec - totals.budgetRec) >= 0 ? "text-primary" : "text-destructive"}`}>
                      {totals.hasActual ? `${(totals.realRec - totals.budgetRec) >= 0 ? "+" : ""}${formatCurrency((totals.realRec - totals.budgetRec) * 100)}` : "—"}
                    </td>
                    <td className="text-right py-2 px-1 text-muted-foreground">{formatCurrency(totals.budgetDesp * 100)}</td>
                    <td className="text-right py-2 px-1 text-foreground">{totals.hasActual ? formatCurrency(totals.realDesp * 100) : "—"}</td>
                    <td className={`text-right py-2 px-1 ${!totals.hasActual ? "text-muted-foreground" : (totals.realDesp - totals.budgetDesp) <= 0 ? "text-primary" : "text-destructive"}`}>
                      {totals.hasActual ? `${(totals.realDesp - totals.budgetDesp) > 0 ? "+" : ""}${formatCurrency((totals.realDesp - totals.budgetDesp) * 100)}` : "—"}
                    </td>
                    <td className="text-right py-2 px-1 text-muted-foreground">{formatCurrency(totals.budgetLucro * 100)}</td>
                    <td className="text-right py-2 px-1 text-foreground">{totals.hasActual ? formatCurrency(totals.realLucro * 100) : "—"}</td>
                    <td className={`text-right py-2 px-1 ${!totals.hasActual ? "text-muted-foreground" : (totals.realLucro - totals.budgetLucro) >= 0 ? "text-primary" : "text-destructive"}`}>
                      {totals.hasActual ? `${(totals.realLucro - totals.budgetLucro) >= 0 ? "+" : ""}${formatCurrency((totals.realLucro - totals.budgetLucro) * 100)}` : "—"}
                    </td>
                  </tr>
                );
              })()}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
