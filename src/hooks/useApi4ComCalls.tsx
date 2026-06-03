import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface Api4ComCall {
  id: string;
  domain?: string;
  email: string;
  first_name: string;
  last_name?: string;
  started_at: string;
  ended_at: string;
  duration: number;
  hangup_cause: string;
  call_type: string;
  from: string;
  to: string;
  record_url?: string;
  BINA?: string | null;
  minute_price?: number;
  call_price?: number;
  metadata?: Record<string, unknown>;
}

interface Api4ComPageResponse {
  data: Api4ComCall[];
  meta?: {
    totalItemCount: number;
    totalPageCount: number;
    itemsPerPage: number;
    currentPage: number;
    nextPage: number;
  };
}

export interface Api4ComResponse {
  data: Api4ComCall[];
  totalItems: number;
  fullyLoaded: boolean;
}

async function fetchPage(page: number): Promise<Api4ComPageResponse> {
  const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const response = await fetch(
    `https://${projectId}.supabase.co/functions/v1/api4com-calls?page=${page}&per_page=100`,
    {
      headers: {
        Authorization: `Bearer ${session?.access_token}`,
        "Content-Type": "application/json",
      },
    },
  );
  if (!response.ok) {
    throw new Error(`Erro ao buscar chamadas: ${response.status}`);
  }
  return response.json();
}

async function fetchAllSince(cutoffDate: Date): Promise<Api4ComResponse> {
  const allCalls: Api4ComCall[] = [];
  let page = 1;
  let totalPages = 1;
  const MAX_PAGES = 100;

  while (page <= totalPages && page <= MAX_PAGES) {
    const result = await fetchPage(page);
    const meta = result.meta;
    if (meta) {
      totalPages = meta.totalPageCount;
    }
    if (!result.data || result.data.length === 0) break;
    allCalls.push(...result.data);

    const oldestInPage = new Date(result.data[result.data.length - 1].started_at);
    if (oldestInPage < cutoffDate) break;

    page++;
  }

  return {
    data: allCalls,
    totalItems: allCalls.length,
    fullyLoaded: page <= totalPages,
  };
}

export function useApi4ComCalls(cutoffDate?: Date) {
  const cutoff =
    cutoffDate ||
    (() => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      return today;
    })();

  return useQuery({
    queryKey: ["api4com-calls-all", cutoff.toISOString()],
    queryFn: () => fetchAllSince(cutoff),
    refetchInterval: 60000,
    staleTime: 30000,
  });
}
