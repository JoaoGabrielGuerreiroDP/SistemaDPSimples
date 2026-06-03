import { useMemo } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, ReferenceLine,
} from "recharts";
import { TrendingUp } from "lucide-react";

const SHORT_MONTHS = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

function formatBRL(v: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
}

interface Props {
  piperunDeals: any[];
  hubspotDeals: any[];
}

export default function CRMForecastChart({ piperunDeals, hubspotDeals }: Props) {
  const chartData = useMemo(() => {
    const now = new Date();
    const months: { year: number; month: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push({ year: d.getFullYear(), month: d.getMonth() });
    }

    return months.map(({ year, month }) => {
      // Realizado = deals ganhos nesse mês
      let realizado = 0;

      // Piperun won deals (status=1) by won_at or updated_at
      piperunDeals.forEach((d: any) => {
        if (d.status !== 1) return;
        const dateStr = d.won_at || d.updated_at || d.created_at;
        if (!dateStr) return;
        const dt = new Date(dateStr);
        if (dt.getFullYear() === year && dt.getMonth() === month) {
          realizado += Number(d.value) || 0;
        }
      });

      // HubSpot won deals by closedate
      hubspotDeals.forEach((d: any) => {
        if (d.properties?.dealstage !== "closedwon") return;
        const dateStr = d.properties?.closedate;
        if (!dateStr) return;
        const dt = new Date(dateStr);
        if (dt.getFullYear() === year && dt.getMonth() === month) {
          realizado += Number(d.properties?.amount) || 0;
        }
      });

      // Forecast = deals abertos com closedate nesse mês (pipeline value)
      let forecast = realizado; // base = already realized

      piperunDeals.forEach((d: any) => {
        if (d.status !== 0) return; // only open
        const dateStr = d.forecast_date || d.close_date;
        if (!dateStr) return;
        const dt = new Date(dateStr);
        if (dt.getFullYear() === year && dt.getMonth() === month) {
          forecast += Number(d.value) || 0;
        }
      });

      hubspotDeals.forEach((d: any) => {
        const stage = d.properties?.dealstage;
        if (stage === "closedwon" || stage === "closedlost") return;
        const dateStr = d.properties?.closedate;
        if (!dateStr) return;
        const dt = new Date(dateStr);
        if (dt.getFullYear() === year && dt.getMonth() === month) {
          forecast += Number(d.properties?.amount) || 0;
        }
      });

      return {
        name: `${SHORT_MONTHS[month]}/${String(year).slice(2)}`,
        Realizado: realizado,
        Forecast: forecast,
      };
    });
  }, [piperunDeals, hubspotDeals]);

  const hasData = chartData.some((d) => d.Realizado > 0 || d.Forecast > 0);

  return (
    <div className="glass-card p-4 sm:p-5 space-y-3">
      <div className="flex items-center gap-2">
        <TrendingUp className="w-5 h-5 text-primary" />
        <h2 className="font-display text-sm sm:text-lg font-semibold text-foreground">
          Forecast vs Realizado (6 meses)
        </h2>
      </div>
      <p className="text-[11px] text-muted-foreground">
        Compara o valor efetivamente ganho com a projeção (ganho + pipeline aberto previsto no mês)
      </p>
      {hasData ? (
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={chartData} barGap={2}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 14%, 16%)" />
            <XAxis dataKey="name" tick={{ fill: "hsl(215, 12%, 50%)", fontSize: 11 }} />
            <YAxis
              tick={{ fill: "hsl(215, 12%, 50%)", fontSize: 11 }}
              tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
              width={45}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "hsl(220, 18%, 10%)",
                border: "1px solid hsl(220, 14%, 16%)",
                borderRadius: "8px",
                color: "hsl(210, 20%, 92%)",
                fontSize: 12,
              }}
              formatter={(value: number) => formatBRL(value)}
            />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Bar dataKey="Realizado" fill="hsl(150, 60%, 45%)" radius={[4, 4, 0, 0]} />
            <Bar dataKey="Forecast" fill="hsl(220, 70%, 55%)" radius={[4, 4, 0, 0]} opacity={0.7} />
          </BarChart>
        </ResponsiveContainer>
      ) : (
        <p className="text-sm text-muted-foreground text-center py-10">
          Sem dados de forecast para exibir
        </p>
      )}
    </div>
  );
}
