import { useMemo } from "react";
import { ProcfyTransaction } from "@/hooks/useProcfyData";
import { Target, TrendingUp, Calendar } from "lucide-react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Legend,
} from "recharts";

function formatCurrency(cents: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
}

interface Props {
  transactions: ProcfyTransaction[];
  selectedYear: number;
  selectedMonth: number;
}

export function BreakevenForecast({ transactions, selectedYear, selectedMonth }: Props) {
  const { chartData, breakevenDay } = useMemo(() => {
    const daysInMonth = new Date(selectedYear, selectedMonth + 1, 0).getDate();

    // Group transactions by day
    const dailyRevenue: Record<number, number> = {};
    const dailyExpense: Record<number, number> = {};

    transactions.forEach((t) => {
      if (t.transaction_type === "transfer") return;
      const day = new Date(t.due_date + "T00:00:00").getDate();

      if (t.transaction_type === "revenue" && t.category?.name === "Comissão") {
        dailyRevenue[day] = (dailyRevenue[day] || 0) + t.amount_cents;
      } else if (t.transaction_type !== "revenue") {
        dailyExpense[day] = (dailyExpense[day] || 0) + t.amount_cents;
      }
    });

    let cumulativeRevenue = 0;
    let cumulativeExpense = 0;
    let breakDay: number | null = null;
    const data: { day: number; label: string; receita: number; despesa: number }[] = [];

    for (let d = 1; d <= daysInMonth; d++) {
      cumulativeRevenue += dailyRevenue[d] || 0;
      cumulativeExpense += dailyExpense[d] || 0;

      data.push({
        day: d,
        label: `${d}`,
        receita: cumulativeRevenue,
        despesa: cumulativeExpense,
      });

      if (breakDay === null && cumulativeRevenue >= cumulativeExpense && cumulativeRevenue > 0) {
        breakDay = d;
      }
    }

    return { chartData: data, breakevenDay: breakDay };
  }, [transactions, selectedYear, selectedMonth]);

  const MONTH_NAMES = [
    "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
  ];

  return (
    <div className="glass-card p-4 sm:p-5 space-y-3">
      <div className="flex items-center gap-2">
        <Target className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
        <h2 className="font-display text-sm sm:text-lg font-semibold text-foreground">
          Previsão de Break-even
        </h2>
      </div>

      {/* Break-even indicator */}
      <div className={`rounded-lg p-3 sm:p-4 ${breakevenDay ? "bg-primary/10" : "bg-destructive/10"}`}>
        <div className="flex items-center gap-2">
          <Calendar className={`w-4 h-4 ${breakevenDay ? "text-primary" : "text-destructive"}`} />
          {breakevenDay ? (
            <div>
              <span className="text-xs sm:text-sm font-semibold text-primary">
                Dia {breakevenDay} de {MONTH_NAMES[selectedMonth]}
              </span>
              <p className="text-[10px] sm:text-xs text-muted-foreground">
                Receita acumulada cobre as despesas acumuladas
              </p>
            </div>
          ) : (
            <div>
              <span className="text-xs sm:text-sm font-semibold text-destructive">
                Não atingido
              </span>
              <p className="text-[10px] sm:text-xs text-muted-foreground">
                A receita acumulada não cobriu as despesas neste mês
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Chart */}
      <div className="h-48 sm:h-64">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis
              dataKey="label"
              tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }}
              interval={4}
            />
            <YAxis
              tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }}
              tickFormatter={(v) => `${(v / 100000).toFixed(0)}k`}
              width={40}
            />
            <Tooltip
              formatter={(v: number, name: string) => [
                formatCurrency(v),
                name === "receita" ? "Receita Acum." : "Despesa Acum.",
              ]}
              contentStyle={{
                background: "hsl(var(--card))",
                border: "1px solid hsl(var(--border))",
                borderRadius: 8,
                color: "hsl(var(--foreground))",
                fontSize: 12,
              }}
            />
            <Legend
              formatter={(value) => (value === "receita" ? "Receita Acum." : "Despesa Acum.")}
              wrapperStyle={{ fontSize: 11 }}
            />
            {breakevenDay && (
              <ReferenceLine
                x={`${breakevenDay}`}
                stroke="hsl(var(--primary))"
                strokeDasharray="5 5"
                label={{ value: `Dia ${breakevenDay}`, fill: "hsl(var(--primary))", fontSize: 10 }}
              />
            )}
            <Line
              type="monotone"
              dataKey="receita"
              stroke="hsl(var(--primary))"
              strokeWidth={2}
              dot={false}
            />
            <Line
              type="monotone"
              dataKey="despesa"
              stroke="hsl(var(--destructive))"
              strokeWidth={2}
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
