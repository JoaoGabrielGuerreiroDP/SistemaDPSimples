import { useMemo } from "react";
import { SaleRow } from "@/hooks/useGoogleSheetsData";
import { Zap } from "lucide-react";

function parseBRDate(raw: string): Date | null {
  if (!raw) return null;
  const parts = raw.split("/");
  if (parts.length !== 3) return null;
  const [day, month, year] = parts.map(Number);
  return new Date(year, month - 1, day);
}

function formatDate(d: Date) {
  return `${d.getDate().toString().padStart(2, "0")}/${(d.getMonth() + 1).toString().padStart(2, "0")}`;
}

interface SalesStreakCardProps {
  rows: SaleRow[];
}

export function SalesStreakCard({ rows }: SalesStreakCardProps) {
  const { currentStreak, bestStreak, lastSaleDate } = useMemo(() => {
    // Collect unique sale dates (as YYYY-MM-DD strings)
    const dateSet = new Set<string>();
    rows.forEach((r) => {
      const d = parseBRDate(r.dataVenda);
      if (d) {
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
        dateSet.add(key);
      }
    });

    if (dateSet.size === 0) return { currentStreak: 0, bestStreak: 0, lastSaleDate: null };

    // Sort dates descending
    const sorted = Array.from(dateSet).sort().reverse();

    // Current streak: count consecutive days ending at today or yesterday
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);

    const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
    const yesterdayKey = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, "0")}-${String(yesterday.getDate()).padStart(2, "0")}`;

    let current = 0;
    // Start counting from today or yesterday
    const startFrom = dateSet.has(todayKey) ? today : dateSet.has(yesterdayKey) ? yesterday : null;

    if (startFrom) {
      const cursor = new Date(startFrom);
      while (true) {
        const k = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}-${String(cursor.getDate()).padStart(2, "0")}`;
        // Skip Sunday (0) — Saturday counts as a sales day
        const dow = cursor.getDay();
        if (dow === 0) {
          cursor.setDate(cursor.getDate() - 1);
          continue;
        }
        if (dateSet.has(k)) {
          current++;
          cursor.setDate(cursor.getDate() - 1);
        } else {
          break;
        }
      }
    }

    // Best streak (working days only)
    let best = 0;
    let tempStreak = 0;
    // Sort ascending for best streak calc
    const asc = Array.from(dateSet).sort();
    for (let i = 0; i < asc.length; i++) {
      if (i === 0) {
        tempStreak = 1;
      } else {
        // Check if this date is the next working day after previous
        const prev = new Date(asc[i - 1]);
        const curr = new Date(asc[i]);
        const expected = new Date(prev);
        expected.setDate(expected.getDate() + 1);
        // Skip only Sunday
        while (expected.getDay() === 0) {
          expected.setDate(expected.getDate() + 1);
        }
        if (curr.getTime() === expected.getTime()) {
          tempStreak++;
        } else {
          tempStreak = 1;
        }
      }
      if (tempStreak > best) best = tempStreak;
    }

    const lastDate = new Date(sorted[0]);

    return { currentStreak: current, bestStreak: best, lastSaleDate: lastDate };
  }, [rows]);

  if (currentStreak === 0 && bestStreak === 0) return null;

  // Fire levels based on streak
  const fireLevel = currentStreak >= 10 ? 3 : currentStreak >= 5 ? 2 : currentStreak >= 1 ? 1 : 0;
  const fireColors = [
    "text-muted-foreground",
    "text-amber-400",
    "text-orange-400",
    "text-red-400",
  ];

  return (
    <div className="glass-card p-3 sm:p-5 animate-fade-in">
      <div className="flex items-center gap-3">
        <div className={`flex items-center justify-center w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-muted/30 border border-border/40 ${fireColors[fireLevel]}`}>
          <Zap className="w-5 h-5 sm:w-6 sm:h-6" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-display text-xl sm:text-2xl font-bold text-foreground">
              {currentStreak}
            </span>
            <span className="text-xs sm:text-sm text-muted-foreground">
              {currentStreak === 1 ? "dia" : "dias"} consecutivos com vendas
            </span>
          </div>
          <div className="flex items-center gap-3 mt-0.5">
            <span className="text-[10px] sm:text-xs text-muted-foreground">
              🏆 Recorde: <span className="font-semibold text-foreground">{bestStreak} dias</span>
            </span>
            {lastSaleDate && (
              <span className="text-[10px] sm:text-xs text-muted-foreground">
                Última venda: {formatDate(lastSaleDate)}
              </span>
            )}
          </div>
        </div>
        {/* Flame indicators */}
        <div className="flex gap-0.5">
          {[...Array(Math.min(currentStreak, 5))].map((_, i) => (
            <span key={i} className="text-sm sm:text-base">🔥</span>
          ))}
        </div>
      </div>
    </div>
  );
}
