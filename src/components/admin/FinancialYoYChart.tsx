import { useMemo } from "react";
import { useProcfyData, ProcfyTransaction } from "@/hooks/useProcfyData";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { CalendarRange } from "lucide-react";

function formatCurrency(cents: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(cents / 100);
}

function getMonthPeriod(year: number, month: number) {
  const startDate = new Date(year, month, 1).toISOString().split("T")[0];
  const endDate = new Date(year, month + 1, 0).toISOString().split("T")[0];
  return { startDate, endDate };
}

const REVENUE_CATEGORIES = ["Comissão"];

function summarize(transactions: ProcfyTransaction[]) {
  const revenue = transactions
    .filter((t) => t.transaction_type === "revenue" && REVENUE_CATEGORIES.includes(t.category?.name || ""))
    .reduce((s, t) => s + t.amount_cents, 0);
  const expenses = transactions
    .filter((t) => t.transaction_type !== "revenue" && t.transaction_type !== "transfer" && t.category?.name !== "Operação")
    .reduce((s, t) => s + t.amount_cents, 0);
  return { revenue, expenses, profit: revenue - expenses };
}

const MONTH_SHORT = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

interface Props {
  selectedYear: number;
  selectedMonth: number;
  currentTransactions: ProcfyTransaction[];
}

export function FinancialYoYChart({ selectedYear, selectedMonth, currentTransactions }: Props) {
  const prevPeriod = getMonthPeriod(selectedYear - 1, selectedMonth);
  const { transactions: prevTransactions, loading } = useProcfyData(prevPeriod);

  const currSummary = useMemo(() => summarize(currentTransactions), [currentTransactions]);
  const prevSummary = useMemo(() => summarize(prevTransactions), [prevTransactions]);

  const data = useMemo(() => {
    const monthName = MONTH_SHORT[selectedMonth];
    return [
      {
        name: `${monthName} ${selectedYear - 1}`,
        Receita: prevSummary.revenue / 100,
        Despesas: prevSummary.expenses / 100,
        Resultado: prevSummary.profit / 100,
      },
      {
        name: `${monthName} ${selectedYear}`,
        Receita: currSummary.revenue / 100,
        Despesas: currSummary.expenses / 100,
        Resultado: currSummary.profit / 100,
      },
    ];
  }, [currSummary, prevSummary, selectedYear, selectedMonth]);

  const revenueChange = prevSummary.revenue
    ? ((currSummary.revenue - prevSummary.revenue) / prevSummary.revenue) * 100
    : 0;
  const expenseChange = prevSummary.expenses
    ? ((currSummary.expenses - prevSummary.expenses) / prevSummary.expenses) * 100
    : 0;

  return (
    <div className="glass-card p-4 sm:p-5 space-y-4">
      <div className="flex items-center gap-2">
        <CalendarRange className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
        <h2 className="font-display text-base sm:text-lg font-semibold text-foreground">
          Comparativo Ano x Ano
        </h2>
        {loading && <span className="text-xs text-muted-foreground animate-pulse">Carregando...</span>}
      </div>

      <div className="grid grid-cols-2 gap-2 sm:gap-3">
        <div className="rounded-lg border border-border bg-card p-3 space-y-1">
          <span className="text-[10px] sm:text-xs text-muted-foreground">Receita vs ano anterior</span>
          <div className={`font-display text-sm sm:text-lg font-bold ${revenueChange >= 0 ? "text-primary" : "text-destructive"}`}>
            {revenueChange >= 0 ? "+" : ""}{revenueChange.toFixed(1)}%
          </div>
          <div className="text-[9px] sm:text-xs text-muted-foreground">
            {formatCurrency(prevSummary.revenue)} → {formatCurrency(currSummary.revenue)}
          </div>
        </div>
        <div className="rounded-lg border border-border bg-card p-3 space-y-1">
          <span className="text-[10px] sm:text-xs text-muted-foreground">Despesas vs ano anterior</span>
          <div className={`font-display text-sm sm:text-lg font-bold ${expenseChange <= 0 ? "text-primary" : "text-destructive"}`}>
            {expenseChange >= 0 ? "+" : ""}{expenseChange.toFixed(1)}%
          </div>
          <div className="text-[9px] sm:text-xs text-muted-foreground">
            {formatCurrency(prevSummary.expenses)} → {formatCurrency(currSummary.expenses)}
          </div>
        </div>
      </div>

      <div className="h-56 sm:h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} barGap={8}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="name" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} />
            <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} tickFormatter={(v) => formatCurrency(v * 100)} />
            <Tooltip
              formatter={(v: number) => formatCurrency(v * 100)}
              contentStyle={{
                background: "hsl(var(--card))",
                border: "1px solid hsl(var(--border))",
                borderRadius: 8,
                color: "hsl(var(--foreground))",
              }}
            />
            <Legend />
            <Bar dataKey="Receita" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
            <Bar dataKey="Despesas" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} />
            <Bar dataKey="Resultado" fill="hsl(var(--accent))" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
