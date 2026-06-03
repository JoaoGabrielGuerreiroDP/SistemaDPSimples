import { useState } from "react";
import { ChevronDown, ChevronRight, Circle, CheckCircle2, Clock, CalendarIcon, Plus } from "lucide-react";
import { differenceInDays, format, isPast, isToday } from "date-fns";
import { cn } from "@/lib/utils";
import { ProgressBar } from "./ProgressBar";
import { Input } from "./ui/input";
import { Button } from "./ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { Department, Status, Priority } from "@/hooks/useOKRData";

// Default colors for known departments, fallback for dynamic ones
const knownColors: Record<string, { border: string; badge: string; dot: string }> = {
  educacao: {
    border: "border-dept-educacao/30 hover:border-dept-educacao/60",
    badge: "bg-dept-educacao/15 text-dept-educacao",
    dot: "bg-dept-educacao",
  },
  consorcios: {
    border: "border-dept-consorcios/30 hover:border-dept-consorcios/60",
    badge: "bg-dept-consorcios/15 text-dept-consorcios",
    dot: "bg-dept-consorcios",
  },
  hub: {
    border: "border-dept-hub/30 hover:border-dept-hub/60",
    badge: "bg-dept-hub/15 text-dept-hub",
    dot: "bg-dept-hub",
  },
  solucoes: {
    border: "border-dept-solucoes/30 hover:border-dept-solucoes/60",
    badge: "bg-dept-solucoes/15 text-dept-solucoes",
    dot: "bg-dept-solucoes",
  },
  contempladas: {
    border: "border-dept-contempladas/30 hover:border-dept-contempladas/60",
    badge: "bg-dept-contempladas/15 text-dept-contempladas",
    dot: "bg-dept-contempladas",
  },
  canceladas: {
    border: "border-dept-canceladas/30 hover:border-dept-canceladas/60",
    badge: "bg-dept-canceladas/15 text-dept-canceladas",
    dot: "bg-dept-canceladas",
  },
};

const fallbackColors = {
  border: "border-primary/30 hover:border-primary/60",
  badge: "bg-primary/15 text-primary",
  dot: "bg-primary",
};

const statusIcons: Record<Status, typeof Circle> = {
  pending: Circle,
  in_progress: Clock,
  done: CheckCircle2,
};

const statusStyles: Record<Status, string> = {
  pending: "text-muted-foreground hover:text-foreground",
  in_progress: "text-dept-solucoes hover:text-dept-solucoes",
  done: "text-primary hover:text-primary",
};

interface DepartmentCardProps {
  department: Department;
  onToggleStatus: (departmentId: string, objectiveId: string, krId: string) => void;
  onKRAdded?: () => void;
}

