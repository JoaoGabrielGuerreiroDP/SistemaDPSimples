import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Plus, Trash2, Building2, User, UserPlus, Archive, CalendarIcon } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { OKRMode } from "@/hooks/useOKRData";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { SortableItem } from "@/components/SortableItem";
import { VoiceOKRInput } from "@/components/VoiceOKRInput";
import { usePermissions } from "@/hooks/usePermissions";

interface DBDepartment {
  id: string;
  name: string;
  icon: string;
  sort_order: number;
}

interface DBObjective {
  id: string;
  department_id: string;
  title: string;
  sort_order: number;
  deadline: string | null;
}

interface DBKeyResult {
  id: string;
  objective_id: string;
  title: string;
  sort_order: number;
  priority: string;
  assigned_to: string | null;
  deadline: string | null;
}

interface UserProfile {
  user_id: string;
  display_name: string | null;
}

export default function ManageOKR() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { hasPermission } = usePermissions();
  const canManageCompany = hasPermission("gerenciar");
  const [mode, setMode] = useState<OKRMode>(canManageCompany ? "company" : "personal");
  const [departments, setDepartments] = useState<DBDepartment[]>([]);
  const [objectives, setObjectives] = useState<DBObjective[]>([]);
  const [keyResults, setKeyResults] = useState<DBKeyResult[]>([]);
  const [loading, setLoading] = useState(true);

  const [newDept, setNewDept] = useState({ name: "", icon: "📋" });
  const [newObj, setNewObj] = useState<Record<string, string>>({});
  const [newKR, setNewKR] = useState<Record<string, string>>({});
  const [newKRPriority, setNewKRPriority] = useState<Record<string, string>>({});
  const [profiles, setProfiles] = useState<UserProfile[]>([]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  useEffect(() => {
    loadAll();
  }, [mode]);

  async function loadAll() {
    if (!user) return;
    setLoading(true);
    let deptQuery = supabase.from("departments").select("*").is("deleted_at", null).order("sort_order");
    if (mode === "company") {
      deptQuery = deptQuery.is("user_id", null);
    } else {
      deptQuery = deptQuery.eq("user_id", user.id);
    }
    const [d, o, k, p] = await Promise.all([
      deptQuery,
      supabase.from("objectives").select("*").is("deleted_at", null).order("sort_order"),
      supabase.from("key_results").select("*").is("deleted_at", null).order("sort_order"),
      supabase.from("profiles").select("user_id, display_name"),
    ]);
    setDepartments(d.data || []);
    setObjectives(o.data || []);
    setKeyResults(k.data || []);
    setProfiles((p.data || []).filter((pr) => pr.display_name) as UserProfile[]);
    setLoading(false);
  }

  async function assignKR(krId: string, userId: string | null) {
    const { error } = await supabase
      .from("key_results")
      .update({ assigned_to: userId, last_assigned_by: userId ? user!.id : null } as any)
      .eq("id", krId);
    if (error) { toast.error("Erro ao atribuir"); return; }
    toast.success(userId ? "KR atribuído!" : "Atribuição removida");
    loadAll();
  }

  // --- Reorder helpers ---
  const persistOrder = useCallback(
    async (table: "departments" | "objectives" | "key_results", items: { id: string }[]) => {
      const updates = items.map((item, i) =>
        supabase.from(table).update({ sort_order: i + 1 }).eq("id", item.id)
      );
      await Promise.all(updates);
    },
    []
  );

  function handleDeptDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setDepartments((prev) => {
      const oldIdx = prev.findIndex((d) => d.id === active.id);
      const newIdx = prev.findIndex((d) => d.id === over.id);
      const reordered = arrayMove(prev, oldIdx, newIdx);
      persistOrder("departments", reordered);
      return reordered;
    });
  }

  function handleObjDragEnd(deptId: string) {
    return (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;
      setObjectives((prev) => {
        const deptObjs = prev.filter((o) => o.department_id === deptId);
        const rest = prev.filter((o) => o.department_id !== deptId);
        const oldIdx = deptObjs.findIndex((o) => o.id === active.id);
        const newIdx = deptObjs.findIndex((o) => o.id === over.id);
        const reordered = arrayMove(deptObjs, oldIdx, newIdx);
        persistOrder("objectives", reordered);
        return [...rest, ...reordered];
      });
    };
  }

  function handleKRDragEnd(objId: string) {
    return (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;
      setKeyResults((prev) => {
        const objKRs = prev.filter((kr) => kr.objective_id === objId);
        const rest = prev.filter((kr) => kr.objective_id !== objId);
        const oldIdx = objKRs.findIndex((kr) => kr.id === active.id);
        const newIdx = objKRs.findIndex((kr) => kr.id === over.id);
        const reordered = arrayMove(objKRs, oldIdx, newIdx);
        persistOrder("key_results", reordered);
        return [...rest, ...reordered];
      });
    };
  }

  // --- Department CRUD ---
  async function addDepartment() {
    if (!newDept.name.trim() || !user) return;
    const id = newDept.name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "") + "-" + Date.now();
    const insertData: any = {
      id,
      name: newDept.name,
      icon: newDept.icon || "📋",
      sort_order: departments.length + 1,
    };
    if (mode === "personal") {
      insertData.user_id = user.id;
    }
    const { error } = await supabase.from("departments").insert(insertData);
    if (error) { toast.error("Erro ao criar departamento"); return; }
    toast.success("Departamento criado!");
    setNewDept({ name: "", icon: "📋" });
    loadAll();
  }

  async function deleteDepartment(id: string) {
    if (!confirm("Mover este departamento para o arquivo?")) return;
    const now = new Date().toISOString();
    await supabase.from("departments").update({ deleted_at: now } as any).eq("id", id);
    // Also soft-delete child objectives and KRs
    const deptObjs = objectives.filter((o) => o.department_id === id);
    for (const obj of deptObjs) {
      await supabase.from("objectives").update({ deleted_at: now } as any).eq("id", obj.id);
      await supabase.from("key_results").update({ deleted_at: now } as any).eq("objective_id", obj.id);
    }
    toast.success("Departamento arquivado");
    loadAll();
  }

  async function addObjective(deptId: string) {
    const title = newObj[deptId]?.trim();
    if (!title) return;
    const id = `${deptId}-${Date.now()}`;
    const deptObjectives = objectives.filter((o) => o.department_id === deptId);
    const { error } = await supabase.from("objectives").insert({
      id,
      department_id: deptId,
      title,
      sort_order: deptObjectives.length + 1,
    });
    if (error) { toast.error("Erro ao criar objetivo"); return; }
    toast.success("Objetivo criado!");
    setNewObj((prev) => ({ ...prev, [deptId]: "" }));
    loadAll();
  }

  async function deleteObjective(id: string) {
    if (!confirm("Mover este objetivo para o arquivo?")) return;
    const now = new Date().toISOString();
    await supabase.from("objectives").update({ deleted_at: now } as any).eq("id", id);
    await supabase.from("key_results").update({ deleted_at: now } as any).eq("objective_id", id);
    toast.success("Objetivo arquivado");
    loadAll();
  }

  async function addKeyResult(objId: string) {
    const title = newKR[objId]?.trim();
    if (!title) return;
    const id = `kr-${Date.now()}`;
    const objKRs = keyResults.filter((kr) => kr.objective_id === objId);
    const priority = newKRPriority[objId] || "medium";
    const { error } = await supabase.from("key_results").insert({
      id,
      objective_id: objId,
      title,
      sort_order: objKRs.length + 1,
      priority,
    });
    if (error) { toast.error("Erro ao criar key result"); return; }
    toast.success("Key Result criado!");
    setNewKR((prev) => ({ ...prev, [objId]: "" }));
    setNewKRPriority((prev) => ({ ...prev, [objId]: "medium" }));
    loadAll();
  }

  async function deleteKeyResult(id: string) {
    await supabase.from("key_results").update({ deleted_at: new Date().toISOString() } as any).eq("id", id);
    toast.success("Key Result arquivado");
    loadAll();
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center text-muted-foreground">
        Carregando...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto px-4 py-8 sm:py-12 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h1 className="font-display text-2xl font-bold text-foreground">Gerenciar OKRs</h1>
          <Button variant="outline" size="sm" onClick={() => navigate("/arquivo")}>
            <Archive className="w-4 h-4 mr-1" /> Arquivo
          </Button>
        </div>

        {/* Mode Tabs */}
        <div className="flex gap-2">
          {canManageCompany && (
            <Button
              variant={mode === "company" ? "default" : "outline"}
              size="sm"
              onClick={() => setMode("company")}
            >
              <Building2 className="w-4 h-4 mr-1" /> Empresa
            </Button>
          )}
          <Button
            variant={mode === "personal" ? "default" : "outline"}
            size="sm"
            onClick={() => setMode("personal")}
          >
            <User className="w-4 h-4 mr-1" /> Pessoal
          </Button>
        </div>

        <div className="glass-card p-5 space-y-3">
          <h2 className="font-display font-semibold text-foreground">Novo Departamento</h2>
          <div className="flex gap-2">
            <Input
              placeholder="Emoji"
              value={newDept.icon}
              onChange={(e) => setNewDept((p) => ({ ...p, icon: e.target.value }))}
              className="w-16 text-center"
            />
            <Input
              placeholder="Nome do departamento"
              value={newDept.name}
              onChange={(e) => setNewDept((p) => ({ ...p, name: e.target.value }))}
              onKeyDown={(e) => e.key === "Enter" && addDepartment()}
              className="flex-1"
            />
            <Button onClick={addDepartment}>
              <Plus className="w-4 h-4 mr-1" /> Criar
            </Button>
          </div>
        </div>

        {/* Voice + AI input */}
        <VoiceOKRInput
          mode={mode}
          existingDepartments={departments}
          onCreated={loadAll}
        />

        {/* Departments list with drag & drop */}
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDeptDragEnd}>
          <SortableContext items={departments.map((d) => d.id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-4">
              {departments.map((dept) => {
                const deptObjectives = objectives
                  .filter((o) => o.department_id === dept.id)
                  .sort((a, b) => a.sort_order - b.sort_order);

                return (
                  <SortableItem key={dept.id} id={dept.id}>
                    <div className="glass-card border border-border/50 overflow-hidden">
                      {/* Dept header */}
                      <div className="flex items-center justify-between p-5 bg-muted/20">
                        <div className="flex items-center gap-3">
                          <span className="text-lg">{dept.icon}</span>
                          <h2 className="font-display font-semibold text-foreground text-lg">{dept.name}</h2>
                        </div>
                        <Button variant="ghost" size="icon" onClick={() => deleteDepartment(dept.id)} className="text-destructive hover:text-destructive">
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>

                      <div className="p-5 space-y-4">
                        {/* Objectives with drag & drop */}
                        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleObjDragEnd(dept.id)}>
                          <SortableContext items={deptObjectives.map((o) => o.id)} strategy={verticalListSortingStrategy}>
                            {deptObjectives.map((obj) => {
                              const objKRs = keyResults
                                .filter((kr) => kr.objective_id === obj.id)
                                .sort((a, b) => a.sort_order - b.sort_order);

                              return (
                                <SortableItem key={obj.id} id={obj.id}>
                                  <div className="rounded-lg bg-muted/30 p-4 space-y-3">
                                    <div className="flex items-center justify-between gap-2">
                                      <h3 className="font-display font-medium text-sm text-foreground flex-1">{obj.title}</h3>
                                      <Popover>
                                        <PopoverTrigger asChild>
                                          <Button variant="ghost" size="sm" className={cn("h-6 text-[10px] px-1.5 gap-1", obj.deadline ? "text-foreground" : "text-muted-foreground")}>
                                            <CalendarIcon className="w-3 h-3" />
                                            {obj.deadline ? format(new Date(obj.deadline + "T12:00:00"), "dd/MM", { locale: ptBR }) : "Prazo"}
                                          </Button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-auto p-0" align="end">
                                          <Calendar
                                            mode="single"
                                            selected={obj.deadline ? new Date(obj.deadline + "T12:00:00") : undefined}
                                            onSelect={async (date) => {
                                              await supabase.from("objectives").update({ deadline: date ? format(date, "yyyy-MM-dd") : null } as any).eq("id", obj.id);
                                              loadAll();
                                            }}
                                            className="p-3 pointer-events-auto"
                                          />
                                        </PopoverContent>
                                      </Popover>
                                      <Button variant="ghost" size="icon" onClick={() => deleteObjective(obj.id)} className="h-7 w-7 text-destructive hover:text-destructive">
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </Button>
                                    </div>

                                    {/* Key Results with drag & drop */}
                                    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleKRDragEnd(obj.id)}>
                                      <SortableContext items={objKRs.map((kr) => kr.id)} strategy={verticalListSortingStrategy}>
                                        <ul className="space-y-1.5">
                                          {objKRs.map((kr) => {
                                            const prioLabel: Record<string, string> = { high: "Alta", medium: "Média", low: "Baixa" };
                                            const prioStyle: Record<string, string> = {
                                              high: "bg-destructive/15 text-destructive",
                                              medium: "bg-amber-500/15 text-amber-500",
                                              low: "bg-muted/50 text-muted-foreground",
                                            };
                                            return (
                                              <SortableItem key={kr.id} id={kr.id} handleClassName="mt-0.5">
                                                <li className="flex items-center justify-between group">
                                                  <span className="text-sm text-secondary-foreground flex-1">{kr.title}</span>
                                                  <div className="flex items-center gap-1">
                                                    {/* Assign to user */}
                                                    <Select
                                                      value={kr.assigned_to || "__none__"}
                                                      onValueChange={(val) => assignKR(kr.id, val === "__none__" ? null : val)}
                                                    >
                                                      <SelectTrigger className={cn(
                                                        "h-6 text-[10px] w-[90px] border-0 px-1.5",
                                                        kr.assigned_to ? "bg-accent/50 text-accent-foreground" : "bg-muted/30 text-muted-foreground"
                                                      )}>
                                                        <UserPlus className="w-3 h-3 mr-0.5 shrink-0" />
                                                        <SelectValue placeholder="Atribuir" />
                                                      </SelectTrigger>
                                                      <SelectContent>
                                                        <SelectItem value="__none__">Nenhum</SelectItem>
                                                        {profiles.map((p) => (
                                                          <SelectItem key={p.user_id} value={p.user_id}>
                                                            {p.display_name}
                                                          </SelectItem>
                                                        ))}
                                                      </SelectContent>
                                                    </Select>
                                                    {/* Priority */}
                                                    <Select
                                                      value={kr.priority || "medium"}
                                                      onValueChange={async (val) => {
                                                        await supabase.from("key_results").update({ priority: val }).eq("id", kr.id);
                                                        loadAll();
                                                      }}
                                                    >
                                                      <SelectTrigger className={cn("h-6 text-[10px] w-[70px] border-0 px-1.5", prioStyle[kr.priority || "medium"])}>
                                                        <SelectValue />
                                                      </SelectTrigger>
                                                      <SelectContent>
                                                        <SelectItem value="high">🔴 Alta</SelectItem>
                                                        <SelectItem value="medium">🟡 Média</SelectItem>
                                                        <SelectItem value="low">🟢 Baixa</SelectItem>
                                                      </SelectContent>
                                                    </Select>
                                                    {/* Deadline */}
                                                    <Popover>
                                                      <PopoverTrigger asChild>
                                                        <Button variant="ghost" size="sm" className={cn("h-6 text-[10px] px-1 gap-0.5", kr.deadline ? "text-foreground" : "text-muted-foreground opacity-0 group-hover:opacity-100")}>
                                                          <CalendarIcon className="w-3 h-3" />
                                                          {kr.deadline ? format(new Date(kr.deadline + "T12:00:00"), "dd/MM") : ""}
                                                        </Button>
                                                      </PopoverTrigger>
                                                      <PopoverContent className="w-auto p-0" align="end">
                                                        <Calendar
                                                          mode="single"
                                                          selected={kr.deadline ? new Date(kr.deadline + "T12:00:00") : undefined}
                                                          onSelect={async (date) => {
                                                            await supabase.from("key_results").update({ deadline: date ? format(date, "yyyy-MM-dd") : null } as any).eq("id", kr.id);
                                                            loadAll();
                                                          }}
                                                          className="p-3 pointer-events-auto"
                                                        />
                                                      </PopoverContent>
                                                    </Popover>
                                                    <Button
                                                      variant="ghost"
                                                      size="icon"
                                                      onClick={() => deleteKeyResult(kr.id)}
                                                      className="h-6 w-6 opacity-0 group-hover:opacity-100 text-destructive hover:text-destructive transition-opacity"
                                                    >
                                                      <Trash2 className="w-3 h-3" />
                                                    </Button>
                                                  </div>
                                                </li>
                                              </SortableItem>
                                            );
                                          })}
                                        </ul>
                                      </SortableContext>
                                    </DndContext>

                                    {/* Add KR */}
                                    <div className="flex gap-2">
                                      <Input
                                        placeholder="Novo key result..."
                                        value={newKR[obj.id] || ""}
                                        onChange={(e) => setNewKR((p) => ({ ...p, [obj.id]: e.target.value }))}
                                        onKeyDown={(e) => e.key === "Enter" && addKeyResult(obj.id)}
                                        className="h-8 text-sm flex-1"
                                      />
                                      <Select
                                        value={newKRPriority[obj.id] || "medium"}
                                        onValueChange={(val) => setNewKRPriority((p) => ({ ...p, [obj.id]: val }))}
                                      >
                                        <SelectTrigger className="h-8 w-[90px] text-xs">
                                          <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                          <SelectItem value="high">🔴 Alta</SelectItem>
                                          <SelectItem value="medium">🟡 Média</SelectItem>
                                          <SelectItem value="low">🟢 Baixa</SelectItem>
                                        </SelectContent>
                                      </Select>
                                      <Button size="sm" variant="outline" onClick={() => addKeyResult(obj.id)} className="h-8">
                                        <Plus className="w-3 h-3" />
                                      </Button>
                                    </div>
                                  </div>
                                </SortableItem>
                              );
                            })}
                          </SortableContext>
                        </DndContext>

                        {/* Add Objective */}
                        <div className="flex gap-2">
                          <Input
                            placeholder="Novo objetivo..."
                            value={newObj[dept.id] || ""}
                            onChange={(e) => setNewObj((p) => ({ ...p, [dept.id]: e.target.value }))}
                            onKeyDown={(e) => e.key === "Enter" && addObjective(dept.id)}
                            className="h-9"
                          />
                          <Button size="sm" onClick={() => addObjective(dept.id)} className="h-9">
                            <Plus className="w-4 h-4 mr-1" /> Objetivo
                          </Button>
                        </div>
                      </div>
                    </div>
                  </SortableItem>
                );
              })}
            </div>
          </SortableContext>
        </DndContext>
      </div>
    </div>
  );
}
