import { useMemo } from "react";
import { SaleRow } from "@/hooks/useGoogleSheetsData";
import { TrendingUp, BarChart3 } from "lucide-react";

function formatBRL(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

interface SalesProjectionProps {
  rows: SaleRow[];
  allRows: SaleRow[];
  meta: number;
  selectedYear: number;
  selectedMonth: number;
  getMonthRows: (year: number, month: number) => SaleRow[];
}

export function SalesProjection({ rows, meta, selectedYear, selectedMonth }: SalesProjectionProps) {
  const now = new Date();
  const isCurrentMonth = selectedYear === now.getFullYear() && selectedMonth === now.getMonth();
  const daysInMonth = new Date(selectedYear, selectedMonth + 1, 0).getDate();
  const currentDay = isCurrentMonth ? now.getDate() : daysInMonth;
  const daysRemaining = Math.max(daysInMonth - currentDay, 0);

  const { avgDaily, avgLast7, projConservador, projRealista, projOtimista } = useMemo(() => {
    // Calculate daily averages
    const dayMap: Record<number, number> = {};
    rows.forEach((r) => {
      if (!r.dataVenda) return;
      const parts = r.dataVenda.split("/");
      const day = parseInt(parts[0], 10);
      if (day >= 1 && day <= daysInMonth) {
        dayMap[day] = (dayMap[day] || 0) + r.valor;
      }
    });

    const totalVendido = rows.reduce((s, r) => s + r.valor, 0);
    const daysWorked = Math.max(currentDay, 1);
    const dailyAvg = totalVendido / daysWorked;

    // Last 7 days average
    const last7Days: number[] = [];
    for (let i = 0; i < 7; i++) {
      const d = currentDay - i;
      if (d >= 1) last7Days.push(dayMap[d] || 0);
    }
    const avg7 = last7Days.length > 0 ? last7Days.reduce((s, v) => s + v, 0) / last7Days.length : 0;

    // Projections
    const projC = totalVendido + avg7 * daysRemaining; // Conservative (last 7 days pace)
    const projR = totalVendido + dailyAvg * daysRemaining; // Realistic (overall average)
    const projO = totalVendido + dailyAvg * 1.2 * daysRemaining; // Optimistic (+20%)

    return {
      avgDaily: dailyAvg,
      avgLast7: avg7,
      projConservador: projC,
      projRealista: projR,
      projOtimista: projO,
    };
  }, [rows, currentDay, daysRemaining, daysInMonth]);

  if (meta <= 0 || !isCurrentMonth) return null;

  const totalVendido = rows.reduce((s, r) => s + r.valor, 0);
  const isAccelerating = avgLast7 > avgDaily;

  // Progress bar segments
  const pctAtual = Math.min((totalVendido / meta) * 100, 100);
  const pctRealista = Math.min((projRealista / meta) * 100, 100);

  return (
    <div className="glass-card p-4 sm:p-5 space-y-4">
      <div className="flex items-center gap-2">
        <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
        <h2 className="font-display text-sm sm:text-lg font-semibold text-foreground">
          Projeção de Fechamento
        </h2>
      </div>

      <p className="text-[10px] sm:text-xs text-muted-foreground">
        Baseada na velocidade média de vendas — {daysRemaining} dias restantes no mês
      </p>

      {/* Velocidade de vendas */}
      <div className="glass-card p-3 sm:p-4 space-y-2 border border-border/50">
        <span className="text-[10px] sm:text-xs text-muted-foreground uppercase tracking-wider font-semibold">
          Velocidade de Vendas
        </span>
        <div className="flex items-center justify-between">
          <span className="text-xs sm:text-sm text-muted-foreground">Média do mês</span>
          <span className="text-xs sm:text-sm font-bold text-foreground">{formatBRL(avgDaily)}/dia</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xs sm:text-sm text-muted-foreground">Últimos 7 dias</span>
          <span className={`text-xs sm:text-sm font-bold ${isAccelerating ? "text-emerald-400" : "text-destructive"}`}>
            {formatBRL(avgLast7)}/dia {isAccelerating ? "↑" : "↓"}
          </span>
        </div>
      </div>

      {/* Cenários */}
      <div className="glass-card p-3 sm:p-4 space-y-2 border border-border/50">
        <span className="text-[10px] sm:text-xs text-muted-foreground uppercase tracking-wider font-semibold">
          Cenários de Fechamento
        </span>
        <div className="flex items-center justify-between">
          <div>
            <span className="text-xs sm:text-sm font-semibold text-destructive">Conservador</span>
            <span className="text-[10px] sm:text-xs text-muted-foreground ml-1">(ritmo últ. 7 dias)</span>
          </div>
          <div className="text-right">
            <span className="text-xs sm:text-sm font-bold text-foreground">{formatBRL(projConservador)}</span>
            <span className="text-[10px] text-muted-foreground ml-1">({((projConservador / meta) * 100).toFixed(0)}%)</span>
          </div>
        </div>
        <div className="flex items-center justify-between">
          <div>
            <span className="text-xs sm:text-sm font-semibold text-[hsl(217,85%,55%)]">Realista</span>
            <span className="text-[10px] sm:text-xs text-muted-foreground ml-1">(média geral)</span>
          </div>
          <div className="text-right">
            <span className="text-xs sm:text-sm font-bold text-foreground">{formatBRL(projRealista)}</span>
            <span className="text-[10px] text-muted-foreground ml-1">({((projRealista / meta) * 100).toFixed(0)}%)</span>
          </div>
        </div>
        <div className="flex items-center justify-between">
          <div>
            <span className="text-xs sm:text-sm font-semibold text-emerald-400">Otimista</span>
            <span className="text-[10px] sm:text-xs text-muted-foreground ml-1">(+20% média)</span>
          </div>
          <div className="text-right">
            <span className="text-xs sm:text-sm font-bold text-foreground">{formatBRL(projOtimista)}</span>
            <span className="text-[10px] text-muted-foreground ml-1">({((projOtimista / meta) * 100).toFixed(0)}%)</span>
          </div>
        </div>
      </div>

      {/* Visual progress with projections */}
      <div className="space-y-1.5">
        <div className="flex justify-between text-[10px] text-muted-foreground">
          <span>R$ 0</span>
          <span>Meta: {formatBRL(meta)}</span>
        </div>
        <div className="relative h-3 rounded-full bg-muted/50 overflow-hidden">
          {/* Realistic projection */}
          <div
            className="absolute inset-y-0 left-0 rounded-full bg-[hsl(217,85%,55%)]/30"
            style={{ width: `${pctRealista}%` }}
          />
          {/* Current */}
          <div
            className="absolute inset-y-0 left-0 rounded-full"
            style={{
              width: `${pctAtual}%`,
              background: "linear-gradient(90deg, hsl(30,90%,55%), hsl(45,85%,50%), hsl(150,60%,45%))",
            }}
          />
          {/* Meta marker */}
          <div className="absolute inset-y-0 right-0 w-0.5 bg-foreground/50" style={{ left: "100%" }} />
        </div>
        <div className="flex gap-3 text-[9px] sm:text-[10px] text-muted-foreground">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-[hsl(45,85%,50%)]" /> Atual
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-[hsl(217,85%,55%)]/50" /> Realista
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-emerald-400/50" /> Otimista
          </span>
        </div>
      </div>
    </div>
  );
}
