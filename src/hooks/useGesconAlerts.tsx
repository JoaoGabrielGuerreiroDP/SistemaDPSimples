import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { format } from "date-fns";

interface Venda {
  vendedor: string;
  credito: string;
  data_venda: string;
}

function parseCredito(v: string) { return parseFloat(v) || 0; }

function parseDate(d: string) {
  const parts = d.split(/[/-]/);
  return new Date(+parts[2], +parts[1] - 1, +parts[0]);
}

const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

export function useGesconAlerts(vendas: Venda[] | undefined) {
  const { user } = useAuth();
  const checkedRef = useRef(false);

  useEffect(() => {
    if (!vendas?.length || !user || checkedRef.current) return;
    checkedRef.current = true;

    (async () => {
      const now = new Date();
      const mesRef = format(now, "yyyy-MM");
      const curMonth = String(now.getMonth() + 1).padStart(2, "0");
      const curYear = String(now.getFullYear());

      // 1. Check goals
      const { data: goals } = await supabase
        .from("gescon_sales_goals")
        .select("vendedor, meta")
        .eq("mes_ref", mesRef);

      if (goals?.length) {
        // Calculate realized per seller this month
        const realized = new Map<string, number>();
        for (const v of vendas) {
          try {
            const parts = v.data_venda.split(/[/-]/);
            if (parts[2] === curYear && parts[1] === curMonth) {
              realized.set(v.vendedor, (realized.get(v.vendedor) || 0) + parseCredito(v.credito));
            }
          } catch { }
        }

        for (const goal of goals) {
          const real = realized.get(goal.vendedor) || 0;
          const meta = Number(goal.meta);
          if (meta > 0 && real >= meta) {
            // Check if already notified
            const { data: existing } = await supabase
              .from("notifications")
              .select("id")
              .eq("user_id", user.id)
              .eq("type", "gescon_goal_hit")
              .contains("metadata", { vendedor: goal.vendedor, mes: mesRef })
              .limit(1);

            if (!existing?.length) {
              await supabase.from("notifications").insert({
                user_id: user.id,
                type: "gescon_goal_hit",
                title: `🎯 ${goal.vendedor} bateu a meta!`,
                message: `${goal.vendedor} atingiu ${fmt(real)} de ${fmt(meta)} (${((real / meta) * 100).toFixed(0)}%) em ${mesRef}.`,
                metadata: { vendedor: goal.vendedor, mes: mesRef, real, meta } as any,
              });
            }
          }
        }
      }

      // 2. Check 3-day inactivity
      const sellerLastSale = new Map<string, Date>();
      for (const v of vendas) {
        try {
          const d = parseDate(v.data_venda);
          const prev = sellerLastSale.get(v.vendedor);
          if (!prev || d > prev) sellerLastSale.set(v.vendedor, d);
        } catch { }
      }

      const threeDaysAgo = new Date();
      threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
      const todayStr = format(now, "yyyy-MM-dd");

      for (const [seller, lastDate] of sellerLastSale.entries()) {
        if (lastDate < threeDaysAgo) {
          const daysSince = Math.floor((now.getTime() - lastDate.getTime()) / 86400000);

          const { data: existing } = await supabase
            .from("notifications")
            .select("id")
            .eq("user_id", user.id)
            .eq("type", "gescon_inactive")
            .contains("metadata", { vendedor: seller, check_date: todayStr })
            .limit(1);

          if (!existing?.length) {
            await supabase.from("notifications").insert({
              user_id: user.id,
              type: "gescon_inactive",
              title: `⚠️ ${seller} sem vendas há ${daysSince} dias`,
              message: `Última venda em ${format(lastDate, "dd/MM/yyyy")}. Considere entrar em contato.`,
              metadata: { vendedor: seller, check_date: todayStr, days_inactive: daysSince } as any,
            });
          }
        }
      }
    })();
  }, [vendas, user]);
}
