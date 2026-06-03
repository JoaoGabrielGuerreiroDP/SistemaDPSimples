import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";

export interface GesconVenda {
  codigo: string;
  vendedor: string;
  regiao: string | null;
  contrato: string | null;
  grupo: string;
  cota: string;
  data_venda: string;
  credito: string;
  nome: string;
  origem: string | null;
  situacao: string;
  tempo_fechamento: string | null;
  motivo_consorcio: string | null;
  administradora: string;
  renda_cliente: string | null;
  profissao: string | null;
  genero: string | null;
  cidade: string | null;
  data_nascimento: string | null;
  login_matricula: string | null;
}

interface GesconResponse {
  statusCode: number;
  data: GesconVenda[];
}

async function fetchGesconVendas(dateFrom: Date, dateTo: Date): Promise<GesconVenda[]> {
  const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
  const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  const { data: { session } } = await supabase.auth.getSession();

  const datainicial = format(dateFrom, "dd-MM-yyyy");
  const datafinal = format(dateTo, "dd-MM-yyyy");

  const response = await fetch(
    `https://${projectId}.supabase.co/functions/v1/gescon-vendas?datainicial=${datainicial}&datafinal=${datafinal}`,
    {
      headers: {
        Authorization: `Bearer ${session?.access_token}`,
        apikey: anonKey,
        "Content-Type": "application/json",
      },
    }
  );

  if (!response.ok) {
    throw new Error(`Erro ao buscar vendas GESCON: ${response.status}`);
  }

  const result: GesconResponse = await response.json();
  return result.data || [];
}

export function useGesconVendas(dateFrom?: Date, dateTo?: Date) {
  const now = new Date();
  const from = dateFrom || new Date(now.getFullYear(), now.getMonth(), 1);
  const to = dateTo || now;

  return useQuery({
    queryKey: ["gescon-vendas", format(from, "yyyy-MM-dd"), format(to, "yyyy-MM-dd")],
    queryFn: () => fetchGesconVendas(from, to),
    staleTime: 60000,
    refetchInterval: 5 * 60000,
  });
}
