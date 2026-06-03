import { useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Target, TrendingUp, TrendingDown, AlertTriangle, CheckCircle2, Pencil, X } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { BudgetEditor } from "./BudgetEditor";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, Cell,
} from "recharts";

interface Transaction {
  amount_cents: number;
  transaction_type: string;
  paid?: boolean;
  name?: string;
  due_date?: string;
  category?: { name?: string } | null;
  bank_account?: { name?: string } | null;
  contact?: { first_name?: string; last_name?: string } | null;
  cost_center?: { name?: string } | null;
}

interface BudgetComparisonProps {
  transactions: Transaction[];
  selectedYear: number;
  selectedMonth: number;
}

const MONTH_NAMES = [
  "Jan", "Fev", "Mar", "Abr", "Mai", "Jun",
  "Jul", "Ago", "Set", "Out", "Nov", "Dez",
];

function formatCurrency(cents: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(cents / 100);
}

const SUMMARY_CATEGORIES = [
  "Receita Estimada",
  "Custo da Operação",
  "Custos Não Operacionais",
  "Total Comissões",
  "Imposto",
  "EBITDA",
  "Lucro Líquido",
];

const DETAIL_CATEGORIES = [
  "Aluguel",
  "Energia Elétrica e Água",
  "Internet e Telefone",
  "Software",
  "Contabilidade",
  "Funcionários CLT",
  "Prestadores de Serviços",
  "Tráfego Pago",
  "Marketing",
];

// Map budget categories to transaction filters
function getTransactionsForBudgetCategory(
  category: string,
  transactions: Transaction[]
): Transaction[] {
  const REVENUE_CATEGORIES = ["Comissão"];

  switch (category) {
    case "Receita Estimada":
    case "Receita":
      return transactions.filter(
        (t) => t.transaction_type === "revenue" && REVENUE_CATEGORIES.includes(t.category?.name || "")
      );
    case "Custo da Operação":
    case "Custo Operac.":
      // Operating costs: exclude revenue, transfers, and non-operational categories
      return transactions.filter(
        (t) =>
          t.transaction_type !== "revenue" &&
          t.transaction_type !== "transfer" &&
          !["Empréstimo", "Negócios", "Sócios"].includes(t.category?.name || "")
      );
    case "Custos Não Operacionais":
    case "Custos Não Op.":
      return transactions.filter(
        (t) =>
          t.transaction_type !== "revenue" &&
          t.transaction_type !== "transfer" &&
          ["Empréstimo", "Negócios", "Sócios"].includes(t.category?.name || "")
      );
    case "Total Comissões":
    case "Comissões":
      return transactions.filter(
        (t) => t.transaction_type === "revenue" && REVENUE_CATEGORIES.includes(t.category?.name || "")
      );
    case "Imposto":
      return transactions.filter((t) => t.transaction_type === "tax");
    default:
      // For detail categories, match by category name
      return transactions.filter(
        (t) =>
          t.transaction_type !== "revenue" &&
          t.transaction_type !== "transfer" &&
          t.category?.name === category
      );
  }
}

