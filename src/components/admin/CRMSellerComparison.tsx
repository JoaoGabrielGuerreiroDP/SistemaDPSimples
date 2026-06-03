import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BarChart3 } from "lucide-react";
import {
  ResponsiveContainer, RadarChart, Radar, PolarGrid, PolarAngleAxis,
  PolarRadiusAxis, Legend,
} from "recharts";

const COLORS = ["hsl(var(--primary))", "#10b981", "#f59e0b", "#f43f5e", "#8b5cf6", "#06b6d4"];

interface Props {
  piperunDeals: any[];
  piperunUsers: any[];
}

export default function CRMSellerComparison({ piperunDeals, piperunUsers }: Props) {
  const sellerStats = useMemo(() => {
    const ownerIds = [...new Set(piperunDeals.map((d) => d.owner_id).filter(Boolean))];
    const stats: Record<number, { name: string; won: number; lost: number; total: number; wonValue: number; avgTicket: number; avgCycle: number; winRate: number }> = {};

    for (const oid of ownerIds) {
      const sd = piperunDeals.filter((d) => d.owner_id === oid);
      const w = sd.filter((d) => d.status === 1);
      const l = sd.filter((d) => d.status === 2);
      const wv = w.reduce((s, d) => s + (Number(d.value) || 0), 0);
      const cl = w.length + l.length;
      const lt = sd.filter((d) => d.lead_time > 0).map((d) => d.lead_time);
      const user = piperunUsers.find((u) => u.id === oid);

      stats[oid] = {
        name: user?.name || `#${oid}`,
        won: w.length,
        lost: l.length,
        total: sd.length,
        wonValue: wv,
        avgTicket: w.length > 0 ? Math.round(wv / w.length) : 0,
        avgCycle: lt.length > 0 ? Math.round(lt.reduce((a, b) => a + b, 0) / lt.length) : 0,
        winRate: cl > 0 ? Math.round((w.length / cl) * 100) : 0,
      };
    }
    return stats;
  }, [piperunDeals, piperunUsers]);

  const topSellers = useMemo(() => {
    return Object.entries(sellerStats)
      .sort(([, a], [, b]) => b.wonValue - a.wonValue)
      .slice(0, 6);
  }, [sellerStats]);

  const radarData = useMemo(() => {
    if (topSellers.length === 0) return [];
    const maxWon = Math.max(...topSellers.map(([, s]) => s.won), 1);
    const maxValue = Math.max(...topSellers.map(([, s]) => s.wonValue), 1);
    const maxTicket = Math.max(...topSellers.map(([, s]) => s.avgTicket), 1);
    const maxVolume = Math.max(...topSellers.map(([, s]) => s.total), 1);

    const metrics = ["Win Rate", "Volume", "Ganhos", "Valor", "Ticket", "Velocidade"];
    return metrics.map((metric) => {
      const point: Record<string, any> = { metric };
      for (const [id, s] of topSellers) {
        const firstName = s.name.split(" ")[0];
        switch (metric) {
          case "Win Rate": point[firstName] = s.winRate; break;
          case "Volume": point[firstName] = Math.round((s.total / maxVolume) * 100); break;
          case "Ganhos": point[firstName] = Math.round((s.won / maxWon) * 100); break;
          case "Valor": point[firstName] = Math.round((s.wonValue / maxValue) * 100); break;
          case "Ticket": point[firstName] = Math.round((s.avgTicket / maxTicket) * 100); break;
          case "Velocidade": point[firstName] = s.avgCycle > 0 ? Math.max(0, 100 - s.avgCycle * 3) : 50; break;
        }
      }
      return point;
    });
  }, [topSellers]);

  if (topSellers.length < 2) return null;

  const sellerNames = topSellers.map(([, s]) => s.name.split(" ")[0]);

  return (
    <Card className="border-border/30">
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-primary" />
          <CardTitle className="text-sm">Comparativo de Vendedores</CardTitle>
          <Badge variant="secondary" className="text-[10px]">Top {topSellers.length}</Badge>
        </div>
      </CardHeader>
      <CardContent className="p-2">
        <ResponsiveContainer width="100%" height={320}>
          <RadarChart data={radarData}>
            <PolarGrid stroke="hsl(var(--border))" />
            <PolarAngleAxis dataKey="metric" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
            <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
            {sellerNames.map((name, i) => (
              <Radar key={name} name={name} dataKey={name} stroke={COLORS[i % COLORS.length]} fill={COLORS[i % COLORS.length]} fillOpacity={0.1} strokeWidth={2} />
            ))}
            <Legend wrapperStyle={{ fontSize: 11 }} />
          </RadarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
