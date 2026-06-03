import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { toast } from "sonner";

export type Status = "pending" | "in_progress" | "done";
export type Priority = "high" | "medium" | "low";

export interface KeyResult {
  id: string;
  title: string;
  status: Status;
  priority: Priority;
  objective_id: string;
  sort_order: number;
  status_changed_at: string;
  assigned_to: string | null;
  assigned_name?: string;
  deadline: string | null;
}

export interface Objective {
  id: string;
  title: string;
  department_id: string;
  sort_order: number;
  deadline: string | null;
  keyResults: KeyResult[];
}

export interface Department {
  id: string;
  name: string;
  icon: string;
  sort_order: number;
  user_id: string | null;
  company_id: string | null;
  objectives: Objective[];
}

const nextStatus: Record<Status, Status> = {
  pending: "in_progress",
  in_progress: "done",
  done: "pending",
};

export type OKRMode = "company" | "personal";

interface UseOKRDataOptions {
  onObjectiveCompleted?: (params: { departmentId: string; objectiveId: string }) => void;
}

export function useOKRData(mode: OKRMode = "company", options: UseOKRDataOptions = {}) {
  const { user } = useAuth();
  const { onObjectiveCompleted } = options;
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async (silent = false) => {
    if (!user) return;
    if (!silent) setLoading(true);

    // Fetch departments filtered by mode
    let deptQuery = supabase.from("departments").select("*").is("deleted_at", null).order("sort_order");
    if (mode === "company") {
      deptQuery = deptQuery.is("user_id", null);
    } else {
      deptQuery = deptQuery.eq("user_id", user.id);
    }

    const [deptRes, objRes, krRes, profilesRes] = await Promise.all([
      deptQuery,
      supabase.from("objectives").select("*").is("deleted_at", null).order("sort_order"),
      supabase.from("key_results").select("*").is("deleted_at", null).order("sort_order"),
      supabase.from("profiles").select("user_id, display_name"),
    ]);

    const profileMap = new Map<string, string>();
    (profilesRes.data || []).forEach((p) => {
      if (p.user_id && p.display_name) profileMap.set(p.user_id, p.display_name);
    });

    const deptIds = new Set((deptRes.data || []).map((d) => d.id));

    // In personal mode, also find KRs assigned to this user
    let assignedKrIds = new Set<string>();
    let assignedObjIds = new Set<string>();
    let assignedDeptIds = new Set<string>();

    if (mode === "personal") {
      const assignedKrs = (krRes.data || []).filter(
        (kr) => kr.assigned_to === user.id
      );
      assignedKrIds = new Set(assignedKrs.map((kr) => kr.id));
      assignedObjIds = new Set(assignedKrs.map((kr) => kr.objective_id));
      // Find departments for assigned objectives
      const allObjs = objRes.data || [];
      assignedDeptIds = new Set(
        allObjs.filter((o) => assignedObjIds.has(o.id)).map((o) => o.department_id)
      );
    }

    const keyResults: KeyResult[] = (krRes.data || []).map((kr) => ({
      ...kr,
      status: (kr.status as Status) ?? "pending",
      priority: (kr.priority as Priority) ?? "medium",
      assigned_to: kr.assigned_to || null,
      assigned_name: kr.assigned_to ? profileMap.get(kr.assigned_to) : undefined,
      deadline: (kr as any).deadline || null,
    }));

    const priorityOrder: Record<Priority, number> = { high: 0, medium: 1, low: 2 };

    const allDeptIds = new Set([...deptIds, ...(mode === "personal" ? assignedDeptIds : [])]);

    // For personal mode assigned KRs, we need to also fetch those departments
    let allDepts = deptRes.data || [];
    if (mode === "personal" && assignedDeptIds.size > 0) {
      const missingDeptIds = [...assignedDeptIds].filter((id) => !deptIds.has(id));
      if (missingDeptIds.length > 0) {
        const { data: extraDepts } = await supabase
          .from("departments")
          .select("*")
          .in("id", missingDeptIds);
        allDepts = [...allDepts, ...(extraDepts || [])];
      }
    }

    const objectives = (objRes.data || [])
      .filter((obj) => allDeptIds.has(obj.department_id))
      .map((obj) => ({
        ...obj,
        deadline: (obj as any).deadline || null,
        keyResults: keyResults
          .filter((kr) => {
            if (kr.objective_id !== obj.id) return false;
            // In personal mode, for non-personal depts show only assigned KRs
            if (mode === "personal" && !deptIds.has(obj.department_id)) {
              return assignedKrIds.has(kr.id);
            }
            return true;
          })
          .sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]),
      }))
      .filter((obj) => obj.keyResults.length > 0 || deptIds.has(obj.department_id));

    const depts: Department[] = allDepts
      .map((dept) => ({
        ...dept,
        objectives: objectives.filter((obj) => obj.department_id === dept.id),
      }))
      .filter((dept) => dept.objectives.length > 0 || deptIds.has(dept.id));

    setDepartments(depts);
    setLoading(false);
  }, [user, mode]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Realtime subscription for shared company status
  useEffect(() => {
    if (mode !== "company") return;

    const channel = supabase
      .channel(`kr-status-changes-${mode}-${Math.random().toString(36).slice(2)}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "key_results" },
        () => {
          loadData(true);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [mode, loadData]);

  const toggleStatus = useCallback(
    async (deptId: string, objId: string, krId: string) => {
      if (!user) return;

      // Optimistic update
      setDepartments((prev) =>
        prev.map((dept) =>
          dept.id !== deptId
            ? dept
            : {
                ...dept,
                objectives: dept.objectives.map((obj) =>
                  obj.id !== objId
                    ? obj
                    : {
                        ...obj,
                        keyResults: obj.keyResults.map((kr) => {
                          if (kr.id !== krId) return kr;
                          return { ...kr, status: nextStatus[kr.status] };
                        }),
                      }
                ),
              }
        )
      );

      const current = departments
        .find((d) => d.id === deptId)
        ?.objectives.find((o) => o.id === objId)
        ?.keyResults.find((kr) => kr.id === krId);

      if (current) {
        const newStatus = nextStatus[current.status];
        await supabase
          .from("key_results")
          .update({ status: newStatus, status_changed_at: new Date().toISOString() })
          .eq("id", krId);

        // Check if the objective is now 100% complete
        if (newStatus === "done") {
          const obj = departments
            .find((d) => d.id === deptId)
            ?.objectives.find((o) => o.id === objId);
          if (obj) {
            const allDoneAfter = obj.keyResults.every((kr) =>
              kr.id === krId ? true : kr.status === "done"
            );
            if (allDoneAfter) {
              const deptName = departments.find((d) => d.id === deptId)?.name || "";
              toast.success(`🎉 Objetivo concluído!`, {
                description: `"${obj.title}" (${deptName}) — todos os KRs finalizados!`,
                duration: 10000,
                action: {
                  label: "Ver Ranking",
                  onClick: () => {
                    onObjectiveCompleted?.({ departmentId: deptId, objectiveId: objId });
                  },
                },
              });
              onObjectiveCompleted?.({ departmentId: deptId, objectiveId: objId });
            }
          }
        }
      }
    },
    [user, departments, onObjectiveCompleted]
  );

  return { departments, loading, toggleStatus, reload: loadData };
}
