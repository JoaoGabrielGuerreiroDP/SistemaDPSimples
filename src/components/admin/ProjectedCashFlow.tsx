import { useMemo } from "react";
import { ProcfyTransaction } from "@/hooks/useProcfyData";
import { TrendingUp, ArrowRight } from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine,
} from "recharts";

function formatCurrency(cents: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
}

interface Props {
  transactions: ProcfyTransaction[];
  totalBalance: number;
}

export function ProjectedCashFlow({ transactions, totalBalance }: Props) {
  const chartData = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Get all unpaid transactions with future due dates
    const futureUnpaid = transactions
      .filter((t) => !t.paid && t.transaction_type !== "transfer")
      .map((t) => ({
        due: new Date(t.due_date + "T00:00:00"),
        amount: t.transaction_type === "revenue" ? t.amount_cents : -t.amount_cents,
      }))
      .filter((t) => t.due >= today)
      .sort((a, b) => a.due.getTime() - b.due.getTime());

    // Build daily projection for 90 days
    const days: { date: string; saldo: number; label: string }[] = [];
    let runningBalance = totalBalance;

    for (let d = 0; d <= 90; d++) {
      const date = new Date(today);
      date.setDate(date.getDate() + d);
      const dateStr = date.toISOString().split("T")[0];

      const dayMovements = futureUnpaid.filter(
        (t) => t.due.toISOString().split("T")[0] === dateStr
      );
      dayMovements.forEach((m) => {
        runningBalance += m.amount;
      });

      days.push({
        date: dateStr,
        saldo: runningBalance,
        label: date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }),
      });
    }

    return days;
  }, [transactions, totalBalance]);

  const minBalance = Math.min(...chartData.map((d) => d.saldo));
  const markers = [30, 60, 90].map((d) => ({
    days: d,
    label: `${d}d`,
    value: chartData[Math.min(d, chartData.length - 1)]?.saldo || 0,
  }));

  return (
    <div className="glass-card p-4 sm:p-5 space-y-3">
      <div className="flex items-center gap-2">
        <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
        <h2 className="font-display text-sm sm:text-lg font-semibold text-foreground">
          Fluxo de Caixa Projetado
        </h2>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-2">
        {markers.map((m) => (
          <div key={m.days} className="rounded-lg bg-muted/50 p-2 sm:p-3 text-center space-y-0.5">
            <div className="text-[10px] sm:text-xs text-muted-foreground">{m.label}</div>
            <div className={`font-display text-xs sm:text-base font-bold ${m.value >= 0 ? "text-primary" : "text-destructive"}`}>
              {formatCurrency(m.value)}
            </div>
          </div>
        ))}
      </div>

      {/* Chart */}
      <div className="h-48 sm:h-64">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData}>
            <defs>
              <linearGradient id="saldoGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis
              dataKey="label"
              tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }}
              interval={14}
            />
            <YAxis
              tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }}
              tickFormatter={(v) => `${(v / 100000).toFixed(0)}k`}
              width={40}
            />
            <Tooltip
              formatter={(v: number) => formatCurrency(v)}
              contentStyle={{
                background: "hsl(var(--card))",
                border: "1px solid hsl(var(--border))",
                borderRadius: 8,
                color: "hsl(var(--foreground))",
                fontSize: 12,
              }}
            />
            {minBalance < 0 && (
              <ReferenceLine y={0} stroke="hsl(var(--destructive))" strokeDasharray="5 5" />
            )}
            <Area
              type="monotone"
              dataKey="saldo"
              stroke="hsl(var(--primary))"
              fill="url(#saldoGrad)"
              strokeWidth={2}
              name="Saldo"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {minBalance < 0 && (
        <div className="flex items-center gap-2 text-destructive text-[10px] sm:text-xs">
          <ArrowRight className="w-3 h-3" />
          <span>⚠️ Saldo projetado fica negativo: mínimo de {formatCurrency(minBalance)}</span>
        </div>
      )}
    </div>
  );
}
