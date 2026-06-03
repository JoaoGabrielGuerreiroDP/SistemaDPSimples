import { useState } from "react";
import { Link } from "react-router-dom";

import { useUserRole } from "@/hooks/useUserRole";
import { useHubData, HubPartner } from "@/hooks/useHubData";
import { supabase } from "@/integrations/supabase/client";
import { HubPartnerForm } from "@/components/hub/HubPartnerForm";
import { HubStageManager } from "@/components/hub/HubStageManager";
import { HubChecklistTab } from "@/components/hub/HubChecklistTab";
import { HubExportButton } from "@/components/hub/HubExportButton";
import { HubOrigensManager } from "@/components/hub/HubOrigensManager";
import { toast } from "sonner";
import { buildPartnerDeadlineUrl } from "@/lib/google-calendar";
import { Button } from "@/components/ui/button";

import {
  DndContext,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  closestCenter,
  useDroppable,
  useDraggable,
  type DragStartEvent,
  type DragEndEvent,
  type DragOverEvent,
} from "@dnd-kit/core";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Building2,
  MapPin,
  Clock,
  AlertTriangle,
  CheckCircle2,
  Send,
  CircleDot,
  Calendar,
  Users,
  Target,
  FileText,
  Plus,
  Pencil,
  Trash2,
  X,
  Search,
  TrendingUp,
  Zap,
  BarChart3,
  ExternalLink,
  GripVertical,
  Tag,
} from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const ETAPAS = [
  { value: "Apresentação", color: "bg-blue-500", icon: Users },
  { value: "Reunião Agendada", color: "bg-cyan-500", icon: Calendar },
  { value: "Envio de Documentos", color: "bg-yellow-500", icon: FileText },
  { value: "Análise Cadastral", color: "bg-orange-500", icon: CircleDot },
  { value: "Implantação", color: "bg-purple-500", icon: Send },
  { value: "Ativo", color: "bg-emerald-500", icon: CheckCircle2 },
];

const STATUS_COLORS: Record<string, string> = {
  Aprovado: "text-emerald-400",
  Enviado: "text-blue-400",
  Aguardando: "text-amber-400",
  Pendente: "text-red-400",
};

const STATUS_BG: Record<string, string> = {
  Aprovado: "bg-emerald-500/10",
  Enviado: "bg-blue-500/10",
  Aguardando: "bg-amber-500/10",
  Pendente: "bg-red-500/10",
};

function statusIcon(status: string | null) {
  if (!status) return null;
  const color = STATUS_COLORS[status] || "text-muted-foreground";
  if (status === "Aprovado") return <CheckCircle2 className={`w-3.5 h-3.5 ${color}`} />;
  if (status === "Enviado") return <Send className={`w-3.5 h-3.5 ${color}`} />;
  if (status === "Pendente") return <AlertTriangle className={`w-3.5 h-3.5 ${color}`} />;
  return <Clock className={`w-3.5 h-3.5 ${color}`} />;
}

function AdminStatusBadge({ label, status, docs }: { label: string; status: string | null; docs: string | null }) {
  if (!status) return null;
  const color = STATUS_COLORS[status] || "text-muted-foreground";
  const bg = STATUS_BG[status] || "bg-muted/50";
  return (
    <div className={`flex items-center gap-1.5 text-[11px] px-2 py-1 rounded-md ${bg}`}>
      {statusIcon(status)}
      <span className={`font-medium ${color}`}>{label}</span>
      {docs && docs !== "OK" && docs !== "Docs completos" && (
        <span className="text-muted-foreground/60 ml-0.5 truncate max-w-[60px]">({docs})</span>
      )}
    </div>
  );
}

function calcProgress(partner: HubPartner): number {
  const etapaIdx = ETAPAS.findIndex((e) => e.value === partner.etapa);
  const baseProgress = etapaIdx >= 0 ? (etapaIdx / (ETAPAS.length - 1)) * 60 : 0;
  let admProgress = 0;
  [partner.status_mag, partner.status_anc, partner.status_can].forEach((s) => {
    if (s === "Aprovado") admProgress += 13.3;
    else if (s === "Enviado") admProgress += 8;
    else if (s === "Aguardando") admProgress += 3;
  });
  return Math.min(100, Math.round(baseProgress + admProgress));
}

