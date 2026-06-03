import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export type SaleSource = "atual" | "historico";

export interface SaleRow {
  proposta: string;
  grupo: string;
  cota: string;
  cliente: string;
  corretor: string;
  time: string;
  dataVenda: string;
  valor: number;
  vencimento: string;
  status: string;
  administradora: string;
  observacao: string;
  cidade: string;
  origemVenda: string;
  canalVenda: string;
  boasVindas: string;
  source: SaleSource;
}

function parseBRLCurrency(raw: string): number {
  if (!raw) return 0;
  const cleaned = raw.replace(/[R$\s.]/g, "").replace(",", ".");
  const val = parseFloat(cleaned);
  return isNaN(val) ? 0 : val;
}

function parseBRDate(raw: string): Date | null {
  if (!raw) return null;
  const parts = raw.split("/");
  if (parts.length !== 3) return null;
  const [day, month, year] = parts.map(Number);
  return new Date(year, month - 1, day);
}

const CURRENT_SPREADSHEET = "1x5y3-TtWonAIEcEyKYtqcRIv7jE-sISsRXqLQrwxOiM";
const HISTORIC_SPREADSHEET = "1l2vVwqtG5mJI_3PK-l7WAtasrf4vXUXReFYfFrLR68A";

function parseRows(rows: string[][], source: SaleSource): SaleRow[] {
  if (rows.length < 2) return [];
  // Detect layout: historic sheets omit the "TIME" column,
  // so DATA/VALOR shift left by one. We inspect the header.
  const header = rows[0].map((h) => (h || "").toString().toLowerCase().trim());
  const hasTimeCol = header[5]?.includes("time");
  const dateIdx = hasTimeCol ? 6 : 5;
  const valueIdx = hasTimeCol ? 7 : 6;
  const dueIdx = hasTimeCol ? 8 : 7;
  const statusIdx = hasTimeCol ? 9 : 8;
  const adminIdx = hasTimeCol ? 10 : 9;
  const obsIdx = hasTimeCol ? 11 : 10;
  const cityIdx = hasTimeCol ? 12 : 11;
  const origIdx = hasTimeCol ? 13 : 12;
  const channelIdx = hasTimeCol ? 14 : 13;
  const welcomeIdx = hasTimeCol ? 15 : 14;
  return rows.slice(1).map((r) => ({
    proposta: r[0] || "",
    grupo: r[1] || "",
    cota: r[2] || "",
    cliente: r[3] || "",
    corretor: (r[4] || "").trim(),
    time: hasTimeCol ? (r[5] || "") : "",
    dataVenda: r[dateIdx] || "",
    valor: parseBRLCurrency(r[valueIdx] || ""),
    vencimento: r[dueIdx] || "",
    status: r[statusIdx] || "",
    administradora: r[adminIdx] || "",
    observacao: r[obsIdx] || "",
    cidade: r[cityIdx] || "",
    origemVenda: r[origIdx] || "",
    canalVenda: r[channelIdx] || "",
    boasVindas: r[welcomeIdx] || "",
    source,
  }));
}

function buildApiUrl(params: Record<string, string>) {
  const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
  const base = `https://${projectId}.supabase.co/functions/v1/google-sheets`;
  const qs = new URLSearchParams(params).toString();
  return `${base}?${qs}`;
}

function authHeaders(token: string | undefined) {
  return {
    Authorization: `Bearer ${token}`,
    apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
  };
}

export function useGoogleSheetsData() {
  const [allRows, setAllRows] = useState<SaleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCurrentSheet = useCallback(async (token: string | undefined): Promise<SaleRow[]> => {
    const url = buildApiUrl({ sheet: "base de dados", spreadsheet_id: CURRENT_SPREADSHEET });
    const res = await fetch(url, { headers: authHeaders(token) });
    if (!res.ok) throw new Error(`Erro ao buscar planilha atual: ${res.status}`);
    const json = await res.json();
    return parseRows(json.values || [], "atual");
  }, []);

  const fetchHistoricSheets = useCallback(async (token: string | undefined): Promise<SaleRow[]> => {
    // 1. List all sheet names
    const listUrl = buildApiUrl({ action: "list_sheets", spreadsheet_id: HISTORIC_SPREADSHEET });
    const listRes = await fetch(listUrl, { headers: authHeaders(token) });
    if (!listRes.ok) {
      console.warn("Não foi possível listar abas históricas:", listRes.status);
      return [];
    }
    const { sheets } = await listRes.json();
    if (!sheets || sheets.length === 0) return [];

    // Filter only "Base" sheets
    const baseSheets = (sheets as string[]).filter(s => s.toLowerCase().startsWith("base"));

    // 2. Batch fetch all sheets (Google API supports up to ~100 ranges)
    const batchUrl = buildApiUrl({
      action: "batch_values",
      spreadsheet_id: HISTORIC_SPREADSHEET,
      sheets: baseSheets.join(","),
    });
    const batchRes = await fetch(batchUrl, { headers: authHeaders(token) });
    if (!batchRes.ok) {
      console.warn("Erro ao buscar dados históricos:", batchRes.status);
      return [];
    }
    const batchData = await batchRes.json();
    const allHistoric: SaleRow[] = [];
    for (const vr of batchData.valueRanges || []) {
      const rows = parseRows(vr.values || [], "historico");
      allHistoric.push(...rows);
    }
    return allHistoric;
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;

      const [currentRows, historicRows] = await Promise.all([
        fetchCurrentSheet(token),
        fetchHistoricSheets(token),
      ]);

      // Merge and deduplicate by proposta number (current takes priority)
      const seen = new Set<string>();
      const merged: SaleRow[] = [];
      for (const row of [...currentRows, ...historicRows]) {
        const key = row.proposta;
        if (key && seen.has(key)) continue;
        if (key) seen.add(key);
        merged.push(row);
      }

      setAllRows(merged);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro desconhecido");
    } finally {
      setLoading(false);
    }
  }, [fetchCurrentSheet, fetchHistoricSheets]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const getMonthRows = useCallback(
    (year: number, month: number) => {
      return allRows.filter((row) => {
        const d = parseBRDate(row.dataVenda);
        if (!d) return false;
        return d.getFullYear() === year && d.getMonth() === month;
      });
    },
    [allRows]
  );

  return { allRows, loading, error, reload: fetchData, getMonthRows };
}