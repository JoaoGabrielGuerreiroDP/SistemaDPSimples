import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Clock, PhoneOff, Snowflake, Calendar } from "lucide-react";

interface SalesAlertsProps {
  piperunDeals: any[];
  hubspotDeals: any[];
}

function daysSince(dateStr: string) {
  return Math.max(0, Math.round((Date.now() - new Date(dateStr).getTime()) / 86400000));
}

function formatDate(val: string | null) {
  if (!val) return "—";
  return new Date(val).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}

function formatCurrency(val: number) {
  if (!val) return "";
  return val.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default function CRMSalesAlerts({ piperunDeals, hubspotDeals }: SalesAlertsProps) {
  // ── Piperun alerts ─────────────────────────────────────────
  const prAlerts = useMemo(() => {
    const now = Date.now();
    const staleDeals: any[] = [];
    const noContactDeals: any[] = [];
    const frozenDeals: any[] = [];

    for (const d of piperunDeals) {
      if (d.status !== 0) continue; // Only open deals

      // Stale: no update in 3+ days
      const lastUpdate = d.updated_at || d.created_at;
      const daysSinceUpdate = daysSince(lastUpdate);
      if (daysSinceUpdate >= 3) {
        staleDeals.push({ ...d, daysSinceUpdate });
      }

      // Never contacted
      if (!d.last_contact_at) {
        const daysOld = daysSince(d.created_at);
        if (daysOld >= 1) {
          noContactDeals.push({ ...d, daysOld });
        }
      }

      // Frozen
      if (d.freezed === 1) {
        frozenDeals.push(d);
      }
    }

    return {
      stale: staleDeals.sort((a, b) => b.daysSinceUpdate - a.daysSinceUpdate).slice(0, 10),
      noContact: noContactDeals.sort((a, b) => b.daysOld - a.daysOld).slice(0, 10),
      frozen: frozenDeals.slice(0, 5),
    };
  }, [piperunDeals]);

  // ── HubSpot alerts ─────────────────────────────────────────
  const hsAlerts = useMemo(() => {
    const staleDeals: any[] = [];

    for (const d of hubspotDeals) {
      const stage = d.properties?.dealstage;
      if (stage === "closedwon" || stage === "closedlost") continue;

      const lastMod = d.properties?.hs_lastmodifieddate || d.updatedAt;
      if (lastMod) {
        const days = daysSince(lastMod);
        if (days >= 3) {
          staleDeals.push({ ...d, daysSinceUpdate: days });
        }
      }
    }

    return {
      stale: staleDeals.sort((a, b) => b.daysSinceUpdate - a.daysSinceUpdate).slice(0, 10),
    };
  }, [hubspotDeals]);

  const totalAlerts = prAlerts.stale.length + prAlerts.noContact.length + prAlerts.frozen.length + hsAlerts.stale.length;

  if (totalAlerts === 0) return null;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <AlertTriangle className="w-5 h-5 text-rose-500" />
        <h2 className="text-base sm:text-lg font-bold text-foreground">Alertas de Vendas</h2>
        <Badge variant="destructive" className="text-[10px] h-5">{totalAlerts}</Badge>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Stale deals - Piperun */}
        {prAlerts.stale.length > 0 && (
          <Card className="border-rose-500/20 bg-rose-500/5">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-semibold text-rose-400 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5" /> Parados há 3+ dias — Piperun
                <Badge variant="destructive" className="text-[9px] h-4 ml-auto">{prAlerts.stale.length}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1.5">
              {prAlerts.stale.map((d: any) => (
                <div key={d.id} className="flex items-center justify-between gap-2 text-xs rounded-lg bg-card/50 p-2 border border-border/20">
                  <p className="font-medium text-foreground truncate flex-1">{d.title || "Sem título"}</p>
                  <span className="text-rose-400 font-bold shrink-0">{d.daysSinceUpdate}d</span>
                  {d.value ? <span className="text-[10px] text-emerald-500 shrink-0">{formatCurrency(d.value)}</span> : null}
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Stale deals - HubSpot */}
        {hsAlerts.stale.length > 0 && (
          <Card className="border-orange-500/20 bg-orange-500/5">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-semibold text-orange-400 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5" /> Parados há 3+ dias — HubSpot
                <Badge className="text-[9px] h-4 ml-auto bg-orange-500/20 text-orange-400">{hsAlerts.stale.length}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1.5">
              {hsAlerts.stale.map((d: any) => (
                <div key={d.id} className="flex items-center justify-between gap-2 text-xs rounded-lg bg-card/50 p-2 border border-border/20">
                  <p className="font-medium text-foreground truncate flex-1">{d.properties?.dealname || "Sem nome"}</p>
                  <span className="text-orange-400 font-bold shrink-0">{d.daysSinceUpdate}d</span>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* No contact - Piperun */}
        {prAlerts.noContact.length > 0 && (
          <Card className="border-amber-500/20 bg-amber-500/5">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-semibold text-amber-400 flex items-center gap-1.5">
                <PhoneOff className="w-3.5 h-3.5" /> Nunca contatados — Piperun
                <Badge className="text-[9px] h-4 ml-auto bg-amber-500/20 text-amber-400">{prAlerts.noContact.length}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1.5">
              {prAlerts.noContact.map((d: any) => (
                <div key={d.id} className="flex items-center justify-between gap-2 text-xs rounded-lg bg-card/50 p-2 border border-border/20">
                  <p className="font-medium text-foreground truncate flex-1">{d.title || "Sem título"}</p>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <Calendar className="w-3 h-3 text-muted-foreground" />
                    <span className="text-amber-400 text-[10px]">criado {formatDate(d.created_at)}</span>
                    <span className="text-amber-400 font-bold">{d.daysOld}d</span>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Frozen - Piperun */}
        {prAlerts.frozen.length > 0 && (
          <Card className="border-blue-500/20 bg-blue-500/5">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-semibold text-blue-400 flex items-center gap-1.5">
                <Snowflake className="w-3.5 h-3.5" /> Congelados — Piperun
                <Badge className="text-[9px] h-4 ml-auto bg-blue-500/20 text-blue-400">{prAlerts.frozen.length}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1.5">
              {prAlerts.frozen.map((d: any) => (
                <div key={d.id} className="flex items-center justify-between gap-2 text-xs rounded-lg bg-card/50 p-2 border border-border/20">
                  <p className="font-medium text-foreground truncate flex-1">{d.title || "Sem título"}</p>
                  {d.frozen_at && <span className="text-blue-400 text-[10px] shrink-0">{formatDate(d.frozen_at)}</span>}
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
