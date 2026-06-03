import { useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { useGoogleSheetsData } from "@/hooks/useGoogleSheetsData";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { normalizeName, BROKER_TEAMS, ALL_BROKERS } from "@/lib/seller-names";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar } from "recharts";
import { Trophy, Users, Target, TrendingUp } from "lucide-react";

const TEAM_COLORS: Record<string, string> = {
  Swat: "#ef4444",
  "The Closers": "#3b82f6",
  Efraim: "#10b981",
};

const TEAMS = ["Swat", "The Closers", "Efraim"] as const;

function formatCurrency(val: number) {
  return val.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
}

export default function TeamComparisonChart() {
  const { allRows } = useGoogleSheetsData();

  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();
  const mesRef = `${currentYear}-${String(currentMonth + 1).padStart(2, "0")}`;

  const { data: individualGoals } = useQuery({
    queryKey: ["sales_goals_byname_teams", mesRef],
    queryFn: async () => {
      const { data } = await supabase.from("sales_goals_byname").select("*").eq("mes_ref", mesRef);
      return data || [];
    },
  });

  const { data: crmData } = useQuery({
    queryKey: ["crm_conv_teams"],
    queryFn: async () => {
      const { data } = await supabase.from("crm_prospections").select("seller_name, stage");
      return data || [];
    },
  });

  const teamStats = useMemo(() => {
    // Sales this month per broker
    const salesByBroker: Record<string, { count: number; credits: number }> = {};
    for (const row of allRows) {
      if (!row.dataVenda) continue;
      const parts = String(row.dataVenda).split("/");
      if (parts.length < 3) continue;
      const m = parseInt(parts[1], 10) - 1;
      const y = parseInt(parts[2], 10);
      const fullYear = y < 100 ? 2000 + y : y;
      if (m === currentMonth && fullYear === currentYear) {
        const seller = normalizeName(row.corretor || "");
        if (seller && ALL_BROKERS.includes(seller)) {
          if (!salesByBroker[seller]) salesByBroker[seller] = { count: 0, credits: 0 };
          salesByBroker[seller].count++;
          salesByBroker[seller].credits += row.valor || 0;
        }
      }
    }

    // Conversion per broker from CRM
    const convByBroker: Record<string, { total: number; won: number }> = {};
    for (const row of crmData || []) {
      if (!row.seller_name) continue;
      const name = normalizeName(row.seller_name);
      if (!convByBroker[name]) convByBroker[name] = { total: 0, won: 0 };
      convByBroker[name].total++;
      if (row.stage === "closedwon") convByBroker[name].won++;
    }

    return TEAMS.map((team) => {
      const members = ALL_BROKERS.filter((b) => BROKER_TEAMS[b] === team);
      let totalSales = 0;
      let totalCredits = 0;
      let totalMeta = 0;
      let totalProsp = 0;
      let totalWon = 0;

      for (const name of members) {
        const s = salesByBroker[name];
        if (s) {
          totalSales += s.count;
          totalCredits += s.credits;
        }
        const goal = (individualGoals || []).find((g) => normalizeName(g.broker_name) === name);
        totalMeta += goal?.meta || 0;
        const conv = convByBroker[name];
        if (conv) {
          totalProsp += conv.total;
          totalWon += conv.won;
        }
      }

      const convRate = totalProsp > 0 ? (totalWon / totalProsp) * 100 : 0;
      const goalPct = totalMeta > 0 ? (totalCredits / totalMeta) * 100 : 0;
      const avgTicket = totalSales > 0 ? totalCredits / totalSales : 0;

      return {
        team,
        members: members.length,
        sales: totalSales,
        credits: totalCredits,
        meta: totalMeta,
        goalPct: Math.round(goalPct),
        convRate: Math.round(convRate * 10) / 10,
        avgTicket,
        prospections: totalProsp,
        salesPerMember: members.length > 0 ? Math.round((totalSales / members.length) * 10) / 10 : 0,
      };
    });
  }, [allRows, currentMonth, currentYear, individualGoals, crmData]);

  // Bar chart data
  const barData = teamStats.map((t) => ({
    name: t.team,
    Vendas: t.credits,
    Meta: t.meta,
  }));

  // Radar chart data (normalized 0-100)
  const maxSales = Math.max(...teamStats.map((t) => t.salesPerMember), 1);
  const maxConv = Math.max(...teamStats.map((t) => t.convRate), 1);
  const maxTicket = Math.max(...teamStats.map((t) => t.avgTicket), 1);

  const radarData = [
    {
      metric: "Meta %",
      ...Object.fromEntries(teamStats.map((t) => [t.team, Math.min(t.goalPct, 100)])),
    },
    {
      metric: "Vendas/membro",
      ...Object.fromEntries(teamStats.map((t) => [t.team, Math.round((t.salesPerMember / maxSales) * 100)])),
    },
    {
      metric: "Conversão",
      ...Object.fromEntries(teamStats.map((t) => [t.team, Math.round((t.convRate / maxConv) * 100)])),
    },
    {
      metric: "Ticket Médio",
      ...Object.fromEntries(teamStats.map((t) => [t.team, Math.round((t.avgTicket / maxTicket) * 100)])),
    },
  ];

  // Winner
  const winner = [...teamStats].sort((a, b) => b.credits - a.credits)[0];

  return (
    <Card className="border-border/30 bg-card/80">
      <CardContent className="p-4 sm:p-5 space-y-5">
        <div className="flex items-center gap-2">
          <Trophy className="w-4 h-4 text-primary" />
          <span className="text-xs font-bold uppercase tracking-wide text-foreground">
            Comparativo de Times
          </span>
        </div>

        {/* Team summary cards */}
        <div className="grid grid-cols-3 gap-2">
          {teamStats.map((t) => {
            const isWinner = t.team === winner?.team && t.credits > 0;
            return (
              <div
                key={t.team}
                className={`rounded-xl border-2 p-3 space-y-1.5 transition-all ${
                  isWinner
                    ? "border-amber-500/50 bg-amber-500/5"
                    : "border-border/30 bg-card/60"
                }`}
              >
                <div className="flex items-center gap-1.5">
                  {isWinner && <Trophy className="w-3.5 h-3.5 text-amber-500 shrink-0" />}
                  <span
                    className="text-[11px] font-bold truncate"
                    style={{ color: TEAM_COLORS[t.team] }}
                  >
                    {t.team}
                  </span>
                </div>
                <p className="text-lg font-black text-foreground leading-tight">
                  {formatCurrency(t.credits)}
                </p>
                <div className="space-y-0.5 text-[10px] text-muted-foreground">
                  <div className="flex justify-between">
                    <span>{t.sales} vendas</span>
                    <span>{t.members} membros</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Meta: {t.goalPct}%</span>
                    <span>Conv: {t.convRate}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Ticket: {formatCurrency(t.avgTicket)}</span>
                    <span>{t.salesPerMember} v/membro</span>
                  </div>
                </div>
                {/* Goal progress bar */}
                <div className="w-full h-1.5 rounded-full bg-muted/50 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${Math.min(t.goalPct, 100)}%`,
                      backgroundColor: TEAM_COLORS[t.team],
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>

        {/* Bar chart: vendas vs meta */}
        <div>
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2">
            Vendas vs Meta (R$)
          </p>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barData} barGap={4}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                <YAxis tick={{ fontSize: 9 }} stroke="hsl(var(--muted-foreground))" tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                    fontSize: 11,
                  }}
                  formatter={(value: number) => formatCurrency(value)}
                />
                <Bar dataKey="Vendas" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Meta" fill="hsl(var(--muted-foreground))" opacity={0.3} radius={[4, 4, 0, 0]} />
                <Legend wrapperStyle={{ fontSize: 10 }} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Radar chart */}
        <div>
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2">
            Performance Radar
          </p>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={radarData}>
                <PolarGrid stroke="hsl(var(--border))" opacity={0.3} />
                <PolarAngleAxis dataKey="metric" tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }} />
                <PolarRadiusAxis tick={false} axisLine={false} domain={[0, 100]} />
                {TEAMS.map((team) => (
                  <Radar
                    key={team}
                    name={team}
                    dataKey={team}
                    stroke={TEAM_COLORS[team]}
                    fill={TEAM_COLORS[team]}
                    fillOpacity={0.15}
                    strokeWidth={2}
                  />
                ))}
                <Legend wrapperStyle={{ fontSize: 10 }} />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
