import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { normalizeName } from "@/lib/seller-names";

export interface SellerProspections {
  /** total deals/prospections created this month */
  total: number;
  /** open deals */
  open: number;
  /** won deals */
  won: number;
  /** lost deals */
  lost: number;
}

/**
 * Queries crm_prospections table for current-month data grouped by seller.
 * Returns a Map<normalizedSellerName, SellerProspections>.
 */
export function useCrmProspections(mesRef?: string) {
  const now = new Date();
  const targetMonth = mesRef || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const startDate = `${targetMonth}-01`;
  // end date: first day of next month
  const [y, m] = targetMonth.split("-").map(Number);
  const nextMonth = m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`;
  const endDate = `${nextMonth}-01`;

  return useQuery({
    queryKey: ["crm-prospections", targetMonth],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("crm_prospections")
        .select("seller_name, stage, source")
        .gte("created_at_crm", startDate)
        .lt("created_at_crm", endDate);

      if (error) throw error;

      const map = new Map<string, SellerProspections>();

      (data || []).forEach((row) => {
        if (!row.seller_name) return;
        const name = normalizeName(row.seller_name);
        if (!map.has(name)) map.set(name, { total: 0, open: 0, won: 0, lost: 0 });
        const entry = map.get(name)!;
        entry.total++;

        const stage = (row.stage || "").toLowerCase();
        if (stage.includes("closedwon") || stage === "closedwon") {
          entry.won++;
        } else if (stage.includes("closedlost") || stage === "closedlost") {
          entry.lost++;
        } else {
          entry.open++;
        }
      });

      return map;
    },
    staleTime: 2 * 60 * 1000,
  });
}
