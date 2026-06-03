import { ProcfyTransaction } from "@/hooks/useProcfyData";
import { AlertTriangle, Clock } from "lucide-react";

function formatCurrency(cents: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
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

export function UpcomingPayments({ transactions }: Props) {
  const unpaid = transactions
    .filter((t) => !t.paid && t.transaction_type !== "revenue" && t.transaction_type !== "transfer")
    .map((t) => ({ ...t, _days: daysUntil(t.due_date) }))
    .sort((a, b) => a._days - b._days);

  const overdue = unpaid.filter((t) => t._days < 0);
  const dueSoon = unpaid.filter((t) => t._days >= 0 && t._days <= 7);
  const upcoming = unpaid.filter((t) => t._days > 7 && t._days <= 30);

  const overdueTotal = overdue.reduce((s, t) => s + t.amount_cents, 0);
  const dueSoonTotal = dueSoon.reduce((s, t) => s + t.amount_cents, 0);

  if (unpaid.length === 0) return null;

  return (
    <div className="glass-card p-4 sm:p-5 space-y-3 sm:space-y-4">
      <div className="flex items-center gap-2">
        <AlertTriangle className="w-4 h-4 sm:w-5 sm:h-5 text-dept-solucoes" />
        <h2 className="font-display text-base sm:text-lg font-semibold text-foreground">
          Contas a Pagar
        </h2>
      </div>

      {/* Summary badges */}
      <div className="flex gap-2 flex-wrap">
        {overdue.length > 0 && (
          <div className="bg-destructive/15 text-destructive text-[11px] sm:text-xs font-medium px-2.5 py-1.5 rounded-lg">
            🔴 {overdue.length} vencida{overdue.length > 1 ? "s" : ""} — {formatCurrency(overdueTotal)}
          </div>
        )}
        {dueSoon.length > 0 && (
          <div className="bg-dept-solucoes/15 text-dept-solucoes text-[11px] sm:text-xs font-medium px-2.5 py-1.5 rounded-lg">
            🟡 {dueSoon.length} nos próx. 7 dias — {formatCurrency(dueSoonTotal)}
          </div>
        )}
        {upcoming.length > 0 && (
          <div className="bg-muted text-muted-foreground text-[11px] sm:text-xs font-medium px-2.5 py-1.5 rounded-lg">
            ⏳ {upcoming.length} até 30 dias
          </div>
        )}
      </div>

      {/* Overdue + Due Soon list */}
      {[...overdue, ...dueSoon].length > 0 && (
        <div className="space-y-1.5 max-h-[300px] overflow-y-auto">
          {[...overdue, ...dueSoon].map((t) => {
            const isOverdue = t._days < 0;
            return (
              <div
                key={t.id}
                className={`flex items-center justify-between gap-2 px-3 py-2 rounded-lg border text-xs sm:text-sm ${
                  isOverdue
                    ? "border-destructive/30 bg-destructive/5"
                    : "border-dept-solucoes/30 bg-dept-solucoes/5"
                }`}
              >
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <Clock className={`w-3.5 h-3.5 shrink-0 ${isOverdue ? "text-destructive" : "text-dept-solucoes"}`} />
                  <span className="truncate text-foreground font-medium">{t.name}</span>
                </div>
                <div className="flex items-center gap-2 sm:gap-3 shrink-0">
                  <span className="text-muted-foreground text-[10px] sm:text-xs">
                    {isOverdue ? `${Math.abs(t._days)}d atraso` : t._days === 0 ? "Hoje" : `${t._days}d`}
                  </span>
                  <span className="text-muted-foreground text-[10px] sm:text-xs">{formatDate(t.due_date)}</span>
                  <span className="font-mono font-medium text-destructive">{formatCurrency(t.amount_cents)}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
