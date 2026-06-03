import { useMemo } from "react";
import { SaleRow } from "@/hooks/useGoogleSheetsData";
import { Calendar } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";

import { isLeadership } from "@/lib/seller-names";

function formatBRL(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

interface SalesSeasonalityProps {
  allRows: SaleRow[];
  getMonthRows: (y: number, m: number) => SaleRow[];
  selectedYear: number;
  selectedMonth: number;
}

const DAY_NAMES = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const DAY_COLORS = [
  "hsl(0, 40%, 45%)",      // Dom - vermelho
  "hsl(217, 85%, 55%)",    // Seg
  "hsl(150, 60%, 45%)",    // Ter
  "hsl(270, 60%, 58%)",    // Qua
  "hsl(30, 90%, 55%)",     // Qui
  "hsl(180, 55%, 45%)",    // Sex
  "hsl(45, 85%, 50%)",     // Sáb
];

export function SalesSeasonality({ allRows, getMonthRows, selectedYear, selectedMonth }: SalesSeasonalityProps) {
  // Analyze last 3 months
  const { dayOfWeekData, weekOfMonthData } = useMemo(() => {
    const dayTotals: Record<number, { total: number; count: number; days: number }> = {};
    const weekTotals: Record<number, { total: number; count: number; days: number }> = {};

    for (let i = 0; i < 7; i++) dayTotals[i] = { total: 0, count: 0, days: 0 };
    for (let i = 1; i <= 5; i++) weekTotals[i] = { total: 0, count: 0, days: 0 };

    // Track which days we've counted to avoid double-counting
    const countedDays = new Set<string>();

    for (let offset = 0; offset < 3; offset++) {
      let y = selectedYear, m = selectedMonth - offset;
      while (m < 0) { m += 12; y -= 1; }
      const mRows = getMonthRows(y, m);

      mRows.forEach((r) => {
        if (!r.dataVenda || isLeadership(r.corretor)) return;
        const parts = r.dataVenda.split("/");
        if (parts.length < 3) return;
        const d = new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
        const dayOfWeek = d.getDay();
        const weekOfMonth = Math.ceil(d.getDate() / 7);
        const dayKey = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;

        dayTotals[dayOfWeek].total += r.valor;
        dayTotals[dayOfWeek].count += 1;
        if (!countedDays.has(`dow-${dayKey}`)) {
          dayTotals[dayOfWeek].days += 1;
          countedDays.add(`dow-${dayKey}`);
        }

        const wk = Math.min(weekOfMonth, 5);
        weekTotals[wk].total += r.valor;
        weekTotals[wk].count += 1;
        if (!countedDays.has(`wk-${dayKey}`)) {
          weekTotals[wk].days += 1;
          countedDays.add(`wk-${dayKey}`);
        }
      });
    }

    const dayOfWeekData = Object.entries(dayTotals).map(([day, d]) => ({
      name: DAY_NAMES[parseInt(day)],
      dayIndex: parseInt(day),
      total: d.total,
      count: d.count,
      avgPerDay: d.days > 0 ? d.total / d.days : 0,
    }));

    const weekOfMonthData = Object.entries(weekTotals).map(([week, d]) => ({
      name: `Sem ${week}`,
      week: parseInt(week),
      total: d.total,
      count: d.count,
      avgPerDay: d.days > 0 ? d.total / d.days : 0,
    }));

    return { dayOfWeekData, weekOfMonthData };
  }, [getMonthRows, selectedYear, selectedMonth]);

  const maxDayAvg = Math.max(...dayOfWeekData.map((d) => d.avgPerDay));
  const bestDay = dayOfWeekData.find((d) => d.avgPerDay === maxDayAvg);
  const maxWeekAvg = Math.max(...weekOfMonthData.map((w) => w.avgPerDay));
  const bestWeek = weekOfMonthData.find((w) => w.avgPerDay === maxWeekAvg);

  return (
    <div className="glass-card p-3 sm:p-5 space-y-4 animate-fade-in">
      <div className="flex items-center gap-2">
        <Calendar className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
        <h2 className="font-display text-sm sm:text-lg font-semibold text-foreground">
          Sazonalidade
        </h2>
        <span className="text-[10px] sm:text-xs text-muted-foreground">(últimos 3 meses)</span>
      </div>

      {/* Insights */}
      <div className="flex flex-wrap gap-2">
        {bestDay && (
          <div className="bg-primary/10 border border-primary/20 rounded-lg px-2.5 py-1.5">
            <span className="text-[10px] sm:text-xs text-muted-foreground">Melhor dia: </span>
            <span className="text-xs sm:text-sm font-semibold text-primary">{bestDay.name}</span>
            <span className="text-[10px] sm:text-xs text-muted-foreground ml-1">({formatBRL(bestDay.avgPerDay)}/dia)</span>
          </div>
        )}
        {bestWeek && (
          <div className="bg-primary/10 border border-primary/20 rounded-lg px-2.5 py-1.5">
            <span className="text-[10px] sm:text-xs text-muted-foreground">Melhor semana: </span>
            <span className="text-xs sm:text-sm font-semibold text-primary">{bestWeek.name}</span>
            <span className="text-[10px] sm:text-xs text-muted-foreground ml-1">({formatBRL(bestWeek.avgPerDay)}/dia)</span>
          </div>
        )}
      </div>

      {/* Day of Week Chart */}
      <div>
        <p className="text-[10px] sm:text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wider">Média por dia da semana</p>
        <div className="h-40 sm:h-52">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={dayOfWeekData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
              <XAxis dataKey="name" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
              <YAxis tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
              <Tooltip
                contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 11, color: "hsl(var(--foreground))" }}
                labelStyle={{ color: "hsl(var(--foreground))" }}
                itemStyle={{ color: "hsl(var(--foreground))" }}
                formatter={(value: number) => [formatBRL(value), "Média/dia"]}
              />
              <Bar dataKey="avgPerDay" radius={[4, 4, 0, 0]}>
                {dayOfWeekData.map((entry, i) => (
                  <Cell key={i} fill={DAY_COLORS[entry.dayIndex]} opacity={entry.avgPerDay === maxDayAvg ? 1 : 0.6} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Week of Month Chart */}
      <div>
        <p className="text-[10px] sm:text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wider">Média por semana do mês</p>
        <div className="h-40 sm:h-52">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={weekOfMonthData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
              <XAxis dataKey="name" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
              <YAxis tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
              <Tooltip
                contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 11, color: "hsl(var(--foreground))" }}
                labelStyle={{ color: "hsl(var(--foreground))" }}
                itemStyle={{ color: "hsl(var(--foreground))" }}
                formatter={(value: number) => [formatBRL(value), "Média/dia"]}
              />
              <Bar dataKey="avgPerDay" radius={[4, 4, 0, 0]} fill="hsl(var(--primary))" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
