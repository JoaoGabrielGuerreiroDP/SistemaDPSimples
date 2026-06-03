import { useState, useEffect, useMemo } from "react";
import { TrendingDown, ArrowDownRight } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import type { ProcfyTransaction } from "@/hooks/useProcfyData";

function formatCurrency(cents: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
}

interface TopExpenseCutsProps {
  currentTransactions: ProcfyTransaction[];
  selectedYear: number;
  selectedMonth: number;
}

interface CutItem {
  category: string;
  current: number;
  previous: number;
  reduction: number; // percentage (negative)
  diff: number; // absolute cents saved (positive)
}

export function TopExpenseCuts({ currentTransactions, selectedYear, selectedMonth }: TopExpenseCutsProps) {
  const { session } = useAuth();
  const [prevTransactions, setPrevTransactions] = useState<ProcfyTransaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!session?.access_token) return;

    const prevDate = new Date(selectedYear, selectedMonth - 1, 1);
    const prevYear = prevDate.getFullYear();
    const prevMonth = prevDate.getMonth();
    const startDate = new Date(prevYear, prevMonth, 1).toISOString().split("T")[0];
    const endDate = new Date(prevYear, prevMonth + 1, 0).toISOString().split("T")[0];

    const params = new URLSearchParams({
      endpoint: "transactions",
      start_date: startDate,
      end_date: endDate,
    });

    setLoading(true);
    fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/procfy-bulk?${params}`, {
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
      },
    })
      .then((r) => r.json())
      .then((result) => setPrevTransactions(result.data || []))
      .catch(() => setPrevTransactions([]))
      .finally(() => setLoading(false));
  }, [session, selectedYear, selectedMonth]);

  const topCuts = useMemo(() => {
    const currentByCategory: Record<string, number> = {};
    for (const t of currentTransactions) {
      if (t.transaction_type === "revenue" || t.transaction_type === "transfer") continue;
      if (t.category?.name === "Operação") continue;
      const cat = t.category?.name || "Sem categoria";
      currentByCategory[cat] = (currentByCategory[cat] || 0) + t.amount_cents;
    }

    const prevByCategory: Record<string, number> = {};
    for (const t of prevTransactions) {
      if (t.transaction_type === "revenue" || t.transaction_type === "transfer") continue;
      if (t.category?.name === "Operação") continue;
      const cat = t.category?.name || "Sem categoria";
      prevByCategory[cat] = (prevByCategory[cat] || 0) + t.amount_cents;
    }

    const items: CutItem[] = [];
    for (const [cat, previous] of Object.entries(prevByCategory)) {
      const current = currentByCategory[cat] || 0;
      if (previous === 0) continue;
      const diff = previous - current;
      const reduction = ((current - previous) / previous) * 100;
      if (diff > 0) {
        items.push({ category: cat, current, previous, reduction, diff });
      }
    }

    items.sort((a, b) => b.diff - a.diff);
    return items.slice(0, 5);
  }, [currentTransactions, prevTransactions]);

  const prevDate = new Date(selectedYear, selectedMonth - 1, 1);
  const MONTH_NAMES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
  const prevLabel = `${MONTH_NAMES[prevDate.getMonth()]}/${prevDate.getFullYear()}`;

  if (loading) {
    return (
      <div className="glass-card p-4 sm:p-5 space-y-3">
        <div className="flex items-center gap-2">
          <TrendingDown className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
          <span className="font-display text-sm sm:text-base font-semibold text-foreground">
            Maiores Cortes de Despesa
          </span>
        </div>
        <div className="text-xs text-muted-foreground animate-pulse">Carregando mês anterior...</div>
      </div>
    );
  }

  if (topCuts.length === 0) return null;

  return (
    <div className="glass-card p-4 sm:p-5 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <TrendingDown className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
          <span className="font-display text-sm sm:text-base font-semibold text-foreground">
            Top 5 Cortes de Despesas
          </span>
        </div>
        <span className="text-[9px] sm:text-[10px] text-muted-foreground">vs {prevLabel}</span>
      </div>

      <div className="grid grid-cols-1 gap-2">
        {topCuts.map((item, i) => (
          <div
            key={item.category}
            className="flex items-center justify-between p-2.5 sm:p-3 rounded-lg border border-border bg-card/50 hover:bg-card/80 transition-colors"
          >
            <div className="flex items-center gap-2.5 min-w-0 flex-1">
              <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <span className="text-[10px] sm:text-xs font-bold text-primary">{i + 1}</span>
              </div>
              <div className="min-w-0">
                <div className="text-[11px] sm:text-xs font-medium text-foreground truncate">{item.category}</div>
                <div className="text-[9px] sm:text-[10px] text-muted-foreground">
                  {formatCurrency(item.previous)} → {formatCurrency(item.current)}
                </div>
              </div>
            </div>
            <div className="flex flex-col items-end shrink-0 ml-2">
              <div className="flex items-center gap-0.5 text-primary">
                <ArrowDownRight className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                <span className="text-xs sm:text-sm font-bold">
                  {Math.abs(item.reduction) > 999 ? "999+" : Math.abs(item.reduction).toFixed(0)}%
                </span>
              </div>
              <span className="text-[9px] sm:text-[10px] text-muted-foreground">
                −{formatCurrency(item.diff)}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
