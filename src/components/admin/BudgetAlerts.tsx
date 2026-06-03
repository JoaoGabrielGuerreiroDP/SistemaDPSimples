import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ProcfyTransaction } from "@/hooks/useProcfyData";
import { AlertTriangle, TrendingDown, ShieldAlert } from "lucide-react";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";

function formatCurrency(cents: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
}

interface Props {
  transactions: ProcfyTransaction[];
  totalBalance: number;
  selectedYear: number;
  selectedMonth: number;
}

export function BudgetAlerts({ transactions, totalBalance, selectedYear, selectedMonth }: Props) {
  const { data: budgetLines } = useQuery({
    queryKey: ["budget-alerts", selectedYear, selectedMonth],
    queryFn: async () => {
      const { data } = await supabase
        .from("budget_lines")
        .select("*")
        .eq("year", selectedYear)
        .eq("month", selectedMonth + 1);
      return data || [];
    },
  });

  const alerts = useMemo(() => {
    if (!budgetLines?.length) return [];

    const result: { type: "over_budget" | "negative_balance"; label: string; detail: string; severity: "warning" | "danger" }[] = [];

    const expenseTransactions = transactions.filter(
      (t) => t.transaction_type !== "revenue" && t.transaction_type !== "transfer"
    );

    const categoryTotals: Record<string, number> = {};
    expenseTransactions.forEach((t) => {
      const cat = t.category?.name || "Outros";
      categoryTotals[cat] = (categoryTotals[cat] || 0) + t.amount_cents;
    });

    budgetLines.forEach((bl) => {
      const actual = categoryTotals[bl.category] || 0;
      if (bl.amount_cents > 0 && actual > bl.amount_cents) {
        const pct = ((actual / bl.amount_cents - 1) * 100).toFixed(0);
        result.push({
          type: "over_budget",
          label: bl.category,
          detail: `${formatCurrency(actual)} vs budget ${formatCurrency(bl.amount_cents)} (+${pct}%)`,
          severity: Number(pct) > 50 ? "danger" : "warning",
        });
      }
    });

    const unpaidExpenses = expenseTransactions
      .filter((t) => !t.paid)
      .reduce((sum, t) => sum + t.amount_cents, 0);

    if (totalBalance - unpaidExpenses < 0) {
      result.push({
        type: "negative_balance",
        label: "Saldo Projetado Negativo",
        detail: `Saldo atual ${formatCurrency(totalBalance)} - A pagar ${formatCurrency(unpaidExpenses)} = ${formatCurrency(totalBalance - unpaidExpenses)}`,
        severity: "danger",
      });
    }

    return result.sort((a, b) => (a.severity === "danger" ? -1 : 1) - (b.severity === "danger" ? -1 : 1));
  }, [transactions, budgetLines, totalBalance]);
  const [seen, setSeen] = useState(false);

  if (alerts.length === 0) return null;

  const hasDanger = alerts.some((a) => a.severity === "danger");

  return (
    <Popover onOpenChange={(open) => { if (open) setSeen(true); }}>
      <PopoverTrigger asChild>
        <button className="relative inline-flex items-center justify-center w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-destructive/15 hover:bg-destructive/25 transition-colors focus:outline-none focus:ring-2 focus:ring-destructive/40">
          <ShieldAlert className={`w-4 h-4 sm:w-5 sm:h-5 ${hasDanger ? "text-destructive" : "text-dept-solucoes"}`} />
          {!seen && (
            <span className="absolute -top-0.5 -right-0.5 flex items-center justify-center w-4 h-4 sm:w-5 sm:h-5 rounded-full bg-destructive text-[9px] sm:text-[10px] font-bold text-white">
              {alerts.length}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 sm:w-80 p-3 space-y-2">
        <div className="flex items-center gap-2 pb-1 border-b border-border">
          <ShieldAlert className="w-4 h-4 text-destructive" />
          <span className="text-xs sm:text-sm font-semibold text-destructive">
            Alertas Financeiros
          </span>
        </div>
        <div className="space-y-1.5 max-h-60 overflow-y-auto">
          {alerts.map((alert, i) => (
            <div
              key={i}
              className={`rounded-lg p-2 flex items-start gap-2 ${
                alert.severity === "danger" ? "bg-destructive/10" : "bg-dept-solucoes/10"
              }`}
            >
              {alert.type === "over_budget" ? (
                <TrendingDown className={`w-3.5 h-3.5 mt-0.5 shrink-0 ${alert.severity === "danger" ? "text-destructive" : "text-dept-solucoes"}`} />
              ) : (
                <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0 text-destructive" />
              )}
              <div className="min-w-0">
                <div className={`text-[11px] sm:text-xs font-semibold ${alert.severity === "danger" ? "text-destructive" : "text-dept-solucoes"}`}>
                  {alert.label}
                </div>
                <div className="text-[9px] sm:text-[10px] text-muted-foreground leading-tight">{alert.detail}</div>
              </div>
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
