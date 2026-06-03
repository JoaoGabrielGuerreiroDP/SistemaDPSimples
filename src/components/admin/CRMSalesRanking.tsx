import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Trophy, TrendingUp, Clock, DollarSign, Target } from "lucide-react";

interface SalesRankingProps {
  piperunDeals: any[];
  piperunUsers: any[];
}

function formatCurrency(val: number) {
  if (!val) return "—";
  return val.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default function CRMSalesRanking({ piperunDeals, piperunUsers }: SalesRankingProps) {
  const navigate = useNavigate();
  const userMap = useMemo(() => {
    const map: Record<number, { name: string; email: string; avatar: string }> = {};
    for (const u of piperunUsers) {
      map[u.id] = { name: u.name || u.email, email: u.email || "", avatar: u.avatar || "" };
    }
    return map;
  }, [piperunUsers]);
  const ranking = useMemo(() => {
    const ownerMap: Record<number, { total: number; won: number; lost: number; totalValue: number; wonValue: number; leadTimeSum: number; leadTimeCount: number }> = {};

    for (const d of piperunDeals) {
      const ownerId = d.owner_id;
      if (!ownerId) continue;

      if (!ownerMap[ownerId]) {
        ownerMap[ownerId] = { total: 0, won: 0, lost: 0, totalValue: 0, wonValue: 0, leadTimeSum: 0, leadTimeCount: 0 };
      }

      const o = ownerMap[ownerId];
      o.total++;
      o.totalValue += Number(d.value) || 0;

      if (d.status === 1) {
        o.won++;
        o.wonValue += Number(d.value) || 0;
      }
      if (d.status === 2) o.lost++;

      if (d.lead_time && d.lead_time > 0) {
        o.leadTimeSum += d.lead_time;
        o.leadTimeCount++;
      }
    }

    return Object.entries(ownerMap)
      .map(([id, stats]) => {
        const closed = stats.won + stats.lost;
        const winRate = closed > 0 ? Math.round((stats.won / closed) * 100) : 0;
        const avgTicket = stats.won > 0 ? Math.round(stats.wonValue / stats.won) : 0;
        const avgCycle = stats.leadTimeCount > 0 ? Math.round(stats.leadTimeSum / stats.leadTimeCount) : 0;

        return {
          ownerId: id,
          ...stats,
          winRate,
          avgTicket,
          avgCycle,
        };
      })
      .sort((a, b) => b.wonValue - a.wonValue);
  }, [piperunDeals]);

  if (ranking.length === 0) return null;

  const medals = ["🥇", "🥈", "🥉"];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Trophy className="w-5 h-5 text-amber-500" />
        <h2 className="text-base sm:text-lg font-bold text-foreground">Ranking de Vendedores</h2>
        <Badge variant="secondary" className="text-[10px]">Piperun</Badge>
      </div>

      <Card className="border-border/30 overflow-hidden">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border/30 bg-muted/30">
                  <th className="text-left px-3 py-2.5 font-semibold text-muted-foreground">#</th>
                  <th className="text-left px-3 py-2.5 font-semibold text-muted-foreground">Vendedor</th>
                  <th className="text-center px-3 py-2.5 font-semibold text-muted-foreground">
                    <div className="flex items-center justify-center gap-1"><Target className="w-3 h-3" /> Total</div>
                  </th>
                  <th className="text-center px-3 py-2.5 font-semibold text-muted-foreground">
                    <div className="flex items-center justify-center gap-1"><TrendingUp className="w-3 h-3" /> Win Rate</div>
                  </th>
                  <th className="text-center px-3 py-2.5 font-semibold text-muted-foreground">
                    <div className="flex items-center justify-center gap-1"><DollarSign className="w-3 h-3" /> Ticket Médio</div>
                  </th>
                  <th className="text-center px-3 py-2.5 font-semibold text-muted-foreground">
                    <div className="flex items-center justify-center gap-1"><Clock className="w-3 h-3" /> Ciclo</div>
                  </th>
                  <th className="text-right px-3 py-2.5 font-semibold text-muted-foreground">Valor Ganho</th>
                </tr>
              </thead>
              <tbody>
                {ranking.map((r, i) => {
                  const isTop3 = i < 3;
                  return (
                    <tr key={r.ownerId} className={`border-b border-border/10 ${isTop3 ? "bg-amber-500/5" : ""} hover:bg-muted/20 transition-colors cursor-pointer`} onClick={() => navigate(`/vendedor-detalhe?id=${r.ownerId}`)}>
                      <td className="px-3 py-2.5 font-bold text-lg">
                        {i < 3 ? medals[i] : <span className="text-xs text-muted-foreground">{i + 1}</span>}
                      </td>
                      <td className="px-3 py-2.5">
                        <p className="font-semibold text-foreground">{userMap[Number(r.ownerId)]?.name || `Vendedor #${r.ownerId}`}</p>
                        <p className="text-[10px] text-muted-foreground">{userMap[Number(r.ownerId)]?.email || ""} · {r.won}W · {r.lost}L · {r.total - r.won - r.lost} abertos</p>
                      </td>
                      <td className="px-3 py-2.5 text-center font-bold text-foreground">{r.total}</td>
                      <td className="px-3 py-2.5 text-center">
                        <Badge
                          variant="secondary"
                          className={`text-[10px] ${r.winRate >= 50 ? "bg-emerald-500/20 text-emerald-400" : r.winRate >= 25 ? "bg-amber-500/20 text-amber-400" : "bg-rose-500/20 text-rose-400"}`}
                        >
                          {r.winRate}%
                        </Badge>
                      </td>
                      <td className="px-3 py-2.5 text-center text-foreground font-medium">{formatCurrency(r.avgTicket)}</td>
                      <td className="px-3 py-2.5 text-center">
                        <span className={`font-bold ${r.avgCycle > 15 ? "text-rose-400" : r.avgCycle > 7 ? "text-amber-400" : "text-emerald-400"}`}>
                          {r.avgCycle}d
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        <span className="font-bold text-emerald-500">{formatCurrency(r.wonValue)}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
