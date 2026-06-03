import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { toast } from "sonner";

// XP per action
const XP_KR_COMPLETE = 50;
const XP_KR_START = 10;
const XP_STREAK_BONUS = 20; // bonus per day of streak

// Levels: XP thresholds
const LEVELS = [
  { level: 1, name: "Iniciante", minXP: 0, icon: "🌱" },
  { level: 2, name: "Aprendiz", minXP: 100, icon: "🌿" },
  { level: 3, name: "Praticante", minXP: 300, icon: "⚡" },
  { level: 4, name: "Competente", minXP: 600, icon: "🔥" },
  { level: 5, name: "Avançado", minXP: 1000, icon: "💎" },
  { level: 6, name: "Expert", minXP: 1500, icon: "🏆" },
  { level: 7, name: "Mestre", minXP: 2500, icon: "👑" },
];

// Badge definitions
export const BADGE_DEFS: Record<string, { name: string; description: string; icon: string; check: (stats: GamificationStats) => boolean }> = {
  first_kr: { name: "Primeiro Passo", description: "Concluiu o primeiro KR", icon: "🎯", check: (s) => s.totalKRsDone >= 1 },
  five_krs: { name: "Engajado", description: "Concluiu 5 KRs", icon: "✨", check: (s) => s.totalKRsDone >= 5 },
  ten_krs: { name: "Imparável", description: "Concluiu 10 KRs", icon: "🚀", check: (s) => s.totalKRsDone >= 10 },
  twenty_five_krs: { name: "Máquina", description: "Concluiu 25 KRs", icon: "⚙️", check: (s) => s.totalKRsDone >= 25 },
  streak_3: { name: "Sequência!", description: "3 dias consecutivos", icon: "🔥", check: (s) => s.bestStreak >= 3 },
  streak_7: { name: "Semana de Fogo", description: "7 dias consecutivos", icon: "💥", check: (s) => s.bestStreak >= 7 },
  streak_14: { name: "Duas Semanas!", description: "14 dias consecutivos", icon: "⭐", check: (s) => s.bestStreak >= 14 },
  speed_demon: { name: "Velocista", description: "Concluiu um KR em menos de 24h", icon: "⚡", check: (s) => s.hasFastKR },
  level_5: { name: "Diamante", description: "Alcançou nível 5", icon: "💎", check: (s) => s.level >= 5 },
};

export interface GamificationStats {
  xp: number;
  level: number;
  currentStreak: number;
  bestStreak: number;
  totalKRsDone: number;
  hasFastKR: boolean;
  lastActivityDate: string | null;
}

export interface Badge {
  badge_key: string;
  badge_name: string;
  badge_description: string | null;
  badge_icon: string;
  earned_at: string;
}

export function getLevelInfo(xp: number) {
  let current = LEVELS[0];
  for (const l of LEVELS) {
    if (xp >= l.minXP) current = l;
  }
  const next = LEVELS.find((l) => l.minXP > xp);
  const progressToNext = next
    ? ((xp - current.minXP) / (next.minXP - current.minXP)) * 100
    : 100;
  return { ...current, next, progressToNext };
}

export function useGamification() {
  const { user } = useAuth();
  const [stats, setStats] = useState<GamificationStats | null>(null);
  const [badges, setBadges] = useState<Badge[]>([]);
  const [loading, setLoading] = useState(true);

  const loadStats = useCallback(async () => {
    if (!user) return;

    const [gamRes, badgeRes, krRes] = await Promise.all([
      supabase.from("user_gamification").select("*").eq("user_id", user.id).maybeSingle(),
      supabase.from("user_badges").select("*").eq("user_id", user.id),
      supabase.from("key_results").select("id, status, status_changed_at, created_at, assigned_to")
        .eq("assigned_to", user.id).is("deleted_at", null),
    ]);

    const krs = krRes.data || [];
    const doneKRs = krs.filter((kr) => kr.status === "done");
    const hasFastKR = doneKRs.some((kr) => {
      const hours = (new Date(kr.status_changed_at).getTime() - new Date(kr.created_at).getTime()) / 3600000;
      return hours < 24 && hours >= 0;
    });

    const gamData = gamRes.data;
    const currentStats: GamificationStats = {
      xp: gamData?.xp || 0,
      level: gamData?.level || 1,
      currentStreak: gamData?.current_streak || 0,
      bestStreak: gamData?.best_streak || 0,
      totalKRsDone: doneKRs.length,
      hasFastKR,
      lastActivityDate: gamData?.last_activity_date || null,
    };

    setStats(currentStats);
    setBadges((badgeRes.data || []) as Badge[]);
    setLoading(false);

    // Check for new badges
    const earnedKeys = new Set((badgeRes.data || []).map((b: any) => b.badge_key));
    for (const [key, def] of Object.entries(BADGE_DEFS)) {
      if (!earnedKeys.has(key) && def.check(currentStats)) {
        await supabase.from("user_badges").insert({
          user_id: user.id,
          badge_key: key,
          badge_name: def.name,
          badge_description: def.description,
          badge_icon: def.icon,
        });
        toast.success(`🏅 Nova conquista: ${def.name}!`, {
          description: def.description,
          duration: 5000,
        });
      }
    }
  }, [user]);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  const awardXP = useCallback(async (amount: number, action: "complete" | "start") => {
    if (!user || !stats) return;

    const today = new Date().toISOString().split("T")[0];
    const lastDate = stats.lastActivityDate;
    let newStreak = stats.currentStreak;

    if (lastDate) {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split("T")[0];
      if (lastDate === yesterdayStr) {
        newStreak += 1;
      } else if (lastDate !== today) {
        newStreak = 1;
      }
    } else {
      newStreak = 1;
    }

    const streakBonus = newStreak > 1 ? XP_STREAK_BONUS * (newStreak - 1) : 0;
    const totalXP = stats.xp + amount + streakBonus;
    const newLevel = getLevelInfo(totalXP).level;
    const newBestStreak = Math.max(stats.bestStreak, newStreak);

    const updateData = {
      xp: totalXP,
      level: newLevel,
      current_streak: newStreak,
      best_streak: newBestStreak,
      last_activity_date: today,
    };

    // Upsert
    const { error } = await supabase
      .from("user_gamification")
      .upsert({ user_id: user.id, ...updateData }, { onConflict: "user_id" });

    if (!error) {
      // Level up notification
      if (newLevel > stats.level) {
        const info = getLevelInfo(totalXP);
        toast.success(`🎉 Level Up! Nível ${info.level} — ${info.icon} ${info.name}`, {
          duration: 6000,
        });
      }

      // Streak notification
      if (newStreak > 1 && newStreak > stats.currentStreak && streakBonus > 0) {
        toast(`🔥 Streak de ${newStreak} dias! +${streakBonus} XP bônus`, { duration: 3000 });
      }

      // Show XP gain
      const totalGained = amount + streakBonus;
      toast(`+${totalGained} XP`, { duration: 2000 });

      setStats({
        ...stats,
        xp: totalXP,
        level: newLevel,
        currentStreak: newStreak,
        bestStreak: newBestStreak,
        lastActivityDate: today,
      });

      // Recheck badges
      setTimeout(() => loadStats(), 500);
    }
  }, [user, stats, loadStats]);

  const onKRStatusChange = useCallback((newStatus: string) => {
    if (newStatus === "done") {
      awardXP(XP_KR_COMPLETE, "complete");
    } else if (newStatus === "in_progress") {
      awardXP(XP_KR_START, "start");
    }
  }, [awardXP]);

  return { stats, badges, loading, onKRStatusChange, reload: loadStats };
}