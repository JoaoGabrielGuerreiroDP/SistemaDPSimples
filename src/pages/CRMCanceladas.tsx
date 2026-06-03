import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Plus, Trash2, Upload, Loader2, FileText, XCircle, Pencil, GripVertical } from "lucide-react";
import { toast } from "sonner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
  closestCorners,
} from "@dnd-kit/core";

// ─── Types ────────────────────────────────────────────────────────────────────
interface CRMCard {
  id: string;
  cliente: string;
  origem_cliente: string | null;
  origem_administradora: string | null;
  observacoes: string | null;
  fundo_comum: number | null;
  melhor_proposta: number | null;
  quem_fez_proposta: string | null;
  valor_ofertado_cliente: number | null;
  extrato_url: string | null;
  extrato_path: string | null;
  stage: string;
  tags: string[] | null;
  sort_order: number;
  created_at: string;
}

const STAGES = [
  { id: "tem_proposta", title: "Tem proposta", color: "border-l-slate-400" },
  { id: "proposta_enviada", title: "Proposta enviada", color: "border-l-blue-500" },
  { id: "negociacao_fechada", title: "Negociação fechada", color: "border-l-violet-500" },
  { id: "transferencia_dp", title: "Transferência DP", color: "border-l-amber-500" },
  { id: "transferencia_parceiro", title: "Transferência Parceiro", color: "border-l-orange-500" },
  { id: "pago", title: "Pago", color: "border-l-emerald-500" },
] as const;

const AVAILABLE_TAGS = ["Aumentar proposta", "Assinado", "Não assinado"] as const;

const fmt = (v: number | null | undefined) =>
  v == null ? "—" : new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

