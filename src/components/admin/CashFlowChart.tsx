import { useMemo } from "react";
import { ProcfyTransaction } from "@/hooks/useProcfyData";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

function formatCurrency(cents: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
}

interface Props {
  transactions: ProcfyTransaction[];
}

export function CashFlowChart({ transactions }: Props) {
  const chartData = useMemo(() => {
    // Group by due_date
    const REVENUE_CATEGORIES = ["Comissão"];
    const byDate: Record<string, { receitas: number; despesas: number; receitasPagas: number; despesasPagas: number }> = {};

    transactions
      .filter((t) => t.transaction_type !== "transfer")
      .forEach((t) => {
        const date = t.due_date;
        if (!byDate[date]) byDate[date] = { receitas: 0, despesas: 0, receitasPagas: 0, despesasPagas: 0 };

        if (t.transaction_type === "revenue" && REVENUE_CATEGORIES.includes(t.category?.name || "")) {
          byDate[date].receitas += t.amount_cents;
          if (t.paid) byDate[date].receitasPagas += t.amount_cents;
        } else if (t.transaction_type !== "revenue") {
          byDate[date].despesas += t.amount_cents;
          if (t.paid) byDate[date].despesasPagas += t.amount_cents;
        }
      });

    const sortedDates = Object.keys(byDate).sort();
    let acumuladoPrevisto = 0;
    let acumuladoRealizado = 0;

    return sortedDates.map((date) => {
      const d = byDate[date];
      acumuladoPrevisto += d.receitas - d.despesas;
      acumuladoRealizado += d.receitasPagas - d.despesasPagas;

      const day = new Date(date + "T00:00:00").getDate();
      return {
        dia: `${day}`,
        previsto: acumuladoPrevisto / 100,
        realizado: acumuladoRealizado / 100,
      };
    });
  }, [transactions]);

  if (chartData.length === 0) return null;

  return (
    <div className="glass-card p-4 sm:p-5 space-y-3 sm:space-y-4">
      <h2 className="font-display text-base sm:text-lg font-semibold text-foreground">
        Fluxo de Caixa Acumulado
      </h2>
      <div className="h-56 sm:h-72">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData}>
            <defs>
              <linearGradient id="gradPrevisto" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="gradRealizado" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(var(--chart-2))" stopOpacity={0.3} />
                <stop offset="95%" stopColor="hsl(var(--chart-2))" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="dia" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
            <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} tickFormatter={(v) => formatCurrency(v * 100)} />
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
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Area type="monotone" dataKey="previsto" name="Previsto" stroke="hsl(var(--primary))" fill="url(#gradPrevisto)" strokeWidth={2} />
            <Area type="monotone" dataKey="realizado" name="Realizado" stroke="hsl(var(--chart-2))" fill="url(#gradRealizado)" strokeWidth={2} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
