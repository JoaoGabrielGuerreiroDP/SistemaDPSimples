import { Target, CheckCircle2, Clock, Circle } from "lucide-react";
import type { Department } from "@/hooks/useOKRData";

interface StatsHeaderProps {
  departments: Department[];
}

export function StatsHeader({ departments }: StatsHeaderProps) {
  const allKRs = departments.flatMap((d) => d.objectives.flatMap((o) => o.keyResults));
  const total = allKRs.length;
  const done = allKRs.filter((kr) => kr.status === "done").length;
  const inProgress = allKRs.filter((kr) => kr.status === "in_progress").length;
  const pending = allKRs.filter((kr) => kr.status === "pending").length;
  const progress = total > 0 ? Math.round((done / total) * 100) : 0;

  const stats = [
    { label: "Total KRs", value: total, icon: Target, color: "text-foreground" },
    { label: "Concluídos", value: done, icon: CheckCircle2, color: "text-primary" },
    { label: "Em progresso", value: inProgress, icon: Clock, color: "text-dept-solucoes" },
    { label: "Pendentes", value: pending, icon: Circle, color: "text-muted-foreground" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <img src="/logo-dp.png" alt="DP Soluções" className="h-10 w-10 rounded-lg object-contain" />
        <div>
          <h1 className="font-display text-3xl sm:text-4xl font-bold text-foreground tracking-tight">
            DP Soluções — OKR
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Organização de demandas e resultados-chave
          </p>
        </div>
      </div>

      <div className="glass-card p-5">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-medium text-muted-foreground">Progresso geral</span>
          <span className="font-display text-2xl font-bold text-foreground">{progress}%</span>
        </div>
        <div className="w-full h-3 rounded-full bg-muted overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-primary/80 to-primary transition-all duration-700"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {stats.map((stat) => (
          <div key={stat.label} className="glass-card p-4 gap-3 font-sans text-secondary-foreground bg-destructive-foreground border-destructive-foreground border-dotted shadow-sm opacity-100 items-center justify-center flex flex-row text-center">
            <stat.icon className={`w-5 h-5 ${stat.color}`} />
            <div>
              <div className="font-display text-xl font-bold text-foreground">{stat.value}</div>
              <div className="text-xs text-muted-foreground">{stat.label}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