function formatCurrency(val: number | null) {
  if (!val) return "R$ 0";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(val);
}

// ─── Card content (usado tanto no board quanto no DragOverlay) ────────────────

function PartnerCardContent({ partner, isDragging = false }: { partner: HubPartner; isDragging?: boolean }) {
  const progress = calcProgress(partner);
  const isPastDue = partner.prazo && new Date(partner.prazo) < new Date();

  return (
    <div
      className={`rounded-lg border border-border/40 bg-card/90 p-2.5 space-y-2 transition-all ${
        isDragging ? "shadow-2xl border-primary/40 rotate-1 scale-105" : ""
      }`}
    >
      <div className="flex items-start justify-between gap-1.5">
        <div className="min-w-0 flex-1">
          <h4 className="font-semibold text-foreground text-[12px] leading-tight truncate">{partner.nome}</h4>
          <div className="flex items-center gap-2 text-[10px] text-muted-foreground mt-0.5">
            {partner.escritorio && (
              <span className="flex items-center gap-0.5 truncate">
                <Building2 className="w-2.5 h-2.5 shrink-0" />
                {partner.escritorio}
              </span>
            )}
            {partner.cidade && (
              <span className="flex items-center gap-0.5 truncate">
                <MapPin className="w-2.5 h-2.5 shrink-0" />
                {partner.cidade}
              </span>
            )}
          </div>
        </div>
        <GripVertical className="w-3.5 h-3.5 text-muted-foreground/30 shrink-0 mt-0.5" />
      </div>

      <div className="flex gap-1 flex-wrap">
        {partner.origem && (
          <span className="inline-flex items-center gap-1 text-[9px] font-medium px-1.5 py-0.5 rounded-full bg-primary/15 text-primary border border-primary/20">
            <Tag className="w-2 h-2" /> {partner.origem}
          </span>
        )}
        <AdminStatusBadge label="Mag" status={partner.status_mag} docs={partner.docs_mag} />
        <AdminStatusBadge label="Ânc" status={partner.status_anc} docs={partner.docs_anc} />
        <AdminStatusBadge label="Can" status={partner.status_can} docs={partner.docs_can} />
      </div>

      <div className="space-y-0.5">
        <div className="flex justify-between text-[10px]">
          <span className="text-muted-foreground">Progresso</span>
          <span className="font-semibold text-foreground">{progress}%</span>
        </div>
        <div className="relative h-1.5 rounded-full bg-secondary/80 overflow-hidden">
          <div
            className={`absolute inset-y-0 left-0 rounded-full transition-all duration-500 ${
              progress >= 80
                ? "bg-emerald-500"
                : progress >= 50
                  ? "bg-blue-500"
                  : progress >= 25
                    ? "bg-amber-500"
                    : "bg-red-400"
            }`}
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {partner.prox_acao && (
        <div className="flex items-start gap-1.5 text-[10px] p-1.5 rounded-md bg-primary/5 border border-primary/10">
          <Target className="w-2.5 h-2.5 text-primary mt-0.5 shrink-0" />
          <span className="text-muted-foreground leading-snug line-clamp-2">{partner.prox_acao}</span>
        </div>
      )}

      <div className="flex items-center justify-between pt-1 border-t border-border/20 text-[9px]">
        <span className="text-muted-foreground/70 font-medium truncate max-w-[80px]">{partner.responsavel}</span>
        {partner.prazo && (
          <span className={isPastDue ? "text-destructive font-semibold" : "text-muted-foreground/60"}>
            {new Date(partner.prazo).toLocaleDateString("pt-BR")}
          </span>
        )}
      </div>
    </div>
  );
}

// ─── Card draggable ───────────────────────────────────────────────────────────

