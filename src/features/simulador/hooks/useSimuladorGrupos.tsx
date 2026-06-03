import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export type SimuladorGrupo = {
  id: string;
  asset_type: "Imovel" | "Veiculo";
  administradora: string | null;
  term_months: number;
  credit_value: number;
  payment_half: number;
  admin_fee_percent: number;
  active: boolean;
  source_pdf_name: string | null;
  created_at: string;
  updated_at: string;
};

export type GrupoInput = Omit<SimuladorGrupo, "id" | "created_at" | "updated_at" | "active"> & { active?: boolean };

export function useSimuladorGrupos(assetType?: "Imovel" | "Veiculo", onlyActive = true) {
  return useQuery({
    queryKey: ["simulador-grupos", assetType, onlyActive],
    queryFn: async () => {
      let q = supabase.from("simulador_grupos").select("*").order("credit_value", { ascending: true });
      if (assetType) q = q.eq("asset_type", assetType);
      if (onlyActive) q = q.eq("active", true);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as SimuladorGrupo[];
    },
  });
}

export function useInsertGrupos() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (rows: GrupoInput[]) => {
      const { data, error } = await supabase.from("simulador_grupos").insert(rows).select();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      toast.success(`${data?.length ?? 0} grupos salvos`);
      qc.invalidateQueries({ queryKey: ["simulador-grupos"] });
    },
    onError: (e: Error) => toast.error("Erro ao salvar: " + e.message),
  });
}

export function useUpdateGrupo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...patch }: Partial<SimuladorGrupo> & { id: string }) => {
      const { error } = await supabase.from("simulador_grupos").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["simulador-grupos"] }),
  });
}

export function useDeleteGrupo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("simulador_grupos").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Grupo removido");
      qc.invalidateQueries({ queryKey: ["simulador-grupos"] });
    },
  });
}
