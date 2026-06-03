import { useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";

type Status = "loading" | "ok" | "pending" | "rejected";

export function ApprovalGate({ children }: { children: React.ReactNode }) {
  const { user, loading, signOut } = useAuth();
  const [status, setStatus] = useState<Status>("loading");
  const location = useLocation();

  useEffect(() => {
    let cancelled = false;
    if (loading) return;
    if (!user) {
      setStatus("ok");
      return;
    }
    // Internal users skip the check
    if (user.email?.endsWith("@dpconsorcios.com.br")) {
      setStatus("ok");
      return;
    }

    (async () => {
      const { data } = await supabase
        .from("account_approvals")
        .select("status")
        .eq("user_id", user.id)
        .maybeSingle();
      if (cancelled) return;
      const s = data?.status;
      if (s === "pending") setStatus("pending");
      else if (s === "rejected") {
        toast({ title: "Acesso negado", description: "Sua solicitação foi rejeitada.", variant: "destructive" });
        await signOut();
        setStatus("rejected");
      } else setStatus("ok");
    })();

    return () => {
      cancelled = true;
    };
  }, [user, loading, signOut]);

  if (loading || status === "loading") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center text-muted-foreground">
        Carregando...
      </div>
    );
  }

  if (status === "pending" && location.pathname !== "/pending-approval") {
    return <Navigate to="/pending-approval" replace />;
  }

  if (status === "rejected") return <Navigate to="/auth" replace />;

  return <>{children}</>;
}