export function DepartmentCard({ department, onToggleStatus, onKRAdded }: DepartmentCardProps) {
  const [expanded, setExpanded] = useState(true);
  const [newKR, setNewKR] = useState<Record<string, string>>({});
  const [addingKR, setAddingKR] = useState<string | null>(null);
  const colors = knownColors[department.id] || fallbackColors;

  const allKRs = department.objectives.flatMap((o) => o.keyResults);
  const doneCount = allKRs.filter((kr) => kr.status === "done").length;
  const progress = allKRs.length > 0 ? Math.round((doneCount / allKRs.length) * 100) : 0;

  return (
    <div
      className={cn("glass-card border transition-colors duration-300", colors.border)}
    >
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-5 text-left"
      >
        <div className="flex items-center gap-3">
          <div className={cn("w-2 h-2 rounded-full", colors.dot)} />
          <span className="text-lg mr-1">{department.icon}</span>
          <h2 className="font-display font-semibold text-foreground text-lg">{department.name}</h2>
          <span className={cn("text-xs font-medium px-2.5 py-0.5 rounded-full", colors.badge)}>
            {doneCount}/{allKRs.length}
          </span>
        </div>
        <div className="flex items-center gap-4">
          <div className="hidden sm:flex items-center gap-3 w-32">
            <ProgressBar value={progress} size="sm" />
            <span className="text-xs font-medium text-muted-foreground w-8">{progress}%</span>
          </div>
          {expanded ? (
            <ChevronDown className="w-4 h-4 text-muted-foreground" />
          ) : (
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
          )}
        </div>
      </button>

      {expanded && (
        <div className="px-5 pb-5 space-y-4">
          {department.objectives.map((objective) => {
            const objDone = objective.keyResults.filter((kr) => kr.status === "done").length;
            const objProgress = objective.keyResults.length > 0
              ? Math.round((objDone / objective.keyResults.length) * 100)
              : 0;

            return (
              <div key={objective.id} className="rounded-lg bg-muted/30 p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-display font-medium text-sm text-foreground">
                    {objective.title}
                  </h3>
                  <div className="flex items-center gap-2">
                    {objective.deadline && (
                      <span className={cn(
                        "text-[10px] font-medium flex items-center gap-0.5 px-1.5 py-0.5 rounded-full",
                        isPast(new Date(objective.deadline + "T23:59:59")) && !isToday(new Date(objective.deadline + "T23:59:59"))
                          ? "bg-destructive/15 text-destructive"
                          : isToday(new Date(objective.deadline + "T23:59:59"))
                            ? "bg-dept-solucoes/15 text-dept-solucoes"
                            : "bg-muted/50 text-muted-foreground"
                      )}>
                        <CalendarIcon className="w-3 h-3" />
                        {format(new Date(objective.deadline + "T12:00:00"), "dd/MM")}
                      </span>
                    )}
                    <span className="text-xs text-muted-foreground">{objProgress}%</span>
                  </div>
                </div>
                <ProgressBar value={objProgress} size="sm" className="mb-3" />
                <ul className="space-y-1.5">
                  {objective.keyResults.map((kr) => {
                    const Icon = statusIcons[kr.status];
                    const priorityConfig: Record<Priority, { label: string; className: string }> = {
                      high: { label: "Alta", className: "bg-destructive/15 text-destructive" },
                      medium: { label: "Média", className: "bg-dept-solucoes/15 text-dept-solucoes" },
                      low: { label: "Baixa", className: "bg-muted/50 text-muted-foreground" },
                    };
                    const prio = priorityConfig[kr.priority] || priorityConfig.medium;
                    return (
                      <li key={kr.id} className="flex items-center gap-2.5 group transition-all duration-300 ease-out">
                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            const btn = e.currentTarget;
                            btn.classList.add("scale-125");
                            setTimeout(() => btn.classList.remove("scale-125"), 200);
                            onToggleStatus(department.id, objective.id, kr.id);
                          }}
                          className={cn("shrink-0 transition-all duration-300 ease-out", statusStyles[kr.status])}
                        >
                          <Icon className="w-4 h-4 transition-transform duration-300" />
                        </button>
                        <span
                          className={cn(
                            "text-sm transition-all duration-300 ease-out flex-1",
                            kr.status === "done"
                              ? "text-muted-foreground line-through opacity-60"
                              : "text-secondary-foreground opacity-100"
                          )}
                        >
                          {kr.title}
                        </span>
                        {kr.assigned_name && (
                          <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-accent/50 text-accent-foreground shrink-0">
                            👤 {kr.assigned_name.split(" ")[0]}
                          </span>
                        )}
                        {kr.status === "in_progress" && kr.status_changed_at && (
                          <span className="text-[10px] font-medium text-dept-solucoes whitespace-nowrap">
                            {differenceInDays(new Date(), new Date(kr.status_changed_at))}d
                          </span>
                        )}
                        {kr.deadline && kr.status !== "done" && (
                          <span className={cn(
                            "text-[10px] font-medium flex items-center gap-0.5 whitespace-nowrap",
                            isPast(new Date(kr.deadline + "T23:59:59")) && !isToday(new Date(kr.deadline + "T23:59:59"))
                              ? "text-destructive"
                              : isToday(new Date(kr.deadline + "T23:59:59"))
                                ? "text-dept-solucoes"
                                : "text-muted-foreground"
                          )}>
                            <CalendarIcon className="w-3 h-3" />
                            {format(new Date(kr.deadline + "T12:00:00"), "dd/MM")}
                          </span>
                        )}
                        <span className={cn("text-[10px] font-medium px-1.5 py-0.5 rounded-full shrink-0", prio.className)}>
                          {prio.label}
                        </span>
                      </li>
                    );
                  })}
                </ul>
                {addingKR === objective.id ? (
                  <div className="flex gap-2 mt-2">
                    <Input
                      placeholder="Novo key result..."
                      value={newKR[objective.id] || ""}
                      onChange={(e) => setNewKR((p) => ({ ...p, [objective.id]: e.target.value }))}
                      onKeyDown={async (e) => {
                        if (e.key === "Enter") {
                          const title = newKR[objective.id]?.trim();
                          if (!title) return;
                          const id = `kr-${Date.now()}`;
                          const { error } = await supabase.from("key_results").insert({
                            id,
                            objective_id: objective.id,
                            title,
                            sort_order: objective.keyResults.length + 1,
                            priority: "medium",
                          });
                          if (error) { toast.error("Erro ao criar KR"); return; }
                          toast.success("Key Result criado!");
                          setNewKR((p) => ({ ...p, [objective.id]: "" }));
                          setAddingKR(null);
                          onKRAdded?.();
                        }
                        if (e.key === "Escape") setAddingKR(null);
                      }}
                      className="h-7 text-sm flex-1"
                      autoFocus
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs"
                      onClick={async () => {
                        const title = newKR[objective.id]?.trim();
                        if (!title) return;
                        const id = `kr-${Date.now()}`;
                        const { error } = await supabase.from("key_results").insert({
                          id,
                          objective_id: objective.id,
                          title,
                          sort_order: objective.keyResults.length + 1,
                          priority: "medium",
                        });
                        if (error) { toast.error("Erro ao criar KR"); return; }
                        toast.success("Key Result criado!");
                        setNewKR((p) => ({ ...p, [objective.id]: "" }));
                        setAddingKR(null);
                        onKRAdded?.();
                      }}
                    >
                      <Plus className="w-3 h-3" />
                    </Button>
                  </div>
                ) : (
                  <button
                    onClick={() => setAddingKR(objective.id)}
                    className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mt-2 transition-colors"
                  >
                    <Plus className="w-3 h-3" /> Adicionar KR
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
