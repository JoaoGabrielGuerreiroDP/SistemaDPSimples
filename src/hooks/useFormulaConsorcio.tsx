import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface FormulaVendaMes {
  lineColor: string;
  date: string;
  valor: string;
}

export interface FormulaLead {
  year: string;
  income: string;
}

export interface FormulaVendaDetalhe {
  numero_contrato: string;
  grupoVenda: string;
  cotaVenda: string;
  nome: string;
  cpf: string;
  administradora: string;
  telefone_celular: string;
  email: string;
  valorTotalVenda: string;
  status: string;
  dataVendido: string;
}

export interface FormulaData {
  vendas: FormulaVendaMes[];
  num_vendas: string;
  valor_total: string;
  valor_media: string;
  negociacoes: string;
  total_leads: number;
  taxa_conv: number;
  array_leads: FormulaLead[];
  vendas_detalhadas: FormulaVendaDetalhe[];
  vendas_periodo: string | null;
}

async function fetchFormulaData(): Promise<FormulaData> {
  const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
  const { data: { session } } = await supabase.auth.getSession();

  const response = await fetch(
    `https://${projectId}.supabase.co/functions/v1/formula-consorcio`,
    {
      headers: {
        Authorization: `Bearer ${session?.access_token}`,
        "Content-Type": "application/json",
      },
    }
  );

  if (!response.ok) {
    throw new Error(`Erro ao buscar dados Fórmula: ${response.status}`);
  }

  return response.json();
}

export function useFormulaConsorcio() {
  return useQuery({
    queryKey: ["formula-consorcio"],
    queryFn: fetchFormulaData,
    staleTime: 5 * 60000,
    refetchInterval: 10 * 60000,
  });
}
