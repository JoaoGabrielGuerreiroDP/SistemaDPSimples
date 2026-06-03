import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useCompanyHealthScore } from "@/hooks/useCompanyHealthScore";
import { Activity, TrendingUp, TrendingDown, Users, Smile, AlertTriangle } from "lucide-react";

export function CompanyHealthWidget() {
  const h = useCompanyHealthScore();
  if (h.loading) return null;

  const tone = h.total >= 75 ? "text-green-500" : h.total >= 50 ? "text-amber-500" : "text-destructive";

  const items = [
    { icon: TrendingUp, label: "Meta vs realizado", value: h.goalVsActual, max: 30 },
    { icon: Activity, label: "Pipeline", value: h.pipelineHealth, max: 20 },
    { icon: TrendingDown, label: "Churn (invertido)", value: h.churn, max: 20 },
    { icon: Users, label: "Equipe ativa", value: h.teamActive, max: 15 },
    { icon: Smile, label: "Humor da equipe", value: h.mood, max: 15 },
  ];

  return (
    <Card className="border-primary/20">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Activity className="h-4 w-4 text-primary" /> Health Score da empresa
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-baseline gap-3">
          <p className={`text-5xl font-bold ${tone}`}>{h.total}</p>
          <p className="text-sm text-muted-foreground">/ 100</p>
          {h.total < 50 && <AlertTriangle className="h-5 w-5 text-destructive" />}
        </div>
        <Progress value={h.total} className="h-2" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2">
          {items.map((it) => {
            const Icon = it.icon;
            const pct = (it.value / it.max) * 100;
            return (
              <div key={it.label} className="flex items-center justify-between text-xs p-2 rounded bg-muted/40">
                <span className="flex items-center gap-1.5"><Icon className="h-3 w-3" /> {it.label}</span>
                <span className="font-semibold tabular-nums">{it.value}/{it.max} <span className="text-muted-foreground">({pct.toFixed(0)}%)</span></span>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}