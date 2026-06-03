import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { useQuery } from "@tanstack/react-query";

export type AppRole = "admin" | "gestor" | "vendedor" | "gestor_hub";

export function useUserRole() {
  const { user, loading: authLoading } = useAuth();

  const { data: role = null, isLoading: queryLoading } = useQuery({
    queryKey: ["user-role", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user!.id)
        .maybeSingle();

      if (error) throw error;
      return (data?.role as AppRole) ?? null;
    },
    enabled: !!user && !authLoading,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  const loading = authLoading || queryLoading;
  const isAdmin = role === "admin";
  const isGestor = role === "gestor" || role === "admin";
  const isGestorHub = role === "gestor_hub";

  return { role, isAdmin, isGestor, isGestorHub, loading };
}
