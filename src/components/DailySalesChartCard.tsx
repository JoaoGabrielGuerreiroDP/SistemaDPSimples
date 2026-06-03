import { useMemo } from "react";
import { SaleRow } from "@/hooks/useGoogleSheetsData";
import { CalendarDays } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";

function formatBRL(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

interface Props {
  rows: SaleRow[];
  selectedYear: number;
  selectedMonth: number;
  monthLabel: string;
}

export function DailySalesChartCard({ rows, selectedYear, selectedMonth, monthLabel }: Props) {
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
    <Card className="border-border/30">
      <CardContent className="p-3 sm:p-4 space-y-3">
        <div className="flex items-center gap-2">
          <CalendarDays className="w-4 h-4 text-primary" />
          <span className="text-[10px] sm:text-xs text-muted-foreground uppercase tracking-wider">
            Vendas Diárias — {monthLabel}
          </span>
        </div>
        {hasData ? (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={dailyData} margin={{ left: -10, right: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis
                dataKey="day"
                tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 9 }}
                interval={1}
                tickFormatter={(v) => (v % 5 === 0 || v === 1 ? String(v) : "")}
              />
              <YAxis
                tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }}
                tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
                width={40}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "8px",
                  color: "hsl(var(--foreground))",
                  fontSize: 12,
                }}
                labelFormatter={(day) => `Dia ${day}`}
                formatter={(value: number, name: string) =>
                  name === "total" ? [formatBRL(value), "Valor"] : [value, "Propostas"]
                }
              />
              <Bar dataKey="total" fill="hsl(var(--primary))" radius={[3, 3, 0, 0]} name="total" />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-10">Sem dados para exibir</p>
        )}
      </CardContent>
    </Card>
  );
}
