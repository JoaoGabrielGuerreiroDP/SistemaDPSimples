import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { HubPartner } from "@/hooks/useHubData";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { CheckCircle2, CircleDot, FileText, Send, Users, ArrowRight, Calendar } from "lucide-react";

const ETAPAS = [
  { value: "Apresentação", color: "bg-blue-500", icon: Users },
  { value: "Reunião Agendada", color: "bg-cyan-500", icon: Calendar },
  { value: "Envio de Documentos", color: "bg-yellow-500", icon: FileText },
  { value: "Análise Cadastral", color: "bg-orange-500", icon: CircleDot },
  { value: "Implantação", color: "bg-purple-500", icon: Send },
  { value: "Ativo", color: "bg-green-500", icon: CheckCircle2 },
];

interface HubStageManagerProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  partners: HubPartner[];
  onSaved: () => void;
}

export function HubStageManager({ open, onOpenChange, partners, onSaved }: HubStageManagerProps) {
  const [changes, setChanges] = useState<Record<number, string>>({});
  const [saving, setSaving] = useState(false);

  const handleChange = (partnerId: number, newEtapa: string) => {
    setChanges((prev) => {
      const partner = partners.find((p) => p.id === partnerId);
      if (partner?.etapa === newEtapa) {
        const next = { ...prev };
        delete next[partnerId];
        return next;
      }
      return { ...prev, [partnerId]: newEtapa };
    });
  };

  const handleSaveAll = async () => {
    const entries = Object.entries(changes);
    if (entries.length === 0) {
      toast.info("Nenhuma alteração para salvar.");
      return;
    }

    setSaving(true);
    let errorCount = 0;

    await Promise.all(
      entries.map(async ([id, etapa]) => {
        const { error } = await supabase
          .from("hub_partners")
          .update({ etapa } as any)
          .eq("id", Number(id));
        if (error) errorCount++;
      })
    );

    setSaving(false);

    if (errorCount > 0) {
      toast.error(`Erro ao salvar ${errorCount} parceiro(s)`);
    } else {
      toast.success(`${entries.length} parceiro(s) atualizado(s)!`);
      setChanges({});
      onOpenChange(false);
      onSaved();
    }
  };

  const handleClose = (v: boolean) => {
    if (!v) setChanges({});
    onOpenChange(v);
  };

  const changedCount = Object.keys(changes).length;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowRight className="w-4 h-4 text-primary" />
            Gerenciar Fases dos Parceiros
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-1">
          {/* Legend */}
          <div className="flex gap-1.5 flex-wrap mb-3">
            {ETAPAS.map((e) => (
              <span
                key={e.value}
                className={`text-[9px] font-medium text-white px-2 py-0.5 rounded-full ${e.color}`}
              >
                {e.value}
              </span>
            ))}
          </div>

          {/* Partners list */}
          {partners.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">Nenhum parceiro cadastrado.</p>
          ) : (
            <div className="space-y-2">
              {partners.map((p) => {
                const currentEtapa = changes[p.id] || p.etapa;
                const hasChanged = changes[p.id] !== undefined;
                return (
                  <div
                    key={p.id}
                    className={`flex items-center gap-3 p-2.5 rounded-lg border transition-colors ${
                      hasChanged ? "border-primary/50 bg-primary/5" : "border-border bg-secondary/30"
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium text-foreground truncate">{p.nome}</p>
                      <p className="text-[10px] text-muted-foreground truncate">{p.escritorio} · {p.cidade}</p>
                    </div>
                    <Select value={currentEtapa} onValueChange={(v) => handleChange(p.id, v)}>
                      <SelectTrigger className="h-7 w-[170px] text-[11px] shrink-0">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ETAPAS.map((e) => {
                          const Icon = e.icon;
                          return (
                            <SelectItem key={e.value} value={e.value}>
                              <span className="flex items-center gap-1.5">
                                <span className={`w-2 h-2 rounded-full ${e.color}`} />
                                {e.value}
                              </span>
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between pt-3 border-t">
          <span className="text-[11px] text-muted-foreground">
            {changedCount > 0 ? `${changedCount} alteração(ões) pendente(s)` : "Nenhuma alteração"}
          </span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => handleClose(false)}>
              Cancelar
            </Button>
            <Button size="sm" onClick={handleSaveAll} disabled={saving || changedCount === 0}>
              {saving ? "Salvando..." : "Salvar Tudo"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
