import { useMemo } from "react";
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
import { useMultiMonthSummary } from "@/hooks/useMultiMonthSummary";
import { Loader2 } from "lucide-react";

function formatCurrency(cents: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(cents / 100);
}

export function MonthlyComparisonChart() {
  const { data, loading } = useMultiMonthSummary(6);

  const chartData = useMemo(
    () =>
      data.map((m) => ({
        name: `${m.month}/${m.year.toString().slice(2)}`,
        "Comissão": m.revenue / 100,
        "Despesas": m.expenses / 100,
        "Resultado": (m.revenue - m.expenses) / 100,
      })),
    [data]
  );

  if (loading) {
    return (
      <div className="glass-card p-5 space-y-4">
        <h2 className="font-display text-lg font-semibold text-foreground">Comissão vs Despesas (6 meses)</h2>
        <div className="flex items-center justify-center py-16 text-muted-foreground gap-2">
          <Loader2 className="w-5 h-5 animate-spin" />
          Carregando dados de 6 meses...
        </div>
      </div>
    );
  }

  return (
    <div className="glass-card p-5 space-y-4">
      <h2 className="font-display text-lg font-semibold text-foreground">Comissão vs Despesas (6 meses)</h2>
      {chartData.length > 0 ? (
        <ResponsiveContainer width="100%" height={320}>
          <BarChart data={chartData} barGap={4}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 14%, 16%)" />
            <XAxis dataKey="name" tick={{ fill: "hsl(215, 12%, 50%)", fontSize: 12 }} />
            <YAxis
              tick={{ fill: "hsl(215, 12%, 50%)", fontSize: 11 }}
              tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "hsl(220, 18%, 10%)",
                border: "1px solid hsl(220, 14%, 16%)",
                borderRadius: "8px",
                color: "hsl(210, 20%, 92%)",
              }}
              formatter={(value: number) => formatCurrency(value * 100)}
            />
            <Legend />
            <Bar dataKey="Comissão" fill="hsl(150, 60%, 45%)" radius={[4, 4, 0, 0]} />
            <Bar dataKey="Despesas" fill="hsl(0, 72%, 55%)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      ) : (
        <p className="text-sm text-muted-foreground text-center py-10">Sem dados para exibir</p>
      )}
    </div>
  );
}