function DraggableCard({
  partner,
  canEdit,
  onEdit,
  onDelete,
}: {
  partner: HubPartner;
  canEdit: boolean;
  onEdit: (p: HubPartner) => void;
  onDelete: (id: number) => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: partner.id,
    disabled: !canEdit,
    data: { partner },
  });

  return (
    <div ref={setNodeRef} className={`group relative ${isDragging ? "opacity-30" : ""}`}>
      {/* Drag handle — cobre o card inteiro */}
      <div
        {...listeners}
        {...attributes}
        className="absolute inset-0 z-10 cursor-grab active:cursor-grabbing rounded-lg"
        style={{ touchAction: "none" }}
      />

      {/* Botões de ação ficam acima do handle */}
      {canEdit && (
        <div className="absolute top-2 right-6 z-20 flex gap-0 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button
            variant="ghost"
            size="icon"
            className="h-5 w-5 rounded"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              onEdit(partner);
            }}
          >
            <Pencil className="w-2.5 h-2.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-5 w-5 rounded text-destructive/70 hover:text-destructive"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              onDelete(partner.id);
            }}
          >
            <Trash2 className="w-2.5 h-2.5" />
          </Button>
        </div>
      )}

      <PartnerCardContent partner={partner} />
    </div>
  );
}

// ─── Coluna droppable ─────────────────────────────────────────────────────────

function DroppableColumn({
  etapa,
  partners,
  canEdit,
  onEdit,
  onDelete,
  isOver,
}: {
  etapa: (typeof ETAPAS)[number];
  partners: HubPartner[];
  canEdit: boolean;
  onEdit: (p: HubPartner) => void;
  onDelete: (id: number) => void;
  isOver: boolean;
}) {
  const { setNodeRef } = useDroppable({ id: etapa.value });
  const EIcon = etapa.icon;

  return (
    <div className="flex-shrink-0 w-[260px] sm:w-[280px]">
      <div className={`flex items-center gap-1.5 px-3 py-2 rounded-t-xl ${etapa.color}`}>
        <EIcon className="w-3.5 h-3.5 text-white" />
        <span className="text-[11px] font-bold text-white">{etapa.value}</span>
        <span className="ml-auto text-[10px] font-mono text-white/80 bg-white/20 rounded-full px-1.5 py-0.5">
          {partners.length}
        </span>
      </div>
      <div
        ref={setNodeRef}
        className={`border border-t-0 rounded-b-xl p-2 space-y-2 min-h-[200px] max-h-[calc(100vh-380px)] overflow-y-auto scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent transition-colors duration-150 ${
          isOver ? "bg-primary/8 border-primary/40 ring-1 ring-primary/20" : "bg-secondary/30 border-border/30"
        }`}
      >
        {partners.length === 0 ? (
          <div
            className={`flex flex-col items-center justify-center py-8 rounded-lg border-2 border-dashed transition-colors ${
              isOver ? "border-primary/40 text-primary/50" : "border-border/20 text-muted-foreground/40"
            }`}
          >
            <Users className="w-5 h-5 mb-1" />
            <span className="text-[10px]">{isOver ? "Soltar aqui" : "Nenhum parceiro"}</span>
          </div>
        ) : (
          partners.map((p) => (
            <DraggableCard key={p.id} partner={p} canEdit={canEdit} onEdit={onEdit} onDelete={onDelete} />
          ))
        )}
      </div>
    </div>
  );
}

// ─── Kanban Board ─────────────────────────────────────────────────────────────

