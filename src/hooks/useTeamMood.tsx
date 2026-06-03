import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { toast } from "sonner";

export type Mood = "happy" | "neutral" | "sad";

function todayStr() {
  return new Date().toISOString().split("T")[0];
}

export function useTeamMood() {
  const { user } = useAuth();
  const [todayMood, setTodayMood] = useState<Mood | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("team_mood")
      .select("mood")
      .eq("user_id", user.id)
      .eq("mood_date", todayStr())
      .maybeSingle();
    setTodayMood((data?.mood as Mood) || null);
    setLoading(false);
  }, [user]);

  useEffect(() => { load(); }, [load]);

  const setMood = useCallback(async (mood: Mood) => {
    if (!user) return;
    const { error } = await supabase.from("team_mood").upsert({
      user_id: user.id,
      mood_date: todayStr(),
      mood,
    }, { onConflict: "user_id,mood_date" });
    if (error) { toast.error("Não foi possível registrar"); return; }
    setTodayMood(mood);
    toast.success("Obrigado por compartilhar! 💚");
  }, [user]);

  return { todayMood, loading, setMood };
}

export function useTeamMoodAggregate(days = 7) {
  const [data, setData] = useState<{ happy: number; neutral: number; sad: number; total: number; score: number; participants: number; teamSize: number; participationRate: number }>({ happy: 0, neutral: 0, sad: 0, total: 0, score: 0, participants: 0, teamSize: 0, participationRate: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const since = new Date(); since.setDate(since.getDate() - days);
      const sinceStr = since.toISOString().split("T")[0];
      const [moodRes, profilesRes] = await Promise.all([
        supabase.from("team_mood").select("mood, user_id").gte("mood_date", sinceStr),
        supabase.from("profiles").select("user_id"),
      ]);
      const rows = moodRes.data;
      const happy = (rows || []).filter((r) => r.mood === "happy").length;
      const neutral = (rows || []).filter((r) => r.mood === "neutral").length;
      const sad = (rows || []).filter((r) => r.mood === "sad").length;
      const total = happy + neutral + sad;
      // score base 0-100: happy=100, neutral=50, sad=0
      const baseScore = total > 0 ? ((happy * 100) + (neutral * 50)) / total : 50;
      // Opção A: pondera pela taxa de participação da equipe
      const participants = new Set((rows || []).map((r) => r.user_id)).size;
      const teamSize = (profilesRes.data || []).length;
      const participationRate = teamSize > 0 ? Math.min(1, participants / teamSize) : 0;
      // Se ninguém marcou, score neutro fica em 50 mas peso é 0 (afeta o cálculo final no health score).
      // Aqui retornamos o score já ponderado pela participação, com piso neutro de 50.
      const score = Math.round(baseScore * participationRate + 50 * (1 - participationRate));
      setData({ happy, neutral, sad, total, score, participants, teamSize, participationRate });
      setLoading(false);
    })();
  }, [days]);

  return { ...data, loading };
}