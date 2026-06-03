import { useMemo } from "react";
import { SaleRow } from "@/hooks/useGoogleSheetsData";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  ReferenceLine,
} from "recharts";

const MONTH_NAMES_SHORT = [
  "Jan","Fev","Mar","Abr","Mai","Jun",
  "Jul","Ago","Set","Out","Nov","Dez",
];

function formatBRL(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

function parseDayFromDate(dateStr: string): number | null {
  if (!dateStr) return null;
  const parts = dateStr.split("/");
  if (parts.length < 1) return null;
  const day = parseInt(parts[0], 10);
  return isNaN(day) ? null : day;
}

interface DailyCumulativeChartProps {
  rows: SaleRow[];
  selectedYear: number;
  selectedMonth: number;
  getMonthRows: (year: number, month: number) => SaleRow[];
}

export function DailyCumulativeChart({ rows, selectedYear, selectedMonth, getMonthRows }: DailyCumulativeChartProps) {
  const now = new Date();
  const isCurrentMonth = selectedYear === now.getFullYear() && selectedMonth === now.getMonth();
  const daysInMonth = new Date(selectedYear, selectedMonth + 1, 0).getDate();
  const currentDay = isCurrentMonth ? now.getDate() : daysInMonth;

  // Previous month rows
  const prevMonthData = useMemo(() => {
    let y = selectedYear;
    let m = selectedMonth - 1;
    if (m < 0) { m = 11; y -= 1; }
    return { rows: getMonthRows(y, m), year: y, month: m };
  }, [getMonthRows, selectedYear, selectedMonth]);

  const prevDaysInMonth = new Date(prevMonthData.year, prevMonthData.month + 1, 0).getDate();
  const maxDays = Math.max(daysInMonth, prevDaysInMonth);

  const chartData = useMemo(() => {
    // Build daily totals for current month
    const currentDaily: number[] = new Array(maxDays + 1).fill(0);
    rows.forEach((r) => {
      const day = parseDayFromDate(r.dataVenda);
      if (day && day >= 1 && day <= daysInMonth) currentDaily[day] += r.valor;
    });

    // Build daily totals for previous month
    const prevDaily: number[] = new Array(maxDays + 1).fill(0);
    prevMonthData.rows.forEach((r) => {
      const day = parseDayFromDate(r.dataVenda);
      if (day && day >= 1 && day <= prevDaysInMonth) prevDaily[day] += r.valor;
    });

    // Accumulate
    const data: { day: number; atual: number | null; anterior: number }[] = [];
    let cumCurrent = 0;
    let cumPrev = 0;

    for (let d = 1; d <= maxDays; d++) {
      if (d <= daysInMonth) cumCurrent += currentDaily[d];
      if (d <= prevDaysInMonth) cumPrev += prevDaily[d];

      data.push({
        day: d,
        atual: d <= currentDay && d <= daysInMonth ? cumCurrent : null,
        anterior: d <= prevDaysInMonth ? cumPrev : cumPrev,
      });
    }

    return data;
  }, [rows, prevMonthData.rows, maxDays, daysInMonth, prevDaysInMonth, currentDay]);

  const prevMonthLabel = MONTH_NAMES_SHORT[prevMonthData.month];
  const currentMonthLabel = MONTH_NAMES_SHORT[selectedMonth];

  return (
    <div className="glass-card p-3 sm:p-5 space-y-3 sm:space-y-4">
      <h2 className="font-display text-sm sm:text-lg font-semibold text-foreground">
        Evolução Diária Acumulada
      </h2>
      <p className="text-[10px] sm:text-xs text-muted-foreground -mt-1">
        {currentMonthLabel} vs {prevMonthLabel} — dia a dia
      </p>

      <ResponsiveContainer width="100%" height={280}>
        <LineChart data={chartData} margin={{ left: -5, right: 10, top: 5, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 14%, 16%)" />
          <XAxis
            dataKey="day"
            tick={{ fill: "hsl(215, 12%, 50%)", fontSize: 10 }}
            tickFormatter={(d) => (d % 5 === 0 || d === 1 ? `${d}` : "")}
          />
          <YAxis
            tick={{ fill: "hsl(215, 12%, 50%)", fontSize: 10 }}
            tickFormatter={(v) => v >= 1_000_000 ? `${(v / 1_000_000).toFixed(1)}M` : `${(v / 1000).toFixed(0)}k`}
            width={48}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "hsl(220, 18%, 10%)",
              border: "1px solid hsl(220, 14%, 16%)",
              borderRadius: "8px",
              color: "hsl(210, 20%, 92%)",
              fontSize: 12,
            }}
            formatter={(value: number | null, name: string) => {
              if (value === null) return ["—", name];
              return [formatBRL(value), name === "atual" ? currentMonthLabel : prevMonthLabel];
            }}
            labelFormatter={(label) => `Dia ${label}`}
          />
          <Legend
            formatter={(value) => (value === "atual" ? currentMonthLabel : prevMonthLabel)}
            wrapperStyle={{ fontSize: 11 }}
          />
          {isCurrentMonth && (
            <ReferenceLine
              x={currentDay}
              stroke="hsl(215, 12%, 35%)"
              strokeDasharray="4 4"
              label={{ value: "Hoje", fill: "hsl(215, 12%, 50%)", fontSize: 9, position: "top" }}
            />
          )}
          <Line
            type="monotone"
            dataKey="anterior"
            stroke="hsl(215, 12%, 40%)"
            strokeWidth={2}
            strokeDasharray="6 3"
            dot={false}
            name="anterior"
            connectNulls
          />
          <Line
            type="monotone"
            dataKey="atual"
            stroke="hsl(150, 60%, 50%)"
            strokeWidth={2.5}
            dot={false}
            name="atual"
            connectNulls
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
