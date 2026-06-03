import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { useUserRole } from "./useUserRole";
import { useQuery } from "@tanstack/react-query";

export const ALL_PERMISSIONS = [
  { key: "vendas", label: "Vendas Tempo Real", icon: "📈" },
  { key: "financeiro", label: "Financeiro Tempo Real", icon: "💰" },
  { key: "gerenciar", label: "Gerenciar OKRs", icon: "⚙️" },
  { key: "hub", label: "HUB", icon: "🎯" },
  { key: "usuarios", label: "Usuários", icon: "👥" },
  { key: "meu_painel", label: "Meu Painel", icon: "📋" },
  { key: "dashboard", label: "Dashboard (legado)", icon: "📊" },
] as const;

export type PermissionKey = typeof ALL_PERMISSIONS[number]["key"];

export function usePermissions() {
  const { user } = useAuth();
  const { role } = useUserRole();

  const { data: permissions = [], isLoading: loading } = useQuery({
    queryKey: ["user-permissions", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("user_permissions")
        .select("permission")
        .eq("user_id", user!.id);
      return (data || []).map((d) => d.permission);
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  const hasPermission = (perm: string) => {
    if (role === "admin") return true;
    if (perm === "hub" && role === "gestor_hub") return true;
    return permissions.includes(perm);
  };

  return { permissions, hasPermission, loading };
}
