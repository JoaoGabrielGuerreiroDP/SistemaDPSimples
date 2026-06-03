import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

async function fetchHubSpot(resource: string, limit = 50, all = false) {
  const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
  const session = await supabase.auth.getSession();
  const token = session.data.session?.access_token;

  if (!token) throw new Error("Usuário não autenticado");

  const params = new URLSearchParams({ resource, limit: String(limit) });
  if (all) params.set("all", "true");

  const res = await fetch(
    `https://${projectId}.supabase.co/functions/v1/hubspot-data?${params}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    }
  );

  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || "Erro ao buscar dados do HubSpot");
  }

  return res.json();
}

export function useHubSpotContacts(limit = 50, all = false) {
  return useQuery({
    queryKey: ["hubspot", "contacts", all ? "all" : limit],
    queryFn: () => fetchHubSpot("contacts", limit, all),
    staleTime: 2 * 60 * 1000,
  });
}

export function useHubSpotDeals(limit = 50, all = false) {
  return useQuery({
    queryKey: ["hubspot", "deals", all ? "all" : limit],
    queryFn: () => fetchHubSpot("deals", limit, all),
    staleTime: 2 * 60 * 1000,
  });
}

export function useHubSpotTasks(limit = 50) {
  return useQuery({
    queryKey: ["hubspot", "tasks", limit],
    queryFn: () => fetchHubSpot("tasks", limit),
    staleTime: 2 * 60 * 1000,
  });
}

export function useHubSpotPipelines() {
  return useQuery({
    queryKey: ["hubspot", "pipelines"],
    queryFn: () => fetchHubSpot("pipelines"),
    staleTime: 10 * 60 * 1000,
  });
}

export function useHubSpotOwners() {
  return useQuery({
    queryKey: ["hubspot", "owners"],
    queryFn: () => fetchHubSpot("owners" as any),
    staleTime: 10 * 60 * 1000,
  });
}
