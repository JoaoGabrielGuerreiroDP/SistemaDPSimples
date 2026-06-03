import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";
import { Target, Pencil, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { toast } from "@/hooks/use-toast";

function formatBRL(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

interface SalesGoalCardProps {
  selectedYear: number;
  selectedMonth: number;
  totalVendido: number;
}

export function SalesGoalCard({ selectedYear, selectedMonth, totalVendido }: SalesGoalCardProps) {
  const { isGestor } = useUserRole();
  const mesRef = `${selectedYear}-${String(selectedMonth + 1).padStart(2, "0")}`;
  const [meta, setMeta] = useState<number>(0);
  const [editing, setEditing] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    supabase
      .from("sales_goals")
      .select("meta")
      .eq("mes_ref", mesRef)
      .maybeSingle()
      .then(({ data }) => {
        setMeta(data?.meta ? Number(data.meta) : 0);
        setLoading(false);
      });
  }, [mesRef]);

  const progress = meta > 0 ? Math.min((totalVendido / meta) * 100, 100) : 0;
  const overMeta = meta > 0 && totalVendido >= meta;

  const handleSave = async () => {
    const newMeta = parseFloat(inputValue.replace(/\./g, "").replace(",", "."));
    if (isNaN(newMeta) || newMeta < 0) {
      toast({ title: "Valor inválido", variant: "destructive" });
      return;
    }

    const { error } = await supabase
      .from("sales_goals")
      .upsert({ mes_ref: mesRef, meta: newMeta }, { onConflict: "mes_ref" });

    if (error) {
      toast({ title: "Erro ao salvar meta", description: error.message, variant: "destructive" });
      return;
    }

    setMeta(newMeta);
    setEditing(false);
    toast({ title: "Meta atualizada!" });
  };

  const startEditing = () => {
    setInputValue(meta > 0 ? meta.toLocaleString("pt-BR", { maximumFractionDigits: 0 }) : "");
    setEditing(true);
  };

  if (loading) return null;

  return (
    <div className="glass-card p-3 sm:p-5 space-y-3 border-l-4 border-l-[hsl(45,85%,50%)]">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Target className="w-4 h-4 sm:w-5 sm:h-5 text-[hsl(45,85%,50%)]" />
          <span className="text-[10px] sm:text-sm text-muted-foreground font-medium">Meta Mensal</span>
        </div>
        {isGestor && !editing && (
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={startEditing}>
            <Pencil className="w-3.5 h-3.5 text-muted-foreground" />
          </Button>
        )}
      </div>

      {editing ? (
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">R$</span>
          <Input
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="Ex: 500000"
            className="h-8 text-sm"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSave();
              if (e.key === "Escape") setEditing(false);
            }}
          />
          <Button variant="ghost" size="icon" className="h-7 w-7 text-primary" onClick={handleSave}>
            <Check className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setEditing(false)}>
            <X className="w-4 h-4" />
          </Button>
        </div>
      ) : (
        <>
          <div className="font-display text-base sm:text-2xl font-bold text-foreground">
            {meta > 0 ? formatBRL(meta) : (
              <span className="text-muted-foreground text-sm">
                {isGestor ? "Clique no lápis para definir" : "Meta não definida"}
              </span>
            )}
          </div>

          {meta > 0 && (
            <div className="space-y-1.5">
              <Progress value={progress} className="h-2.5 sm:h-3" />
              <div className="flex items-center justify-between text-[10px] sm:text-xs">
                <span className={overMeta ? "text-emerald-400 font-semibold" : "text-muted-foreground"}>
                  {progress.toFixed(1)}% atingido
                </span>
                <span className="text-muted-foreground">
                  {formatBRL(totalVendido)} / {formatBRL(meta)}
                </span>
              </div>
              {overMeta && (
                <p className="text-[10px] sm:text-xs text-emerald-400 font-medium">
                  🎉 Meta batida! Excedente: {formatBRL(totalVendido - meta)}
                </p>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
