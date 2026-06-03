import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "@/hooks/use-toast";
import { Check, X, Loader2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Approval {
  user_id: string;
  email: string;
  display_name: string | null;
  avatar_url: string | null;
  status: string;
  requested_at: string;
}

export default function AccountApprovals() {
  const [items, setItems] = useState<Approval[]>([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("account_approvals")
      .select("user_id,email,display_name,avatar_url,status,requested_at")
      .order("requested_at", { ascending: false });
    setItems((data as Approval[]) || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    const channel = supabase
      .channel("account_approvals_admin")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "account_approvals" },
        () => load()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [load]);

  const decide = async (userId: string, action: "approve" | "reject") => {
    setActing(userId);
    const fn = action === "approve" ? "approve_account" : "reject_account";
    const { error } = await supabase.rpc(fn, { _user_id: userId });
    setActing(null);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
      return;
    }
    toast({
      title: action === "approve" ? "Conta aprovada" : "Conta rejeitada",
    });
    load();
  };

  const pending = items.filter((i) => i.status === "pending");
  const decided = items.filter((i) => i.status !== "pending");

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
      <header>
        <h1 className="font-display text-2xl font-bold text-foreground">Aprovações de Acesso</h1>
        <p className="text-sm text-muted-foreground">
          Solicitações de cadastro com e-mails externos a @dpconsorcios.com.br.
        </p>
      </header>

      {loading ? (
        <div className="text-center py-12 text-muted-foreground">Carregando...</div>
      ) : (
        <>
          <section className="space-y-2">
            <h2 className="text-sm font-semibold text-foreground">
              Pendentes ({pending.length})
            </h2>
            {pending.length === 0 && (
              <div className="glass-card p-6 text-center text-sm text-muted-foreground">
                Nenhuma solicitação pendente.
              </div>
            )}
            {pending.map((it) => (
              <div key={it.user_id} className="glass-card p-4 flex items-center gap-3">
                <Avatar className="h-10 w-10">
                  <AvatarImage src={it.avatar_url ?? undefined} />
                  <AvatarFallback>{(it.display_name || it.email).charAt(0).toUpperCase()}</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{it.display_name || it.email}</p>
                  <p className="text-xs text-muted-foreground truncate">{it.email}</p>
                  <p className="text-[10px] text-muted-foreground/70">
                    {formatDistanceToNow(new Date(it.requested_at), { addSuffix: true, locale: ptBR })}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={() => decide(it.user_id, "approve")}
                    disabled={acting === it.user_id}
                  >
                    {acting === it.user_id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3 mr-1" />}
                    Aprovar
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => decide(it.user_id, "reject")}
                    disabled={acting === it.user_id}
                  >
                    <X className="w-3 h-3 mr-1" />
                    Rejeitar
                  </Button>
                </div>
              </div>
            ))}
          </section>

          {decided.length > 0 && (
            <section className="space-y-2">
              <h2 className="text-sm font-semibold text-foreground">Histórico</h2>
              {decided.slice(0, 20).map((it) => (
                <div key={it.user_id} className="glass-card p-3 flex items-center gap-3 opacity-70">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={it.avatar_url ?? undefined} />
                    <AvatarFallback>{(it.display_name || it.email).charAt(0).toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-foreground truncate">{it.display_name || it.email}</p>
                    <p className="text-[10px] text-muted-foreground truncate">{it.email}</p>
                  </div>
                  <span className={`text-[10px] font-semibold uppercase ${it.status === "approved" ? "text-emerald-500" : "text-destructive"}`}>
                    {it.status === "approved" ? "Aprovado" : "Rejeitado"}
                  </span>
                </div>
              ))}
            </section>
          )}
        </>
      )}
    </div>
  );
}