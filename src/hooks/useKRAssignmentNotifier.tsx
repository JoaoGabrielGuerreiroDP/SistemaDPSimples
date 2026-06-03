import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { toast } from "sonner";

/**
 * Listens for realtime changes on key_results table.
 * When a KR is assigned to the current user, shows a toast and creates a notification.
 */
export function useKRAssignmentNotifier() {
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel("kr-assignment-notify")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "key_results" },
        async (payload) => {
          const newRow = payload.new as {
            assigned_to: string | null;
            title: string;
            id: string;
            last_assigned_by: string | null;
          };
          const oldRow = payload.old as { assigned_to: string | null };

          // Only notify if assigned_to changed TO the current user
          if (
            newRow.assigned_to === user.id &&
            oldRow.assigned_to !== user.id
          ) {
            let assignerName = "Alguém";

            if (newRow.last_assigned_by) {
              const { data } = await supabase
                .from("profiles")
                .select("display_name")
                .eq("user_id", newRow.last_assigned_by)
                .maybeSingle();

              if (data?.display_name) {
                assignerName = data.display_name.split(" ")[0];
              }
            }

            // Show toast
            toast.info(`📋 ${assignerName} atribuiu um KR a você`, {
              description: newRow.title,
              duration: 8000,
            });

            // Persist notification
            await supabase.from("notifications").insert({
              user_id: user.id,
              type: "kr_assigned",
              title: `${assignerName} atribuiu um KR a você`,
              message: newRow.title,
              metadata: {
                kr_id: newRow.id,
                assigned_by: newRow.last_assigned_by,
              },
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);
}
