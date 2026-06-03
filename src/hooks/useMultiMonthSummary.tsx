import { useState, useEffect, useCallback } from "react";
import { useAuth } from "./useAuth";

interface MonthSummary {
  month: string;
  year: number;
  revenue: number;
  expenses: number;
  paidExpenses: number;
  unpaidExpenses: number;
}

const SHORT_MONTHS = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

export function useMultiMonthSummary(months = 6) {
  const { session } = useAuth();
  const [data, setData] = useState<MonthSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!session) return;

    const load = async () => {
      setLoading(true);
      const now = new Date();

      // Calculate date range covering all requested months
      const startMonth = new Date(now.getFullYear(), now.getMonth() - (months - 1), 1);
      const endMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      const startDate = startMonth.toISOString().split("T")[0];
      const endDate = endMonth.toISOString().split("T")[0];

      try {
        // Single bulk call for the entire range
        const params = new URLSearchParams({
          endpoint: "transactions",
          start_date: startDate,
          end_date: endDate,
        });

        const res = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/procfy-bulk?${params}`,
          {
            headers: {
              Authorization: `Bearer ${session.access_token}`,
              apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            },
          }
        );

        if (!res.ok) {
          setData([]);
          return;
        }

        const result = await res.json();
        const allTxns: any[] = result.data || [];

        // Build month list
        const monthsToFetch: { year: number; month: number }[] = [];
        for (let i = months - 1; i >= 0; i--) {
          const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
          monthsToFetch.push({ year: d.getFullYear(), month: d.getMonth() });
        }

        // Group transactions by month and aggregate
        const REVENUE_CATEGORIES = ["Comissão"];
        const results: MonthSummary[] = monthsToFetch.map(({ year, month }) => {
          const monthTxns = allTxns.filter((t: any) => {
            const dueDate = t.due_date || t.paid_at;
            if (!dueDate) return false;
            const d = new Date(dueDate);
            return d.getFullYear() === year && d.getMonth() === month;
          });

          const filteredTxns = monthTxns.filter(
            (t: any) => t.transaction_type !== "transfer" && t.category?.name !== "Operação"
          );

          const revenue = filteredTxns
            .filter((t: any) => t.transaction_type === "revenue" && REVENUE_CATEGORIES.includes(t.category?.name || ""))
            .reduce((sum: number, t: any) => sum + t.amount_cents, 0);

          const expenseTxns = filteredTxns.filter(
            (t: any) => t.transaction_type !== "revenue"
          );
          const expenses = expenseTxns.reduce((sum: number, t: any) => sum + t.amount_cents, 0);
          const paidExpenses = expenseTxns.filter((t: any) => t.paid).reduce((sum: number, t: any) => sum + t.amount_cents, 0);
          const unpaidExpenses = expenseTxns.filter((t: any) => !t.paid).reduce((sum: number, t: any) => sum + t.amount_cents, 0);

          return { month: SHORT_MONTHS[month], year, revenue, expenses, paidExpenses, unpaidExpenses };
        });

        setData(results);
      } catch (e) {
        console.error("Multi-month fetch error:", e);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [session, months]);

  return { data, loading };
}
