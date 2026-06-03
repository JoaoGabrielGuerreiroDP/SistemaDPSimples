import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Loader2 } from "lucide-react";

export default function PendingApproval() {
  const { user, signOut } = useAuth();
  const [refreshing, setRefreshing] = useState(false);

  // Realtime: when approved, reload
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`approval-${user.id}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "account_approvals", filter: `user_id=eq.${user.id}` },
        (payload) => {
          const status = (payload.new as { status?: string })?.status;
          if (status === "approved") window.location.href = "/home";
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const handleRefresh = async () => {
    setRefreshing(true);
    const { data } = await supabase
      .from("account_approvals")
      .select("status")
      .eq("user_id", user!.id)
      .maybeSingle();
    if (data?.status === "approved") {
      window.location.href = "/home";
    } else {
      setTimeout(() => setRefreshing(false), 800);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="glass-card border border-border/50 w-full max-w-md p-8 space-y-6 text-center">
        <img src="/logo-dp.png" alt="DP Soluções" className="h-16 w-16 mx-auto rounded-xl object-contain" />
        <h1 className="font-display text-2xl font-bold text-foreground">
          Aguardando aprovação
        </h1>
        <p className="text-sm text-muted-foreground">
          Sua solicitação de acesso foi enviada aos gestores. Você será notificado e poderá entrar assim que for aprovada.
        </p>
        <p className="text-xs text-muted-foreground/80">
          Conta: <span className="font-medium text-foreground">{user?.email}</span>
        </p>
        <div className="flex flex-col gap-2">
          <Button onClick={handleRefresh} disabled={refreshing}>
            {refreshing ? <Loader2 className="w-4 h-4 animate-spin" /> : "Verificar novamente"}
          </Button>
          <Button variant="ghost" onClick={signOut}>
            Sair
          </Button>
        </div>
      </div>
    </div>
  );
}