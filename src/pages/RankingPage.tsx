import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useGoogleSheetsData } from "@/hooks/useGoogleSheetsData";
import { normalizeName, ALL_BROKERS, isLeadership } from "@/lib/seller-names";
import { Button } from "@/components/ui/button";
import { ArrowLeft, RefreshCw, ChevronLeft, ChevronRight } from "lucide-react";
import { SalesPodium } from "@/components/admin/SalesPodium";
import { WeeklyRanking } from "@/components/admin/WeeklyRanking";
import { SalesHistoricalRanking } from "@/components/admin/SalesHistoricalRanking";
import { TrainingRanking } from "@/components/training/TrainingRanking";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";

const MONTH_NAMES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

function formatBRL(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

export default function RankingPage() {
  const now = new Date();
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth());
  const isCurrentMonth = selectedYear === now.getFullYear() && selectedMonth === now.getMonth();
  const navigate = useNavigate();
  const sheetsData = useGoogleSheetsData();

  const monthRows = useMemo(
    () => sheetsData.getMonthRows(selectedYear, selectedMonth),
    [sheetsData, selectedYear, selectedMonth]
  );
  const monthLabel = `${MONTH_NAMES[selectedMonth]} ${selectedYear}`;

  // Load profiles for avatars
  const { data: profiles } = useQuery({
    queryKey: ["profiles_ranking"],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("user_id, display_name, avatar_url, email");
      return data || [];
    },
  });

  const profileMap = useMemo(() => {
    const map: Record<string, string | null> = {};
    (profiles || []).forEach((p) => {
      if (!p.avatar_url) return;
      // Match by display_name (normalized)
      if (p.display_name) {
        const norm = normalizeName(p.display_name).toLowerCase();
        map[norm] = p.avatar_url;
        map[p.display_name.toLowerCase()] = p.avatar_url;
        // Also map first name (e.g. "Patrick Rex" -> "patrick")
        const first = norm.split(/\s+/)[0];
        if (first && !map[first]) map[first] = p.avatar_url;
      }
      // Match by email local-part (e.g. "cassiobianchi@..." -> "cassio bianchi")
      if (p.email) {
        const local = p.email.split("@")[0].toLowerCase();
        map[local] = p.avatar_url;
      }
    });
    return map;
  }, [profiles]);

  // Lookup helper: try normalized name, then collapsed (no spaces) to match email local-part
  function getAvatar(name: string): string | null {
    const norm = normalizeName(name).toLowerCase();
    if (profileMap[norm]) return profileMap[norm];
    const collapsed = norm.replace(/\s+/g, "");
    if (profileMap[collapsed]) return profileMap[collapsed];
    // Try first name (e.g. spreadsheet "Patrick" matches profile "Patrick Rex")
    const first = norm.split(/\s+/)[0];
    if (first && profileMap[first]) return profileMap[first];
    return profileMap[name.toLowerCase()] || null;
  }

  // Broker ranking (no leadership)
  const brokerRanking = useMemo(() => {
    const map: Record<string, { total: number; count: number }> = {};
    monthRows.forEach((r) => {
      if (!r.corretor || isLeadership(r.corretor)) return;
      const name = normalizeName(r.corretor);
      if (!map[name]) map[name] = { total: 0, count: 0 };
      map[name].total += r.valor;
      map[name].count += 1;
    });
    // Include all known brokers even with zero
    ALL_BROKERS.forEach((name) => {
      if (!map[name] && !isLeadership(name)) map[name] = { total: 0, count: 0 };
    });
    return Object.entries(map)
      .map(([name, { total, count }]) => ({
        name,
        total,
        count,
        avatarUrl: getAvatar(name),
      }))
      .sort((a, b) => b.total - a.total);
  }, [monthRows, profileMap]);

  // Team ranking
  const teamRanking = useMemo(() => {
    const map: Record<string, { total: number; count: number }> = {};
    monthRows.forEach((r) => {
      if (r.corretor && isLeadership(r.corretor)) return;
      const team = r.time || "Sem time";
      if (!map[team]) map[team] = { total: 0, count: 0 };
      map[team].total += r.valor;
      map[team].count += 1;
    });
    return Object.entries(map)
      .map(([name, { total, count }]) => ({ name, total, count }))
      .sort((a, b) => b.total - a.total);
  }, [monthRows]);

  // Leadership data
  const leadershipData = useMemo(() => {
    const map: Record<string, { total: number; count: number }> = {};
    monthRows.forEach((r) => {
      if (!r.corretor || !isLeadership(r.corretor)) return;
      if (!map[r.corretor]) map[r.corretor] = { total: 0, count: 0 };
      map[r.corretor].total += r.valor;
      map[r.corretor].count += 1;
    });
    return Object.entries(map)
      .map(([name, { total, count }]) => ({
        name,
        total,
        count,
        avatarUrl: getAvatar(name),
      }))
      .sort((a, b) => b.total - a.total);
  }, [monthRows, profileMap]);

  function goToPrevMonth() {
    if (selectedMonth === 0) { setSelectedMonth(11); setSelectedYear((y) => y - 1); }
    else { setSelectedMonth((m) => m - 1); }
  }
  function goToNextMonth() {
    if (selectedMonth === 11) { setSelectedMonth(0); setSelectedYear((y) => y + 1); }
    else { setSelectedMonth((m) => m + 1); }
  }
  function goToCurrentMonth() {
    setSelectedYear(now.getFullYear());
    setSelectedMonth(now.getMonth());
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-6xl mx-auto px-3 sm:px-4 py-4 sm:py-12 space-y-4 sm:space-y-6">
        {/* Header */}
        <div className="flex items-start sm:items-center justify-between gap-2">
           <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <div className="min-w-0">
              <h1 className="font-display text-base sm:text-3xl font-bold text-foreground tracking-tight truncate">
                Ranking
              </h1>
              <p className="text-[10px] sm:text-sm text-muted-foreground truncate">
                Rankings de vendas, times e treinamento
              </p>
            </div>
          </div>
          <Button variant="outline" size="sm" className="shrink-0 text-[11px] sm:text-sm h-7 sm:h-9 px-2 sm:px-3" onClick={() => sheetsData.reload?.()} disabled={sheetsData.loading}>
            <RefreshCw className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${sheetsData.loading ? "animate-spin" : ""}`} />
            <span className="hidden sm:inline ml-1">Atualizar</span>
          </Button>
        </div>

        {/* Month Selector */}
        <div className="glass-card p-3 sm:p-4 flex items-center justify-between">
          <Button variant="ghost" size="icon" className="h-8 w-8 sm:h-10 sm:w-10" onClick={goToPrevMonth}>
            <ChevronLeft className="w-4 h-4 sm:w-5 sm:h-5" />
          </Button>
          <div className="flex items-center gap-2 sm:gap-3">
            <span className="font-display text-sm sm:text-lg font-semibold text-foreground">
              {MONTH_NAMES[selectedMonth]} {selectedYear}
            </span>
            {!isCurrentMonth && (
              <Button variant="outline" size="sm" onClick={goToCurrentMonth} className="text-[10px] sm:text-xs h-6 sm:h-8 px-2">
                Ir para Mês Atual
              </Button>
            )}
          </div>
          <Button variant="ghost" size="icon" className="h-8 w-8 sm:h-10 sm:w-10" onClick={goToNextMonth} disabled={isCurrentMonth}>
            <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5" />
          </Button>
        </div>

        {/* Ranking de Times */}
        <SalesPodium ranking={teamRanking} title="Ranking de Times" icon="medal" showCotas />

        {/* Ranking (Corretores) */}
        <SalesPodium ranking={brokerRanking} title={`Ranking — ${monthLabel}`} showCotas />

        {/* Ranking Histórico */}
        <SalesHistoricalRanking
          selectedYear={selectedYear}
          selectedMonth={selectedMonth}
          getMonthRows={sheetsData.getMonthRows}
        />

        {/* Ranking Liderança */}
        {leadershipData.length > 0 && (
          <div className="glass-card p-3 sm:p-5 space-y-3 animate-fade-in">
            <div className="flex items-center gap-2">
              <span className="text-base">👔</span>
              <h2 className="font-display text-sm sm:text-lg font-semibold text-foreground">Ranking Liderança — {monthLabel}</h2>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:gap-3">
              {leadershipData.map((leader) => {
                const initials = leader.name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
                return (
                  <div key={leader.name} className="glass-card p-3 sm:p-4 flex items-center gap-3 border border-border/30">
                    <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-primary/20 border-2 border-primary/40 flex items-center justify-center overflow-hidden shrink-0">
                      {leader.avatarUrl ? (
                        <img src={leader.avatarUrl} alt={leader.name} className="w-full h-full object-cover rounded-full" />
                      ) : (
                        <span className="text-xs font-bold text-primary">{initials}</span>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs sm:text-sm font-semibold text-foreground truncate">{leader.name}</p>
                      <p className="text-xs sm:text-sm font-bold text-primary">{formatBRL(leader.total)}</p>
                      <p className="text-[9px] sm:text-[10px] text-muted-foreground">{leader.count} proposta{leader.count !== 1 ? "s" : ""}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Ranking da Semana */}
        <WeeklyRanking rows={monthRows} selectedYear={selectedYear} selectedMonth={selectedMonth} />

        {/* Ranking de Alunos */}
        <TrainingRanking />
      </div>
    </div>
  );
}
