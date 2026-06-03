import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, LayoutGrid } from "lucide-react";
import { normalizeName } from "@/lib/seller-names";
import { cn } from "@/lib/utils";

type Row = {
  upload_id: string | null;
  grupo: string | null;
  cota: string | null;
  vendedor_normalizado: string | null;
  parcelas_pagas: number | null;
};
type Upload = { id: string; created_at: string };

const BUCKETS = [
  { key: "0", label: "0", min: 0, max: 0 },
  { key: "1-3", label: "1–3", min: 1, max: 3 },
  { key: "4-6", label: "4–6", min: 4, max: 6 },
  { key: "7-12", label: "7–12", min: 7, max: 12 },
  { key: "13+", label: "13+", min: 13, max: Infinity },
] as const;

function bucketFor(p: number) {
  return BUCKETS.find((b) => p >= b.min && p <= b.max)!.key;
}

function monthKey(iso: string) {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
function monthLabel(k: string) {
  const [y, m] = k.split("-");
  return `${m}/${y}`;
}

export function CohortParcelasSection() {
  const [vendedor, setVendedor] = useState<string>("all");

  const { data, isLoading } = useQuery({
    queryKey: ["cohort-parcelas"],
    queryFn: async () => {
      const [resultsRes, uploadsRes] = await Promise.all([
        supabase
          .from("broker_results")
          .select("upload_id,grupo,cota,vendedor_normalizado,parcelas_pagas")
          .limit(50000),
        supabase.from("broker_results_uploads").select("id,created_at"),
      ]);
      if (resultsRes.error) throw resultsRes.error;
      if (uploadsRes.error) throw uploadsRes.error;
      return {
        rows: (resultsRes.data || []) as Row[],
        uploads: (uploadsRes.data || []) as Upload[],
      };
    },
    staleTime: 5 * 60 * 1000,
  });

  const { vendedores, cohort } = useMemo(() => {
    if (!data) return { vendedores: [] as string[], cohort: [] as any[] };
    const uploadDate = new Map<string, Date>();
    for (const u of data.uploads) uploadDate.set(u.id, new Date(u.created_at));

    // For each cota (grupo+cota): track earliest upload date and latest upload's parcelas_pagas + vendedor
    type Agg = {
      firstDate: Date;
      latestDate: Date;
      parcelas: number;
      vendedor: string;
    };
    const map = new Map<string, Agg>();
    for (const r of data.rows) {
      if (!r.upload_id || !r.cota) continue;
      const d = uploadDate.get(r.upload_id);
      if (!d) continue;
      const key = `${r.grupo || ""}|${r.cota}`;
      const v = normalizeName(r.vendedor_normalizado || "");
      const p = Number(r.parcelas_pagas) || 0;
      const cur = map.get(key);
      if (!cur) {
        map.set(key, { firstDate: d, latestDate: d, parcelas: p, vendedor: v });
      } else {
        if (d < cur.firstDate) cur.firstDate = d;
        if (d > cur.latestDate) {
          cur.latestDate = d;
          cur.parcelas = p;
          cur.vendedor = v;
        }
      }
    }

    const vendSet = new Set<string>();
    const cohortMap = new Map<string, Record<string, number>>();
    for (const a of map.values()) {
      if (a.vendedor) vendSet.add(a.vendedor);
      if (vendedor !== "all" && a.vendedor !== vendedor) continue;
      const mk = monthKey(a.firstDate.toISOString());
      const bk = bucketFor(a.parcelas);
      if (!cohortMap.has(mk)) {
        const init: Record<string, number> = { total: 0 };
        for (const b of BUCKETS) init[b.key] = 0;
        cohortMap.set(mk, init);
      }
      const row = cohortMap.get(mk)!;
      row[bk] += 1;
      row.total += 1;
    }

    const cohort = Array.from(cohortMap.entries())
      .map(([k, v]) => ({ month: k, ...v }))
      .sort((a, b) => (a.month < b.month ? 1 : -1))
      .slice(0, 12);

    return { vendedores: Array.from(vendSet).sort(), cohort };
  }, [data, vendedor]);

  const totals = useMemo(() => {
    const t: Record<string, number> = { total: 0 };
    for (const b of BUCKETS) t[b.key] = 0;
    for (const r of cohort) {
      for (const b of BUCKETS) t[b.key] += (r as any)[b.key] || 0;
      t.total += (r as any).total || 0;
    }
    return t;
  }, [cohort]);

  function cellTone(bucketKey: string, count: number, rowTotal: number) {
    if (!count || !rowTotal) return "text-muted-foreground";
    const pct = count / rowTotal;
    if (bucketKey === "0") return pct > 0.2 ? "text-destructive font-semibold" : "text-destructive/80";
    if (bucketKey === "13+") return "text-emerald-500 font-semibold";
    if (bucketKey === "7-12") return "text-emerald-500/80";
    if (bucketKey === "4-6") return "text-amber-500";
    return "text-foreground";
  }

  return (
    <Card>
      <CardHeader className="pb-3 flex flex-row items-center justify-between gap-3 space-y-0">
        <CardTitle className="text-base flex items-center gap-2">
          <LayoutGrid className="h-4 w-4 text-primary" />
          Cohort — Mês da venda × Parcelas pagas
        </CardTitle>
        <Select value={vendedor} onValueChange={setVendedor}>
          <SelectTrigger className="w-[200px] h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os corretores</SelectItem>
            {vendedores.map((v) => (
              <SelectItem key={v} value={v}>
                {v}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : cohort.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">Sem dados de cotas para exibir.</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Mês da venda</TableHead>
                  {BUCKETS.map((b) => (
                    <TableHead key={b.key} className="text-xs text-right">
                      {b.label} parcelas
                    </TableHead>
                  ))}
                  <TableHead className="text-xs text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {cohort.map((r: any) => (
                  <TableRow key={r.month}>
                    <TableCell className="font-medium text-xs">{monthLabel(r.month)}</TableCell>
                    {BUCKETS.map((b) => {
                      const c = r[b.key] || 0;
                      const pct = r.total ? Math.round((c / r.total) * 100) : 0;
                      return (
                        <TableCell key={b.key} className={cn("text-right text-xs tabular-nums", cellTone(b.key, c, r.total))}>
                          {c > 0 ? (
                            <>
                              {c} <span className="text-muted-foreground">({pct}%)</span>
                            </>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                      );
                    })}
                    <TableCell className="text-right text-xs font-semibold tabular-nums">{r.total}</TableCell>
                  </TableRow>
                ))}
                <TableRow className="border-t-2">
                  <TableCell className="text-xs font-bold">Total</TableCell>
                  {BUCKETS.map((b) => (
                    <TableCell key={b.key} className="text-right text-xs font-bold tabular-nums">
                      {totals[b.key] || 0}
                    </TableCell>
                  ))}
                  <TableCell className="text-right text-xs font-bold tabular-nums">{totals.total}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}