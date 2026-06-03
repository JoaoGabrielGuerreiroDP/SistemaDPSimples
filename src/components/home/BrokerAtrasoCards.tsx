import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useMyBrokerAtraso, useCompanyBrokerAtraso, type BrokerAtrasoAggregate } from "@/hooks/useBrokerAtraso";
import { useUserRole } from "@/hooks/useUserRole";
import { UploadAtrasoDialog } from "./UploadAtrasoDialog";
import { Upload, AlertTriangle, ChevronDown, ChevronUp, FileSpreadsheet, ShieldAlert } from "lucide-react";

function formatBRL(val: number) {
  return (val || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
}
function formatNum(val: number) {
  return (val || 0).toLocaleString("pt-BR");
}
function formatDate(iso?: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

function KpiBlock({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className={`rounded-lg p-3 space-y-1 ${accent ? "bg-destructive/15 border border-destructive/30" : "bg-background/60"}`}>
      <span className="text-[10px] sm:text-xs text-muted-foreground uppercase tracking-wider">{label}</span>
      <p className={`text-base sm:text-xl font-bold ${accent ? "text-destructive" : "text-foreground"}`}>{value}</p>
    </div>
  );
}

function AggregateGrid({ agg }: { agg: BrokerAtrasoAggregate }) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      <KpiBlock label="Contratos em atraso" value={String(agg.count)} accent />
      <KpiBlock label="Parcelas em atraso" value={formatNum(agg.parcelasAtrasoTotal)} />
      <KpiBlock label="Crédito em risco" value={formatBRL(agg.creditoVendaTotal)} />
      <KpiBlock label="Comissão em risco" value={formatBRL(agg.comissaoTotal)} />
    </div>
  );
}

