import { useMemo, useState } from "react";
import { SaleRow } from "@/hooks/useGoogleSheetsData";
import { ChevronDown, ChevronUp, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

function formatBRL(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

interface SalesDetailTableProps {
  rows: SaleRow[];
  monthLabel: string;
}

type SortKey = "proposta" | "corretor" | "valor" | "source" | "cliente" | "administradora" | "dataVenda";
type SortDir = "asc" | "desc";

export function SalesDetailTable({ rows, monthLabel }: SalesDetailTableProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("valor");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("desc"); }
  };

  const filtered = useMemo(() => {
    if (!search.trim()) return rows;
    const q = search.toLowerCase();
    return rows.filter(
      (r) =>
        r.proposta.toLowerCase().includes(q) ||
        r.corretor.toLowerCase().includes(q) ||
        r.cliente.toLowerCase().includes(q) ||
        r.administradora.toLowerCase().includes(q)
    );
  }, [rows, search]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      let cmp = 0;
      if (sortKey === "valor") cmp = a.valor - b.valor;
      else cmp = (a[sortKey] || "").localeCompare(b[sortKey] || "");
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [filtered, sortKey, sortDir]);

  const SortIcon = ({ col }: { col: SortKey }) => {
    if (sortKey !== col) return null;
    return sortDir === "asc" ? <ChevronUp className="w-3 h-3 inline ml-1" /> : <ChevronDown className="w-3 h-3 inline ml-1" />;
  };

  const thClass = "py-2 pr-3 text-left cursor-pointer select-none hover:text-foreground transition-colors whitespace-nowrap";

  return (
    <div className="glass-card overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between p-5 text-left hover:bg-muted/10 transition-colors"
      >
        <h2 className="font-display text-lg font-semibold text-foreground">
          Lista de Vendas — {monthLabel}
          <span className="ml-2 text-sm font-normal text-muted-foreground">({rows.length})</span>
        </h2>
        {open ? <ChevronUp className="w-5 h-5 text-muted-foreground" /> : <ChevronDown className="w-5 h-5 text-muted-foreground" />}
      </button>

      {open && (
        <div className="px-5 pb-5 space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por proposta, corretor, cliente..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 bg-background/50"
            />
          </div>

          <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-card z-10">
                <tr className="border-b border-border text-muted-foreground text-xs uppercase tracking-wider">
                  <th className={thClass} onClick={() => toggleSort("proposta")}>Proposta<SortIcon col="proposta" /></th>
                  <th className={thClass} onClick={() => toggleSort("cliente")}>Cliente<SortIcon col="cliente" /></th>
                  <th className={thClass} onClick={() => toggleSort("corretor")}>Corretor<SortIcon col="corretor" /></th>
                  <th className={thClass} onClick={() => toggleSort("administradora")}>Admin.<SortIcon col="administradora" /></th>
                  <th className={thClass} onClick={() => toggleSort("dataVenda")}>Data<SortIcon col="dataVenda" /></th>
                  <th className={`${thClass} text-right`} onClick={() => toggleSort("valor")}>Valor<SortIcon col="valor" /></th>
                  <th className={thClass} onClick={() => toggleSort("source")}>Origem<SortIcon col="source" /></th>
                </tr>
              </thead>
              <tbody>
                {sorted.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-muted-foreground">Nenhuma venda encontrada</td>
                  </tr>
                ) : (
                  sorted.map((r, i) => (
                    <tr key={`${r.proposta}-${i}`} className="border-b border-border/30 hover:bg-muted/5 transition-colors">
                      <td className="py-2 pr-3 font-mono text-xs text-muted-foreground">{r.proposta || "—"}</td>
                      <td className="py-2 pr-3 text-foreground max-w-[180px] truncate">{r.cliente || "—"}</td>
                      <td className="py-2 pr-3 font-medium text-foreground">{r.corretor || "—"}</td>
                      <td className="py-2 pr-3 text-muted-foreground">{r.administradora || "—"}</td>
                      <td className="py-2 pr-3 text-muted-foreground whitespace-nowrap">{r.dataVenda || "—"}</td>
                      <td className="py-2 pr-3 text-right font-semibold text-primary whitespace-nowrap">{formatBRL(r.valor)}</td>
                      <td className="py-2">
                        {r.source === "atual" ? (
                          <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/25 text-[10px]">atual</Badge>
                        ) : (
                          <Badge className="bg-amber-500/15 text-amber-400 border-amber-500/20 hover:bg-amber-500/25 text-[10px]">hist.</Badge>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
