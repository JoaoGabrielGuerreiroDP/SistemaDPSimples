import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

async function fetchPiperun(resource: string, params: Record<string, string> = {}) {
  const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
  const session = await supabase.auth.getSession();
  const token = session.data.session?.access_token;

  if (!token) throw new Error("Usuário não autenticado");

  const qs = new URLSearchParams({ resource, ...params }).toString();
  const res = await fetch(
    `https://${projectId}.supabase.co/functions/v1/piperun-data?${qs}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    }
  );

  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || "Erro ao buscar dados do Piperun");
  }

  return res.json();
}

export function usePiperunDeals(show = "50", all = false) {
  return useQuery({
    queryKey: ["piperun", "deals", all ? "all" : show],
    queryFn: () => fetchPiperun("deals", all ? { all: "true" } : { show }),
    staleTime: 2 * 60 * 1000,
  });
}

export function usePiperunPersons(show = "50") {
  return useQuery({
    queryKey: ["piperun", "persons", show],
    queryFn: () => fetchPiperun("persons", { show }),
    staleTime: 2 * 60 * 1000,
  });
}

export function usePiperunPipelines() {
  return useQuery({
    queryKey: ["piperun", "pipelines"],
    queryFn: () => fetchPiperun("pipelines"),
    staleTime: 10 * 60 * 1000,
  });
}

export function usePiperunStages(pipelineId?: string) {
  return useQuery({
    queryKey: ["piperun", "stages", pipelineId],
    queryFn: () => fetchPiperun("stages", pipelineId ? { pipeline_id: pipelineId } : {}),
    staleTime: 10 * 60 * 1000,
    enabled: true,
  });
}

export function usePiperunActivities(show = "50", all = false) {
  return useQuery({
    queryKey: ["piperun", "activities", all ? "all" : show],
    queryFn: () => fetchPiperun("activities", all ? { all: "true" } : { show }),
    staleTime: 2 * 60 * 1000,
  });
}

export function usePiperunUsers(show = "200") {
  return useQuery({
    queryKey: ["piperun", "users", show],
    queryFn: () => fetchPiperun("users", { show }),
    staleTime: 10 * 60 * 1000,
  });
}
