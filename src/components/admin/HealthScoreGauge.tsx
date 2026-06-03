import { useMemo } from "react";
import { Activity } from "lucide-react";

interface HealthScoreGaugeProps {
  revenue: number;
  expenses: number;
  paidExpenses: number;
  unpaidExpenses: number;
  totalBalance: number;
  multiMonthData: { month: string; year: number; revenue: number; expenses: number }[];
}

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
}

export function HealthScoreGauge({
  revenue,
  expenses,
  paidExpenses,
  unpaidExpenses,
  totalBalance,
  multiMonthData,
}: HealthScoreGaugeProps) {
  const { score, breakdown } = useMemo(() => {
    // 1. Margem de lucro (30%) — 0-100
    const profit = revenue - expenses;
    const marginPct = revenue > 0 ? (profit / revenue) * 100 : 0;
    // >20% = 100, 0% = 50, <-20% = 0
    const marginScore = clamp((marginPct + 20) * (100 / 40), 0, 100);

    // 2. Liquidez (25%) — saldo / despesas a pagar
    const liquidityRatio = unpaidExpenses > 0 ? totalBalance / unpaidExpenses : totalBalance > 0 ? 100 : 50;
    // >2 = 100, 1 = 60, <0.5 = 0
    const liquidityScore = clamp(liquidityRatio * 50, 0, 100);

    // 3. Tendência de receita (20%) — comparar com média dos meses anteriores
    let trendScore = 50;
    if (multiMonthData.length >= 2) {
      const prev = multiMonthData.slice(0, -1);
      const avgPrev = prev.reduce((s, m) => s + m.revenue, 0) / prev.length;
      if (avgPrev > 0) {
        const change = ((revenue - avgPrev) / avgPrev) * 100;
        // +20% = 100, 0% = 60, -30% = 0
        trendScore = clamp(60 + change * 2, 0, 100);
      }
    }

    // 4. % despesas pagas (15%)
    const totalExp = paidExpenses + unpaidExpenses;
    const paidPct = totalExp > 0 ? (paidExpenses / totalExp) * 100 : 100;
    const paidScore = paidPct; // direct 0-100

    // 5. Eficiência operacional (10%)
    const effRatio = revenue > 0 ? (expenses / revenue) * 100 : 100;
    // <50% = 100, 80% = 50, >100% = 0
    const effScore = clamp((100 - effRatio) * 2, 0, 100);

    const total = Math.round(
      marginScore * 0.30 +
      liquidityScore * 0.25 +
      trendScore * 0.20 +
      paidScore * 0.15 +
      effScore * 0.10
    );

    return {
      score: clamp(total, 0, 100),
      breakdown: [
        { label: "Margem", value: Math.round(marginScore), weight: 30 },
        { label: "Liquidez", value: Math.round(liquidityScore), weight: 25 },
        { label: "Tendência", value: Math.round(trendScore), weight: 20 },
        { label: "Pgtos", value: Math.round(paidScore), weight: 15 },
        { label: "Eficiência", value: Math.round(effScore), weight: 10 },
      ],
    };
  }, [revenue, expenses, paidExpenses, unpaidExpenses, totalBalance, multiMonthData]);

  const color = score > 70 ? "text-emerald-500" : score > 40 ? "text-yellow-500" : "text-red-500";
  const bgColor = score > 70 ? "bg-emerald-500" : score > 40 ? "bg-yellow-500" : "bg-red-500";
  const label = score > 70 ? "Saudável" : score > 40 ? "Atenção" : "Crítico";
  const emoji = score > 70 ? "🟢" : score > 40 ? "🟡" : "🔴";

  // SVG gauge
  const radius = 54;
  const circumference = Math.PI * radius; // half circle
  const strokeDashoffset = circumference - (score / 100) * circumference;

  return (
    <div className="glass-card p-3 sm:p-5 space-y-3">
      <div className="flex items-center gap-2">
        <Activity className="w-4 h-4 sm:w-5 sm:h-5 text-foreground" />
        <span className="text-[11px] sm:text-sm text-muted-foreground font-medium">
          Score de Saúde Financeira
        </span>
        <span className="text-xs">{emoji}</span>
      </div>

      <div className="flex items-center gap-4 sm:gap-6">
        {/* Gauge */}
        <div className="relative shrink-0">
          <svg width="120" height="70" viewBox="0 0 120 70" className="sm:w-[140px] sm:h-[80px]">
            {/* Background arc */}
            <path
              d="M 6 64 A 54 54 0 0 1 114 64"
              fill="none"
              stroke="hsl(var(--muted))"
              strokeWidth="8"
              strokeLinecap="round"
            />
            {/* Score arc */}
            <path
              d="M 6 64 A 54 54 0 0 1 114 64"
              fill="none"
              className={color.replace("text-", "stroke-")}
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={`${circumference}`}
              strokeDashoffset={strokeDashoffset}
              style={{ transition: "stroke-dashoffset 1s ease-out" }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-end pb-0.5">
            <span className={`font-display text-2xl sm:text-3xl font-bold ${color}`}>
              {score}
            </span>
          </div>
        </div>

        {/* Breakdown */}
        <div className="flex-1 space-y-1.5 min-w-0">
          <div className={`text-xs sm:text-sm font-semibold ${color}`}>{label}</div>
          {breakdown.map((b) => (
            <div key={b.label} className="flex items-center gap-2">
              <span className="text-[9px] sm:text-[10px] text-muted-foreground w-16 sm:w-20 shrink-0 truncate">
                {b.label} ({b.weight}%)
              </span>
              <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-700 ${
                    b.value > 70 ? "bg-emerald-500" : b.value > 40 ? "bg-yellow-500" : "bg-red-500"
                  }`}
                  style={{ width: `${b.value}%` }}
                />
              </div>
              <span className="text-[9px] sm:text-[10px] text-muted-foreground w-6 text-right">
                {b.value}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
