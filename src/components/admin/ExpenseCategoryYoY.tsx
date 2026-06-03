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
  Cell,
} from "recharts";
import { ArrowUpDown } from "lucide-react";

function formatCurrency(cents: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
}

function getMonthPeriod(year: number, month: number) {
  const startDate = new Date(year, month, 1).toISOString().split("T")[0];
  const endDate = new Date(year, month + 1, 0).toISOString().split("T")[0];
  return { startDate, endDate };
}

const MONTH_SHORT = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

function getExpensesByCategory(transactions: ProcfyTransaction[]) {
  const groups: Record<string, number> = {};
  transactions
    .filter((t) => t.transaction_type !== "revenue" && t.transaction_type !== "transfer" && t.category?.name !== "Operação")
    .forEach((t) => {
      const name = t.category?.name || "Sem categoria";
      groups[name] = (groups[name] || 0) + t.amount_cents;
    });
  return groups;
}

interface Props {
  selectedYear: number;
  selectedMonth: number;
  currentTransactions: ProcfyTransaction[];
}

export function ExpenseCategoryYoY({ selectedYear, selectedMonth, currentTransactions }: Props) {
  const prevPeriod = getMonthPeriod(selectedYear - 1, selectedMonth);
  const { transactions: prevTransactions, loading } = useProcfyData(prevPeriod);

  const data = useMemo(() => {
    const currByCategory = getExpensesByCategory(currentTransactions);
    const prevByCategory = getExpensesByCategory(prevTransactions);

    const allCategories = new Set([...Object.keys(currByCategory), ...Object.keys(prevByCategory)]);

    return Array.from(allCategories)
      .map((cat) => {
        const curr = currByCategory[cat] || 0;
        const prev = prevByCategory[cat] || 0;
        const change = prev > 0 ? ((curr - prev) / prev) * 100 : curr > 0 ? 100 : 0;
        return {
          name: cat,
          [`${MONTH_SHORT[selectedMonth]} ${selectedYear}`]: curr / 100,
          [`${MONTH_SHORT[selectedMonth]} ${selectedYear - 1}`]: prev / 100,
          currCents: curr,
          prevCents: prev,
          change,
        };
      })
      .sort((a, b) => b.currCents - a.currCents);
  }, [currentTransactions, prevTransactions, selectedYear, selectedMonth]);

  const currLabel = `${MONTH_SHORT[selectedMonth]} ${selectedYear}`;
  const prevLabel = `${MONTH_SHORT[selectedMonth]} ${selectedYear - 1}`;

  if (data.length === 0 && !loading) return null;

  return (
    <div className="glass-card p-4 sm:p-5 space-y-4">
      <div className="flex items-center gap-2">
        <ArrowUpDown className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
        <h2 className="font-display text-base sm:text-lg font-semibold text-foreground">
          Despesas por Categoria — Ano x Ano
        </h2>
        {loading && <span className="text-xs text-muted-foreground animate-pulse">Carregando...</span>}
      </div>

      {/* Chart */}
      <div className="h-64 sm:h-80">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" barGap={4}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis
              type="number"
              tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }}
              tickFormatter={(v) => formatCurrency(v * 100)}
            />
            <YAxis
              type="category"
              dataKey="name"
              tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
              width={120}
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
            <Legend />
            <Bar dataKey={currLabel} fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
            <Bar dataKey={prevLabel} fill="hsl(var(--muted-foreground))" radius={[0, 4, 4, 0]} opacity={0.5} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Detail table */}
      <div className="space-y-1.5 max-h-[250px] overflow-y-auto">
        <div className="flex items-center justify-between gap-2 text-[10px] sm:text-xs text-muted-foreground font-medium px-1 pb-1 border-b border-border">
          <span className="min-w-0 truncate">Categoria</span>
          <div className="flex items-center gap-3 sm:gap-4 shrink-0">
            <span className="w-20 sm:w-24 text-right">{currLabel}</span>
            <span className="w-20 sm:w-24 text-right">{prevLabel}</span>
            <span className="w-14 text-right">Var %</span>
          </div>
        </div>
        {data.map((item) => (
          <div key={item.name} className="flex items-center justify-between gap-2 text-xs sm:text-sm px-1">
            <span className="text-muted-foreground truncate min-w-0">{item.name}</span>
            <div className="flex items-center gap-3 sm:gap-4 shrink-0">
              <span className="font-mono text-foreground w-20 sm:w-24 text-right">{formatCurrency(item.currCents)}</span>
              <span className="font-mono text-muted-foreground w-20 sm:w-24 text-right">{formatCurrency(item.prevCents)}</span>
              <span className={`font-mono w-14 text-right font-medium ${item.change <= 0 ? "text-primary" : "text-destructive"}`}>
                {item.change >= 0 ? "+" : ""}{item.change.toFixed(0)}%
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
