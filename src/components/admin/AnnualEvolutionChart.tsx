import { useMemo, useState } from "react";
import { SaleRow } from "@/hooks/useGoogleSheetsData";
import { Button } from "@/components/ui/button";
import { CalendarRange } from "lucide-react";
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

function formatBRL(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

function parseBRDate(raw: string): Date | null {
  if (!raw) return null;
  const parts = raw.split("/");
  if (parts.length !== 3) return null;
  const [day, month, year] = parts.map(Number);
  return new Date(year, month - 1, day);
}

const MONTH_NAMES = [
  "Jan", "Fev", "Mar", "Abr", "Mai", "Jun",
  "Jul", "Ago", "Set", "Out", "Nov", "Dez",
];

interface AnnualEvolutionChartProps {
  allRows: SaleRow[];
}

interface MonthData {
  key: string;
  label: string;
  year: number;
  month: number;
  total: number;
  count: number;
}

export function AnnualEvolutionChart({ allRows }: AnnualEvolutionChartProps) {
  const availableYears = useMemo(() => {
    const years = new Set<number>();
    allRows.forEach((r) => {
      const d = parseBRDate(r.dataVenda);
      if (d) years.add(d.getFullYear());
    });
    return Array.from(years).sort();
  }, [allRows]);

  const [selectedYears, setSelectedYears] = useState<number[]>(() => {
    if (availableYears.length === 0) return [];
    const current = new Date().getFullYear();
    const prev = current - 1;
    return availableYears.filter((y) => y === current || y === prev);
  });

  const toggleYear = (year: number) => {
    setSelectedYears((prev) =>
      prev.includes(year) ? prev.filter((y) => y !== year) : [...prev, year]
    );
  };

  // Build per-year monthly data
  const yearData = useMemo(() => {
    const map: Record<number, Record<number, { total: number; count: number }>> = {};
    allRows.forEach((r) => {
      const d = parseBRDate(r.dataVenda);
      if (!d) return;
      const y = d.getFullYear();
      const m = d.getMonth();
      if (!map[y]) map[y] = {};
      if (!map[y][m]) map[y][m] = { total: 0, count: 0 };
      map[y][m].total += r.valor;
      map[y][m].count += 1;
    });
    return map;
  }, [allRows]);

  // Chart data: 12 months, each with a line per selected year
  const chartData = useMemo(() => {
    return Array.from({ length: 12 }, (_, m) => {
      const point: Record<string, any> = { month: MONTH_NAMES[m] };
      selectedYears.forEach((y) => {
        point[`valor_${y}`] = yearData[y]?.[m]?.total || 0;
        point[`qtd_${y}`] = yearData[y]?.[m]?.count || 0;
      });
      return point;
    });
  }, [yearData, selectedYears]);

  // Year-level summary
  const yearSummaries = useMemo(() => {
    return selectedYears.map((y) => {
      let total = 0;
      let count = 0;
      for (let m = 0; m < 12; m++) {
        total += yearData[y]?.[m]?.total || 0;
        count += yearData[y]?.[m]?.count || 0;
      }
      return { year: y, total, count };
    }).sort((a, b) => a.year - b.year);
  }, [yearData, selectedYears]);

  const LINE_COLORS: Record<number, string> = {};
  const colorPalette = [
    "hsl(150, 60%, 45%)",
    "hsl(217, 85%, 55%)",
    "hsl(270, 60%, 58%)",
    "hsl(30, 90%, 55%)",
    "hsl(0, 72%, 55%)",
    "hsl(180, 55%, 45%)",
  ];
  selectedYears.sort().forEach((y, i) => {
    LINE_COLORS[y] = colorPalette[i % colorPalette.length];
  });

  if (availableYears.length === 0) return null;

  return (
    <div className="glass-card p-5 space-y-4">
      <div className="flex items-center gap-2">
        <CalendarRange className="w-5 h-5 text-primary" />
        <h2 className="font-display text-lg font-semibold text-foreground">
          Evolução Anual de Vendas
        </h2>
      </div>

      {/* Year selector */}
      <div className="flex gap-2 flex-wrap">
        {availableYears.map((year) => (
          <Button
            key={year}
            variant={selectedYears.includes(year) ? "default" : "outline"}
            size="sm"
            onClick={() => toggleYear(year)}
            style={
              selectedYears.includes(year)
                ? { backgroundColor: LINE_COLORS[year] || colorPalette[0], borderColor: "transparent" }
                : undefined
            }
          >
            {year}
          </Button>
        ))}
      </div>

      {/* Year summaries */}
      {yearSummaries.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {yearSummaries.map((s) => (
            <div key={s.year} className="rounded-lg p-3 bg-muted/30 border border-border/50">
              <div className="text-xs text-muted-foreground font-medium">{s.year}</div>
              <div className="text-lg font-bold" style={{ color: LINE_COLORS[s.year] }}>
                {formatBRL(s.total)}
              </div>
              <div className="text-xs text-muted-foreground">{s.count} propostas</div>
            </div>
          ))}
        </div>
      )}

      {/* Chart */}
      {selectedYears.length > 0 ? (
        <ResponsiveContainer width="100%" height={360}>
          <AreaChart data={chartData}>
            <defs>
              {selectedYears.map((y) => (
                <linearGradient key={y} id={`gradient_${y}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={LINE_COLORS[y]} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={LINE_COLORS[y]} stopOpacity={0} />
                </linearGradient>
              ))}
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 14%, 16%)" />
            <XAxis dataKey="month" tick={{ fill: "hsl(215, 12%, 50%)", fontSize: 12 }} />
            <YAxis
              tick={{ fill: "hsl(215, 12%, 50%)", fontSize: 11 }}
              tickFormatter={(v) => v >= 1000000 ? `${(v / 1000000).toFixed(1)}M` : `${(v / 1000).toFixed(0)}k`}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "hsl(220, 18%, 10%)",
                border: "1px solid hsl(220, 14%, 16%)",
                borderRadius: "8px",
                color: "hsl(210, 20%, 92%)",
              }}
              formatter={(value: number, name: string) => {
                const year = name.replace("valor_", "");
                return [formatBRL(value), year];
              }}
            />
            <Legend
              formatter={(value) => value.replace("valor_", "")}
            />
            {selectedYears.sort().map((y) => (
              <Area
                key={y}
                type="monotone"
                dataKey={`valor_${y}`}
                stroke={LINE_COLORS[y]}
                fill={`url(#gradient_${y})`}
                strokeWidth={2.5}
                dot={{ r: 3, fill: LINE_COLORS[y] }}
                activeDot={{ r: 5 }}
                name={`valor_${y}`}
              />
            ))}
          </AreaChart>
        </ResponsiveContainer>
      ) : (
        <p className="text-sm text-muted-foreground text-center py-10">
          Selecione pelo menos um ano para visualizar
        </p>
      )}
    </div>
  );
}