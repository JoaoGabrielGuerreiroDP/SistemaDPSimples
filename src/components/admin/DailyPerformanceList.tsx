import { useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useGoogleSheetsData } from "@/hooks/useGoogleSheetsData";
import { usePiperunActivities, usePiperunUsers } from "@/hooks/usePiperunData";
import { useTeamFilter } from "@/hooks/useTeamFilter";
import { normalizeName, BROKER_TEAMS, isLeadership } from "@/lib/seller-names";
import { CalendarDays, TrendingUp, Trophy, Phone, Users2, Handshake } from "lucide-react";

function formatCurrency(val: number) {
  return val.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
}

interface DaySeller {
  name: string;
  team: string;
  count: number;
  total: number;
}

interface DayData {
  label: string;
  date: string;
  sellers: DaySeller[];
  totalValue: number;
  totalCount: number;
  prospections: number;
  meetings: number;
}

const TEAM_DOT_COLORS: Record<string, string> = {
  Swat: "bg-red-500",
  "The Closers": "bg-blue-500",
  Efraim: "bg-emerald-500",
  Hub: "bg-purple-500",
};

export default function DailyPerformanceList() {
  const { allRows } = useGoogleSheetsData();
  const { matchesTeam } = useTeamFilter();
  const { data: piperunActivitiesData } = usePiperunActivities("200");
  const { data: piperunUsersData } = usePiperunUsers();

  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  // Build piperun user id → name map
  const piperunIdToName = useMemo(() => {
    const map = new Map<number, string>();
    const users = piperunUsersData?.data || piperunUsersData?.items || [];
    if (Array.isArray(users)) {
      users.forEach((u: any) => {
        const raw = (u.name || u.nome || "").trim();
        if (!raw || isLeadership(raw)) return;
        map.set(u.id, normalizeName(raw));
      });
    }
    return map;
  }, [piperunUsersData]);

  // Group piperun activities by day (prospections type 1/2, meetings type 3)
  const activityByDay = useMemo(() => {
    const map: Record<string, { prospections: number; meetings: number }> = {};
    const activities = piperunActivitiesData?.data || [];
    if (!Array.isArray(activities)) return map;

    activities.forEach((act: any) => {
      const startAt = act.start_at || act.created_at || "";
      const actDate = new Date(startAt.replace(" ", "T"));
      if (isNaN(actDate.getTime())) return;
      if (actDate.getFullYear() !== currentYear || actDate.getMonth() !== currentMonth) return;

      const sellerName = piperunIdToName.get(act.owner_id);
      if (!sellerName || !matchesTeam(sellerName)) return;

      const dateKey = `${actDate.getFullYear()}-${String(actDate.getMonth() + 1).padStart(2, "0")}-${String(actDate.getDate()).padStart(2, "0")}`;
      if (!map[dateKey]) map[dateKey] = { prospections: 0, meetings: 0 };

      const actType = act.type;
      if (actType === 1 || actType === 2) {
        map[dateKey].prospections++;
      } else if (actType === 3) {
        map[dateKey].meetings++;
      }
    });

    return map;
  }, [piperunActivitiesData, piperunIdToName, currentMonth, currentYear, matchesTeam]);

  const dailyData = useMemo(() => {
    const dayMap: Record<string, Record<string, DaySeller>> = {};

    for (const row of allRows) {
      if (!row.dataVenda || !row.corretor) continue;
      const parts = String(row.dataVenda).split("/");
      if (parts.length < 3) continue;
      const d = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10) - 1;
      const y = parseInt(parts[2], 10);
      const fullYear = y < 100 ? 2000 + y : y;
      if (m !== currentMonth || fullYear !== currentYear) continue;

      const seller = normalizeName(row.corretor);
      if (isLeadership(seller) || !matchesTeam(seller)) continue;

      const dateKey = `${fullYear}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      if (!dayMap[dateKey]) dayMap[dateKey] = {};
      if (!dayMap[dateKey][seller]) {
        dayMap[dateKey][seller] = {
          name: seller,
          team: BROKER_TEAMS[seller] || "—",
          count: 0,
          total: 0,
        };
      }
      dayMap[dateKey][seller].count++;
      dayMap[dateKey][seller].total += row.valor || 0;
    }

    const days: DayData[] = Object.entries(dayMap)
      .map(([dateKey, sellersMap]) => {
        const sellers = Object.values(sellersMap).sort((a, b) => b.total - a.total);
        const [y, m, d] = dateKey.split("-").map(Number);
        const dateObj = new Date(y, m - 1, d);
        const weekday = dateObj.toLocaleDateString("pt-BR", { weekday: "short" });
        const acts = activityByDay[dateKey] || { prospections: 0, meetings: 0 };
        return {
          label: `${weekday}, ${d}/${m}`,
          date: dateKey,
          sellers,
          totalValue: sellers.reduce((s, x) => s + x.total, 0),
          totalCount: sellers.reduce((s, x) => s + x.count, 0),
          prospections: acts.prospections,
          meetings: acts.meetings,
        };
      })
      .sort((a, b) => b.date.localeCompare(a.date));

    return days;
  }, [allRows, currentMonth, currentYear, matchesTeam, activityByDay]);

  if (dailyData.length === 0) return null;

  const totalProspections = dailyData.reduce((s, d) => s + d.prospections, 0);
  const totalMeetings = dailyData.reduce((s, d) => s + d.meetings, 0);

  return (
    <Card className="border-border/30 bg-card/80">
      <CardContent className="p-4 sm:p-5 space-y-4">
        <div className="flex items-center gap-2">
          <CalendarDays className="w-4 h-4 text-primary" />
          <span className="text-xs font-bold uppercase tracking-wide text-foreground">
            Desempenho Diário
          </span>
          <Badge variant="secondary" className="text-[10px]">
            {dailyData.length} dias
          </Badge>
        </div>

        <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
          {dailyData.map((day) => (
            <div key={day.date} className="rounded-xl border border-border/30 bg-card/60 overflow-hidden">
              {/* Day header */}
              <div className="flex items-center justify-between px-3 py-2 bg-muted/20 border-b border-border/20">
                <span className="text-xs font-bold text-foreground capitalize">{day.label}</span>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-[10px] border-primary/30 text-primary">
                    {day.totalCount} venda{day.totalCount !== 1 ? "s" : ""}
                  </Badge>
                  <span className="text-xs font-bold text-emerald-500">{formatCurrency(day.totalValue)}</span>
                </div>
              </div>

              {/* Activity counters row */}
              {(day.prospections > 0 || day.meetings > 0) && (
                <div className="flex items-center gap-4 px-3 py-1.5 bg-muted/10 border-b border-border/10">
                  {day.prospections > 0 && (
                    <div className="flex items-center gap-1">
                      <Phone className="w-3 h-3 text-blue-400" />
                      <span className="text-[10px] text-muted-foreground">
                        {day.prospections} prospecç{day.prospections !== 1 ? "ões" : "ão"}
                      </span>
                    </div>
                  )}
                  {day.meetings > 0 && (
                    <div className="flex items-center gap-1">
                      <Users2 className="w-3 h-3 text-violet-400" />
                      <span className="text-[10px] text-muted-foreground">
                        {day.meetings} reuniã{day.meetings !== 1 ? "es" : "o"}
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* Seller rows */}
              <div className="divide-y divide-border/10">
                {day.sellers.map((seller, idx) => (
                  <div
                    key={seller.name}
                    className={`flex items-center justify-between px-3 py-2 ${idx === 0 && day.sellers.length > 1 ? "bg-amber-500/5" : ""}`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      {idx === 0 && day.sellers.length > 1 && (
                        <Trophy className="w-3 h-3 text-amber-500 shrink-0" />
                      )}
                      <div className={`w-2 h-2 rounded-full shrink-0 ${TEAM_DOT_COLORS[seller.team] || "bg-muted-foreground"}`} />
                      <span className="text-xs font-medium text-foreground truncate">
                        {seller.name.split(" ")[0]}
                      </span>
                      <span className="text-[9px] text-muted-foreground shrink-0">
                        {seller.team}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-[10px] text-muted-foreground">{seller.count}x</span>
                      <span className="text-xs font-bold text-foreground min-w-[70px] text-right">
                        {formatCurrency(seller.total)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Monthly cumulative summary */}
        {dailyData.length > 0 && (
          <div className="flex flex-col gap-2 pt-2 border-t border-border/30 text-xs">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <TrendingUp className="w-3.5 h-3.5" />
                <span>Total mês</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-muted-foreground">
                  {dailyData.reduce((s, d) => s + d.totalCount, 0)} vendas
                </span>
                <span className="font-bold text-foreground">
                  {formatCurrency(dailyData.reduce((s, d) => s + d.totalValue, 0))}
                </span>
              </div>
            </div>
            {(totalProspections > 0 || totalMeetings > 0) && (
              <div className="flex items-center gap-4">
                {totalProspections > 0 && (
                  <div className="flex items-center gap-1 text-muted-foreground">
                    <Phone className="w-3 h-3 text-blue-400" />
                    <span>{totalProspections} prospecções</span>
                  </div>
                )}
                {totalMeetings > 0 && (
                  <div className="flex items-center gap-1 text-muted-foreground">
                    <Users2 className="w-3 h-3 text-violet-400" />
                    <span>{totalMeetings} reuniões</span>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
