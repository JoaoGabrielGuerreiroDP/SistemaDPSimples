import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Clock, TrendingDown, ArrowRight, Zap } from "lucide-react";
import { getHubSpotStageEntryDate, getPiperunStageEntryDate } from "@/lib/crm-stage-dates";

interface FunnelMetricsProps {
  piperunDeals: any[];
  piperunStages: any[];
  hubspotDeals: any[];
  hubspotStages: { id: string; label: string }[];
}

function daysBetween(from: string, to: string) {
  return Math.max(0, Math.round((new Date(to).getTime() - new Date(from).getTime()) / 86400000));
}

export default function CRMFunnelMetrics({ piperunDeals, piperunStages, hubspotDeals, hubspotStages }: FunnelMetricsProps) {
  // ── Piperun funnel metrics ─────────────────────────────────
  const prFunnel = useMemo(() => {
    const stageMap = new Map(piperunStages.map((s: any) => [String(s.id), s]));
    const stageGroups: Record<string, any[]> = {};

    for (const d of piperunDeals) {
      const sid = String(d.stage_id);
      if (!stageGroups[sid]) stageGroups[sid] = [];
      stageGroups[sid].push(d);
    }

    return piperunStages
      .sort((a: any, b: any) => (a.order ?? 0) - (b.order ?? 0))
      .map((stage: any) => {
        const deals = stageGroups[String(stage.id)] || [];
        const totalInStage = deals.length;

        // Avg days in stage
        const now = new Date().toISOString();
        const dealsWithStageDate = deals.filter((d: any) => getPiperunStageEntryDate(d));
        const avgDays = totalInStage > 0
          ? Math.round(dealsWithStageDate.reduce((s: number, d: any) => s + daysBetween(getPiperunStageEntryDate(d)!, now), 0) / Math.max(dealsWithStageDate.length, 1))
          : 0;

        // Value in stage
        const stageValue = deals.reduce((s: number, d: any) => s + (Number(d.value) || 0), 0);

        return {
          id: String(stage.id),
          name: stage.name,
          count: totalInStage,
          avgDays,
          stageValue,
          pipelineId: stage.pipeline_id,
          color: stage.color,
        };
      })
      .filter((s) => s.count > 0);
  }, [piperunDeals, piperunStages]);

  // ── HubSpot funnel metrics ─────────────────────────────────
  const hsFunnel = useMemo(() => {
    const stageGroups: Record<string, any[]> = {};
    for (const d of hubspotDeals) {
      const stage = d.properties?.dealstage;
      if (!stage) continue;
      if (!stageGroups[stage]) stageGroups[stage] = [];
      stageGroups[stage].push(d);
    }

    return hubspotStages.map((stage) => {
      const deals = stageGroups[stage.id] || [];
      const now = new Date().toISOString();
      const dealsWithStageDate = deals.filter((d: any) => getHubSpotStageEntryDate(d));
      const avgDays = deals.length > 0
        ? Math.round(dealsWithStageDate.reduce((s: number, d: any) => s + daysBetween(getHubSpotStageEntryDate(d)!, now), 0) / Math.max(dealsWithStageDate.length, 1))
        : 0;
      const stageValue = deals.reduce((s: number, d: any) => s + (Number(d.properties?.amount) || 0), 0);

      return {
        id: stage.id,
        name: stage.label,
        count: deals.length,
        avgDays,
        stageValue,
      };
    }).filter((s) => s.count > 0);
  }, [hubspotDeals, hubspotStages]);

  // ── Conversion per stage (Piperun) ─────────────────────────
  const prConversion = useMemo(() => {
    if (prFunnel.length < 2) return [];
    return prFunnel.slice(0, -1).map((stage, i) => {
      const next = prFunnel[i + 1];
      const rate = stage.count > 0 ? Math.round((next.count / stage.count) * 100) : 0;
      return { from: stage.name, to: next.name, rate, fromCount: stage.count, toCount: next.count };
    });
  }, [prFunnel]);

  const formatCurrency = (v: number) => v > 0 ? v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "—";

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Zap className="w-5 h-5 text-amber-500" />
        <h2 className="text-base sm:text-lg font-bold text-foreground">Velocidade do Funil</h2>
      </div>

      {/* Piperun funnel */}
      {prFunnel.length > 0 && (
        <Card className="border-border/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-muted-foreground">Piperun — Tempo médio por etapa</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {prFunnel.map((stage) => {
              const isStuck = stage.avgDays > 5;
              return (
                <div key={stage.id} className="flex items-center gap-3">
                  <div className="w-32 sm:w-44 shrink-0">
                    <p className="text-xs font-medium text-foreground truncate">{stage.name}</p>
                  </div>
                  <div className="flex-1 flex items-center gap-2">
                    <div className="h-7 rounded-md bg-gradient-to-r from-primary/20 to-primary/5 border border-primary/20 flex items-center px-2.5 gap-2" style={{ width: `${Math.max(Math.min(stage.avgDays * 8, 100), 15)}%` }}>
                      <Clock className="w-3 h-3 text-muted-foreground shrink-0" />
                      <span className={`text-xs font-bold ${isStuck ? "text-rose-400" : "text-foreground"}`}>{stage.avgDays}d</span>
                    </div>
                    <Badge variant="secondary" className="text-[9px] h-5 shrink-0">{stage.count} deals</Badge>
                    {stage.stageValue > 0 && (
                      <span className="text-[10px] text-emerald-500 font-semibold hidden sm:inline">{formatCurrency(stage.stageValue)}</span>
                    )}
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* HubSpot funnel */}
      {hsFunnel.length > 0 && (
        <Card className="border-border/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-muted-foreground">HubSpot — Tempo médio por etapa</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {hsFunnel.map((stage) => {
              const isStuck = stage.avgDays > 5;
              return (
                <div key={stage.id} className="flex items-center gap-3">
                  <div className="w-32 sm:w-44 shrink-0">
                    <p className="text-xs font-medium text-foreground truncate">{stage.name}</p>
                  </div>
                  <div className="flex-1 flex items-center gap-2">
                    <div className="h-7 rounded-md bg-gradient-to-r from-orange-500/20 to-orange-500/5 border border-orange-500/20 flex items-center px-2.5 gap-2" style={{ width: `${Math.max(Math.min(stage.avgDays * 8, 100), 15)}%` }}>
                      <Clock className="w-3 h-3 text-muted-foreground shrink-0" />
                      <span className={`text-xs font-bold ${isStuck ? "text-rose-400" : "text-foreground"}`}>{stage.avgDays}d</span>
                    </div>
                    <Badge variant="secondary" className="text-[9px] h-5 shrink-0">{stage.count} deals</Badge>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* Conversion between stages */}
      {prConversion.length > 0 && (
        <Card className="border-border/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-muted-foreground flex items-center gap-1.5">
              <TrendingDown className="w-4 h-4" /> Conversão entre etapas (Piperun)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {prConversion.map((c, i) => (
                <div key={i} className="flex items-center gap-2 text-xs">
                  <span className="font-medium text-foreground truncate w-24 sm:w-32 text-right">{c.from}</span>
                  <ArrowRight className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                  <span className="font-medium text-foreground truncate w-24 sm:w-32">{c.to}</span>
                  <div className="flex-1 h-6 rounded bg-muted/30 overflow-hidden relative">
                    <div
                      className={`h-full rounded transition-all ${c.rate >= 50 ? "bg-emerald-500/30" : c.rate >= 25 ? "bg-amber-500/30" : "bg-rose-500/30"}`}
                      style={{ width: `${Math.max(c.rate, 5)}%` }}
                    />
                    <span className={`absolute inset-0 flex items-center justify-center text-[11px] font-bold ${c.rate >= 50 ? "text-emerald-400" : c.rate >= 25 ? "text-amber-400" : "text-rose-400"}`}>
                      {c.rate}%
                    </span>
                  </div>
                  <span className="text-[10px] text-muted-foreground shrink-0 w-16 text-right">{c.fromCount} → {c.toCount}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
