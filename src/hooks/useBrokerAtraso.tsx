import { useEffect, useState, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { normalizeName } from "@/lib/seller-names";

export interface BrokerAtrasoRow {
  id: string;
  vendedor: string | null;
  vendedor_normalizado: string | null;
  cliente: string | null;
  grupo: string | null;
  cota: string | null;
  parcelas_pagas: number | null;
  parcelas_atraso: number | null;
  credito_venda: number | null;
  situacao: string | null;
  comissao_corretor: number | null;
}

export interface BrokerAtrasoUpload {
  id: string;
  uploaded_by_name: string | null;
  file_name: string | null;
  total_rows: number;
  total_vendedores: number;
  created_at: string;
}

export function useBrokerAtraso() {
  const [rows, setRows] = useState<BrokerAtrasoRow[]>([]);
  const [lastUpload, setLastUpload] = useState<BrokerAtrasoUpload | null>(null);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    setLoading(true);
    const [resRows, resUpload] = await Promise.all([
      (supabase.from("broker_atraso" as any).select("*").limit(5000) as any),
      (supabase
        .from("broker_atraso_uploads" as any)
        .select("*")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle() as any),
    ]);
    if (!resRows.error) setRows((resRows.data ?? []) as BrokerAtrasoRow[]);
    if (!resUpload.error) setLastUpload((resUpload.data as BrokerAtrasoUpload | null) ?? null);
    setLoading(false);
  }, []);

  useEffect(() => { refetch(); }, [refetch]);

  return { rows, lastUpload, loading, refetch };
}

export interface BrokerAtrasoAggregate {
  vendedor: string;
  count: number;
  parcelasAtrasoTotal: number;
  creditoVendaTotal: number;
  comissaoTotal: number;
  rows: BrokerAtrasoRow[];
}

function aggregate(rows: BrokerAtrasoRow[], vendedor: string): BrokerAtrasoAggregate {
  let parcelasAtrasoTotal = 0, creditoVendaTotal = 0, comissaoTotal = 0;
  for (const r of rows) {
    parcelasAtrasoTotal += r.parcelas_atraso ?? 0;
    creditoVendaTotal += r.credito_venda ?? 0;
    comissaoTotal += r.comissao_corretor ?? 0;
  }
  return {
    vendedor,
    count: rows.length,
    parcelasAtrasoTotal,
    creditoVendaTotal,
    comissaoTotal,
    rows,
  };
}

export function useMyBrokerAtraso() {
  const { user } = useAuth();
  const { rows, lastUpload, loading, refetch } = useBrokerAtraso();
  const userDisplayName = user?.user_metadata?.full_name || user?.user_metadata?.display_name || user?.email?.split("@")[0] || "";
  const myCanonical = useMemo(() => normalizeName(userDisplayName), [userDisplayName]);

  const myRows = useMemo(
    () => rows.filter((r) => r.vendedor_normalizado === myCanonical),
    [rows, myCanonical]
  );

  const aggregateData = useMemo(() => aggregate(myRows, myCanonical), [myRows, myCanonical]);

  return { aggregate: aggregateData, myRows, myCanonical, lastUpload, loading, refetch };
}

export function useCompanyBrokerAtraso() {
  const { rows, lastUpload, loading, refetch } = useBrokerAtraso();

  const company = useMemo(() => aggregate(rows, "Empresa"), [rows]);

  const byVendedor = useMemo(() => {
    const map = new Map<string, BrokerAtrasoRow[]>();
    for (const r of rows) {
      const k = r.vendedor_normalizado || r.vendedor || "—";
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(r);
    }
    return Array.from(map.entries())
      .map(([v, rs]) => aggregate(rs, v))
      .sort((a, b) => b.creditoVendaTotal - a.creditoVendaTotal);
  }, [rows]);

  return { company, byVendedor, lastUpload, loading, refetch };
}