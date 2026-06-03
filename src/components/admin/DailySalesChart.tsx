import { useMemo } from "react";
import { SaleRow } from "@/hooks/useGoogleSheetsData";
import { CalendarDays } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";

function formatBRL(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

interface DailySalesChartProps {
  rows: SaleRow[];
  selectedYear: number;
  selectedMonth: number;
  monthLabel: string;
}

export function DailySalesChart({ rows, selectedYear, selectedMonth, monthLabel }: DailySalesChartProps) {
  const dailyData = useMemo(() => {
    const daysInMonth = new Date(selectedYear, selectedMonth + 1, 0).getDate();
    const dayMap: Record<number, { total: number; count: number }> = {};
    for (let d = 1; d <= daysInMonth; d++) {
      dayMap[d] = { total: 0, count: 0 };
    }
    rows.forEach((r) => {
      if (!r.dataVenda) return;
      const parts = r.dataVenda.split("/");
      if (parts.length >= 1) {
        const day = parseInt(parts[0], 10);
        if (day >= 1 && day <= daysInMonth && dayMap[day]) {
          dayMap[day].total += r.valor;
          dayMap[day].count += 1;
        }
      }
    });
    return Object.entries(dayMap).map(([day, { total, count }]) => ({
      day: parseInt(day, 10),
      total,
      count,
    }));
  }, [rows, selectedYear, selectedMonth]);

  const hasData = dailyData.some((d) => d.total > 0);

  return (
    <div className="glass-card p-3 sm:p-5 space-y-3 sm:space-y-4">
      <div className="flex items-center gap-2">
        <CalendarDays className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
        <h2 className="font-display text-sm sm:text-lg font-semibold text-foreground">
          Vendas Diárias — {monthLabel}
        </h2>
      </div>
      {hasData ? (
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={dailyData} margin={{ left: -10, right: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 14%, 16%)" />
            <XAxis
              dataKey="day"
              tick={{ fill: "hsl(215, 12%, 50%)", fontSize: 9 }}
              interval={1}
              tickFormatter={(v) => (v % 5 === 0 || v === 1 ? String(v) : "")}
            />
            <YAxis
              tick={{ fill: "hsl(215, 12%, 50%)", fontSize: 10 }}
              tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
              width={40}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "hsl(220, 18%, 10%)",
                border: "1px solid hsl(220, 14%, 16%)",
                borderRadius: "8px",
                color: "hsl(210, 20%, 92%)",
                fontSize: 12,
              }}
              labelFormatter={(day) => `Dia ${day}`}
              formatter={(value: number, name: string) =>
                name === "total" ? [formatBRL(value), "Valor"] : [value, "Propostas"]
              }
            />
            <Bar dataKey="total" fill="hsl(150, 60%, 45%)" radius={[3, 3, 0, 0]} name="total" />
          </BarChart>
        </ResponsiveContainer>
      ) : (
        <p className="text-sm text-muted-foreground text-center py-10">Sem dados para exibir</p>
      )}
    </div>
  );
}
