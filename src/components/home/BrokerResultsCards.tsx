import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useMyBrokerResults, useCompanyBrokerResults, type BrokerAggregate } from "@/hooks/useBrokerResults";
import { useUserRole } from "@/hooks/useUserRole";
import { UploadResultsDialog } from "./UploadResultsDialog";
import { Upload, TrendingUp, DollarSign, Users, ChevronDown, ChevronUp, Building2, Trophy, FileSpreadsheet } from "lucide-react";

function formatBRL(val: number) {
  return (val || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
}
function formatPct(val: number) {
  // pct may already be 0–1 or 0–100. Heuristic: if absolute < 1.5 treat as fraction.
  const v = Math.abs(val) <= 1.5 ? val * 100 : val;
  return `${v.toFixed(1)}%`;
}
function formatDate(iso?: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

function KpiBlock({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className={`rounded-lg p-3 space-y-1 ${accent ? "bg-primary/15 border border-primary/30" : "bg-background/60"}`}>
      <span className="text-[10px] sm:text-xs text-muted-foreground uppercase tracking-wider">{label}</span>
      <p className={`text-base sm:text-xl font-bold ${accent ? "text-primary" : "text-foreground"}`}>{value}</p>
    </div>
  );
}

function AggregateGrid({ agg }: { agg: BrokerAggregate }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
      <KpiBlock label="Dinheiro na Mesa" value={formatBRL(agg.dinheiroMesa)} accent />
      <KpiBlock label="Crédito Gerado" value={formatBRL(agg.creditoGerado)} />
      <KpiBlock label="Vlr. até fim do ciclo" value={formatBRL(agg.vlrFimCiclo)} />
      <KpiBlock label="Contratos" value={String(agg.count)} />
      <KpiBlock label="% Comissão (média)" value={formatPct(agg.pctComissaoAvg)} />
      <KpiBlock label="% Estorno (média)" value={formatPct(agg.pctEstornoAvg)} />
      <KpiBlock label="Vlr. Estorno" value={formatBRL(agg.vlrEstorno)} />
    </div>
  );
}

/* ─── Card individual do corretor logado ─── */
export function MyBrokerResultsCard() {
  const { aggregate, myRows, myCanonical, lastUpload, loading } = useMyBrokerResults();
  const [expanded, setExpanded] = useState(false);

  if (loading) return null;
  if (!lastUpload) return null;
  if (myRows.length === 0) return null;

  return (
    <Card className="border-primary/30 bg-gradient-to-br from-primary/5 to-transparent overflow-hidden">
      <CardContent className="p-4 sm:p-5 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-full bg-primary/20 flex items-center justify-center">
              <Trophy className="w-4 h-4 text-primary" />
            </div>
            <div>
              <h2 className="font-display text-sm sm:text-base font-bold text-foreground">
                Meus Resultados — {myCanonical}
              </h2>
              <span className="text-[10px] sm:text-xs text-muted-foreground">
                Planilha atualizada em {formatDate(lastUpload.created_at)}
              </span>
            </div>
          </div>
          <Badge variant="secondary" className="text-[10px]">{aggregate.count} contratos</Badge>
        </div>

        <AggregateGrid agg={aggregate} />

        <Button
          variant="ghost"
          size="sm"
          className="w-full"
          onClick={() => setExpanded((v) => !v)}
        >
          {expanded ? <><ChevronUp className="w-4 h-4 mr-1" /> Ocultar contratos</> : <><ChevronDown className="w-4 h-4 mr-1" /> Ver meus contratos</>}
        </Button>

        {expanded && (
          <div className="overflow-x-auto rounded-lg border border-border/30">
            <table className="text-xs w-full">
              <thead className="bg-muted/40">
                <tr>
                  <th className="text-left px-2 py-1.5">Grupo/Cota</th>
                  <th className="text-left px-2 py-1.5">Cliente</th>
                  <th className="text-right px-2 py-1.5">Parc.</th>
                  <th className="text-right px-2 py-1.5">Crédito</th>
                  <th className="text-right px-2 py-1.5">% Com.</th>
                  <th className="text-right px-2 py-1.5">$ na Mesa</th>
                </tr>
              </thead>
              <tbody>
                {myRows.map((r) => (
                  <tr key={r.id} className="border-t border-border/20">
                    <td className="px-2 py-1.5 whitespace-nowrap">{r.grupo}/{r.cota}</td>
                    <td className="px-2 py-1.5 truncate max-w-[180px]">{r.cliente}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums">{r.parcelas_pagas ?? "—"}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums">{r.credito_gerado != null ? formatBRL(r.credito_gerado) : "—"}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums">{r.pct_comissao != null ? formatPct(r.pct_comissao) : "—"}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums font-semibold text-primary">{r.dinheiro_na_mesa != null ? formatBRL(r.dinheiro_na_mesa) : "—"}</td>
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
export function CompanyResultsOverview() {
  const { isAdmin, isGestor } = useUserRole();
  const { company, byVendedor, lastUpload, loading, refetch } = useCompanyBrokerResults();
  const [expanded, setExpanded] = useState(false);

  if (!isAdmin && !isGestor) return null;

  return (
    <Card className="border-amber-500/40 bg-gradient-to-br from-amber-500/5 via-transparent to-primary/5 overflow-hidden">
      <CardContent className="p-4 sm:p-5 space-y-4">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-full bg-amber-500/20 flex items-center justify-center">
              <Building2 className="w-4 h-4 text-amber-500" />
            </div>
            <div>
              <h2 className="font-display text-sm sm:text-base font-bold text-foreground flex items-center gap-2">
                Visão Geral - Canceladas
                <Badge variant="outline" className="text-[9px] border-amber-500/40 text-amber-500">Gestão</Badge>
              </h2>
              <span className="text-[10px] sm:text-xs text-muted-foreground">
                {lastUpload
                  ? <>Última atualização: {formatDate(lastUpload.created_at)}{lastUpload.uploaded_by_name ? ` · por ${lastUpload.uploaded_by_name}` : ""}</>
                  : "Nenhuma planilha carregada ainda"}
              </span>
            </div>
          </div>

          <UploadResultsDialog
            trigger={
              <Button size="sm" variant="default">
                <Upload className="w-4 h-4 mr-1" /> Atualizar canceladas
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
            Faça upload da planilha gerada pela sua automação para começar.
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
              {expanded ? <><ChevronUp className="w-4 h-4 mr-1" /> Ocultar ranking por corretor</> : <><ChevronDown className="w-4 h-4 mr-1" /> Ver ranking por corretor ({byVendedor.length})</>}
            </Button>

            {expanded && (
              <div className="overflow-x-auto rounded-lg border border-border/30">
                <table className="text-xs w-full">
                  <thead className="bg-muted/40">
                    <tr>
                      <th className="text-left px-2 py-1.5">#</th>
                      <th className="text-left px-2 py-1.5">Corretor</th>
                      <th className="text-right px-2 py-1.5">Contratos</th>
                      <th className="text-right px-2 py-1.5">Crédito</th>
                      <th className="text-right px-2 py-1.5">$ na Mesa</th>
                      <th className="text-right px-2 py-1.5">Vlr fim ciclo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {byVendedor.map((b, i) => (
                      <tr key={b.vendedor} className="border-t border-border/20">
                        <td className="px-2 py-1.5 tabular-nums text-muted-foreground">{i + 1}</td>
                        <td className="px-2 py-1.5 font-medium">{b.vendedor}</td>
                        <td className="px-2 py-1.5 text-right tabular-nums">{b.count}</td>
                        <td className="px-2 py-1.5 text-right tabular-nums">{formatBRL(b.creditoGerado)}</td>
                        <td className="px-2 py-1.5 text-right tabular-nums font-semibold text-primary">{formatBRL(b.dinheiroMesa)}</td>
                        <td className="px-2 py-1.5 text-right tabular-nums">{formatBRL(b.vlrFimCiclo)}</td>
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