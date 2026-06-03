import { useMemo, useState } from "react";
import { SaleRow } from "@/hooks/useGoogleSheetsData";
import { History, ChevronDown, ChevronUp, Minus } from "lucide-react";

import { isLeadership, normalizeName } from "@/lib/seller-names";

const MONTH_NAMES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

function formatCompact(value: number) {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(0)}k`;
  return value.toFixed(0);
}

interface SalesHistoricalRankingProps {
  selectedYear: number;
  selectedMonth: number;
  getMonthRows: (year: number, month: number) => SaleRow[];
}

interface MonthRanking {
  label: string;
  rankings: Record<string, { position: number; total: number }>;
}

export function SalesHistoricalRanking({ selectedYear, selectedMonth, getMonthRows }: SalesHistoricalRankingProps) {
  const [expanded, setExpanded] = useState(false);
  const numMonths = expanded ? 6 : 3;

  const { months, allBrokers } = useMemo(() => {
    const monthsData: MonthRanking[] = [];

    for (let i = numMonths - 1; i >= 0; i--) {
      let y = selectedYear;
      let m = selectedMonth - i;
      while (m < 0) { m += 12; y -= 1; }

      const rows = getMonthRows(y, m);
      const brokerMap: Record<string, number> = {};
      rows.forEach((r) => {
        if (!r.corretor || isLeadership(r.corretor)) return;
        const key = normalizeName(r.corretor);
        brokerMap[key] = (brokerMap[key] || 0) + r.valor;
      });

      const sorted = Object.entries(brokerMap)
        .sort((a, b) => b[1] - a[1]);

      const rankings: Record<string, { position: number; total: number }> = {};
      sorted.forEach(([name, total], idx) => {
        rankings[name] = { position: idx + 1, total };
      });

      monthsData.push({
        label: `${MONTH_NAMES[m]}/${String(y).slice(2)}`,
        rankings,
      });
    }

    // Collect all unique brokers from current month
    const currentMonth = monthsData[monthsData.length - 1];
    const brokerNames = Object.entries(currentMonth.rankings)
      .sort((a, b) => a[1].position - b[1].position)
      .map(([name]) => name);

    // Add brokers from other months that aren't in current
    monthsData.forEach((md) => {
      Object.keys(md.rankings).forEach((name) => {
        if (!brokerNames.includes(name)) brokerNames.push(name);
      });
    });

    return { months: monthsData, allBrokers: brokerNames };
  }, [selectedYear, selectedMonth, getMonthRows, numMonths]);

  if (allBrokers.length === 0) return null;

  const currentMonthIdx = months.length - 1;
  const prevMonthIdx = months.length - 2;

  return (
    <div className="glass-card p-3 sm:p-5 space-y-3 sm:space-y-4 animate-fade-in">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <History className="w-4 h-4 sm:w-5 sm:h-5 text-[hsl(270,60%,58%)]" />
          <h2 className="font-display text-sm sm:text-lg font-semibold text-foreground">
            Ranking Histórico
          </h2>
        </div>
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-[10px] sm:text-xs text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded-md hover:bg-muted/50"
        >
          {expanded ? "3 meses" : "6 meses"}
        </button>
      </div>

      <div className="overflow-x-auto -mx-3 sm:mx-0">
        <table className="w-full text-[10px] sm:text-xs min-w-[360px]">
          <thead>
            <tr className="border-b border-border/50">
              <th className="text-left py-2 pl-3 sm:pl-0 pr-2 text-muted-foreground font-medium">Corretor</th>
              {months.map((m) => (
                <th key={m.label} className="text-center py-2 px-1 text-muted-foreground font-medium whitespace-nowrap">
                  {m.label}
                </th>
              ))}
              <th className="text-center py-2 pr-3 sm:pr-0 pl-1 text-muted-foreground font-medium">Trend</th>
            </tr>
          </thead>
          <tbody>
            {allBrokers.map((broker, brokerIdx) => {
              const current = months[currentMonthIdx]?.rankings[broker];
              const prev = prevMonthIdx >= 0 ? months[prevMonthIdx]?.rankings[broker] : undefined;

              let trend: "up" | "down" | "same" | "new" = "new";
              let trendDiff = 0;
              if (current && prev) {
                trendDiff = prev.position - current.position;
                if (trendDiff > 0) trend = "up";
                else if (trendDiff < 0) trend = "down";
                else trend = "same";
              }

              return (
                <tr
                  key={broker}
                  className="border-b border-border/20 hover:bg-muted/30 transition-colors animate-fade-in"
                  style={{ animationDelay: `${brokerIdx * 40}ms`, animationFillMode: "both" }}
                >
                  <td className="py-2 pl-3 sm:pl-0 pr-2 font-medium text-foreground truncate max-w-[100px] sm:max-w-[140px]">
                    {broker}
                  </td>
                  {months.map((m) => {
                    const data = m.rankings[broker];
                    if (!data) {
                      return (
                        <td key={m.label} className="text-center py-2 px-1 text-muted-foreground/40">
                          —
                        </td>
                      );
                    }

                    const posColor =
                      data.position === 1
                        ? "text-[hsl(45,85%,50%)] font-bold"
                        : data.position === 2
                        ? "text-[hsl(210,15%,75%)] font-semibold"
                        : data.position === 3
                        ? "text-[hsl(30,60%,50%)] font-semibold"
                        : "text-foreground";

                    return (
                      <td key={m.label} className="text-center py-2 px-1">
                        <div className="flex flex-col items-center gap-0">
                          <span className={`text-[11px] sm:text-xs ${posColor}`}>
                            {data.position}º
                          </span>
                          <span className="text-[8px] sm:text-[9px] text-muted-foreground">
                            R$ {formatCompact(data.total)}
                          </span>
                        </div>
                      </td>
                    );
                  })}
                  <td className="text-center py-2 pr-3 sm:pr-0 pl-1">
                    {trend === "up" && (
                      <span className="inline-flex items-center gap-0.5 text-emerald-400 font-semibold">
                        <ChevronUp className="w-3 h-3" />
                        <span className="text-[10px]">{trendDiff}</span>
                      </span>
                    )}
                    {trend === "down" && (
                      <span className="inline-flex items-center gap-0.5 text-red-400 font-semibold">
                        <ChevronDown className="w-3 h-3" />
                        <span className="text-[10px]">{Math.abs(trendDiff)}</span>
                      </span>
                    )}
                    {trend === "same" && (
                      <span className="inline-flex items-center text-muted-foreground">
                        <Minus className="w-3 h-3" />
                      </span>
                    )}
                    {trend === "new" && (
                      <span className="text-[9px] text-[hsl(217,85%,55%)] font-medium">NEW</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
