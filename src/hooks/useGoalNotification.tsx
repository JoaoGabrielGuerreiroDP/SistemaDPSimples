import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { toast } from "sonner";

const MILESTONES = [
  { pct: 50, emoji: "🚀", label: "Metade da meta!" },
  { pct: 75, emoji: "🔥", label: "75% da meta!" },
  { pct: 100, emoji: "🎉", label: "Meta batida!" },
];

function formatBRL(v: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
}

/**
 * Checks if a broker has reached 50%, 75%, or 100% of their individual sales goal.
 * Creates persistent notifications (avoiding duplicates) and shows a toast.
 */
export function useGoalNotification(
  selectedYear: number,
  selectedMonth: number,
  totalVendido: number
) {
  const { user } = useAuth();
  const checkedRef = useRef<string | null>(null);
  const mesRef = `${selectedYear}-${String(selectedMonth + 1).padStart(2, "0")}`;

  useEffect(() => {
    if (!user || totalVendido <= 0) return;
    if (checkedRef.current === `${mesRef}_${totalVendido}`) return;

    const check = async () => {
      // 1. Get individual goal
      const { data: goalData } = await supabase
        .from("sales_goals_individual")
        .select("meta")
        .eq("user_id", user.id)
        .eq("mes_ref", mesRef)
        .maybeSingle();

      const meta = goalData?.meta ? Number(goalData.meta) : 0;
      if (meta <= 0) return;

      const currentPct = (totalVendido / meta) * 100;

      // 2. Check each milestone
      for (const milestone of MILESTONES) {
        if (currentPct < milestone.pct) continue;

        const notifKey = `meta_individual_${mesRef}_${milestone.pct}`;

        // Check if already notified
        const { data: existing } = await supabase
          .from("notifications")
          .select("id")
          .eq("user_id", user.id)
          .eq("type", "goal_reached")
          .contains("metadata", { key: notifKey })
          .maybeSingle();

        if (existing) continue;

        // 3. Create notification for broker
        const title = `${milestone.emoji} ${milestone.label}`;
        const message =
          milestone.pct === 100
            ? `Parabéns! Você bateu sua meta de ${formatBRL(meta)}. Total: ${formatBRL(totalVendido)}.`
            : `Você atingiu ${milestone.pct}% da meta (${formatBRL(meta)}). Total: ${formatBRL(totalVendido)}.`;

        await supabase.from("notifications").insert({
          user_id: user.id,
          type: "goal_reached",
          title,
          message,
          metadata: { key: notifKey, meta, totalVendido, mesRef, milestone: milestone.pct },
        });

        // Show toast
        toast.success(title, { description: message });

        // 4. Notify gestors/admins
        const { data: gestors } = await supabase
          .from("user_roles")
          .select("user_id")
          .in("role", ["admin", "gestor"]);

        const userName = user.user_metadata?.display_name || user.email || "Corretor";

        if (gestors && gestors.length > 0) {
          const gestorTitle =
            milestone.pct === 100
              ? `🏆 ${userName} bateu a meta!`
              : `${milestone.emoji} ${userName} atingiu ${milestone.pct}% da meta`;

          const gestorNotifs = gestors
            .filter((g) => g.user_id !== user.id)
            .map((g) => ({
              user_id: g.user_id,
              type: "goal_reached",
              title: gestorTitle,
              message: `${userName}: ${formatBRL(totalVendido)} de ${formatBRL(meta)} (${milestone.pct}%) em ${mesRef}.`,
              metadata: {
                key: `gestor_${notifKey}_${user.id}`,
                meta,
                totalVendido,
                mesRef,
                corretorId: user.id,
                milestone: milestone.pct,
              },
            }));

          if (gestorNotifs.length > 0) {
            await supabase.from("notifications").insert(gestorNotifs);
          }
        }
      }

      checkedRef.current = `${mesRef}_${totalVendido}`;
    };

    check();
  }, [user, mesRef, totalVendido]);
}