/* ─── Card individual do corretor logado ─── */
export function MyBrokerAtrasoCard() {
  const { aggregate, myRows, myCanonical, lastUpload, loading } = useMyBrokerAtraso();
  const [expanded, setExpanded] = useState(false);

  if (loading) return null;
  if (!lastUpload) return null;
  if (myRows.length === 0) return null;

  return (
    <Card className="border-destructive/30 bg-gradient-to-br from-destructive/5 to-transparent overflow-hidden">
      <CardContent className="p-4 sm:p-5 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-full bg-destructive/20 flex items-center justify-center">
              <AlertTriangle className="w-4 h-4 text-destructive" />
            </div>
            <div>
              <h2 className="font-display text-sm sm:text-base font-bold text-foreground">
                Meus Atrasos — {myCanonical}
              </h2>
              <span className="text-[10px] sm:text-xs text-muted-foreground">
                Snapshot atualizado em {formatDate(lastUpload.created_at)}
              </span>
            </div>
          </div>
          <Badge variant="destructive" className="text-[10px]">{aggregate.count} em atraso</Badge>
        </div>

        <AggregateGrid agg={aggregate} />

        <Button
          variant="ghost"
          size="sm"
          className="w-full"
          onClick={() => setExpanded((v) => !v)}
        >
          {expanded ? <><ChevronUp className="w-4 h-4 mr-1" /> Ocultar contratos</> : <><ChevronDown className="w-4 h-4 mr-1" /> Ver meus contratos em atraso</>}
        </Button>

        {expanded && (
          <div className="overflow-x-auto rounded-lg border border-border/30">
            <table className="text-xs w-full">
              <thead className="bg-muted/40">
                <tr>
                  <th className="text-left px-2 py-1.5">Grupo/Cota</th>
                  <th className="text-left px-2 py-1.5">Cliente</th>
                  <th className="text-right px-2 py-1.5">Pagas</th>
                  <th className="text-right px-2 py-1.5">Atraso</th>
                  <th className="text-right px-2 py-1.5">Crédito</th>
                  <th className="text-left px-2 py-1.5">Situação</th>
                  <th className="text-right px-2 py-1.5">Comissão</th>
                </tr>
              </thead>
              <tbody>
                {myRows.map((r) => (
                  <tr key={r.id} className="border-t border-border/20">
                    <td className="px-2 py-1.5 whitespace-nowrap">{r.grupo}/{r.cota}</td>
                    <td className="px-2 py-1.5 truncate max-w-[180px]">{r.cliente}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums">{r.parcelas_pagas ?? "—"}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums font-semibold text-destructive">{r.parcelas_atraso ?? "—"}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums">{r.credito_venda != null ? formatBRL(r.credito_venda) : "—"}</td>
                    <td className="px-2 py-1.5 truncate max-w-[140px]">{r.situacao ?? "—"}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums">{r.comissao_corretor != null ? formatBRL(r.comissao_corretor) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/* ─── Visão geral da empresa (apenas gestão) ─── */
export function CompanyAtrasoOverview() {
  const { isAdmin, isGestor } = useUserRole();
  const { company, byVendedor, lastUpload, loading, refetch } = useCompanyBrokerAtraso();
  const [expanded, setExpanded] = useState(false);

  if (!isAdmin && !isGestor) return null;

  return (
    <Card className="border-destructive/40 bg-gradient-to-br from-destructive/5 via-transparent to-amber-500/5 overflow-hidden">
      <CardContent className="p-4 sm:p-5 space-y-4">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-full bg-destructive/20 flex items-center justify-center">
              <ShieldAlert className="w-4 h-4 text-destructive" />
            </div>
            <div>
              <h2 className="font-display text-sm sm:text-base font-bold text-foreground flex items-center gap-2">
                Visão Geral — Atrasos
                <Badge variant="outline" className="text-[9px] border-destructive/40 text-destructive">Gestão</Badge>
              </h2>
              <span className="text-[10px] sm:text-xs text-muted-foreground">
                {lastUpload
                  ? <>Snapshot: {formatDate(lastUpload.created_at)}{lastUpload.uploaded_by_name ? ` · por ${lastUpload.uploaded_by_name}` : ""}</>
                  : "Nenhuma planilha de atraso carregada ainda"}
              </span>
            </div>
          </div>

          <UploadAtrasoDialog
            trigger={
              <Button size="sm" variant="destructive">
                <Upload className="w-4 h-4 mr-1" /> Atualizar atraso
              </Button>
            }
            onSuccess={refetch}
          />
        </div>

        {loading ? (
          <p className="text-sm text-muted-foreground">Carregando...</p>
        ) : !lastUpload ? (
          <div className="rounded-lg border border-dashed border-border/40 p-6 text-center text-sm text-muted-foreground">
            <FileSpreadsheet className="w-8 h-8 mx-auto mb-2 opacity-40" />
            Faça upload da planilha de atraso para começar.
          </div>
        ) : (
          <>
            <AggregateGrid agg={company} />

            <Button
              variant="ghost"
              size="sm"
              className="w-full"
              onClick={() => setExpanded((v) => !v)}
            >
              {expanded ? <><ChevronUp className="w-4 h-4 mr-1" /> Ocultar ranking por corretor</> : <><ChevronDown className="w-4 h-4 mr-1" /> Ver atrasos por corretor ({byVendedor.length})</>}
            </Button>

            {expanded && (
              <div className="overflow-x-auto rounded-lg border border-border/30">
                <table className="text-xs w-full">
                  <thead className="bg-muted/40">
                    <tr>
                      <th className="text-left px-2 py-1.5">#</th>
                      <th className="text-left px-2 py-1.5">Corretor</th>
                      <th className="text-right px-2 py-1.5">Contratos</th>
                      <th className="text-right px-2 py-1.5">Parc. atraso</th>
                      <th className="text-right px-2 py-1.5">Crédito em risco</th>
                      <th className="text-right px-2 py-1.5">Comissão em risco</th>
                    </tr>
                  </thead>
                  <tbody>
                    {byVendedor.map((b, i) => (
                      <tr key={b.vendedor} className="border-t border-border/20">
                        <td className="px-2 py-1.5 tabular-nums text-muted-foreground">{i + 1}</td>
                        <td className="px-2 py-1.5 font-medium">{b.vendedor}</td>
                        <td className="px-2 py-1.5 text-right tabular-nums">{b.count}</td>
                        <td className="px-2 py-1.5 text-right tabular-nums font-semibold text-destructive">{formatNum(b.parcelasAtrasoTotal)}</td>
                        <td className="px-2 py-1.5 text-right tabular-nums">{formatBRL(b.creditoVendaTotal)}</td>
                        <td className="px-2 py-1.5 text-right tabular-nums">{formatBRL(b.comissaoTotal)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}