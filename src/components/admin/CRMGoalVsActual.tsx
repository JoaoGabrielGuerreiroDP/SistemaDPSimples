import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Target } from "lucide-react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend, Cell } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { useGoogleSheetsData } from "@/hooks/useGoogleSheetsData";
import { normalizeName, ALL_BROKERS, isLeadership } from "@/lib/seller-names";
import { useTeamFilter } from "@/hooks/useTeamFilter";

interface Props {
  piperunDeals: any[];
  piperunUsers: any[];
}

function formatCurrency(val: number) {
  return val.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default function CRMGoalVsActual({ piperunDeals, piperunUsers }: Props) {
  const { matchesTeam } = useTeamFilter();
  const now = new Date();
  const mesRef = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  const { allRows } = useGoogleSheetsData();

  // Fetch goals by name
  const { data: goalsByName } = useQuery({
    queryKey: ["sales_goals_byname", mesRef],
    queryFn: async () => {
      const { data } = await supabase
        .from("sales_goals_byname")
        .select("*")
        .eq("mes_ref", mesRef);
      return data || [];
    },
    staleTime: 5 * 60 * 1000,
  });

  const chartData = useMemo(() => {
    // Use Google Sheets data (same source as War Room) for actual sales
    const sellerActual: Record<string, { name: string; actual: number; count: number }> = {};

    for (const row of allRows) {
      if (!row.dataVenda || !row.corretor) continue;
      const parts = row.dataVenda.split("/");
      if (parts.length !== 3) continue;
      const [d, m, y] = parts.map(Number);
      if (y !== currentYear || m - 1 !== currentMonth) continue;
      const name = normalizeName(row.corretor);
      if (isLeadership(name) || !matchesTeam(name)) continue;
      if (!sellerActual[name]) sellerActual[name] = { name, actual: 0, count: 0 };
      sellerActual[name].actual += row.valor;
      sellerActual[name].count++;
    }

    // Merge with goals
    const result: { name: string; meta: number; realizado: number; pct: number; count: number }[] = [];
    const processedNames = new Set<string>();

    if (goalsByName) {
      for (const g of goalsByName) {
        const canonical = normalizeName(g.broker_name);
        if (isLeadership(canonical) || !matchesTeam(canonical)) continue;
        processedNames.add(canonical);
        const actual = sellerActual[canonical]?.actual || 0;
        const count = sellerActual[canonical]?.count || 0;
        result.push({
          name: canonical.split(" ")[0],
          meta: Number(g.meta),
          realizado: actual,
          pct: Number(g.meta) > 0 ? Math.round((actual / Number(g.meta)) * 100) : 0,
          count,
        });
      }
    }

    // Add sellers from Sheets with actual but no goal
    for (const [name, data] of Object.entries(sellerActual)) {
      if (processedNames.has(name) || isLeadership(name)) continue;
      result.push({
        name: name.split(" ")[0],
        meta: 0,
        realizado: data.actual,
        pct: 0,
        count: data.count,
      });
    }

    // Add all brokers from central list that are missing (zero sales, no goal)
    for (const broker of ALL_BROKERS) {
      const canonical = normalizeName(broker);
      if (processedNames.has(canonical) || Object.keys(sellerActual).includes(canonical)) continue;
      if (isLeadership(canonical) || !matchesTeam(canonical)) continue;
      result.push({
        name: canonical.split(" ")[0],
        meta: 0,
        realizado: 0,
        pct: 0,
        count: 0,
      });
    }

    return result.sort((a, b) => b.realizado - a.realizado);
  }, [allRows, goalsByName, currentMonth, currentYear, matchesTeam]);

  if (chartData.length === 0) return null;

  const monthLabel = now.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });

  return (
    <Card className="border-border/30">
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <Target className="w-4 h-4 text-primary" />
          <CardTitle className="text-sm">Meta vs Realizado</CardTitle>
          <Badge variant="secondary" className="text-[10px] capitalize">{monthLabel}</Badge>
        </div>
      </CardHeader>
      <CardContent className="p-2">
        <ResponsiveContainer width="100%" height={Math.max(200, chartData.length * 45)}>
          <BarChart data={chartData} layout="vertical" margin={{ left: 10, right: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
            <XAxis type="number" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
            <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: "hsl(var(--foreground))" }} width={70} />
            <Tooltip formatter={(v: number) => formatCurrency(v)} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Bar dataKey="meta" name="Meta" fill="hsl(var(--muted-foreground))" fillOpacity={0.3} radius={[0, 4, 4, 0]} barSize={16} />
            <Bar dataKey="realizado" name="Realizado" radius={[0, 4, 4, 0]} barSize={16}>
              {chartData.map((entry, i) => (
                <Cell key={i} fill={entry.pct >= 100 ? "#10b981" : entry.pct >= 50 ? "#f59e0b" : "#f43f5e"} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>

        {/* Percentage badges */}
        <div className="flex flex-wrap gap-2 mt-3 px-2">
          {chartData.filter((d) => d.meta > 0).map((d) => (
            <Badge key={d.name} variant="outline" className={`text-[10px] ${d.pct >= 100 ? "border-emerald-500/50 text-emerald-500" : d.pct >= 50 ? "border-amber-500/50 text-amber-500" : "border-rose-500/50 text-rose-500"}`}>
              {d.name}: {d.pct}%
            </Badge>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
