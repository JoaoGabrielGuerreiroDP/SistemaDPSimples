import { useMemo, useState, useEffect } from "react";
import { SaleRow } from "@/hooks/useGoogleSheetsData";
import { Flame, TrendingUp, Pencil, Check, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { isLeadership, normalizeName } from "@/lib/seller-names";

function formatBRL(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

function parseBRDate(raw: string): Date | null {
  if (!raw) return null;
  const parts = raw.split("/");
  if (parts.length !== 3) return null;
  const [day, month, year] = parts.map(Number);
  return new Date(year, month - 1, day);
}

function getWeekRange(date: Date): { start: Date; end: Date; label: string; key: string } {
  const d = new Date(date);
  const dayOfWeek = d.getDay();
  const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;

  const monday = new Date(d);
  monday.setDate(d.getDate() + diffToMonday);
  monday.setHours(0, 0, 0, 0);

  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);

  const fmt = (dt: Date) => `${dt.getDate().toString().padStart(2, "0")}/${(dt.getMonth() + 1).toString().padStart(2, "0")}`;
  const label = `${fmt(monday)} — ${fmt(sunday)}`;
  const key = `week_${monday.getFullYear()}-${String(monday.getMonth() + 1).padStart(2, "0")}-${String(monday.getDate()).padStart(2, "0")}`;

  return { start: monday, end: sunday, label, key };
}

interface WeeklyRankingProps {
  rows: SaleRow[];
  selectedYear: number;
  selectedMonth: number;
}

export function WeeklyRanking({ rows, selectedYear, selectedMonth }: WeeklyRankingProps) {
  const now = new Date();
  const { start, end, label, key: weekKey } = useMemo(() => getWeekRange(now), []);
  const { isGestor } = useUserRole();

  // Weekly meta from sales_goals
  const [weeklyMeta, setWeeklyMeta] = useState<number>(0);
  const [editing, setEditing] = useState(false);
  const [inputValue, setInputValue] = useState("");

  useEffect(() => {
    supabase.from("sales_goals").select("meta").eq("mes_ref", weekKey).maybeSingle().then(({ data }) => {
      setWeeklyMeta(data?.meta ? Number(data.meta) : 0);
    });
  }, [weekKey]);

  const handleSave = async () => {
    const newMeta = parseFloat(inputValue.replace(/\./g, "").replace(",", "."));
    if (isNaN(newMeta) || newMeta < 0) {
      toast.error("Valor inválido");
      return;
    }
    const { error } = await supabase
      .from("sales_goals")
      .upsert({ mes_ref: weekKey, meta: newMeta }, { onConflict: "mes_ref" });
    if (error) {
      toast.error("Erro ao salvar meta", { description: error.message });
      return;
    }
    setWeeklyMeta(newMeta);
    setEditing(false);
    toast.success("Meta semanal atualizada!");
  };

  const startEditing = () => {
    setInputValue(weeklyMeta > 0 ? weeklyMeta.toLocaleString("pt-BR", { maximumFractionDigits: 0 }) : "");
    setEditing(true);
  };

  // Total week = ALL sales (including leadership)
  const weekTotal = useMemo(() => {
    return rows.filter((r) => {
      const d = parseBRDate(r.dataVenda);
      if (!d) return false;
      return d >= start && d <= end;
    }).reduce((s, r) => s + r.valor, 0);
  }, [rows, start, end]);

  // Ranking = only non-leadership
  const ranking = useMemo(() => {
    const weekRows = rows.filter((r) => {
      if (!r.corretor || isLeadership(r.corretor)) return false;
      const d = parseBRDate(r.dataVenda);
      if (!d) return false;
      return d >= start && d <= end;
    });

    const map: Record<string, { total: number; count: number }> = {};
    weekRows.forEach((r) => {
      const key = normalizeName(r.corretor);
      if (!map[key]) map[key] = { total: 0, count: 0 };
      map[key].total += r.valor;
      map[key].count += 1;
    });

    return Object.entries(map)
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);
  }, [rows, start, end]);

  if (ranking.length === 0 && weekTotal === 0) return null;

  const medals = ["🥇", "🥈", "🥉"];
  const weekPct = weeklyMeta > 0 ? (weekTotal / weeklyMeta) * 100 : 0;

  return (
    <div className="glass-card p-3 sm:p-5 space-y-3 animate-fade-in">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Flame className="w-4 h-4 sm:w-5 sm:h-5 text-orange-400" />
          <h2 className="font-display text-sm sm:text-lg font-semibold text-foreground">
            Ranking da Semana
          </h2>
        </div>
        <span className="text-[9px] sm:text-[10px] text-muted-foreground font-medium px-1.5 py-0.5 rounded-full bg-muted/50 border border-border/40">
          Seg–Dom · {label}
        </span>
      </div>

      {/* Weekly totals & meta */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-1.5">
          <TrendingUp className="w-3.5 h-3.5 text-primary" />
          <span className="text-[10px] sm:text-xs text-muted-foreground">Total:</span>
          <span className="text-xs sm:text-sm font-bold text-primary">{formatBRL(weekTotal)}</span>
        </div>

        {!editing && (
          <>
            <span className="text-muted-foreground/40">·</span>
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] sm:text-xs text-muted-foreground">Meta:</span>
              <span className="text-xs sm:text-sm font-semibold text-foreground">
                {weeklyMeta > 0 ? formatBRL(weeklyMeta) : "—"}
              </span>
              {isGestor && (
                <Button variant="ghost" size="icon" className="h-5 w-5" onClick={startEditing}>
                  <Pencil className="w-3 h-3 text-muted-foreground" />
                </Button>
              )}
            </div>
            {weeklyMeta > 0 && (
              <span className={`text-[10px] sm:text-xs font-bold px-1.5 py-0.5 rounded-full ${
                weekPct >= 100
                  ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/20"
                  : weekPct >= 70
                  ? "bg-amber-500/15 text-amber-400 border border-amber-500/20"
                  : "bg-muted/50 text-muted-foreground border border-border/40"
              }`}>
                {weekPct.toFixed(0)}%
              </span>
            )}
          </>
        )}
      </div>

      {/* Edit meta inline */}
      {editing && (
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">R$</span>
          <Input
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="Ex: 3000000"
            className="h-7 text-xs flex-1"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSave();
              if (e.key === "Escape") setEditing(false);
            }}
          />
          <Button variant="ghost" size="icon" className="h-6 w-6 text-primary" onClick={handleSave}>
            <Check className="w-3.5 h-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => setEditing(false)}>
            <X className="w-3.5 h-3.5" />
          </Button>
        </div>
      )}

      {/* Progress bar */}
      {weeklyMeta > 0 && !editing && (
        <div className="h-1.5 rounded-full bg-muted/30 overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${Math.min(weekPct, 100)}%`,
              background: weekPct >= 100
                ? "linear-gradient(90deg, hsl(150, 60%, 45%), hsl(150, 70%, 50%))"
                : weekPct >= 70
                ? "linear-gradient(90deg, hsl(45, 85%, 50%), hsl(30, 90%, 55%))"
                : "hsl(215, 60%, 50%)",
            }}
          />
        </div>
      )}

      <div className="space-y-1.5">
        {ranking.map((r, i) => {
          const pctOfFirst = ranking[0].total > 0 ? (r.total / ranking[0].total) * 100 : 0;
          return (
            <div key={r.name} className="flex items-center gap-2 sm:gap-3">
              <span className="w-6 text-center text-sm">
                {i < 3 ? medals[i] : <span className="text-[10px] text-muted-foreground font-bold">{i + 1}º</span>}
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-0.5">
                  <span className="text-xs sm:text-sm font-medium text-foreground truncate">{r.name}</span>
                  <div className="flex items-center gap-1.5 shrink-0 ml-2">
                    <span className="text-[9px] sm:text-[10px] text-muted-foreground">{r.count}x</span>
                    <span className="text-xs sm:text-sm font-semibold text-primary">{formatBRL(r.total)}</span>
                  </div>
                </div>
                <div className="h-1.5 rounded-full bg-muted/30 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${pctOfFirst}%`,
                      background: i === 0
                        ? "linear-gradient(90deg, hsl(45, 85%, 50%), hsl(30, 90%, 55%))"
                        : i === 1
                        ? "linear-gradient(90deg, hsl(215, 12%, 45%), hsl(215, 12%, 55%))"
                        : "hsl(215, 12%, 30%)",
                    }}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
