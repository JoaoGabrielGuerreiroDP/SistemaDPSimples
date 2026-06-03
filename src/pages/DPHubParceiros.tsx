import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Users, Search, ExternalLink, RefreshCw } from "lucide-react";
import { toast } from "sonner";

type Partner = {
  id: string;
  name: string;
  status: string;
  progress: number;
  notes: string | null;
  created_at: string;
};

export default function DPHubParceiros() {
  const [partners, setPartners] = useState<Partner[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("partners_onboarding")
      .select("id, name, status, progress, notes, created_at")
      .order("name", { ascending: true });
    if (error) {
      toast.error("Erro ao carregar parceiros");
    } else {
      setPartners((data ?? []) as Partner[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
    const channel = supabase
      .channel(`partners_onboarding_changes-${Math.random().toString(36).slice(2)}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "partners_onboarding" },
        () => load(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const filtered = partners.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase()),
  );

  const statusColor = (s: string) => {
    switch (s) {
      case "ativo":
        return "bg-emerald-500/15 text-emerald-600 border-emerald-500/30";
      case "em_andamento":
        return "bg-blue-500/15 text-blue-600 border-blue-500/30";
      case "concluido":
        return "bg-violet-500/15 text-violet-600 border-violet-500/30";
      default:
        return "bg-muted text-muted-foreground border-border";
    }
  };

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center shadow-lg">
              <Users className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold">Parceiros</h1>
              <p className="text-xs text-muted-foreground">
                Sincronizado automaticamente com o HUB · {partners.length} parceiros
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={load} disabled={loading}>
              <RefreshCw className={`w-4 h-4 mr-1 ${loading ? "animate-spin" : ""}`} />
              Atualizar
            </Button>
            <Button size="sm" asChild>
              <Link to="/hub">
                <ExternalLink className="w-4 h-4 mr-1" />
                Cadastrar no HUB
              </Link>
            </Button>
          </div>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar parceiro..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        {loading ? (
          <div className="text-center text-sm text-muted-foreground py-12">Carregando...</div>
        ) : filtered.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-sm text-muted-foreground">
              Nenhum parceiro encontrado.
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {filtered.map((p) => (
              <Card key={p.id} className="hover:shadow-md transition-shadow">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-base">{p.name}</CardTitle>
                    <Badge variant="outline" className={statusColor(p.status)}>
                      {p.status}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2 text-xs text-muted-foreground">
                  {p.notes && <p>{p.notes}</p>}
                  <div className="flex items-center justify-between">
                    <span>Progresso</span>
                    <span className="font-medium text-foreground">{p.progress}%</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-violet-500 to-fuchsia-500"
                      style={{ width: `${p.progress}%` }}
                    />
                  </div>
                  <Button variant="ghost" size="sm" className="w-full mt-2" asChild>
                    <Link to={`/meu-processo/${p.id}`}>Abrir processo</Link>
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
      )}
    </div>
  );
}
