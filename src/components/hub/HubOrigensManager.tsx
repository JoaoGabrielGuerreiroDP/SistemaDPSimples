import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, Trash2, Tag } from "lucide-react";

interface HubOrigem {
  id: string;
  nome: string;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  canEdit: boolean;
}

export function HubOrigensManager({ open, onOpenChange, canEdit }: Props) {
  const [origens, setOrigens] = useState<HubOrigem[]>([]);
  const [novo, setNovo] = useState("");
  const [loading, setLoading] = useState(false);

  const load = async () => {
    const { data } = await (supabase as any).from("hub_origens").select("*").order("nome");
    if (data) setOrigens(data);
  };

  useEffect(() => {
    if (open) load();
  }, [open]);

  const handleAdd = async () => {
    if (!novo.trim()) return;
    setLoading(true);
    const { error } = await (supabase as any).from("hub_origens").insert({ nome: novo.trim() });
    setLoading(false);
    if (error) {
      toast.error("Erro ao adicionar origem");
      return;
    }
    toast.success("Origem cadastrada!");
    setNovo("");
    load();
  };

  const handleDelete = async (id: string) => {
    const { error } = await (supabase as any).from("hub_origens").delete().eq("id", id);
    if (error) {
      toast.error("Erro ao excluir");
      return;
    }
    toast.success("Origem removida");
    load();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Tag className="w-4 h-4 text-primary" />
            Origens dos Parceiros
          </DialogTitle>
        </DialogHeader>

        {canEdit && (
          <div className="flex gap-2">
            <Input
              placeholder="Nome da origem (ex: Indicação, Site, Evento...)"
              value={novo}
              onChange={(e) => setNovo(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleAdd())}
            />
            <Button onClick={handleAdd} disabled={loading || !novo.trim()} size="sm">
              <Plus className="w-3.5 h-3.5" />
            </Button>
          </div>
        )}

        <div className="space-y-1 max-h-[50vh] overflow-y-auto">
          {origens.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-4">Nenhuma origem cadastrada.</p>
          ) : (
            origens.map((o) => (
              <div
                key={o.id}
                className="flex items-center justify-between gap-2 p-2 rounded-md border border-border bg-secondary/30"
              >
                <span className="text-xs font-medium">{o.nome}</span>
                {canEdit && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 text-destructive/70 hover:text-destructive"
                    onClick={() => handleDelete(o.id)}
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                )}
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
