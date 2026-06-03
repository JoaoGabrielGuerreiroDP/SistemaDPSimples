import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface CustomAchievement {
  id: string;
  name: string;
  description: string | null;
  icon_url: string;
  created_at: string;
}

export interface BrokerAchievementRow {
  id: string;
  achievement_id: string;
  broker_name: string;
  note: string | null;
  awarded_at: string;
}

export function useCustomAchievements() {
  const [achievements, setAchievements] = useState<CustomAchievement[]>([]);
  const [assignments, setAssignments] = useState<BrokerAchievementRow[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = async () => {
    setLoading(true);
    const [aRes, bRes] = await Promise.all([
      supabase.from("custom_achievements").select("*").order("created_at", { ascending: false }),
      supabase.from("broker_achievements").select("*").order("awarded_at", { ascending: false }),
    ]);
    if (!aRes.error) setAchievements(aRes.data || []);
    if (!bRes.error) setAssignments(bRes.data || []);
    setLoading(false);
  };

  useEffect(() => { reload(); }, []);

  /** broker → CustomAchievement[] (com note) */
  const byBroker = useMemo(() => {
    const map: Record<string, (CustomAchievement & { note: string | null; awarded_at: string })[]> = {};
    const aMap = new Map(achievements.map((a) => [a.id, a]));
    for (const b of assignments) {
      const a = aMap.get(b.achievement_id);
      if (!a) continue;
      if (!map[b.broker_name]) map[b.broker_name] = [];
      map[b.broker_name].push({ ...a, note: b.note, awarded_at: b.awarded_at });
    }
    return map;
  }, [achievements, assignments]);

  return { achievements, assignments, byBroker, loading, reload };
}
