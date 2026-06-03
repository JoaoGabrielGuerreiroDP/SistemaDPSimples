import { useMemo } from "react";
import { ProcfyTransaction } from "@/hooks/useProcfyData";
import { Clock, AlertTriangle, CalendarDays } from "lucide-react";

function formatCurrency(cents: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
}

function daysUntil(dateStr: string) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(dateStr + "T00:00:00");
  return Math.ceil((due.getTime() - today.getTime()) / 86400000);
}

interface Props {
  transactions: ProcfyTransaction[];
}

const AGING_RANGES = [
  { label: "Vencidas", key: "overdue", min: -Infinity, max: -1, color: "text-destructive", bg: "bg-destructive/10", border: "border-l-destructive" },
  { label: "0–7 dias", key: "0-7", min: 0, max: 7, color: "text-dept-solucoes", bg: "bg-dept-solucoes/10", border: "border-l-dept-solucoes" },
  { label: "8–15 dias", key: "8-15", min: 8, max: 15, color: "text-primary", bg: "bg-primary/10", border: "border-l-primary" },
  { label: "16–30 dias", key: "16-30", min: 16, max: 30, color: "text-muted-foreground", bg: "bg-muted/50", border: "border-l-muted-foreground" },
  { label: "30+ dias", key: "30+", min: 31, max: Infinity, color: "text-muted-foreground/60", bg: "bg-muted/30", border: "border-l-muted" },
];

export function AgingContasPagar({ transactions }: Props) {
  const aging = useMemo(() => {
    const unpaid = transactions.filter(
      (t) => !t.paid && t.transaction_type !== "revenue" && t.transaction_type !== "transfer"
    );

    return AGING_RANGES.map((range) => {
      const items = unpaid.filter((t) => {
        const days = daysUntil(t.due_date);
        return days >= range.min && days <= range.max;
      });
      const total = items.reduce((sum, t) => sum + t.amount_cents, 0);
      return { ...range, count: items.length, total };
    });
  }, [transactions]);

  const grandTotal = aging.reduce((sum, a) => sum + a.total, 0);

  if (grandTotal === 0) return null;

  return (
    <div className="glass-card p-4 sm:p-5 space-y-3">
      <div className="flex items-center gap-2">
        <CalendarDays className="w-4 h-4 sm:w-5 sm:h-5 text-dept-solucoes" />
        <h2 className="font-display text-sm sm:text-lg font-semibold text-foreground">
          Aging de Contas a Pagar
        </h2>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
        {aging.map((range) => (
          <div
            key={range.key}
            className={`rounded-lg border-l-4 ${range.border} ${range.bg} p-2.5 sm:p-3 space-y-1`}
          >
            <div className="flex items-center gap-1.5">
              {range.key === "overdue" ? (
                <AlertTriangle className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-destructive" />
              ) : (
                <Clock className={`w-3 h-3 sm:w-3.5 sm:h-3.5 ${range.color}`} />
              )}
              <span className="text-[10px] sm:text-xs text-muted-foreground font-medium">
                {range.label}
              </span>
            </div>
            <div className={`font-display text-xs sm:text-base font-bold ${range.color}`}>
              {formatCurrency(range.total)}
            </div>
            <div className="text-[9px] sm:text-xs text-muted-foreground">
              {range.count} lançamento{range.count !== 1 ? "s" : ""}
            </div>
            {grandTotal > 0 && (
              <div className="w-full bg-muted/50 rounded-full h-1.5 mt-1">
                <div
                  className={`h-1.5 rounded-full ${range.key === "overdue" ? "bg-destructive" : "bg-primary"}`}
                  style={{ width: `${Math.min((range.total / grandTotal) * 100, 100)}%` }}
                />
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between pt-1 border-t border-border">
        <span className="text-[10px] sm:text-xs text-muted-foreground">Total a pagar</span>
        <span className="font-display text-sm sm:text-lg font-bold text-foreground">
          {formatCurrency(grandTotal)}
        </span>
      </div>
    </div>
  );
}
