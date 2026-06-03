import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Save, X, Pencil } from "lucide-react";
import { toast } from "sonner";

const ALL_CATEGORIES = [
  "Receita Estimada",
  "Estorno",
  "Receita Realizada",
  "Imposto",
  "Receita Líquida",
  "Total Comissões",
  "Custo da Operação",
  "EBITDA",
  "Custos Não Operacionais",
  "Lucro Líquido",
  "Aluguel",
  "Energia Elétrica e Água",
  "Internet e Telefone",
  "Software",
  "Contabilidade",
  "Funcionários CLT",
  "Prestadores de Serviços",
  "Tráfego Pago",
  "Marketing",
];

const MONTH_NAMES = [
  "Jan", "Fev", "Mar", "Abr", "Mai", "Jun",
  "Jul", "Ago", "Set", "Out", "Nov", "Dez",
];

function formatCurrency(cents: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(cents / 100);
}

interface BudgetEditorProps {
  selectedYear: number;
  selectedMonth: number;
  onClose: () => void;
}

export function BudgetEditor({ selectedYear, selectedMonth, onClose }: BudgetEditorProps) {
  const queryClient = useQueryClient();
  const [values, setValues] = useState<Record<string, string>>({});
  const [existing, setExisting] = useState<Record<string, { id: string; amount_cents: number }>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadData();
  }, [selectedYear, selectedMonth]);

  async function loadData() {
    setLoading(true);
    const { data } = await supabase
      .from("budget_lines")
      .select("*")
      .eq("year", selectedYear)
      .eq("month", selectedMonth + 1);

    const map: Record<string, { id: string; amount_cents: number }> = {};
    const vals: Record<string, string> = {};
    (data || []).forEach((b: any) => {
      map[b.category] = { id: b.id, amount_cents: b.amount_cents };
      vals[b.category] = (b.amount_cents / 100).toFixed(2);
    });
    ALL_CATEGORIES.forEach((cat) => {
      if (!vals[cat]) vals[cat] = "0.00";
    });
    setExisting(map);
    setValues(vals);
    setLoading(false);
  }

  async function handleSave() {
    setSaving(true);
    try {
      const upserts: any[] = [];
      for (const cat of ALL_CATEGORIES) {
        const amountCents = Math.round(parseFloat(values[cat] || "0") * 100);
        if (existing[cat]) {
          upserts.push(
            supabase
              .from("budget_lines")
              .update({ amount_cents: amountCents })
              .eq("id", existing[cat].id)
          );
        } else if (amountCents !== 0) {
          upserts.push(
            supabase
              .from("budget_lines")
              .insert({ year: selectedYear, month: selectedMonth + 1, category: cat, amount_cents: amountCents })
          );
        }
      }
      await Promise.all(upserts);
      queryClient.invalidateQueries({ queryKey: ["budget-lines"] });
      toast.success("Premissas salvas com sucesso!");
      onClose();
    } catch (e) {
      toast.error("Erro ao salvar premissas");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="text-center text-muted-foreground py-4">Carregando...</div>;

  return (
    <div className="glass-card p-4 sm:p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-display text-sm sm:text-base font-semibold text-foreground flex items-center gap-2">
          <Pencil className="w-4 h-4 text-primary" />
          Editar Premissas — {MONTH_NAMES[selectedMonth]}/{selectedYear}
        </h3>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="w-4 h-4" />
        </Button>
      </div>

      <div className="space-y-1.5 max-h-[60vh] overflow-y-auto pr-1">
        {ALL_CATEGORIES.map((cat) => (
          <div key={cat} className="flex items-center justify-between gap-3 py-1.5 border-b border-border/30 last:border-0">
            <span className="text-xs sm:text-sm text-muted-foreground flex-1 min-w-0 truncate">{cat}</span>
            <div className="flex items-center gap-1 w-36 sm:w-44">
              <span className="text-xs text-muted-foreground">R$</span>
              <Input
                type="number"
                step="0.01"
                value={values[cat] || "0"}
                onChange={(e) => setValues((prev) => ({ ...prev, [cat]: e.target.value }))}
                className="h-8 text-xs sm:text-sm text-right"
              />
            </div>
          </div>
        ))}
      </div>

      <div className="flex gap-2 justify-end pt-2">
        <Button variant="outline" size="sm" onClick={onClose} disabled={saving}>
          Cancelar
        </Button>
        <Button size="sm" onClick={handleSave} disabled={saving}>
          <Save className="w-3.5 h-3.5 mr-1" />
          {saving ? "Salvando..." : "Salvar"}
        </Button>
      </div>
    </div>
  );
}
