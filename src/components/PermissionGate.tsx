import { useState, useEffect } from "react";
import { Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export function PermissionGate({ permission, children }: { permission: string | string[]; children: React.ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const [allowed, setAllowed] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;

    const checkAccess = async () => {
      if (authLoading) return;

      setAllowed(null);

      const { data: { session } } = await supabase.auth.getSession();
      const currentUser = session?.user ?? user;

      if (!currentUser) {
        if (!cancelled) setAllowed(false);
        return;
      }

      const permissions = Array.isArray(permission) ? permission : [permission];

      const [{ data: isAdmin }, { data: isGestor }, { data: isGestorHub }] = await Promise.all([
        supabase.rpc("has_role", { _user_id: currentUser.id, _role: "admin" }),
        supabase.rpc("has_role", { _user_id: currentUser.id, _role: "gestor" }),
        supabase.rpc("has_role", { _user_id: currentUser.id, _role: "gestor_hub" }),
      ]);

      if (cancelled) return;

      if (isAdmin || isGestor) {
        setAllowed(true);
        return;
      }

      // gestor_hub tem acesso completo às funções do HUB
      if (isGestorHub) {
        const hubPerms = ["hub"];
        if (permissions.some((p) => hubPerms.includes(p))) {
          setAllowed(true);
          return;
        }
      }

      const results = await Promise.all(
        permissions.map((p) =>
          supabase.rpc("has_permission", { _user_id: currentUser.id, _permission: p }).then(({ data }) => !!data)
        )
      );

      if (!cancelled) {
        setAllowed(results.some(Boolean));
      }
    };

    checkAccess();

    return () => {
      cancelled = true;
    };
  }, [authLoading, user, permission]);

  if (authLoading || allowed === null) {
    return <div className="min-h-screen bg-background flex items-center justify-center text-muted-foreground">Carregando...</div>;
  }

  if (!allowed) return <Navigate to="/" replace />;
  return <>{children}</>;
}
