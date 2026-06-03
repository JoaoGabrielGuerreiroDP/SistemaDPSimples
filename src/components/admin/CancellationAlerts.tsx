import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle, XCircle, TrendingDown, ShieldAlert } from "lucide-react";
import { cn } from "@/lib/utils";

interface GesconVenda {
  vendedor: string;
  credito: string;
  situacao: string;
  administradora: string;
}

function parseCredito(v: string) { return parseFloat(v) || 0; }
const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

interface SellerAlert {
  name: string;
  total: number;
  canceladas: number;
  taxa: number;
  creditoPerdido: number;
  severity: "critical" | "warning";
}

interface CancellationAlertsProps {
  vendas: GesconVenda[];
  threshold?: number;
}

export function CancellationAlerts({ vendas, threshold = 20 }: CancellationAlertsProps) {
  const alerts = useMemo(() => {
    if (!vendas.length) return [];

    const map = new Map<string, { total: number; canceladas: number; creditoPerdido: number }>();
    for (const v of vendas) {
      const cur = map.get(v.vendedor) || { total: 0, canceladas: 0, creditoPerdido: 0 };
      cur.total++;
      if (v.situacao === "Cancelada") {
        cur.canceladas++;
        cur.creditoPerdido += parseCredito(v.credito);
      }
      map.set(v.vendedor, cur);
    }

    return Array.from(map.entries())
      .map(([name, d]): SellerAlert => {
        const taxa = d.total > 0 ? (d.canceladas / d.total) * 100 : 0;
        return { name, ...d, taxa, severity: taxa >= 40 ? "critical" : "warning" };
      })
      .filter(a => a.taxa >= threshold && a.total >= 2)
      .sort((a, b) => b.taxa - a.taxa);
  }, [vendas, threshold]);

  const totalPerdido = alerts.reduce((s, a) => s + a.creditoPerdido, 0);

  if (!alerts.length) {
    return (
      <Card className="border-[#10b981]/30 bg-[#10b981]/5">
        <CardContent className="p-4 flex items-center gap-3">
          <div className="rounded-full p-2 bg-[#10b981]/20"><ShieldAlert className="h-5 w-5 text-[#10b981]" /></div>
          <div>
            <p className="text-sm font-semibold text-[#10b981]">Nenhum alerta de cancelamento</p>
            <p className="text-xs text-muted-foreground">Todos os vendedores estão abaixo de {threshold}% de cancelamento.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {/* Summary */}
      <Card className="border-destructive/30 bg-destructive/5">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <div className="rounded-full p-2 bg-destructive/20 shrink-0">
              <AlertTriangle className="h-5 w-5 text-destructive" />
            </div>
            <div>
              <p className="text-sm font-bold text-destructive">
                {alerts.length} vendedor{alerts.length > 1 ? "es" : ""} com taxa de cancelamento acima de {threshold}%
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Crédito total perdido: <span className="font-bold text-destructive">{fmt(totalPerdido)}</span>
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Individual alerts */}
      {alerts.map((a) => (
        <Card key={a.name} className={cn(
          "border-l-4 transition-all",
          a.severity === "critical" ? "border-l-destructive bg-destructive/5" : "border-l-[#f59e0b] bg-[#f59e0b]/5"
        )}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <XCircle className={cn("h-4 w-4 shrink-0", a.severity === "critical" ? "text-destructive" : "text-[#f59e0b]")} />
                <span className="font-bold text-sm truncate">{a.name}</span>
                {a.severity === "critical" && (
                  <span className="text-[9px] uppercase tracking-wider font-bold text-destructive bg-destructive/10 px-1.5 py-0.5 rounded">Crítico</span>
                )}
              </div>
              <span className={cn("text-xl font-black", a.severity === "critical" ? "text-destructive" : "text-[#f59e0b]")}>
                {a.taxa.toFixed(0)}%
              </span>
            </div>
            <div className="mt-2 grid grid-cols-3 gap-2 text-center">
              <div>
                <p className="text-lg font-bold">{a.total}</p>
                <p className="text-[10px] text-muted-foreground">Total</p>
              </div>
              <div>
                <p className="text-lg font-bold text-destructive">{a.canceladas}</p>
                <p className="text-[10px] text-muted-foreground">Canceladas</p>
              </div>
              <div>
                <p className="text-lg font-bold text-destructive">{fmt(a.creditoPerdido)}</p>
                <p className="text-[10px] text-muted-foreground">Perdido</p>
              </div>
            </div>
            <div className="mt-2 h-2 rounded-full bg-muted/40 overflow-hidden">
              <div className={cn("h-full rounded-full", a.severity === "critical" ? "bg-destructive" : "bg-[#f59e0b]")}
                style={{ width: `${Math.min(a.taxa, 100)}%` }} />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
