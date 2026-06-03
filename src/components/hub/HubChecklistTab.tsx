import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { HubChecklistItem, HubChecklistStatus, HubPartner } from "@/hooks/useHubData";
import { toast } from "sonner";

const STATUS_CYCLE = ["⏳", "✅", "❌", "N/A"];

function nextStatus(current: string) {
  const idx = STATUS_CYCLE.indexOf(current);
  return STATUS_CYCLE[(idx + 1) % STATUS_CYCLE.length];
}

function statusColor(s: string) {
  if (s === "✅") return "bg-green-500/20 text-green-400 border-green-500/30";
  if (s === "❌") return "bg-red-500/20 text-red-400 border-red-500/30";
  if (s === "N/A") return "bg-muted text-muted-foreground border-muted";
  return "bg-yellow-500/20 text-yellow-400 border-yellow-500/30";
}

interface Props {
  checklist: HubChecklistItem[];
  checklistStatus: HubChecklistStatus[];
  partners: HubPartner[];
  canEdit: boolean;
  onReload: () => void;
}

export function HubChecklistTab({ checklist, checklistStatus, partners, canEdit, onReload }: Props) {
  const [updating, setUpdating] = useState<string | null>(null);

  const getStatus = (checklistId: string, partnerId: number) => {
    const found = checklistStatus.find(
      (cs) => cs.checklist_id === checklistId && cs.partner_id === partnerId
    );
    return found?.status || "⏳";
  };

  const handleToggle = async (checklistId: string, partnerId: number) => {
    if (!canEdit) return;
    const key = `${checklistId}-${partnerId}`;
    setUpdating(key);

    const current = getStatus(checklistId, partnerId);
    const newStatus = nextStatus(current);
    const existing = checklistStatus.find(
      (cs) => cs.checklist_id === checklistId && cs.partner_id === partnerId
    );

    let error;
    if (existing) {
      ({ error } = await supabase
        .from("hub_checklist_status")
        .update({ status: newStatus } as any)
        .eq("id", existing.id));
    } else {
      ({ error } = await supabase
        .from("hub_checklist_status")
        .insert({ checklist_id: checklistId, partner_id: partnerId, status: newStatus } as any));
    }

    if (error) {
      toast.error("Erro ao atualizar status");
      console.error(error);
    }
    setUpdating(null);
    onReload();
  };

  // Group by grupo
  const groups = [...new Set(checklist.map((c) => c.grupo))];

  // Calculate completion stats per partner
  const totalDocs = checklist.length;

  if (checklist.length === 0) {
    return <div className="glass-card p-8 text-center text-muted-foreground">Nenhum documento no checklist.</div>;
  }

  return (
    <div className="space-y-4">
      {/* Partner completion summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {partners.map((p) => {
          const done = checklist.filter((c) => {
            const s = getStatus(c.id, p.id);
            return s === "✅" || s === "N/A";
          }).length;
          const pct = totalDocs > 0 ? Math.round((done / totalDocs) * 100) : 0;
          return (
            <div key={p.id} className="glass-card p-2.5 text-center">
              <p className="text-xs font-medium text-foreground truncate">{p.nome}</p>
              <p className={`text-lg font-bold ${pct === 100 ? "text-green-400" : pct > 50 ? "text-yellow-400" : "text-red-400"}`}>{pct}%</p>
              <p className="text-[9px] text-muted-foreground">{done}/{totalDocs} docs</p>
            </div>
          );
        })}
      </div>

      {/* Checklist table */}
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left py-2 px-2 text-muted-foreground font-medium min-w-[200px]">Documento</th>
              <th className="text-center py-2 px-1 text-muted-foreground font-medium text-[10px]">Obrig.</th>
              {partners.map((p) => (
                <th key={p.id} className="text-center py-2 px-1 text-muted-foreground font-medium text-[10px] min-w-[60px]">
                  {p.nome.split(" ")[0]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {groups.map((grupo) => (
              <>
                <tr key={`group-${grupo}`}>
                  <td colSpan={2 + partners.length} className="pt-3 pb-1 px-2 text-[10px] font-bold text-primary uppercase tracking-wider">
                    {grupo}
                  </td>
                </tr>
                {checklist
                  .filter((c) => c.grupo === grupo)
                  .map((item) => (
                    <tr key={item.id} className="border-b border-border/30 hover:bg-accent/30">
                      <td className="py-1.5 px-2 text-foreground">{item.documento}</td>
                      <td className="py-1.5 px-1 text-center">
                        <span className={`text-[9px] ${item.obrigatorio === "Obrigatório" ? "text-red-400" : "text-muted-foreground"}`}>
                          {item.obrigatorio === "Obrigatório" ? "Obrig." : item.obrigatorio}
                        </span>
                      </td>
                      {partners.map((p) => {
                        const status = getStatus(item.id, p.id);
                        const key = `${item.id}-${p.id}`;
                        return (
                          <td key={p.id} className="py-1.5 px-1 text-center">
                            <button
                              onClick={() => handleToggle(item.id, p.id)}
                              disabled={!canEdit || updating === key}
                              className={`inline-flex items-center justify-center w-8 h-6 rounded border text-[11px] font-medium transition-colors ${statusColor(status)} ${canEdit ? "cursor-pointer hover:opacity-80" : "cursor-default"}`}
                            >
                              {updating === key ? "…" : status}
                            </button>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
              </>
            ))}
          </tbody>
        </table>
      </div>

      {canEdit && (
        <p className="text-[10px] text-muted-foreground text-center">
          Clique nos ícones para alternar: ⏳ Aguardando → ✅ Recebido → ❌ Pendente → N/A
        </p>
      )}
    </div>
  );
}