function KanbanBoard({
  partners,
  canEdit,
  onEdit,
  onDelete,
  onEtapaChange,
  loading,
}: {
  partners: HubPartner[];
  canEdit: boolean;
  onEdit: (p: HubPartner) => void;
  onDelete: (id: number) => void;
  onEtapaChange: (partnerId: number, newEtapa: string) => Promise<void>;
  loading: boolean;
}) {
  const [activePartner, setActivePartner] = useState<HubPartner | null>(null);
  const [overColumn, setOverColumn] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
  );

  function handleDragStart(event: DragStartEvent) {
    const partner = partners.find((p) => p.id === event.active.id);
    if (partner) setActivePartner(partner);
  }

  function handleDragOver(event: DragOverEvent) {
    const { over } = event;
    if (!over) {
      setOverColumn(null);
      return;
    }
    const col = ETAPAS.find((e) => e.value === over.id);
    setOverColumn(col ? col.value : null);
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setActivePartner(null);
    setOverColumn(null);

    if (!over || !canEdit) return;

    const dragged = partners.find((p) => p.id === active.id);
    if (!dragged) return;

    const targetEtapa = ETAPAS.find((e) => e.value === over.id)?.value;
    if (targetEtapa && targetEtapa !== dragged.etapa) {
      await onEtapaChange(dragged.id, targetEtapa);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground">
        <div className="animate-pulse flex items-center gap-2 text-sm">
          <div className="w-2 h-2 rounded-full bg-primary animate-bounce" />
          Carregando parceiros...
        </div>
      </div>
    );
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <div className="flex gap-3 overflow-x-auto pb-4 -mx-3 px-3 sm:mx-0 sm:px-0 scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent">
        {ETAPAS.map((etapa) => (
          <DroppableColumn
            key={etapa.value}
            etapa={etapa}
            partners={partners.filter((p) => p.etapa === etapa.value)}
            canEdit={canEdit}
            onEdit={onEdit}
            onDelete={onDelete}
            isOver={overColumn === etapa.value}
          />
        ))}
      </div>

      <DragOverlay dropAnimation={{ duration: 150, easing: "ease" }}>
        {activePartner ? (
          <div className="w-[260px] sm:w-[280px]">
            <PartnerCardContent partner={activePartner} isDragging />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────

function KPICard({
  label,
  value,
  sub,
  icon: Icon,
  gradient,
}: {
  label: string;
  value: string | number;
  sub?: string;
  icon: React.ElementType;
  gradient: string;
}) {
  return (
    <div className={`relative overflow-hidden rounded-xl border border-border/30 p-3 sm:p-5 ${gradient}`}>
      <div className="absolute top-2 right-2 sm:top-3 sm:right-3 opacity-10">
        <Icon className="w-7 h-7 sm:w-10 sm:h-10" />
      </div>
      <div className="relative z-10">
        <p className="text-base sm:text-2xl font-bold text-foreground truncate">{value}</p>
        <p className="text-[10px] sm:text-xs text-muted-foreground font-medium mt-0.5 sm:mt-1">{label}</p>
        {sub && <p className="text-[9px] sm:text-[10px] text-muted-foreground/60 mt-0.5 truncate">{sub}</p>}
      </div>
    </div>
  );
}

// ─── Página principal ─────────────────────────────────────────────────────────

export default function Hub() {
  const { isAdmin, role } = useUserRole();
  const { partners, historico, metas, checklist, checklistStatus, loading, reload } = useHubData();
  const [activeTab, setActiveTab] = useState("parceiros");
  const [formOpen, setFormOpen] = useState(false);
  const [stageOpen, setStageOpen] = useState(false);
  const [origensOpen, setOrigensOpen] = useState(false);
  const [editing, setEditing] = useState<HubPartner | null>(null);
  const [filterEtapa, setFilterEtapa] = useState<string>("all");
  const [filterAdm, setFilterAdm] = useState<string>("all");
  const [search, setSearch] = useState("");
  const canEdit = isAdmin || role === "gestor" || role === "gestor_hub";

  const handleEdit = (p: HubPartner) => {
    setEditing(p);
    setFormOpen(true);
  };
  const handleAdd = () => {
    setEditing(null);
    setFormOpen(true);
  };
  const handleDelete = async (id: number) => {
    const { error } = await supabase.from("hub_partners").delete().eq("id", id);
    if (error) {
      toast.error("Erro ao remover");
      return;
    }
    toast.success("Parceiro removido");
    reload();
  };

  const handleEtapaChange = async (partnerId: number, newEtapa: string) => {
    const { error } = await supabase.from("hub_partners").update({ etapa: newEtapa }).eq("id", partnerId);
    if (error) {
      toast.error("Erro ao mover parceiro");
      return;
    }
    toast.success(`Movido para "${newEtapa}"`);
    reload();
  };

  const filteredPartners = partners.filter((p) => {
    if (
      search &&
      !p.nome.toLowerCase().includes(search.toLowerCase()) &&
      !p.escritorio?.toLowerCase().includes(search.toLowerCase()) &&
      !p.cidade?.toLowerCase().includes(search.toLowerCase())
    )
      return false;
    if (filterEtapa !== "all" && p.etapa !== filterEtapa) return false;
    if (filterAdm !== "all") {
      const statusKey = filterAdm === "mag" ? p.status_mag : filterAdm === "anc" ? p.status_anc : p.status_can;
      if (!statusKey || statusKey === "Aguardando") return false;
    }
    return true;
  });

  const hasFilters = filterEtapa !== "all" || filterAdm !== "all" || search !== "";
  const pendencias = partners.filter(
    (p) => p.status_mag === "Pendente" || p.status_anc === "Pendente" || p.status_can === "Pendente",
  ).length;
  const byEtapa = ETAPAS.map((e) => ({ ...e, count: partners.filter((p) => p.etapa === e.value).length }));
  const totalMeta = metas.reduce((s, m) => s + m.meta_mag + m.meta_anc + m.meta_can, 0);
  const totalReal = metas.reduce((s, m) => s + m.realizado_mag + m.realizado_anc + m.realizado_can, 0);

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-4 py-4 sm:py-8 space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="space-y-2.5">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h1 className="text-base sm:text-2xl font-bold text-foreground tracking-tight">
              🏢 HUB — Corretoras Master
            </h1>
            <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5">
              Magalu · Âncora · Canopus — Onboarding
            </p>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <Button
              variant="outline"
              size="sm"
              className="text-[10px] sm:text-xs h-7 sm:h-8 rounded-lg border-border/50 px-2 sm:px-3"
              onClick={() => setOrigensOpen(true)}
            >
              <Tag className="w-3 h-3 sm:mr-1.5" />
              <span className="hidden sm:inline">Origens</span>
            </Button>
            {canEdit && (
              <Button
                size="sm"
                className="text-[10px] sm:text-xs h-7 sm:h-8 rounded-lg shadow-sm shadow-primary/20 px-2.5 sm:px-3"
                onClick={handleAdd}
              >
                <Plus className="w-3 h-3 sm:mr-1.5" />
                <span className="hidden sm:inline">Novo Parceiro</span>
              </Button>
            )}
          </div>
        </div>
        <div className="flex gap-1.5">
          <HubExportButton partners={filteredPartners} />
          {canEdit && (
            <Button
              variant="outline"
              size="sm"
              className="text-[10px] sm:text-xs h-7 sm:h-8 rounded-lg border-border/50 px-2 sm:px-3"
              onClick={() => setStageOpen(true)}
            >
              <CircleDot className="w-3 h-3 sm:mr-1.5" />
              <span className="hidden sm:inline">Fases</span>
            </Button>
          )}
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
        <KPICard
          label="Total Parceiros"
          value={partners.length}
          icon={Users}
          gradient="bg-gradient-to-br from-card to-blue-500/5"
        />
        <KPICard
          label="Com Pendências"
          value={pendencias}
          icon={AlertTriangle}
          gradient="bg-gradient-to-br from-card to-red-500/8"
        />
        <KPICard
          label="Ativos"
          value={partners.filter((p) => p.etapa === "Ativo").length}
          icon={Zap}
          sub="Parceiros ativos"
          gradient="bg-gradient-to-br from-card to-emerald-500/8"
        />
        <KPICard
          label="Realizado"
          value={formatCurrency(totalReal)}
          icon={TrendingUp}
          sub={`Meta: ${formatCurrency(totalMeta)}`}
          gradient="bg-gradient-to-br from-card to-primary/8"
        />
      </div>

      {/* Pipeline pills */}
      <div className="flex gap-1 sm:gap-1.5 overflow-x-auto pb-1 scrollbar-none -mx-3 px-3 sm:mx-0 sm:px-0">
        {byEtapa.map((e) => {
          const active = filterEtapa === e.value;
          const EIcon = e.icon;
          return (
            <button
              key={e.value}
              onClick={() => setFilterEtapa(active ? "all" : e.value)}
              className={`flex items-center gap-1 text-[10px] sm:text-[11px] font-medium text-white px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg transition-all whitespace-nowrap ${e.color} ${
                filterEtapa !== "all" && !active ? "opacity-30 scale-95" : "opacity-100"
              } ${active ? "ring-2 ring-white/30 shadow-md" : "hover:opacity-90"}`}
            >
              <EIcon className="w-3 h-3" />
              <span className="hidden sm:inline">{e.value}:</span> {e.count}
            </button>
          );
        })}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[120px] max-w-[200px] sm:max-w-[280px]">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 sm:w-3.5 sm:h-3.5 text-muted-foreground/60" />
          <Input
            placeholder="Buscar..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-7 sm:h-8 pl-7 sm:pl-8 text-[11px] sm:text-xs rounded-lg bg-secondary/50 border-border/30 focus:bg-card"
          />
        </div>
        <Select value={filterEtapa} onValueChange={setFilterEtapa}>
          <SelectTrigger className="h-7 sm:h-8 w-auto min-w-[100px] sm:min-w-[140px] text-[11px] sm:text-xs rounded-lg bg-secondary/50 border-border/30">
            <SelectValue placeholder="Etapa" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas etapas</SelectItem>
            {ETAPAS.map((e) => (
              <SelectItem key={e.value} value={e.value}>
                {e.value} ({byEtapa.find((b) => b.value === e.value)?.count || 0})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterAdm} onValueChange={setFilterAdm}>
          <SelectTrigger className="h-7 sm:h-8 w-auto min-w-[100px] sm:min-w-[140px] text-[11px] sm:text-xs rounded-lg bg-secondary/50 border-border/30">
            <SelectValue placeholder="Adm." />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas adm.</SelectItem>
            <SelectItem value="mag">🔵 Magalu</SelectItem>
            <SelectItem value="anc">🔴 Âncora</SelectItem>
            <SelectItem value="can">🟢 Canopus</SelectItem>
          </SelectContent>
        </Select>
        {hasFilters && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 sm:h-8 text-[10px] sm:text-xs text-muted-foreground rounded-lg px-1.5 sm:px-2"
            onClick={() => {
              setFilterEtapa("all");
              setFilterAdm("all");
              setSearch("");
            }}
          >
            <X className="w-3 h-3" />
          </Button>
        )}
        {hasFilters && (
          <span className="text-[9px] sm:text-[10px] text-muted-foreground/70 ml-auto font-medium">
            {filteredPartners.length}/{partners.length}
          </span>
        )}
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="w-full grid grid-cols-4 rounded-xl bg-secondary/60 p-0.5 sm:p-1 h-8 sm:h-9">
          <TabsTrigger value="parceiros" className="rounded-lg text-[10px] sm:text-xs data-[state=active]:shadow-sm">
            Parceiros
          </TabsTrigger>
          <TabsTrigger value="checklist" className="rounded-lg text-[10px] sm:text-xs data-[state=active]:shadow-sm">
            Checklist
          </TabsTrigger>
          <TabsTrigger value="timeline" className="rounded-lg text-[10px] sm:text-xs data-[state=active]:shadow-sm">
            Timeline
          </TabsTrigger>
          <TabsTrigger value="metas" className="rounded-lg text-[10px] sm:text-xs data-[state=active]:shadow-sm">
            Metas
          </TabsTrigger>
        </TabsList>

        <TabsContent value="parceiros" className="mt-4">
          <KanbanBoard
            partners={filteredPartners}
            canEdit={canEdit}
            onEdit={handleEdit}
            onDelete={handleDelete}
            onEtapaChange={handleEtapaChange}
            loading={loading}
          />
        </TabsContent>

        <TabsContent value="checklist" className="mt-4">
          <HubChecklistTab
            checklist={checklist}
            checklistStatus={checklistStatus}
            partners={partners}
            canEdit={canEdit}
            onReload={reload}
          />
        </TabsContent>

        <TabsContent value="timeline" className="mt-4">
          {historico.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border/50 p-12 text-center text-muted-foreground">
              <Clock className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">Nenhuma atividade registrada.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {historico.map((h) => {
                const partner = partners.find((p) => p.id === h.partner_id);
                return (
                  <div
                    key={h.id}
                    className="group rounded-xl border border-border/30 bg-card/60 p-3.5 flex items-start gap-3 hover:bg-card transition-colors"
                  >
                    <div className="text-[10px] text-muted-foreground/50 w-16 shrink-0 pt-0.5 font-mono">
                      {new Date(h.data).toLocaleDateString("pt-BR")}
                    </div>
                    <div className="w-px h-8 bg-border/50 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-semibold text-foreground">
                          {partner?.nome || `#${h.partner_id}`}
                        </span>
                        {h.tipo && (
                          <Badge variant="outline" className="text-[9px] h-4 rounded-md">
                            {h.tipo}
                          </Badge>
                        )}
                        {h.adm && h.adm !== "Todas" && (
                          <Badge variant="secondary" className="text-[9px] h-4 rounded-md">
                            {h.adm}
                          </Badge>
                        )}
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed">{h.acao}</p>
                      {h.doc_pendente && (
                        <p className="text-[10px] text-destructive mt-1 flex items-center gap-1 font-medium">
                          <AlertTriangle className="w-3 h-3" /> {h.doc_pendente}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="metas" className="mt-4">
          {metas.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border/50 p-12 text-center text-muted-foreground">
              <BarChart3 className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">Nenhuma meta registrada.</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {[
                  {
                    label: "🔵 Magalu",
                    meta: metas.reduce((s, m) => s + m.meta_mag, 0),
                    real: metas.reduce((s, m) => s + m.realizado_mag, 0),
                    accent: "from-blue-500/10 to-transparent",
                  },
                  {
                    label: "🔴 Âncora",
                    meta: metas.reduce((s, m) => s + m.meta_anc, 0),
                    real: metas.reduce((s, m) => s + m.realizado_anc, 0),
                    accent: "from-red-500/10 to-transparent",
                  },
                  {
                    label: "🟢 Canopus",
                    meta: metas.reduce((s, m) => s + m.meta_can, 0),
                    real: metas.reduce((s, m) => s + m.realizado_can, 0),
                    accent: "from-emerald-500/10 to-transparent",
                  },
                ].map((a) => {
                  const pct = a.meta > 0 ? (a.real / a.meta) * 100 : 0;
                  return (
                    <div
                      key={a.label}
                      className={`rounded-xl border border-border/30 bg-gradient-to-br ${a.accent} p-4 space-y-2`}
                    >
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-semibold">{a.label}</p>
                        <span className="text-[10px] text-muted-foreground font-mono">{Math.round(pct)}%</span>
                      </div>
                      <p className="text-lg font-bold text-foreground">{formatCurrency(a.real)}</p>
                      <div className="relative h-2 rounded-full bg-secondary/80 overflow-hidden">
                        <div
                          className={`absolute inset-y-0 left-0 rounded-full transition-all duration-500 ${pct >= 80 ? "bg-emerald-500" : pct >= 50 ? "bg-blue-500" : "bg-amber-500"}`}
                          style={{ width: `${Math.min(100, pct)}%` }}
                        />
                      </div>
                      <p className="text-[10px] text-muted-foreground">Meta: {formatCurrency(a.meta)}</p>
                    </div>
                  );
                })}
              </div>
              <div className="space-y-2">
                {partners.map((p) => {
                  const pMetas = metas.filter((m) => m.partner_id === p.id);
                  if (pMetas.length === 0) return null;
                  const tReal = pMetas.reduce((s, m) => s + m.realizado_mag + m.realizado_anc + m.realizado_can, 0);
                  const tMeta = pMetas.reduce((s, m) => s + m.meta_mag + m.meta_anc + m.meta_can, 0);
                  const pct = tMeta > 0 ? (tReal / tMeta) * 100 : 0;
                  return (
                    <div
                      key={p.id}
                      className="rounded-xl border border-border/30 bg-card/60 p-3.5 flex items-center gap-3 hover:bg-card transition-colors"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-semibold text-foreground">{p.nome}</p>
                        <p className="text-[10px] text-muted-foreground/70">{p.escritorio}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-bold text-foreground">{formatCurrency(tReal)}</p>
                        <p className="text-[10px] text-muted-foreground/60">de {formatCurrency(tMeta)}</p>
                      </div>
                      <div className="w-16 shrink-0">
                        <div className="relative h-2 rounded-full bg-secondary/80 overflow-hidden">
                          <div
                            className={`absolute inset-y-0 left-0 rounded-full ${pct >= 80 ? "bg-emerald-500" : pct >= 50 ? "bg-blue-500" : "bg-amber-500"}`}
                            style={{ width: `${Math.min(100, pct)}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>

      <HubPartnerForm
        open={formOpen}
        onOpenChange={(v) => {
          setFormOpen(v);
          if (!v) setEditing(null);
        }}
        partner={editing}
        onSaved={reload}
      />
      {canEdit && <HubStageManager open={stageOpen} onOpenChange={setStageOpen} partners={partners} onSaved={reload} />}
      <HubOrigensManager open={origensOpen} onOpenChange={setOrigensOpen} canEdit={canEdit} />
    </div>
  );
}
