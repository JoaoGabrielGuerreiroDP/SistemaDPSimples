import { useMemo, useState } from "react";
import { SaleRow } from "@/hooks/useGoogleSheetsData";
import { BarChart3 } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  PieChart,
  Pie,
} from "recharts";
import { Button } from "@/components/ui/button";

const COLORS = [
  "hsl(150, 60%, 45%)",
  "hsl(217, 85%, 55%)",
  "hsl(270, 60%, 58%)",
  "hsl(30, 90%, 55%)",
  "hsl(180, 55%, 45%)",
  "hsl(0, 72%, 55%)",
  "hsl(45, 85%, 50%)",
  "hsl(320, 60%, 55%)",
];

function formatBRL(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

interface SalesChannelChartProps {
  rows: SaleRow[];
}

type ViewMode = "canal" | "origem";

export function SalesChannelChart({ rows }: SalesChannelChartProps) {
  const [mode, setMode] = useState<ViewMode>("canal");

  const data = useMemo(() => {
    const map: Record<string, { total: number; count: number }> = {};
    rows.forEach((r) => {
      const key = mode === "canal"
        ? (r.canalVenda || "Não informado").trim()
        : (r.origemVenda || "Não informado").trim();
      if (!map[key]) map[key] = { total: 0, count: 0 };
      map[key].total += r.valor;
      map[key].count += 1;
    });

    return Object.entries(map)
      .map(([name, d]) => ({ name, ...d }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 8);
  }, [rows, mode]);

  const grandTotal = useMemo(() => data.reduce((s, d) => s + d.total, 0), [data]);

  if (data.length === 0) return null;

  return (
    <div className="glass-card p-3 sm:p-5 space-y-3 sm:space-y-4 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <BarChart3 className="w-4 h-4 sm:w-5 sm:h-5 text-[hsl(270,60%,58%)]" />
          <h2 className="font-display text-sm sm:text-lg font-semibold text-foreground">
            Vendas por {mode === "canal" ? "Canal" : "Origem"}
          </h2>
        </div>
        <div className="flex gap-1">
          <Button
            variant={mode === "canal" ? "default" : "outline"}
            size="sm"
            className="text-[10px] sm:text-xs h-6 sm:h-7 px-2"
            onClick={() => setMode("canal")}
          >
            Canal
          </Button>
          <Button
            variant={mode === "origem" ? "default" : "outline"}
            size="sm"
            className="text-[10px] sm:text-xs h-6 sm:h-7 px-2"
            onClick={() => setMode("origem")}
          >
            Origem
          </Button>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data} layout="vertical" margin={{ left: 0, right: 10 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 14%, 16%)" horizontal={false} />
          <XAxis
            type="number"
            tick={{ fill: "hsl(215, 12%, 50%)", fontSize: 9 }}
            tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
          />
          <YAxis
            type="category"
            dataKey="name"
            width={90}
            tick={{ fill: "hsl(215, 12%, 60%)", fontSize: 10 }}
          />
          <Tooltip
            contentStyle={{
              background: "hsl(220, 20%, 10%)",
              border: "1px solid hsl(220, 14%, 20%)",
              borderRadius: "8px",
              fontSize: "11px",
            }}
            formatter={(value: number) => [formatBRL(value), "Total"]}
          />
          <Bar dataKey="total" radius={[0, 4, 4, 0]} barSize={18}>
            {data.map((_, i) => (
              <Cell key={i} fill={COLORS[i % COLORS.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      {/* Legend with percentages */}
      <div className="flex flex-wrap gap-x-3 gap-y-1">
        {data.map((d, i) => (
          <div key={d.name} className="flex items-center gap-1.5">
            <span
              className="w-2 h-2 rounded-full shrink-0"
              style={{ background: COLORS[i % COLORS.length] }}
            />
            <span className="text-[9px] sm:text-[10px] text-muted-foreground">
              {d.name}: {d.count}x ({grandTotal > 0 ? ((d.total / grandTotal) * 100).toFixed(0) : 0}%)
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