export function BudgetComparison({ transactions, selectedYear, selectedMonth }: BudgetComparisonProps) {
  const [showDetails, setShowDetails] = useState(false);
  const [editing, setEditing] = useState(false);
  const [drillCategory, setDrillCategory] = useState<string | null>(null);

  const { data: budgetLines = [], isLoading } = useQuery({
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

  const monthBudget = useMemo(() => {
    const map: Record<string, number> = {};
    budgetLines
      .filter((b: any) => b.month === selectedMonth + 1)
      .forEach((b: any) => { map[b.category] = b.amount_cents; });
    return map;
  }, [budgetLines, selectedMonth]);

  const ytdBudget = useMemo(() => {
    const map: Record<string, number> = {};
    budgetLines
      .filter((b: any) => b.month <= selectedMonth + 1)
      .forEach((b: any) => { map[b.category] = (map[b.category] || 0) + b.amount_cents; });
    return map;
  }, [budgetLines, selectedMonth]);

  const actuals = useMemo(() => {
    const REVENUE_CATEGORIES = ["Comissão"];
    const revenue = transactions
      .filter((t) => t.transaction_type === "revenue" && REVENUE_CATEGORIES.includes(t.category?.name || ""))
      .reduce((sum, t) => sum + t.amount_cents, 0);
    const expenses = transactions
      .filter((t) => t.transaction_type !== "revenue" && t.transaction_type !== "transfer")
      .reduce((sum, t) => sum + t.amount_cents, 0);
    return { revenue, expenses };
  }, [transactions]);

  // Drill-down data
  const drillTransactions = useMemo(() => {
    if (!drillCategory) return [];
    return getTransactionsForBudgetCategory(drillCategory, transactions);
  }, [drillCategory, transactions]);

  const drillTotal = useMemo(
    () => drillTransactions.reduce((sum, t) => sum + t.amount_cents, 0),
    [drillTransactions]
  );

  if (isLoading || Object.keys(monthBudget).length === 0) return null;

  const budgetRevenue = monthBudget["Receita Estimada"] || 0;
  const budgetExpenses = (monthBudget["Custo da Operação"] || 0) + (monthBudget["Custos Não Operacionais"] || 0) + (monthBudget["Total Comissões"] || 0);
  const budgetTotal = budgetExpenses + (monthBudget["Imposto"] || 0);

  const revenuePercent = budgetRevenue > 0 ? Math.min((actuals.revenue / budgetRevenue) * 100, 150) : 0;
  const expensePercent = budgetTotal > 0 ? Math.min((actuals.expenses / budgetTotal) * 100, 150) : 0;

  const revenueVariance = actuals.revenue - budgetRevenue;
  const expenseVariance = actuals.expenses - budgetTotal;

  const chartData = SUMMARY_CATEGORIES.filter(c => c !== "Lucro Líquido").map((cat) => ({
    name: cat.replace("Receita Estimada", "Receita").replace("Custo da Operação", "Custo Operac.").replace("Custos Não Operacionais", "Custos Não Op.").replace("Total Comissões", "Comissões"),
    budget: (monthBudget[cat] || 0) / 100,
    fullName: cat,
  }));

  const handleBarClick = (data: any) => {
    if (data?.activePayload?.[0]?.payload?.fullName) {
      setDrillCategory(data.activePayload[0].payload.fullName);
    }
  };

  return (
    <div className="space-y-3 sm:space-y-4">
      {editing && (
        <BudgetEditor
          selectedYear={selectedYear}
          selectedMonth={selectedMonth}
          onClose={() => setEditing(false)}
        />
      )}

      {/* Drill-down dialog */}
      <Dialog open={!!drillCategory} onOpenChange={(open) => !open && setDrillCategory(null)}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold flex items-center gap-2">
              <Target className="w-4 h-4 text-primary" />
              {drillCategory} — {MONTH_NAMES[selectedMonth]}/{selectedYear}
            </DialogTitle>
          </DialogHeader>

          <div className="flex items-center justify-between text-xs border-b border-border pb-2 mb-2">
            <span className="text-muted-foreground">
              {drillTransactions.length} lançamento{drillTransactions.length !== 1 ? "s" : ""}
            </span>
            <div className="flex items-center gap-3">
              <span className="text-muted-foreground">
                Budget: <strong className="text-foreground">{formatCurrency(monthBudget[drillCategory || ""] || 0)}</strong>
              </span>
              <span className="text-muted-foreground">
                Real: <strong className="text-foreground">{formatCurrency(drillTotal)}</strong>
              </span>
            </div>
          </div>

          <div className="overflow-y-auto flex-1 space-y-1 pr-1">
            {drillTransactions.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">Nenhum lançamento encontrado</p>
            ) : (
              drillTransactions
                .sort((a, b) => b.amount_cents - a.amount_cents)
                .map((t, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between p-2.5 rounded-lg border border-border bg-card/50 hover:bg-card/80 transition-colors"
                  >
                    <div className="min-w-0 flex-1 space-y-0.5">
                      <div className="text-xs font-medium text-foreground truncate">{t.name || "—"}</div>
                      <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                        {t.category?.name && <span>{t.category.name}</span>}
                        {t.contact?.first_name && (
                          <span>• {t.contact.first_name}{t.contact.last_name ? ` ${t.contact.last_name}` : ""}</span>
                        )}
                        {t.due_date && <span>• {new Date(t.due_date + "T12:00:00").toLocaleDateString("pt-BR")}</span>}
                      </div>
                    </div>
                    <div className="flex flex-col items-end shrink-0 ml-2">
                      <span className="text-xs font-bold text-foreground">{formatCurrency(t.amount_cents)}</span>
                      <span className={`text-[9px] ${t.paid ? "text-primary" : "text-amber-500"}`}>
                        {t.paid ? "Pago" : "Pendente"}
                      </span>
                    </div>
                  </div>
                ))
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Budget Header */}
      <div className="glass-card p-4 sm:p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Target className="w-5 h-5 text-primary" />
            <h2 className="font-display text-base sm:text-lg font-semibold text-foreground">
              Budget vs Realizado — {MONTH_NAMES[selectedMonth]}/{selectedYear}
            </h2>
          </div>
          <Button variant="ghost" size="sm" onClick={() => setEditing(!editing)} className="text-xs gap-1">
            <Pencil className="w-3.5 h-3.5" />
            Editar
          </Button>
        </div>

        {/* Revenue comparison */}
        <div
          className="space-y-2 cursor-pointer hover:bg-muted/30 rounded-lg p-2 -m-2 transition-colors"
          onClick={() => setDrillCategory("Receita Estimada")}
        >
          <div className="flex items-center justify-between text-xs sm:text-sm">
            <span className="text-muted-foreground">Receita</span>
            <div className="flex items-center gap-2">
              <span className="text-foreground font-medium">{formatCurrency(actuals.revenue)}</span>
              <span className="text-muted-foreground">/ {formatCurrency(budgetRevenue)}</span>
            </div>
          </div>
          <Progress value={revenuePercent} className="h-3" />
          <div className="flex items-center justify-between">
            <span className="text-[10px] sm:text-xs text-muted-foreground">
              {revenuePercent.toFixed(1)}% do budget
            </span>
            <div className={`flex items-center gap-1 text-[10px] sm:text-xs font-medium ${revenueVariance >= 0 ? "text-primary" : "text-destructive"}`}>
              {revenueVariance >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
              {revenueVariance >= 0 ? "+" : ""}{formatCurrency(revenueVariance)}
            </div>
          </div>
        </div>

        {/* Expense comparison */}
        <div
          className="space-y-2 cursor-pointer hover:bg-muted/30 rounded-lg p-2 -m-2 transition-colors"
          onClick={() => setDrillCategory("Custo da Operação")}
        >
          <div className="flex items-center justify-between text-xs sm:text-sm">
            <span className="text-muted-foreground">Despesas Totais</span>
            <div className="flex items-center gap-2">
              <span className="text-foreground font-medium">{formatCurrency(actuals.expenses)}</span>
              <span className="text-muted-foreground">/ {formatCurrency(budgetTotal)}</span>
            </div>
          </div>
          <div className="relative">
            <Progress value={expensePercent} className="h-3" />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[10px] sm:text-xs text-muted-foreground">
              {expensePercent.toFixed(1)}% do budget
            </span>
            <div className={`flex items-center gap-1 text-[10px] sm:text-xs font-medium ${expenseVariance <= 0 ? "text-primary" : "text-destructive"}`}>
              {expenseVariance <= 0 ? (
                <CheckCircle2 className="w-3 h-3" />
              ) : (
                <AlertTriangle className="w-3 h-3" />
              )}
              {expenseVariance > 0 ? "+" : ""}{formatCurrency(expenseVariance)}
              {expenseVariance > 0 ? " acima" : " abaixo"}
            </div>
          </div>
        </div>

        {/* Status Badge */}
        <div className={`rounded-lg p-3 text-center text-xs sm:text-sm font-medium ${
          expenseVariance <= 0
            ? "bg-primary/10 text-primary border border-primary/20"
            : "bg-destructive/10 text-destructive border border-destructive/20"
        }`}>
          {expenseVariance <= 0
            ? `✅ Dentro do orçamento — folga de ${formatCurrency(Math.abs(expenseVariance))}`
            : `⚠️ Acima do orçamento em ${formatCurrency(expenseVariance)}`
          }
        </div>
      </div>

      {/* Budget breakdown chart */}
      {chartData.length > 0 && (
        <div className="glass-card p-4 sm:p-5 space-y-3">
          <h3 className="font-display text-sm sm:text-base font-semibold text-foreground">
            Premissas do Mês (Budget) <span className="text-[10px] text-muted-foreground font-normal ml-1">clique para detalhar</span>
          </h3>
          <div className="h-52 sm:h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} layout="vertical" onClick={handleBarClick} style={{ cursor: "pointer" }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis
                  type="number"
                  tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }}
                  tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }}
                  width={90}
                />
                <Tooltip
                  formatter={(v: number) => formatCurrency(v * 100)}
                  contentStyle={{
                    background: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: 8,
                    color: "hsl(var(--foreground))",
                    fontSize: 12,
                  }}
                />
                <Bar dataKey="budget" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} name="Budget" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Detailed categories */}
      <div className="glass-card p-4 sm:p-5 space-y-3">
        <button
          onClick={() => setShowDetails(!showDetails)}
          className="w-full flex items-center justify-between text-left"
        >
          <h3 className="font-display text-sm sm:text-base font-semibold text-foreground">
            Detalhamento por Categoria
          </h3>
          <span className="text-xs text-muted-foreground">{showDetails ? "Ocultar" : "Expandir"}</span>
        </button>

        {showDetails && (
          <div className="space-y-2">
            {DETAIL_CATEGORIES.map((cat) => {
              const budgetVal = monthBudget[cat] || 0;
              if (budgetVal === 0) return null;
              return (
                <div
                  key={cat}
                  className="flex items-center justify-between py-1.5 border-b border-border/50 last:border-0 cursor-pointer hover:bg-muted/30 rounded px-1 transition-colors"
                  onClick={() => setDrillCategory(cat)}
                >
                  <span className="text-xs sm:text-sm text-muted-foreground">{cat}</span>
                  <span className="text-xs sm:text-sm font-medium text-foreground">{formatCurrency(budgetVal)}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Annual progress */}
      <div className="glass-card p-4 sm:p-5 space-y-3">
        <h3 className="font-display text-sm sm:text-base font-semibold text-foreground">
          Progresso Anual {selectedYear}
        </h3>
        <div className="grid grid-cols-2 gap-3">
          {["Receita Estimada", "Custo da Operação"].map((cat) => {
            const annual = budgetLines
              .filter((b: any) => b.category === cat)
              .reduce((sum: number, b: any) => sum + b.amount_cents, 0);
            const ytd = ytdBudget[cat] || 0;
            const pct = annual > 0 ? (ytd / annual) * 100 : 0;
            return (
              <div key={cat} className="space-y-1.5">
                <span className="text-[10px] sm:text-xs text-muted-foreground">
                  {cat === "Receita Estimada" ? "Receita" : "Custo Operac."}
                </span>
                <Progress value={pct} className="h-2" />
                <div className="flex justify-between text-[9px] sm:text-xs text-muted-foreground">
                  <span>YTD: {formatCurrency(ytd)}</span>
                  <span>Ano: {formatCurrency(annual)}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
