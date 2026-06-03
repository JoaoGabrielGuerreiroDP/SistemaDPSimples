import { useMemo } from "react";
import { ProcfyTransaction } from "@/hooks/useProcfyData";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Legend,
} from "recharts";

function formatCurrency(cents: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
}

const COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--destructive))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
  "#8b5cf6",
  "#f59e0b",
  "#06b6d4",
  "#ec4899",
];

interface Props {
  transactions: ProcfyTransaction[];
}

function groupBy(transactions: ProcfyTransaction[], key: "category" | "cost_center") {
  const groups: Record<string, number> = {};
  transactions
    .filter((t) => t.transaction_type !== "revenue" && t.transaction_type !== "transfer")
    .forEach((t) => {
      const name =
        key === "category"
          ? t.category?.name || "Sem categoria"
          : t.cost_center?.name?.trim() || "Sem centro de custo";
      groups[name] = (groups[name] || 0) + t.amount_cents;
    });

  return Object.entries(groups)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);
}

function DonutChart({ data, title }: { data: { name: string; value: number }[]; title: string }) {
  if (data.length === 0) return null;

  const total = data.reduce((s, d) => s + d.value, 0);

  return (
    <div className="glass-card p-4 sm:p-5 space-y-3">
      <h2 className="font-display text-sm sm:text-base font-semibold text-foreground">{title}</h2>
      <div className="h-52 sm:h-64">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius="45%"
              outerRadius="75%"
              paddingAngle={2}
              dataKey="value"
            >
              {data.map((_, i) => (
                <Cell key={i} fill={COLORS[i % COLORS.length]} />
              ))}
            </Pie>
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
          </PieChart>
        </ResponsiveContainer>
      </div>
      {/* Legend as list */}
      <div className="space-y-1.5 max-h-[200px] overflow-y-auto">
        {data.map((item, i) => (
          <div key={item.name} className="flex items-center justify-between gap-2 text-xs sm:text-sm">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
              <span className="text-muted-foreground truncate">{item.name}</span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className="font-mono text-foreground font-medium">{formatCurrency(item.value)}</span>
              <span className="text-muted-foreground text-[10px]">
                {((item.value / total) * 100).toFixed(0)}%
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function ExpenseBreakdownCharts({ transactions }: Props) {
  const byCategory = useMemo(() => groupBy(transactions, "category"), [transactions]);
  const byCostCenter = useMemo(() => groupBy(transactions, "cost_center"), [transactions]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4">
      <DonutChart data={byCategory} title="Despesas por Categoria" />
      <DonutChart data={byCostCenter} title="Despesas por Centro de Custo" />
    </div>
  );
}
