import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useGoogleSheetsData } from "@/hooks/useGoogleSheetsData";
import { normalizeName } from "@/lib/seller-names";
import { Card, CardContent } from "@/components/ui/card";
import { Trophy, Crown, ChevronRight, Flame, ChevronDown, ChevronUp } from "lucide-react";

const COMP_YEAR = 2026;
const COMP_MONTH = 5; // June
const COMP_START = new Date(COMP_YEAR, COMP_MONTH, 1);
const COMP_END = new Date(COMP_YEAR, COMP_MONTH + 1, 0, 23, 59, 59);

const DUELS: { id: number; a: string; b: string; aShort: string; bShort: string }[] = [
  { id: 1, a: "Gabriel Simão",          b: "Vinícius Oliveira",   aShort: "Simão",    bShort: "Vinícius"   },
  { id: 2, a: "Gustavo Machado Correa", b: "Márcio Pereira",      aShort: "Gustavo",  bShort: "Márcio"     },
  { id: 3, a: "Alexander",              b: "Alessandro",          aShort: "Xandi",    bShort: "Alessandro" },
  { id: 4, a: "Gabriel Manenti",        b: "Guilherme Sutil",     aShort: "Manenti",  bShort: "Sutil"      },
  { id: 5, a: "Guilherme Melo",         b: "Luan",                aShort: "Melo",     bShort: "Luan"       },
  { id: 6, a: "Lucas Freitas",          b: "Patrick Bragato Rex", aShort: "Lucas",    bShort: "Patrick"    },
];
const PARTICIPANTS_SHORT: Record<string, string> = Object.fromEntries(
  DUELS.flatMap((d) => [[d.a, d.aShort], [d.b, d.bShort]])
);
const PARTICIPANTS = Object.keys(PARTICIPANTS_SHORT);

function parseBRDate(raw: string): Date | null {
  if (!raw) return null;
  const [d, m, y] = raw.split("/").map(Number);
  if (!d || !m || !y) return null;
  return new Date(y, m - 1, d);
}
function formatBRL(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
}

export function CopaDPSummary() {
  const navigate = useNavigate();
  const { allRows } = useGoogleSheetsData();
  const [expanded, setExpanded] = useState(false);

  const now = new Date();
  const isActive = now <= COMP_END && now >= new Date(2026, 4, 15); // show from mid-May onward

  const { ranking, total, totals } = useMemo(() => {
    const totals: Record<string, number> = {};
    PARTICIPANTS.forEach((n) => (totals[n] = 0));
    let sum = 0;
    allRows.forEach((r) => {
      const d = parseBRDate(r.dataVenda);
      if (!d || d < COMP_START || d > COMP_END) return;
      const canonical = normalizeName(r.corretor || "");
      if (!PARTICIPANTS.includes(canonical)) return;
      totals[canonical] += r.valor;
      sum += r.valor;
    });
    const ranking = Object.entries(totals)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
    return { ranking, total: sum, totals };
  }, [allRows]);

  if (!isActive) return null;

  const diasRestantes = Math.max(
    Math.ceil((COMP_END.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)),
    0
  );
  const top3 = ranking.slice(0, 3);
  const leader = top3[0];
  const hasSales = leader && leader.value > 0;

  return (
    <Card className="overflow-hidden border-[hsl(45,90%,55%)]/40 bg-gradient-to-br from-[hsl(45,80%,12%)] via-background to-[hsl(140,40%,8%)]">
      <CardContent className="p-4 sm:p-5 space-y-3">
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="w-full flex items-center justify-between gap-2 group"
          aria-expanded={expanded}
        >
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[hsl(45,95%,70%)] to-[hsl(45,90%,55%)] flex items-center justify-center shadow-lg shadow-[hsl(45,90%,55%)]/30 shrink-0 group-hover:scale-110 transition-transform">
              <Trophy className="w-4 h-4 text-black" />
            </div>
            <div className="text-left min-w-0">
              <h2 className="font-display text-sm sm:text-base font-bold text-foreground leading-tight truncate">
                Copa do Mundo de Vendas DP 2026
              </h2>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider truncate">
                {diasRestantes > 0 ? `${diasRestantes} dias restantes` : "Encerrada"}
                {total > 0 && <> · {formatBRL(total)} disputados</>}
              </p>
            </div>
          </div>
          <div className="w-7 h-7 rounded-full bg-[hsl(45,90%,55%)]/20 flex items-center justify-center shrink-0 group-hover:bg-[hsl(45,90%,55%)]/30 transition-colors">
            {expanded ? (
              <ChevronUp className="w-4 h-4 text-[hsl(45,95%,70%)]" />
            ) : (
              <ChevronDown className="w-4 h-4 text-[hsl(45,95%,70%)]" />
            )}
          </div>
        </button>

        {expanded && (hasSales ? (
          <>
            {/* Resumo das 6 partidas */}
            <div className="space-y-1.5">
              <div className="text-[9px] uppercase tracking-widest text-muted-foreground font-bold px-1">
                Partidas
              </div>
              {DUELS.map((d) => {
                const aVal = totals[d.a] || 0;
                const bVal = totals[d.b] || 0;
                const aLead = aVal > bVal;
                const bLead = bVal > aVal;
                const noPlay = aVal === 0 && bVal === 0;
                return (
                  <div
                    key={d.id}
                    className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 rounded-md bg-background/50 border border-border/40 px-2.5 py-1.5 text-[11px]"
                  >
                    <div className={`flex items-center gap-1.5 min-w-0 ${aLead ? "text-[hsl(140,60%,65%)] font-bold" : "text-foreground/80"}`}>
                      <span className="truncate">{d.aShort}</span>
                      <span className="ml-auto text-[10px] tabular-nums opacity-80">{formatBRL(aVal)}</span>
                    </div>
                    <span className="text-[9px] uppercase tracking-widest text-muted-foreground/60">
                      {noPlay ? "—" : "vs"}
                    </span>
                    <div className={`flex items-center gap-1.5 min-w-0 ${bLead ? "text-[hsl(140,60%,65%)] font-bold" : "text-foreground/80"}`}>
                      <span className="text-[10px] tabular-nums opacity-80">{formatBRL(bVal)}</span>
                      <span className="truncate ml-auto text-right">{d.bShort}</span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Abrir Copa completa */}
            <button
              type="button"
              onClick={() => navigate("/dp-consorcios/copa-dp-2026")}
              className="w-full flex items-center justify-center gap-1.5 text-[11px] font-bold uppercase tracking-widest text-[hsl(45,95%,70%)] hover:text-[hsl(45,95%,80%)] py-2 rounded-md border border-[hsl(45,90%,55%)]/30 hover:bg-[hsl(45,90%,55%)]/10 transition-colors"
            >
              Abrir Copa completa
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </>
        ) : (
          <div className="flex items-center gap-2 text-xs text-muted-foreground py-3 justify-center">
            <Flame className="w-4 h-4 text-[hsl(45,95%,70%)]" />
            A bola vai rolar — vendas começam a contar em junho.
          </div>
        ))}
      </CardContent>
    </Card>
  );
}