// ─── Card form ────────────────────────────────────────────────────────────────
function CardForm({
  initial,
  onSave,
  onCancel,
  saving,
  origens,
  onCreateOrigem,
  onDeleteOrigem,
  propositores,
  onCreatePropositor,
  onDeletePropositor,
  canManageOrigens,
}: {
  initial?: Partial<CRMCard>;
  onSave: (data: Partial<CRMCard> & { extratoFile?: File | null }) => void;
  onCancel: () => void;
  saving: boolean;
  origens: { id: string; nome: string }[];
  onCreateOrigem: (nome: string) => Promise<void>;
  onDeleteOrigem: (id: string) => void;
  propositores: { id: string; nome: string }[];
  onCreatePropositor: (nome: string) => Promise<void>;
  onDeletePropositor: (id: string) => void;
  canManageOrigens: boolean;
}) {
  const [cliente, setCliente] = useState(initial?.cliente ?? "");
  const [origemCliente, setOrigemCliente] = useState(initial?.origem_cliente ?? "");
  const [origemAdm, setOrigemAdm] = useState(initial?.origem_administradora ?? "");
  const [observacoes, setObservacoes] = useState(initial?.observacoes ?? "");
  const [fundoComum, setFundoComum] = useState(initial?.fundo_comum?.toString() ?? "");
  const [melhorProposta, setMelhorProposta] = useState(initial?.melhor_proposta?.toString() ?? "");
  const [quemFez, setQuemFez] = useState(initial?.quem_fez_proposta ?? "");
  const [valorOfertado, setValorOfertado] = useState(initial?.valor_ofertado_cliente?.toString() ?? "");
  const [tags, setTags] = useState<string[]>(initial?.tags ?? []);
  const [extratoFile, setExtratoFile] = useState<File | null>(null);
  const [showNewOrigem, setShowNewOrigem] = useState(false);
  const [newOrigem, setNewOrigem] = useState("");
  const [creatingOrigem, setCreatingOrigem] = useState(false);
  const [showNewProp, setShowNewProp] = useState(false);
  const [newProp, setNewProp] = useState("");
  const [creatingProp, setCreatingProp] = useState(false);

  const toggleTag = (t: string) =>
    setTags((p) => (p.includes(t) ? p.filter((x) => x !== t) : [...p, t]));

  const handleCreateOrigem = async () => {
    const n = newOrigem.trim();
    if (!n) return;
    setCreatingOrigem(true);
    try {
      await onCreateOrigem(n);
      setOrigemCliente(n);
      setNewOrigem("");
      setShowNewOrigem(false);
    } finally {
      setCreatingOrigem(false);
    }
  };

  const handleCreateProp = async () => {
    const n = newProp.trim();
    if (!n) return;
    setCreatingProp(true);
    try {
      await onCreatePropositor(n);
      setQuemFez(n);
      setNewProp("");
      setShowNewProp(false);
    } finally {
      setCreatingProp(false);
    }
  };

  return (
    <div className="space-y-3 max-h-[70vh] overflow-y-auto pr-1">
      <div>
        <label className="text-xs font-medium text-foreground mb-1 block">Cliente *</label>
        <Input value={cliente} onChange={(e) => setCliente(e.target.value)} maxLength={120} />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-xs font-medium text-foreground mb-1 block">Origem do cliente</label>
          {showNewOrigem ? (
            <div className="flex gap-1">
              <Input
                value={newOrigem}
                onChange={(e) => setNewOrigem(e.target.value)}
                placeholder="Nova origem"
                maxLength={80}
                autoFocus
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleCreateOrigem(); } }}
              />
              <Button type="button" size="sm" onClick={handleCreateOrigem} disabled={creatingOrigem || !newOrigem.trim()}>
                {creatingOrigem ? <Loader2 className="h-3 w-3 animate-spin" /> : "OK"}
              </Button>
              <Button type="button" size="sm" variant="ghost" onClick={() => { setShowNewOrigem(false); setNewOrigem(""); }}>
                ✕
              </Button>
            </div>
          ) : (
            <div className="flex gap-1">
              <Select value={origemCliente || undefined} onValueChange={setOrigemCliente}>
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  {origens.map((o) => (
                    <div key={o.id} className="flex items-center group">
                      <SelectItem value={o.nome} className="flex-1">{o.nome}</SelectItem>
                      {canManageOrigens && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            if (confirm(`Excluir origem "${o.nome}"?`)) {
                              onDeleteOrigem(o.id);
                              if (origemCliente === o.nome) setOrigemCliente("");
                            }
                          }}
                          className="px-2 py-1 text-destructive opacity-0 group-hover:opacity-100 hover:bg-destructive/10 rounded"
                          title="Excluir origem"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                  ))}
                  {origens.length === 0 && (
                    <div className="text-xs text-muted-foreground p-2">Nenhuma origem cadastrada</div>
                  )}
                </SelectContent>
              </Select>
              {canManageOrigens && (
                <Button type="button" size="icon" variant="outline" onClick={() => setShowNewOrigem(true)} title="Cadastrar nova origem">
                  <Plus className="h-4 w-4" />
                </Button>
              )}
            </div>
          )}
        </div>
        <div>
          <label className="text-xs font-medium text-foreground mb-1 block">Origem da administradora</label>
          <Input value={origemAdm} onChange={(e) => setOrigemAdm(e.target.value)} maxLength={80} />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <div>
          <label className="text-xs font-medium text-foreground mb-1 block">Fundo comum</label>
          <Input type="number" step="0.01" value={fundoComum} onChange={(e) => setFundoComum(e.target.value)} />
        </div>
        <div>
          <label className="text-xs font-medium text-foreground mb-1 block">Melhor proposta</label>
          <Input type="number" step="0.01" value={melhorProposta} onChange={(e) => setMelhorProposta(e.target.value)} />
        </div>
        <div>
          <label className="text-xs font-medium text-foreground mb-1 block">Valor ofertado ao cliente</label>
          <Input type="number" step="0.01" value={valorOfertado} onChange={(e) => setValorOfertado(e.target.value)} />
        </div>
      </div>
      <div>
        <label className="text-xs font-medium text-foreground mb-1 block">Quem fez a proposta</label>
        {showNewProp ? (
          <div className="flex gap-1">
            <Input
              value={newProp}
              onChange={(e) => setNewProp(e.target.value)}
              placeholder="Novo nome"
              maxLength={80}
              autoFocus
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleCreateProp(); } }}
            />
            <Button type="button" size="sm" onClick={handleCreateProp} disabled={creatingProp || !newProp.trim()}>
              {creatingProp ? <Loader2 className="h-3 w-3 animate-spin" /> : "OK"}
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => { setShowNewProp(false); setNewProp(""); }}>
              ✕
            </Button>
          </div>
        ) : (
          <div className="flex gap-1">
            <Select value={quemFez || undefined} onValueChange={setQuemFez}>
              <SelectTrigger className="flex-1">
                <SelectValue placeholder="Selecione..." />
              </SelectTrigger>
              <SelectContent>
                {propositores.map((p) => (
                  <div key={p.id} className="flex items-center group">
                    <SelectItem value={p.nome} className="flex-1">{p.nome}</SelectItem>
                    {canManageOrigens && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          if (confirm(`Excluir "${p.nome}"?`)) {
                            onDeletePropositor(p.id);
                            if (quemFez === p.nome) setQuemFez("");
                          }
                        }}
                        className="px-2 py-1 text-destructive opacity-0 group-hover:opacity-100 hover:bg-destructive/10 rounded"
                        title="Excluir"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                ))}
                {propositores.length === 0 && (
                  <div className="text-xs text-muted-foreground p-2">Nenhum cadastrado</div>
                )}
              </SelectContent>
            </Select>
            {canManageOrigens && (
              <Button type="button" size="icon" variant="outline" onClick={() => setShowNewProp(true)} title="Cadastrar novo">
                <Plus className="h-4 w-4" />
              </Button>
            )}
          </div>
        )}
      </div>
      <div>
        <label className="text-xs font-medium text-foreground mb-1 block">Observações</label>
        <Textarea value={observacoes} onChange={(e) => setObservacoes(e.target.value)} rows={3} maxLength={1000} />
      </div>
      <div>
        <label className="text-xs font-medium text-foreground mb-1 block">Etiquetas</label>
        <div className="flex flex-wrap gap-1.5">
          {AVAILABLE_TAGS.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => toggleTag(t)}
              className={`text-xs px-2 py-1 rounded-md border transition-colors ${
                tags.includes(t)
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-background text-foreground border-border hover:border-primary/50"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>
      <div>
        <label className="text-xs font-medium text-foreground mb-1 block">Extrato (PDF, imagem)</label>
        <Input
          type="file"
          accept=".pdf,image/*"
          onChange={(e) => setExtratoFile(e.target.files?.[0] ?? null)}
        />
        {initial?.extrato_url && !extratoFile && (
          <p className="text-[11px] text-muted-foreground mt-1">Extrato já anexado — selecione um novo para substituir.</p>
        )}
      </div>

      <DialogFooter className="pt-2">
        <Button variant="outline" onClick={onCancel} disabled={saving}>Cancelar</Button>
        <Button
          onClick={() => {
            if (!cliente.trim()) {
              toast.error("Nome do cliente é obrigatório");
              return;
            }
            onSave({
              cliente: cliente.trim(),
              origem_cliente: origemCliente.trim() || null,
              origem_administradora: origemAdm.trim() || null,
              observacoes: observacoes.trim() || null,
              fundo_comum: fundoComum ? parseFloat(fundoComum) : null,
              melhor_proposta: melhorProposta ? parseFloat(melhorProposta) : null,
              quem_fez_proposta: quemFez.trim() || null,
              valor_ofertado_cliente: valorOfertado ? parseFloat(valorOfertado) : null,
              tags,
              extratoFile,
            });
          }}
          disabled={saving}
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
          Salvar
        </Button>
      </DialogFooter>
    </div>
  );
}

// ─── Draggable card ───────────────────────────────────────────────────────────
function KanbanCard({
  card,
  canEdit,
  onEdit,
  onDelete,
}: {
  card: CRMCard;
  canEdit: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: card.id,
    disabled: !canEdit,
  });

  return (
    <Card
      ref={setNodeRef}
      className={`overflow-hidden transition-opacity ${isDragging ? "opacity-30" : ""}`}
    >
      <CardContent className="p-3 space-y-2">
        <div className="flex items-start gap-2">
          {canEdit && (
            <button
              {...attributes}
              {...listeners}
              className="text-muted-foreground hover:text-foreground cursor-grab active:cursor-grabbing mt-0.5"
              aria-label="Arrastar"
            >
              <GripVertical className="h-3.5 w-3.5" />
            </button>
          )}
          <div className="flex-1 min-w-0">
            <h4 className="font-medium text-sm text-foreground truncate">{card.cliente}</h4>
            {card.origem_cliente && (
              <p className="text-[11px] text-muted-foreground truncate">Origem: {card.origem_cliente}</p>
            )}
          </div>
          {canEdit && (
            <div className="flex gap-0.5">
              <Button size="icon" variant="ghost" className="h-6 w-6" onClick={onEdit}>
                <Pencil className="h-3 w-3" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="h-6 w-6 text-destructive hover:text-destructive"
                onClick={onDelete}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          )}
        </div>

        {(card.fundo_comum || card.melhor_proposta || card.valor_ofertado_cliente) && (
          <div className="grid grid-cols-3 gap-1 text-[10px]">
            {card.fundo_comum != null && (
              <div className="bg-muted/50 rounded px-1.5 py-1">
                <p className="text-muted-foreground">FC</p>
                <p className="font-medium text-foreground">{fmt(card.fundo_comum)}</p>
              </div>
            )}
            {card.melhor_proposta != null && (
              <div className="bg-muted/50 rounded px-1.5 py-1">
                <p className="text-muted-foreground">Melhor</p>
                <p className="font-medium text-foreground">{fmt(card.melhor_proposta)}</p>
              </div>
            )}
            {card.valor_ofertado_cliente != null && (
              <div className="bg-muted/50 rounded px-1.5 py-1">
                <p className="text-muted-foreground">Ofertado</p>
                <p className="font-medium text-foreground">{fmt(card.valor_ofertado_cliente)}</p>
              </div>
            )}
          </div>
        )}

        {card.quem_fez_proposta && (
          <p className="text-[11px] text-muted-foreground">Por: {card.quem_fez_proposta}</p>
        )}

        {card.tags && card.tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {card.tags.map((t) => (
              <Badge
                key={t}
                variant="secondary"
                className={`text-[10px] ${
                  t === "Assinado"
                    ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
                    : t === "Não assinado"
                      ? "bg-rose-500/15 text-rose-700 dark:text-rose-400"
                      : "bg-amber-500/15 text-amber-700 dark:text-amber-400"
                }`}
              >
                {t}
              </Badge>
            ))}
          </div>
        )}

        {card.extrato_url && (
          <a
            href={card.extrato_url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-[11px] text-primary hover:underline"
            onClick={(e) => e.stopPropagation()}
          >
            <FileText className="h-3 w-3" /> Ver extrato
          </a>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Droppable column ─────────────────────────────────────────────────────────
function KanbanColumn({
  stageId,
  children,
}: {
  stageId: string;
  children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: stageId });
  return (
    <div
      ref={setNodeRef}
      className={`space-y-2 min-h-[100px] rounded-lg p-1 transition-colors ${isOver ? "bg-primary/5" : ""}`}
    >
      {children}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function CRMCanceladas() {
  const { user } = useAuth();
  const { role } = useUserRole();
  const queryClient = useQueryClient();
  const canEdit = role === "admin" || role === "gestor";

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<CRMCard | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const { data: origens = [] } = useQuery({
    queryKey: ["crm_canceladas_origens"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("crm_canceladas_origens" as any)
        .select("id, nome")
        .order("nome");
      if (error) throw error;
      return ((data ?? []) as unknown) as { id: string; nome: string }[];
    },
  });

  const createOrigem = async (nome: string) => {
    const { error } = await supabase.from("crm_canceladas_origens" as any).insert({ nome, created_by: user!.id });
    if (error) {
      toast.error(error.message.includes("duplicate") ? "Origem já cadastrada" : "Erro ao criar origem");
      throw error;
    }
    await queryClient.invalidateQueries({ queryKey: ["crm_canceladas_origens"] });
    toast.success("Origem cadastrada!");
  };

  const deleteOrigem = async (id: string) => {
    const { error } = await supabase.from("crm_canceladas_origens" as any).delete().eq("id", id);
    if (error) { toast.error("Erro ao excluir origem"); return; }
    queryClient.invalidateQueries({ queryKey: ["crm_canceladas_origens"] });
    toast.success("Origem excluída");
  };

  const { data: propositores = [] } = useQuery({
    queryKey: ["crm_canceladas_propositores"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("crm_canceladas_propositores" as any)
        .select("id, nome")
        .order("nome");
      if (error) throw error;
      return ((data ?? []) as unknown) as { id: string; nome: string }[];
    },
  });

  const createPropositor = async (nome: string) => {
    const { error } = await supabase.from("crm_canceladas_propositores" as any).insert({ nome, created_by: user!.id });
    if (error) {
      toast.error(error.message.includes("duplicate") ? "Nome já cadastrado" : "Erro ao cadastrar");
      throw error;
    }
    await queryClient.invalidateQueries({ queryKey: ["crm_canceladas_propositores"] });
    toast.success("Cadastrado!");
  };

  const deletePropositor = async (id: string) => {
    const { error } = await supabase.from("crm_canceladas_propositores" as any).delete().eq("id", id);
    if (error) { toast.error("Erro ao excluir"); return; }
    queryClient.invalidateQueries({ queryKey: ["crm_canceladas_propositores"] });
    toast.success("Excluído");
  };

  const { data: cards = [], isLoading } = useQuery({
    queryKey: ["crm_canceladas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("crm_canceladas")
        .select("*")
        .order("stage")
        .order("sort_order");
      if (error) throw error;
      return data as CRMCard[];
    },
  });

  const upsert = useMutation({
    mutationFn: async (payload: Partial<CRMCard> & { extratoFile?: File | null }) => {
      let extrato_url = editing?.extrato_url ?? null;
      let extrato_path = editing?.extrato_path ?? null;

      if (payload.extratoFile) {
        const ext = payload.extratoFile.name.split(".").pop();
        const path = `${user!.id}/${Date.now()}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from("crm-canceladas-extratos")
          .upload(path, payload.extratoFile);
        if (upErr) throw upErr;
        const { data: signed } = await supabase.storage
          .from("crm-canceladas-extratos")
          .createSignedUrl(path, 60 * 60 * 24 * 365);
        extrato_url = signed?.signedUrl ?? null;
        extrato_path = path;
      }

      const row = {
        cliente: payload.cliente!,
        origem_cliente: payload.origem_cliente ?? null,
        origem_administradora: payload.origem_administradora ?? null,
        observacoes: payload.observacoes ?? null,
        fundo_comum: payload.fundo_comum ?? null,
        melhor_proposta: payload.melhor_proposta ?? null,
        quem_fez_proposta: payload.quem_fez_proposta ?? null,
        valor_ofertado_cliente: payload.valor_ofertado_cliente ?? null,
        tags: payload.tags ?? [],
        extrato_url,
        extrato_path,
      };

      if (editing) {
        const { error } = await supabase.from("crm_canceladas").update(row).eq("id", editing.id);
        if (error) throw error;
      } else {
        const stage = "tem_proposta";
        const maxOrder = Math.max(
          0,
          ...cards.filter((c) => c.stage === stage).map((c) => c.sort_order),
        );
        const { error } = await supabase.from("crm_canceladas").insert({
          ...row,
          stage,
          sort_order: maxOrder + 1,
          created_by: user!.id,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["crm_canceladas"] });
      setDialogOpen(false);
      setEditing(null);
      toast.success("Card salvo!");
    },
    onError: (e: any) => toast.error(e.message || "Erro ao salvar card"),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("crm_canceladas").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["crm_canceladas"] });
      toast.success("Card removido");
    },
  });

  const moveStage = useMutation({
    mutationFn: async ({ id, stage }: { id: string; stage: string }) => {
      const maxOrder = Math.max(
        0,
        ...cards.filter((c) => c.stage === stage).map((c) => c.sort_order),
      );
      const { error } = await supabase
        .from("crm_canceladas")
        .update({ stage, sort_order: maxOrder + 1 })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["crm_canceladas"] }),
    onError: () => toast.error("Erro ao mover card"),
  });

  const handleDragStart = (e: DragStartEvent) => setActiveId(String(e.active.id));
  const handleDragEnd = (e: DragEndEvent) => {
    setActiveId(null);
    if (!e.over) return;
    const cardId = String(e.active.id);
    const newStage = String(e.over.id);
    const card = cards.find((c) => c.id === cardId);
    if (!card || card.stage === newStage) return;
    moveStage.mutate({ id: cardId, stage: newStage });
  };

  // ─── Filtro por mês ─────────────────────────────────────────────────────────
  const [monthFilter, setMonthFilter] = useState<string>("all"); // "all" | "YYYY-MM"

  const availableMonths = useMemo(() => {
    const set = new Set<string>();
    cards.forEach((c) => {
      const d = new Date(c.created_at);
      if (!isNaN(d.getTime())) {
        set.add(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
      }
    });
    return Array.from(set).sort().reverse();
  }, [cards]);

  const filteredCards = useMemo(() => {
    if (monthFilter === "all") return cards;
    return cards.filter((c) => {
      const d = new Date(c.created_at);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      return key === monthFilter;
    });
  }, [cards, monthFilter]);

  const grouped: Record<string, CRMCard[]> = {};
  STAGES.forEach((s) => (grouped[s.id] = []));
  filteredCards.forEach((c) => {
    if (grouped[c.stage]) grouped[c.stage].push(c);
    else grouped["tem_proposta"].push(c);
  });

  const activeCard = activeId ? cards.find((c) => c.id === activeId) : null;

  // ─── Totais ─────────────────────────────────────────────────────────────────
  const totals = filteredCards.reduce(
    (acc, c) => {
      const fc = Number(c.fundo_comum ?? 0);
      const mp = Number(c.melhor_proposta ?? 0);
      const vo = Number(c.valor_ofertado_cliente ?? 0);
      acc.fundoComum += fc;
      acc.melhorProposta += mp;
      acc.valorOfertado += vo;
      if (c.stage === "pago") acc.lucroTotal += mp - vo;
      return acc;
    },
    { fundoComum: 0, melhorProposta: 0, valorOfertado: 0, lucroTotal: 0 },
  );

  const formatMonthLabel = (key: string) => {
    const [y, m] = key.split("-");
    const date = new Date(Number(y), Number(m) - 1, 1);
    return date.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  };

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-[1800px] mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-destructive/10">
            <XCircle className="h-6 w-6 text-destructive" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">CRM Canceladas</h1>
            <p className="text-sm text-muted-foreground">
              {filteredCards.length} card{filteredCards.length !== 1 ? "s" : ""}{monthFilter !== "all" ? ` em ${formatMonthLabel(monthFilter)}` : " no painel"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Select value={monthFilter} onValueChange={setMonthFilter}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Filtrar por mês" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os meses</SelectItem>
              {availableMonths.map((m) => (
                <SelectItem key={m} value={m} className="capitalize">{formatMonthLabel(m)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex justify-end">

        {canEdit && (
          <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) setEditing(null); }}>
            <DialogTrigger asChild>
              <Button size="sm" onClick={() => setEditing(null)}>
                <Plus className="h-4 w-4 mr-1" /> Novo Cliente
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-2xl">
              <DialogHeader>
                <DialogTitle>{editing ? "Editar Card" : "Novo Cliente"}</DialogTitle>
              </DialogHeader>
              <CardForm
                initial={editing ?? undefined}
                saving={upsert.isPending}
                onCancel={() => { setDialogOpen(false); setEditing(null); }}
                onSave={(data) => upsert.mutate(data)}
                origens={origens}
                onCreateOrigem={createOrigem}
                onDeleteOrigem={deleteOrigem}
                propositores={propositores}
                onCreatePropositor={createPropositor}
                onDeletePropositor={deletePropositor}
                canManageOrigens={canEdit}
              />
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Resumo */}
      {!isLoading && cards.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Fundo Comum (total)</p>
              <p className="text-lg font-bold text-foreground mt-1">{fmt(totals.fundoComum)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Melhor Proposta (total)</p>
              <p className="text-lg font-bold text-foreground mt-1">{fmt(totals.melhorProposta)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Valor Ofertado (total)</p>
              <p className="text-lg font-bold text-foreground mt-1">{fmt(totals.valorOfertado)}</p>
            </CardContent>
          </Card>
          <Card className="border-emerald-500/40 bg-emerald-500/5">
            <CardContent className="p-4">
              <p className="text-xs text-emerald-700 dark:text-emerald-400 font-medium">Lucro Realizado</p>
              <p className={`text-lg font-bold mt-1 ${totals.lucroTotal >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-destructive"}`}>
                {fmt(totals.lucroTotal)}
              </p>
              <p className="text-[10px] text-muted-foreground mt-0.5">Apenas cards na etapa "Pago"</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Kanban */}
      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">Carregando...</div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6 gap-3">
            {STAGES.map((stage) => {
              const stageCards = grouped[stage.id] ?? [];
              const stageLucro = stageCards.reduce(
                (s, c) => s + (Number(c.melhor_proposta ?? 0) - Number(c.valor_ofertado_cliente ?? 0)),
                0,
              );
              return (
                <div
                  key={stage.id}
                  className={`bg-muted/30 rounded-lg border border-border border-l-4 ${stage.color} flex flex-col`}
                >
                  <div className="p-3 border-b border-border space-y-1">
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold text-sm text-foreground">{stage.title}</h3>
                      <Badge variant="secondary" className="text-xs">{stageCards.length}</Badge>
                    </div>
                    {stageCards.length > 0 && stage.id === "pago" && (
                      <p className="text-[11px] text-muted-foreground">
                        Lucro: <span className={`font-semibold ${stageLucro >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-destructive"}`}>{fmt(stageLucro)}</span>
                      </p>
                    )}
                  </div>
                  <div className="p-2 flex-1">
                    <KanbanColumn stageId={stage.id}>
                      {stageCards.map((card) => (
                        <KanbanCard
                          key={card.id}
                          card={card}
                          canEdit={canEdit}
                          onEdit={() => { setEditing(card); setDialogOpen(true); }}
                          onDelete={() => {
                            if (confirm(`Remover card "${card.cliente}"?`)) remove.mutate(card.id);
                          }}
                        />
                      ))}
                      {stageCards.length === 0 && (
                        <p className="text-xs text-muted-foreground text-center py-6">
                          Nenhum card
                        </p>
                      )}
                    </KanbanColumn>
                  </div>
                </div>
              );
            })}
          </div>

          <DragOverlay>
            {activeCard && (
              <div className="opacity-90 rotate-2">
                <KanbanCard card={activeCard} canEdit={false} onEdit={() => {}} onDelete={() => {}} />
              </div>
            )}
          </DragOverlay>
        </DndContext>
      )}
    </div>
  );
}
