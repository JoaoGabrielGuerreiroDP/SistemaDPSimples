import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Target, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useGoogleSheetsData } from "@/hooks/useGoogleSheetsData";
import { normalizeName } from "@/lib/seller-names";

const GROUPS: { key: string; label: string; members: string[] }[] = [
  { key: "socios", label: "Sócios", members: ["Diego", "Daniel", "Alan"] },
  {
    key: "velhos",
    label: "Velhos",
    members: [
      "Gabriel Simão",
      "Alessandro",
      "Márcio Pereira",
      "Lucas Freitas",
      "Gabriel Manenti",
      "Luan",
    ],
  },
  {
    key: "novos",
    label: "Novos",
    members: [
      "Patrick Bragato Rex",
      "Gustavo Machado Correa",
      "Vinícius Oliveira",
      "Guilherme Sutil",
      "Guilherme Melo",
      "Alexander",
    ],
  },
];

function formatBRL(val: number) {
  return val.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  });
}

function pctClass(pct: number) {
  if (pct >= 100) return "text-emerald-500 border-emerald-500/40";
  if (pct >= 50) return "text-amber-500 border-amber-500/40";
  return "text-rose-500 border-rose-500/40";
}

export function MetaPorGrupoSection() {
  const now = new Date();
  const mesRef = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();
  const monthLabel = now.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });

  const { allRows } = useGoogleSheetsData();

  const { data: goalsByName } = useQuery({
    queryKey: ["sales_goals_byname_groups", mesRef],
    queryFn: async () => {
      const { data } = await supabase
        .from("sales_goals_byname")
        .select("broker_name, meta")
        .eq("mes_ref", mesRef);
      return data || [];
    },
    staleTime: 5 * 60 * 1000,
  });

  const { groups, total } = useMemo(() => {
    // Build map of canonical name -> meta
    const metaMap = new Map<string, number>();
    for (const g of goalsByName || []) {
      const c = normalizeName(g.broker_name);
      metaMap.set(c, (metaMap.get(c) || 0) + Number(g.meta || 0));
    }
    // Build map of canonical name -> realizado (mês atual)
    const realMap = new Map<string, number>();
    for (const row of allRows) {
      if (!row.dataVenda || !row.corretor) continue;
      const parts = row.dataVenda.split("/");
      if (parts.length !== 3) continue;
      const [, m, y] = parts.map(Number);
      if (y !== currentYear || m - 1 !== currentMonth) continue;
      const c = normalizeName(row.corretor);
      realMap.set(c, (realMap.get(c) || 0) + (row.valor || 0));
    }

    // Meta total = soma de todas as metas cadastradas
    let metaTotal = 0;
    for (const v of metaMap.values()) metaTotal += v;
    const metaPorGrupo = metaTotal / GROUPS.length;

    const groups = GROUPS.map((g) => {
      let realizado = 0;
      for (const member of g.members) {
        const c = normalizeName(member);
        realizado += realMap.get(c) || 0;
      }
      const meta = metaPorGrupo;
      const pct = meta > 0 ? Math.round((realizado / meta) * 100) : 0;
      return { ...g, meta, realizado, pct };
    });

    const total = groups.reduce(
      (acc, g) => ({
        meta: acc.meta + g.meta,
        realizado: acc.realizado + g.realizado,
      }),
      { meta: 0, realizado: 0 }
    );
    const totalPct = total.meta > 0 ? Math.round((total.realizado / total.meta) * 100) : 0;

    return { groups, total: { ...total, pct: totalPct } };
  }, [goalsByName, allRows, currentMonth, currentYear]);

  return (
    <Card className="border-border/30">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2 flex-wrap">
          <Target className="w-4 h-4 text-primary" />
          <CardTitle className="text-sm">Meta do Mês por Grupo</CardTitle>
          <Badge variant="secondary" className="text-[10px] capitalize">
            {monthLabel}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Total */}
        <div className="rounded-lg border border-primary/20 bg-primary/5 p-4">
          <div className="flex items-baseline justify-between gap-2 flex-wrap">
            <div className="text-xs text-muted-foreground uppercase tracking-wide">Meta Total</div>
            <Badge variant="outline" className={`text-xs ${pctClass(total.pct)}`}>
              {total.pct}%
            </Badge>
          </div>
          <div className="mt-1 flex items-baseline gap-2 flex-wrap">
            <span className="text-xl sm:text-2xl font-bold text-foreground">
              {formatBRL(total.realizado)}
            </span>
            <span className="text-sm text-muted-foreground">/ {formatBRL(total.meta)}</span>
          </div>
          <Progress value={Math.min(total.pct, 100)} className="h-2 mt-3" />
        </div>

        {/* 3 grupos */}
        <div className="grid grid-cols-3 gap-3">
          {groups.map((g) => (
            <div
              key={g.key}
              className="rounded-lg border border-border/40 bg-card p-3 space-y-2"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-muted-foreground" />
                  <span className="text-sm font-semibold text-foreground">{g.label}</span>
                </div>
                <Badge variant="outline" className={`text-[10px] ${pctClass(g.pct)}`}>
                  {g.pct}%
                </Badge>
              </div>
              <div>
                <div className="text-base font-bold text-foreground leading-tight">
                  {formatBRL(g.realizado)}
                </div>
                <div className="text-[11px] text-muted-foreground">
                  Meta: {formatBRL(g.meta)}
                </div>
              </div>
              <Progress value={Math.min(g.pct, 100)} className="h-1.5" />
              <div className="text-[10px] text-muted-foreground truncate">
                {g.members.length} corretores
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}