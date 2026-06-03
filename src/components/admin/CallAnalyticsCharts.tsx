import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Api4ComCall } from "@/hooks/useApi4ComCalls";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
  PieChart, Pie, Legend,
} from "recharts";
import { PhoneCall, Timer, TrendingUp, TrendingDown } from "lucide-react";

interface CallAnalyticsChartsProps {
  calls: Api4ComCall[];
}

function formatDurationShort(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m < 60) return `${m}m${s > 0 ? ` ${s}s` : ""}`;
  const h = Math.floor(m / 60);
  const rm = m % 60;
  return `${h}h ${rm}m`;
}

const COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
  "#6366f1",
  "#f43f5e",
  "#14b8a6",
  "#f59e0b",
  "#8b5cf6",
];

export function CallAnalyticsCharts({ calls }: CallAnalyticsChartsProps) {
  const attendantStats = useMemo(() => {
    const map: Record<string, {
      name: string;
      totalCalls: number;
      answeredCalls: number;
      totalDuration: number;
      callsOver20s: number;
      avgDuration: number;
    }> = {};

    for (const call of calls) {
      const name = call.first_name || call.email || "Desconhecido";
      if (!map[name]) {
        map[name] = { name, totalCalls: 0, answeredCalls: 0, totalDuration: 0, callsOver20s: 0, avgDuration: 0 };
      }
      map[name].totalCalls++;
      if (call.hangup_cause === "NORMAL_CLEARING") {
        map[name].answeredCalls++;
      }
      map[name].totalDuration += call.duration || 0;
      if ((call.duration || 0) > 20) {
        map[name].callsOver20s++;
      }
    }

    Object.values(map).forEach((s) => {
      s.avgDuration = s.totalCalls > 0 ? Math.round(s.totalDuration / s.totalCalls) : 0;
    });

    return Object.values(map);
  }, [calls]);

  const rankingMostCalls = useMemo(
    () => [...attendantStats].sort((a, b) => b.totalCalls - a.totalCalls),
    [attendantStats],
  );

  const rankingOver20s = useMemo(
    () => [...attendantStats]
      .map((s) => ({
        ...s,
        pctOver20s: s.totalCalls > 0 ? Math.round((s.callsOver20s / s.totalCalls) * 100) : 0,
      }))
      .sort((a, b) => b.callsOver20s - a.callsOver20s),
    [attendantStats],
  );

  const answerRateData = useMemo(
    () => [...attendantStats]
      .map((s) => ({
        name: s.name,
        taxa: s.totalCalls > 0 ? Math.round((s.answeredCalls / s.totalCalls) * 100) : 0,
        atendidas: s.answeredCalls,
        total: s.totalCalls,
      }))
      .sort((a, b) => b.taxa - a.taxa),
    [attendantStats],
  );

  if (attendantStats.length === 0) return null;

  const topCaller = rankingMostCalls[0];
  const leastCaller = rankingMostCalls[rankingMostCalls.length - 1];
  const topPersistence = rankingOver20s[0];

  return (
    <div className="space-y-4">
      {/* Quick highlights */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Card className="border-l-4 border-l-emerald-500">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp className="h-4 w-4 text-emerald-500" />
              <span className="text-xs font-medium text-muted-foreground">Mais ligou</span>
            </div>
            <p className="text-lg font-bold truncate">{topCaller?.name}</p>
            <p className="text-xs text-muted-foreground">{topCaller?.totalCalls} chamadas · {formatDurationShort(topCaller?.totalDuration || 0)} total</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-red-500">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <TrendingDown className="h-4 w-4 text-red-500" />
              <span className="text-xs font-medium text-muted-foreground">Menos ligou</span>
            </div>
            <p className="text-lg font-bold truncate">{leastCaller?.name}</p>
            <p className="text-xs text-muted-foreground">{leastCaller?.totalCalls} chamadas · {formatDurationShort(leastCaller?.totalDuration || 0)} total</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-blue-500">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <Timer className="h-4 w-4 text-blue-500" />
              <span className="text-xs font-medium text-muted-foreground">Mais permanece em ligação (&gt;20s)</span>
            </div>
            <p className="text-lg font-bold truncate">{topPersistence?.name}</p>
            <p className="text-xs text-muted-foreground">{topPersistence?.callsOver20s} chamadas &gt;20s · Média {formatDurationShort(topPersistence?.avgDuration || 0)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Ranking de chamadas */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <PhoneCall className="h-4 w-4 text-primary" />
              Ranking de Chamadas por Atendente
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={Math.max(200, rankingMostCalls.length * 40)}>
              <BarChart data={rankingMostCalls} layout="vertical" margin={{ left: 0, right: 20 }}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                <XAxis type="number" tick={{ fontSize: 11 }} />
                <YAxis dataKey="name" type="category" width={100} tick={{ fontSize: 11 }} />
                <Tooltip
                  contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                  formatter={(value: number) => [`${value} chamadas`, "Total"]}
                />
                <Bar dataKey="totalCalls" radius={[0, 4, 4, 0]} barSize={20}>
                  {rankingMostCalls.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Chamadas >20s */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Timer className="h-4 w-4 text-blue-500" />
              Chamadas com mais de 20 segundos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={Math.max(200, rankingOver20s.length * 40)}>
              <BarChart data={rankingOver20s} layout="vertical" margin={{ left: 0, right: 20 }}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                <XAxis type="number" tick={{ fontSize: 11 }} />
                <YAxis dataKey="name" type="category" width={100} tick={{ fontSize: 11 }} />
                <Tooltip
                  contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                  formatter={(value: number, name: string) => {
                    if (name === "callsOver20s") return [`${value} chamadas`, ">20s"];
                    return [`${value}%`, "% do total"];
                  }}
                />
                <Bar dataKey="callsOver20s" radius={[0, 4, 4, 0]} barSize={20}>
                  {rankingOver20s.map((_, i) => (
                    <Cell key={i} fill={COLORS[(i + 3) % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Taxa de atendimento */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Taxa de Atendimento por Atendente</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={Math.max(200, answerRateData.length * 40)}>
              <BarChart data={answerRateData} layout="vertical" margin={{ left: 0, right: 20 }}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11 }} unit="%" />
                <YAxis dataKey="name" type="category" width={100} tick={{ fontSize: 11 }} />
                <Tooltip
                  contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                  formatter={(value: number, name: string) => {
                    if (name === "taxa") return [`${value}%`, "Taxa"];
                    return [value, name];
                  }}
                />
                <Bar dataKey="taxa" radius={[0, 4, 4, 0]} barSize={20}>
                  {answerRateData.map((entry, i) => (
                    <Cell key={i} fill={entry.taxa >= 70 ? "hsl(var(--chart-2))" : entry.taxa >= 40 ? "#f59e0b" : "hsl(var(--destructive))"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Duração média */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Duração Média por Atendente</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={Math.max(200, attendantStats.length * 40)}>
              <BarChart
                data={[...attendantStats].sort((a, b) => b.avgDuration - a.avgDuration)}
                layout="vertical"
                margin={{ left: 0, right: 20 }}
              >
                <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                <XAxis type="number" tick={{ fontSize: 11 }} />
                <YAxis dataKey="name" type="category" width={100} tick={{ fontSize: 11 }} />
                <Tooltip
                  contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                  formatter={(value: number) => [formatDurationShort(value), "Média"]}
                />
                <Bar dataKey="avgDuration" radius={[0, 4, 4, 0]} barSize={20}>
                  {[...attendantStats].sort((a, b) => b.avgDuration - a.avgDuration).map((_, i) => (
                    <Cell key={i} fill={COLORS[(i + 5) % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
