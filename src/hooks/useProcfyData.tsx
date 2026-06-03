import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

export interface ProcfyTransaction {
  id: number;
  name: string;
  description?: string;
  amount_cents: number;
  amount_currency: string;
  transaction_type: string;
  payment_method: string;
  payment_type: string;
  due_date: string;
  paid: boolean;
  paid_at?: string;
  bank_account?: {
    id: number;
    name: string;
    balance_cents: number;
    balance_currency: string;
  };
  category?: {
    id: number;
    name: string;
    description?: string;
  };
  cost_center?: {
    id: number;
    name: string;
    description?: string;
  };
  contact?: {
    id: number;
    first_name: string;
    last_name?: string;
  };
}

export interface ProcfyBankAccount {
  id: number;
  name: string;
  default: boolean;
  balance_cents: number;
  balance_currency: string;
  agency?: string;
}

export interface ProcfyCategory {
  id: number;
  name: string;
  transaction_type?: string;
}

interface PaginatedResponse<T> {
  page: {
    page: number;
    items: number;
    pages: number;
    count: number;
  };
  data: T[];
}

export function useProcfyData(period?: { startDate: string; endDate: string }) {
  const { session } = useAuth();
  const [transactions, setTransactions] = useState<ProcfyTransaction[]>([]);
  const [bankAccounts, setBankAccounts] = useState<ProcfyBankAccount[]>([]);
  const [categories, setCategories] = useState<ProcfyCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchEndpoint = useCallback(
    async function fetchFn<T>(endpoint: string, params?: Record<string, string>): Promise<T[]> {
      if (!session?.access_token) return [];

      const queryParams = new URLSearchParams({
        endpoint,
        ...params,
      });

      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/procfy-bulk?${queryParams}`;
      const res = await fetch(url, {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to fetch data");
      }

      const result = await res.json();
      return (result.data || []) as T[];
    },
    [session]
  );

  const loadData = useCallback(async () => {
    if (!session) return;
    setLoading(true);
    setError(null);

    try {
      let startOfMonth: string;
      let endOfMonth: string;

      if (period) {
        startOfMonth = period.startDate;
        endOfMonth = period.endDate;
      } else {
        const now = new Date();
        startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];
        endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split("T")[0];
      }

      const [txns, accounts, cats] = await Promise.all([
        fetchEndpoint<ProcfyTransaction>("transactions", {
          start_date: startOfMonth,
          end_date: endOfMonth,
        }),
        fetchEndpoint<ProcfyBankAccount>("bank_accounts"),
        fetchEndpoint<ProcfyCategory>("categories"),
      ]);

      setTransactions(txns);
      setBankAccounts(accounts);
      setCategories(cats);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao carregar dados");
    } finally {
      setLoading(false);
    }
  }, [session, fetchEndpoint, period?.startDate, period?.endDate]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Receita real = apenas categoria "Comissão" do tipo revenue
  const REVENUE_CATEGORIES = ["Comissão"];
  const revenue = transactions
    .filter((t) => t.transaction_type === "revenue" && REVENUE_CATEGORIES.includes(t.category?.name || ""))
    .reduce((sum, t) => sum + t.amount_cents, 0);

  const expenses = transactions
    .filter((t) => t.transaction_type !== "revenue" && t.transaction_type !== "transfer")
    .reduce((sum, t) => sum + t.amount_cents, 0);

  const profit = revenue - expenses;

  const paid = transactions.filter((t) => t.paid);
  const unpaid = transactions.filter((t) => !t.paid);

  const totalBalance = bankAccounts.reduce((sum, a) => sum + a.balance_cents, 0);

  // Group by transaction type
  const byType = transactions.reduce(
    (acc, t) => {
      const type = t.transaction_type;
      if (!acc[type]) acc[type] = 0;
      acc[type] += t.amount_cents;
      return acc;
    },
    {} as Record<string, number>
  );

  // Group by bank account
  const byAccount = transactions.reduce(
    (acc, t) => {
      const name = t.bank_account?.name || "Sem conta";
      if (!acc[name]) acc[name] = 0;
      acc[name] += t.amount_cents;
      return acc;
    },
    {} as Record<string, number>
  );

  // Group by category
  const byCategory = transactions.reduce(
    (acc, t) => {
      const name = t.category?.name || "Sem categoria";
      if (!acc[name]) acc[name] = 0;
      acc[name] += t.amount_cents;
      return acc;
    },
    {} as Record<string, number>
  );

  // Group by cost center
  const byCostCenter = transactions.reduce(
    (acc, t) => {
      const name = t.cost_center?.name?.trim() || "Sem centro de custo";
      if (!acc[name]) acc[name] = 0;
      acc[name] += t.amount_cents;
      return acc;
    },
    {} as Record<string, number>
  );

  // Unique categories and cost centers from transactions
  const uniqueCategories = [...new Set(transactions.map((t) => t.category?.name).filter(Boolean))] as string[];
  const uniqueCostCenters = [...new Set(transactions.map((t) => t.cost_center?.name?.trim()).filter(Boolean))] as string[];

  return {
    transactions,
    bankAccounts,
    categories,
    loading,
    error,
    reload: loadData,
    uniqueCategories,
    uniqueCostCenters,
    summary: {
      revenue,
      expenses,
      profit,
      totalBalance,
      paidCount: paid.length,
      unpaidCount: unpaid.length,
      totalCount: transactions.length,
      byType,
      byAccount,
      byCategory,
      byCostCenter,
    },
  };
}
