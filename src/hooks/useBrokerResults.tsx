import { useEffect, useState, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { normalizeName } from "@/lib/seller-names";

export interface BrokerResultRow {
  id: string;
  grupo: string | null;
  cota: string | null;
  vendedor: string | null;
  vendedor_normalizado: string | null;
  cliente: string | null;
  parcelas_pagas: number | null;
  credito_gerado: number | null;
  pct_estorno: number | null;
  pct_comissao: number | null;
  vlr_estorno: number | null;
  vlr_fim_ciclo: number | null;
  dinheiro_na_mesa: number | null;
}

export interface BrokerUpload {
  id: string;
  uploaded_by_name: string | null;
  file_name: string | null;
  total_rows: number;
  total_vendedores: number;
  created_at: string;
}

export function useBrokerResults() {
  const [rows, setRows] = useState<BrokerResultRow[]>([]);
  const [lastUpload, setLastUpload] = useState<BrokerUpload | null>(null);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    setLoading(true);
    const [resRows, resUpload] = await Promise.all([
      supabase.from("broker_results").select("*").limit(5000),
      supabase
        .from("broker_results_uploads")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);
    if (!resRows.error) setRows((resRows.data ?? []) as BrokerResultRow[]);
    if (!resUpload.error) setLastUpload((resUpload.data as BrokerUpload | null) ?? null);
    setLoading(false);
  }, []);

  useEffect(() => { refetch(); }, [refetch]);

  return { rows, lastUpload, loading, refetch };
}

export interface BrokerAggregate {
  vendedor: string;
  count: number;
  creditoGerado: number;
  dinheiroMesa: number;
  vlrFimCiclo: number;
  vlrEstorno: number;
  pctComissaoAvg: number;
  pctEstornoAvg: number;
  rows: BrokerResultRow[];
}

function aggregate(rows: BrokerResultRow[], vendedor: string): BrokerAggregate {
  let creditoGerado = 0, dinheiroMesa = 0, vlrFimCiclo = 0, vlrEstorno = 0;
  let pctComissaoSum = 0, pctComissaoCount = 0;
  let pctEstornoSum = 0, pctEstornoCount = 0;
  for (const r of rows) {
    creditoGerado += r.credito_gerado ?? 0;
    dinheiroMesa += r.dinheiro_na_mesa ?? 0;
    vlrFimCiclo += r.vlr_fim_ciclo ?? 0;
    vlrEstorno += r.vlr_estorno ?? 0;
    if (r.pct_comissao !== null) { pctComissaoSum += r.pct_comissao; pctComissaoCount++; }
    if (r.pct_estorno !== null) { pctEstornoSum += r.pct_estorno; pctEstornoCount++; }
  }
  return {
    vendedor,
    count: rows.length,
    creditoGerado,
    dinheiroMesa,
    vlrFimCiclo,
    vlrEstorno,
    pctComissaoAvg: pctComissaoCount ? pctComissaoSum / pctComissaoCount : 0,
    pctEstornoAvg: pctEstornoCount ? pctEstornoSum / pctEstornoCount : 0,
    rows,
  };
}

export function useMyBrokerResults() {
  const { user } = useAuth();
  const { rows, lastUpload, loading, refetch } = useBrokerResults();
  const userDisplayName = user?.user_metadata?.full_name || user?.user_metadata?.display_name || user?.email?.split("@")[0] || "";
  const myCanonical = useMemo(() => normalizeName(userDisplayName), [userDisplayName]);

  const myRows = useMemo(
    () => rows.filter((r) => normalizeName(r.vendedor_normalizado || r.vendedor || "") === myCanonical),
    [rows, myCanonical]
  );

  const aggregateData = useMemo(() => aggregate(myRows, myCanonical), [myRows, myCanonical]);

  return { aggregate: aggregateData, myRows, myCanonical, lastUpload, loading, refetch };
}

export function useCompanyBrokerResults() {
  const { rows, lastUpload, loading, refetch } = useBrokerResults();

  const company = useMemo(() => aggregate(rows, "Empresa"), [rows]);

  const byVendedor = useMemo(() => {
    const map = new Map<string, BrokerResultRow[]>();
    for (const r of rows) {
      const raw = r.vendedor_normalizado || r.vendedor || "—";
      const k = normalizeName(raw);
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(r);
    }
    return Array.from(map.entries())
      .map(([v, rs]) => aggregate(rs, v))
      .sort((a, b) => b.dinheiroMesa - a.dinheiroMesa);
  }, [rows]);

  return { company, byVendedor, lastUpload, loading, refetch };
}