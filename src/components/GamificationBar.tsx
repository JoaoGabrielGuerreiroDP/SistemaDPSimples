import { getLevelInfo, type Badge } from "@/hooks/useGamification";
import { ProgressBar } from "./ProgressBar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

interface GamificationBarProps {
  xp: number;
  level: number;
  currentStreak: number;
  badges: Badge[];
}

export function GamificationBar({ xp, level, currentStreak, badges }: GamificationBarProps) {
  const info = getLevelInfo(xp);

  return (
    <div className="glass-card border border-primary/20 p-4 space-y-3">
      {/* Level + XP row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xl">{info.icon}</span>
          <div>
            <p className="text-sm font-semibold text-foreground">
              Nível {info.level} — {info.name}
            </p>
            <p className="text-[10px] text-muted-foreground">
              {xp} XP total
              {info.next && ` · ${info.next.minXP - xp} XP para ${info.next.name}`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {currentStreak > 0 && (
            <span className="text-xs font-bold text-foreground bg-destructive/15 px-2 py-0.5 rounded-full flex items-center gap-1">
              🔥 {currentStreak}d
            </span>
          )}
        </div>
      </div>

      {/* XP progress bar */}
      {info.next && (
        <ProgressBar value={Math.round(info.progressToNext)} size="sm" />
      )}

      {/* Badges */}
      {badges.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {badges.map((b) => (
            <Popover key={b.badge_key}>
              <PopoverTrigger asChild>
                <button
                  className={cn(
                    "text-lg hover:scale-125 transition-transform cursor-pointer",
                    "focus:outline-none"
                  )}
                  title={b.badge_name}
                >
                  {b.badge_icon}
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-48 p-3" side="top">
                <p className="text-sm font-semibold text-foreground">{b.badge_name}</p>
                <p className="text-xs text-muted-foreground">{b.badge_description}</p>
              </PopoverContent>
            </Popover>
          ))}
        </div>
      )}
    </div>
  );
}