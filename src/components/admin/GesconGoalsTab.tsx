import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Target, Save, Loader2, Trophy, TrendingUp, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format, addMonths } from "date-fns";
import { ptBR } from "date-fns/locale";

interface GesconGoalsTabProps {
  vendas: { vendedor: string; credito: string; data_venda: string }[];
  sellers: string[];
}

function parseCredito(v: string) { return parseFloat(v) || 0; }

export function GesconGoalsTab({ vendas, sellers }: GesconGoalsTabProps) {
  const queryClient = useQueryClient();
  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState(format(now, "yyyy-MM"));
  const [editGoals, setEditGoals] = useState<Record<string, string>>({});
  const [isEditing, setIsEditing] = useState(false);

  const months = useMemo(() => {
    const list: { value: string; label: string }[] = [];
    for (let i = -2; i <= 3; i++) {
      const d = addMonths(now, i);
      list.push({
        value: format(d, "yyyy-MM"),
        label: format(d, "MMMM yyyy", { locale: ptBR }).replace(/^\w/, c => c.toUpperCase()),
      });
    }
    return list;
  }, []);

  const mesRef = selectedMonth;

  const { data: goals, isLoading } = useQuery({
    queryKey: ["gescon-goals", mesRef],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("gescon_sales_goals")
        .select("*")
        .eq("mes_ref", mesRef);
      if (error) throw error;
      return data || [];
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (entries: { vendedor: string; meta: number }[]) => {
      for (const entry of entries) {
        const { error } = await supabase
          .from("gescon_sales_goals")
          .upsert({ vendedor: entry.vendedor, mes_ref: mesRef, meta: entry.meta }, { onConflict: "vendedor,mes_ref" });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["gescon-goals"] });
      toast.success("Metas salvas com sucesso!");
      setIsEditing(false);
      setEditGoals({});
    },
    onError: (e: any) => toast.error(e.message || "Erro ao salvar metas"),
  });

  // Calculate realized per seller for selected month
  const realized = useMemo(() => {
    const map = new Map<string, number>();
    const [year, month] = selectedMonth.split("-");
    for (const v of vendas) {
      try {
        const parts = v.data_venda.split(/[/-]/);
        if (parts[2] === year && parts[1] === month) {
          map.set(v.vendedor, (map.get(v.vendedor) || 0) + parseCredito(v.credito));
        }
      } catch { }
    }
    return map;
  }, [vendas, selectedMonth]);

  const goalsMap = useMemo(() => {
    const map = new Map<string, number>();
    if (goals) {
      for (const g of goals) {
        map.set(g.vendedor, Number(g.meta));
      }
    }
    return map;
  }, [goals]);

  const sellerProgress = useMemo(() => {
    return sellers.map(seller => {
      const meta = goalsMap.get(seller) || 0;
      const real = realized.get(seller) || 0;
      const pct = meta > 0 ? (real / meta) * 100 : 0;
      return { seller, meta, real, pct };
    }).sort((a, b) => b.pct - a.pct);
  }, [sellers, goalsMap, realized]);

  const totalMeta = sellerProgress.reduce((s, p) => s + p.meta, 0);
  const totalReal = sellerProgress.reduce((s, p) => s + p.real, 0);
  const totalPct = totalMeta > 0 ? (totalReal / totalMeta) * 100 : 0;
  const atingiram = sellerProgress.filter(p => p.pct >= 100).length;

  const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

  function startEditing() {
    const obj: Record<string, string> = {};
    for (const s of sellers) {
      obj[s] = String(goalsMap.get(s) || 0);
    }
    setEditGoals(obj);
    setIsEditing(true);
  }

  function handleSave() {
    const entries = Object.entries(editGoals)
      .filter(([, v]) => Number(v) > 0)
      .map(([vendedor, meta]) => ({ vendedor, meta: Number(meta) }));
    saveMutation.mutate(entries);
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Select value={selectedMonth} onValueChange={setSelectedMonth}>
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {months.map(m => (
                <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex gap-2">
          {isEditing ? (
            <>
              <Button variant="outline" size="sm" onClick={() => { setIsEditing(false); setEditGoals({}); }}>Cancelar</Button>
              <Button size="sm" onClick={handleSave} disabled={saveMutation.isPending} className="gap-1">
                {saveMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                Salvar Metas
              </Button>
            </>
          ) : (
            <Button size="sm" onClick={startEditing} className="gap-1">
              <Target className="h-3 w-3" />Definir Metas
            </Button>
          )}
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-4">
            <p className="text-[11px] font-medium text-muted-foreground uppercase">Meta Total</p>
            <p className="text-lg font-bold">{fmt(totalMeta)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-[11px] font-medium text-muted-foreground uppercase">Realizado</p>
            <p className="text-lg font-bold">{fmt(totalReal)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-[11px] font-medium text-muted-foreground uppercase">% Atingido</p>
            <p className="text-lg font-bold">{totalPct.toFixed(1)}%</p>
            <Progress value={Math.min(totalPct, 100)} className="mt-2 h-2" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-[11px] font-medium text-muted-foreground uppercase">Bateram Meta</p>
            <p className="text-lg font-bold">{atingiram} / {sellers.length}</p>
          </CardContent>
        </Card>
      </div>

      {/* Seller list */}
      {isLoading ? (
        <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : (
        <div className="space-y-2">
          {sellerProgress.map(({ seller, meta, real, pct }) => (
            <Card key={seller}>
              <CardContent className="p-3">
                <div className="flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-sm font-medium truncate">{seller}</span>
                        {pct >= 100 && <Trophy className="h-4 w-4 text-yellow-500 shrink-0" />}
                        {pct >= 80 && pct < 100 && <TrendingUp className="h-4 w-4 text-green-500 shrink-0" />}
                        {meta > 0 && pct < 50 && <AlertTriangle className="h-4 w-4 text-red-500 shrink-0" />}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground shrink-0">
                        {isEditing ? (
                          <Input
                            type="number"
                            className="w-28 h-7 text-xs"
                            value={editGoals[seller] || "0"}
                            onChange={e => setEditGoals(prev => ({ ...prev, [seller]: e.target.value }))}
                            placeholder="Meta"
                          />
                        ) : (
                          <>
                            <span>{fmt(real)}</span>
                            <span className="text-muted-foreground/50">/</span>
                            <span>{meta > 0 ? fmt(meta) : "Sem meta"}</span>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Progress
                        value={Math.min(pct, 100)}
                        className="h-2 flex-1"
                      />
                      <Badge
                        variant={pct >= 100 ? "default" : pct >= 80 ? "secondary" : "outline"}
                        className="text-[10px] px-1.5 shrink-0"
                      >
                        {meta > 0 ? `${pct.toFixed(0)}%` : "—"}
                      </Badge>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
