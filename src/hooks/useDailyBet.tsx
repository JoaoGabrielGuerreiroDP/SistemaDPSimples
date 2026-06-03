import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { toast } from "sonner";

export interface DailyBet {
  id: string;
  user_id: string;
  broker_name: string;
  bet_date: string;
  bet_amount: number;
  actual_amount: number | null;
  xp_earned: number | null;
  status: "pending" | "won" | "partial" | "lost";
  created_at: string;
  resolved_at: string | null;
}

function todayStr() {
  return new Date().toISOString().split("T")[0];
}

export function useDailyBet(brokerName?: string) {
  const { user } = useAuth();
  const [todayBet, setTodayBet] = useState<DailyBet | null>(null);
  const [history, setHistory] = useState<DailyBet[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const today = todayStr();
    const since = new Date(); since.setDate(since.getDate() - 30);
    const sinceStr = since.toISOString().split("T")[0];

    const [todayRes, historyRes] = await Promise.all([
      supabase.from("daily_bets").select("*").eq("user_id", user.id).eq("bet_date", today).maybeSingle(),
      supabase.from("daily_bets").select("*").eq("user_id", user.id).gte("bet_date", sinceStr).order("bet_date", { ascending: false }),
    ]);
    setTodayBet((todayRes.data as DailyBet | null) || null);
    setHistory((historyRes.data || []) as DailyBet[]);
    setLoading(false);
  }, [user]);

  useEffect(() => { load(); }, [load]);

  const placeBet = useCallback(async (amount: number) => {
    if (!user || !brokerName) return;
    setSubmitting(true);
    const { error } = await supabase.from("daily_bets").upsert({
      user_id: user.id,
      broker_name: brokerName,
      bet_date: todayStr(),
      bet_amount: amount,
      status: "pending",
    }, { onConflict: "user_id,bet_date" });
    setSubmitting(false);
    if (error) { toast.error("Não foi possível registrar a aposta"); return; }
    toast.success(`🎯 Aposta de R$ ${amount.toLocaleString("pt-BR")} registrada!`);
    await load();
  }, [user, brokerName, load]);

  return { todayBet, history, loading, submitting, placeBet, reload: load };
}

export function useDailyBetsRanking() {
  const [bets, setBets] = useState<DailyBet[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from("daily_bets").select("*").eq("bet_date", todayStr()).order("bet_amount", { ascending: false });
    setBets((data || []) as DailyBet[]);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);
  return { bets, loading, reload: load };
}