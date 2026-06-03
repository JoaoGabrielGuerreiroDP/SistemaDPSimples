import { useMemo, useEffect, useState } from "react";
import { SaleRow } from "@/hooks/useGoogleSheetsData";
import { AlertTriangle, TrendingDown, TrendingUp, Minus, Monitor, Square } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { normalizeName, BROKER_TEAMS } from "@/lib/seller-names";
import { isLeadership } from "@/lib/seller-names";

function formatBRL(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

interface SalesChurnAlertProps {
  rows: SaleRow[];
  getMonthRows: (y: number, m: number) => SaleRow[];
  selectedYear: number;
  selectedMonth: number;
}

interface ChurnRisk {
  name: string;
  currentTotal: number;
  prevTotal: number;
  change: number;
  daysSinceLastSale: number;
  riskLevel: "high" | "medium" | "low";
}

interface YellowCard {
  name: string;
  currentTotal: number;
  goal: number;
  pct: number;
}

export function SalesChurnAlert({ rows, getMonthRows, selectedYear, selectedMonth }: SalesChurnAlertProps) {
  const [individualGoals, setIndividualGoals] = useState<Record<string, number>>({});

  // Load individual goals
  useEffect(() => {
    const mesRef = `${selectedYear}-${String(selectedMonth + 1).padStart(2, "0")}`;
    supabase
      .from("sales_goals_byname")
      .select("broker_name, meta")
      .eq("mes_ref", mesRef)
      .then(({ data }) => {
        const map: Record<string, number> = {};
        (data || []).forEach((r) => {
          map[r.broker_name] = r.meta;
        });
        setIndividualGoals(map);
      });
  }, [selectedYear, selectedMonth]);

  // ─── Yellow Cards: brokers below 70% of goal ───
  const yellowCards = useMemo(() => {
    const brokerTotals: Record<string, number> = {};
    rows.forEach((r) => {
      if (!r.corretor || isLeadership(r.corretor)) return;
      const name = normalizeName(r.corretor);
      if (!BROKER_TEAMS[name]) return;
      brokerTotals[name] = (brokerTotals[name] || 0) + r.valor;
    });

    const cards: YellowCard[] = [];
    Object.entries(individualGoals).forEach(([name, goal]) => {
      if (goal <= 0) return;
      const canonical = normalizeName(name);
      if (!BROKER_TEAMS[canonical]) return;
      const total = brokerTotals[canonical] || 0;
      const pct = (total / goal) * 100;

      if (pct < 70) {
        cards.push({ name: canonical, currentTotal: total, goal, pct });
      }
    });

    return cards.sort((a, b) => a.pct - b.pct);
  }, [rows, individualGoals, selectedYear, selectedMonth]);

  const risks = useMemo(() => {
    const now = new Date();
    const isCurrentMonth = selectedYear === now.getFullYear() && selectedMonth === now.getMonth();
    const currentDay = isCurrentMonth ? now.getDate() : new Date(selectedYear, selectedMonth + 1, 0).getDate();

    let prevY = selectedYear,
      prevM = selectedMonth - 1;
    if (prevM < 0) {
      prevM = 11;
      prevY -= 1;
    }
    const prevRows = getMonthRows(prevY, prevM);
    const prevDaysInMonth = new Date(prevY, prevM + 1, 0).getDate();

    const currentMap: Record<string, { total: number; lastSaleDate: Date | null }> = {};
    rows.forEach((r) => {
      if (!r.corretor || isLeadership(r.corretor)) return;
      if (!currentMap[r.corretor]) currentMap[r.corretor] = { total: 0, lastSaleDate: null };
      currentMap[r.corretor].total += r.valor;
      if (r.dataVenda) {
        const parts = r.dataVenda.split("/");
        if (parts.length >= 3) {
          const d = new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
          if (!currentMap[r.corretor].lastSaleDate || d > currentMap[r.corretor].lastSaleDate!) {
            currentMap[r.corretor].lastSaleDate = d;
          }
        }
      }
    });

    const prevMap: Record<string, number> = {};
    prevRows.forEach((r) => {
      if (!r.corretor || isLeadership(r.corretor)) return;
      prevMap[r.corretor] = (prevMap[r.corretor] || 0) + r.valor;
    });

    const allBrokers = new Set([...Object.keys(currentMap), ...Object.keys(prevMap)]);

    const results: ChurnRisk[] = [];
    allBrokers.forEach((name) => {
      const current = currentMap[name]?.total || 0;
      const prev = prevMap[name] || 0;

      const currentDailyRate = current / currentDay;
      const prevDailyRate = prev / prevDaysInMonth;

      const change = prevDailyRate > 0 ? ((currentDailyRate - prevDailyRate) / prevDailyRate) * 100 : 0;

      const lastSale = currentMap[name]?.lastSaleDate;
      const daysSince = lastSale ? Math.floor((now.getTime() - lastSale.getTime()) / (1000 * 60 * 60 * 24)) : 999;

      let riskLevel: "high" | "medium" | "low" = "low";
      if (change < -50 || daysSince >= 7) riskLevel = "high";
      else if (change < -25 || daysSince >= 4) riskLevel = "medium";

      if (riskLevel !== "low") {
        results.push({ name, currentTotal: current, prevTotal: prev, change, daysSinceLastSale: daysSince, riskLevel });
      }
    });

    return results.sort((a, b) => {
      const riskOrder = { high: 0, medium: 1, low: 2 };
      return riskOrder[a.riskLevel] - riskOrder[b.riskLevel] || a.change - b.change;
    });
  }, [rows, getMonthRows, selectedYear, selectedMonth]);

  if (risks.length === 0 && yellowCards.length === 0) return null;

  const highRisks = risks.filter((r) => r.riskLevel === "high");
  const mediumRisks = risks.filter((r) => r.riskLevel === "medium");

  return (
    <div className="space-y-4 animate-fade-in">
      {/* ─── Yellow Cards: abaixo de 75% da meta ─── */}
      {yellowCards.length > 0 && (
        <div className="glass-card p-3 sm:p-5 space-y-3 border-l-4 border-l-yellow-500">
          <div className="flex items-center gap-2">
            <span className="text-xl">🟨</span>
            <h2 className="font-display text-sm sm:text-lg font-semibold text-foreground">Cartão Amarelo</h2>
            <span className="text-[10px] sm:text-xs bg-yellow-500/20 text-yellow-400 px-1.5 py-0.5 rounded-full font-medium">
              {yellowCards.length} corretor{yellowCards.length > 1 ? "es" : ""}
            </span>
          </div>
          <p className="text-[10px] sm:text-xs text-muted-foreground">
            Corretores abaixo de 70% do ritmo esperado para atingir a meta do mês.
          </p>
          <div className="space-y-2">
            {yellowCards.map((yc) => (
              <div key={yc.name} className="flex items-center justify-between p-2 sm:p-3 rounded-lg bg-yellow-500/5 border border-yellow-500/30">
                <div className="min-w-0">
                  <p className="text-xs sm:text-sm font-medium text-foreground truncate flex items-center gap-1.5">
                    🟨 {yc.name}
                  </p>
                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                    <span className="text-[10px] sm:text-xs text-muted-foreground">
                      Vendido: {formatBRL(yc.currentTotal)}
                    </span>
                    <span className="text-[10px] sm:text-xs text-muted-foreground">
                      Meta: {formatBRL(yc.goal)}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <div className="text-right">
                    <span className={`text-sm sm:text-base font-bold ${yc.pct < 50 ? "text-destructive" : "text-yellow-400"}`}>
                      {yc.pct.toFixed(0)}%
                    </span>
                    <p className="text-[9px] text-muted-foreground">da meta</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ─── VAR: Risco de queda ─── */}
      {risks.length > 0 && (
        <div className="glass-card p-3 sm:p-5 space-y-3 border-l-4 border-l-red-500/60">
          <div className="flex items-center gap-2">
            <Monitor className="w-4 h-4 sm:w-5 sm:h-5 text-yellow-400" />
            <h2 className="font-display text-sm sm:text-lg font-semibold text-foreground">VAR</h2>
            <span className="text-[10px] sm:text-xs bg-yellow-500/20 text-yellow-400 px-1.5 py-0.5 rounded-full font-medium">
              {risks.length} vendedor{risks.length > 1 ? "es" : ""}
            </span>
          </div>

          {highRisks.length > 0 && (
            <div className="space-y-2">
              <p className="text-[10px] sm:text-xs font-medium text-yellow-400 uppercase tracking-wider">
                🟡 Risco Alto de Falta
              </p>
              {highRisks.map((r) => (
                <RiskCard key={r.name} risk={r} />
              ))}
            </div>
          )}

          {mediumRisks.length > 0 && (
            <div className="space-y-2">
              <p className="text-[10px] sm:text-xs font-medium text-amber-400 uppercase tracking-wider">🟡 Atenção</p>
              {mediumRisks.map((r) => (
                <RiskCard key={r.name} risk={r} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function RiskCard({ risk }: { risk: ChurnRisk }) {
  const isDown = risk.change < 0;
  return (
    <div className="flex items-center justify-between p-2 sm:p-3 rounded-lg bg-background/50 border border-border/40">
      <div className="min-w-0">
        <p className="text-xs sm:text-sm font-medium text-foreground truncate">{risk.name}</p>
        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
          <span className="text-[10px] sm:text-xs text-muted-foreground">
            Mês atual: {formatBRL(risk.currentTotal)}
          </span>
          <span className="text-[10px] sm:text-xs text-muted-foreground">Ant: {formatBRL(risk.prevTotal)}</span>
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {risk.daysSinceLastSale < 999 && (
          <span className="text-[9px] sm:text-[10px] text-muted-foreground">{risk.daysSinceLastSale}d sem vender</span>
        )}
        <span
          className={`flex items-center gap-0.5 text-[10px] sm:text-xs font-medium ${isDown ? "text-red-400" : "text-emerald-400"}`}
        >
          {isDown ? <TrendingDown className="w-3 h-3" /> : <TrendingUp className="w-3 h-3" />}
          {Math.abs(risk.change).toFixed(0)}%
        </span>
      </div>
    </div>
  );
}
