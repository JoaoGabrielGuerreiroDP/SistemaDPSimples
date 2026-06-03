import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import {
  RefreshCw,
  Search,
  ExternalLink,
  Wallet,
  ArrowUpDown,
  MessageCircle,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Carta {
  codigo: string;
  categoria: string;
  credito_cents: number;
  entrada_cents: number;
  parcelas: number;
  valor_parcela_cents: number;
  saldo_devedor_cents: number;
  fundo_comum_cents: number;
  ref_garantia_cents: number;
  administradora: string;
  status: string;
  fonte: string;
  fonte_nome: string;
  fonte_cor: string;
  whatsapp_link: string;
}

interface SourceInfo {
  id: string;
  name: string;
  url: string;
  site: string;
  color: string;
  total: number;
  error?: string;
}

interface ApiResponse {
  sources: SourceInfo[];
  fetched_at: string;
  total: number;
  cartas: Carta[];
  cached?: boolean;
}

function formatBRL(cents: number) {
  if (!cents) return "—";
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(cents / 100);
}

function normalize(s: string) {
  return (s || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

/**
 * Calcula a taxa de juros mensal embutida em uma carta contemplada,
 * usando a mesma metodologia da Calculadora do Cidadão (BCB):
 * Tabela Price com juros compostos, capitalização mensal,
 * 1ª prestação não no ato. Resolve j em:
 *   q0 = p × [1 − (1 + j)^-n] / j
 * via Newton-Raphson, tolerância sobre p < 1e-6.
 */
function calcTaxaBCB(
  creditoCents: number,
  entradaCents: number,
  parcelas: number,
  valorParcelaCents: number,
) {
  const credito = creditoCents / 100;
  const entrada = entradaCents / 100;
  const p = valorParcelaCents / 100;
  const n = parcelas;

  const valorFinanciado = Math.max(0, credito - entrada);
  const custoTotal = entrada + p * n;
  const agioCents = Math.round((custoTotal - credito) * 100);
  const agioPct = credito > 0 ? (custoTotal - credito) / credito : 0;
  const entradaPct = credito > 0 ? entrada / credito : 0;

  let taxaMensal: number | null = null;
  if (n > 0 && p > 0 && valorFinanciado > 0) {
    if (p * n <= valorFinanciado) {
      // Soma das parcelas <= principal: sem juros (ou negativo).
      taxaMensal = 0;
    } else {
      // Newton-Raphson em f(j) = p × (1 − (1+j)^-n)/j − q0
      let j = 0.01;
      for (let i = 0; i < 100; i++) {
        const pow = Math.pow(1 + j, -n);
        const f = (p * (1 - pow)) / j - valorFinanciado;
        // df/dj
        const df =
          (p * (n * pow * (1 + j) ** -1)) / j -
          (p * (1 - pow)) / (j * j);
        if (!isFinite(df) || df === 0) break;
        const jNext = j - f / df;
        if (!isFinite(jNext) || jNext <= 0) {
          j = j / 2;
          continue;
        }
        // Tolerância sobre p (critério BCB)
        const pCalc = (valorFinanciado * jNext) / (1 - Math.pow(1 + jNext, -n));
        if (Math.abs(pCalc - p) < 1e-6 * p) {
          j = jNext;
          break;
        }
        j = jNext;
      }
      taxaMensal = j;
    }
  } else if (valorFinanciado === 0 && entrada >= credito) {
    taxaMensal = 0;
  }

  const taxaAnual =
    taxaMensal !== null ? Math.pow(1 + taxaMensal, 12) - 1 : null;

  return {
    valorFinanciado,
    custoTotal,
    agioCents,
    agioPct,
    entradaPct,
    taxaMensal,
    taxaAnual,
  };
}

function formatPct(value: number | null, digits = 2): string {
  if (value === null || !isFinite(value)) return "—";
  return `${(value * 100).toLocaleString("pt-BR", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })}%`;
}

function formatBRLSigned(cents: number): string {
  if (!cents) return "R$ 0,00";
  const abs = formatBRL(Math.abs(cents));
  return cents > 0 ? `+${abs}` : `−${abs}`;
}

const FONTE_CLASSES: Record<string, string> = {
  amber: "bg-amber-500/15 text-amber-600 border-amber-500/30",
  emerald: "bg-emerald-500/15 text-emerald-600 border-emerald-500/30",
  violet: "bg-violet-500/15 text-violet-600 border-violet-500/30",
  sky: "bg-sky-500/15 text-sky-600 border-sky-500/30",
};

type SortKey = "credito" | "entrada" | "parcela" | "codigo" | "agio" | "taxa";

type CartaEnriquecida = Carta & ReturnType<typeof calcTaxaBCB>;

export default function CartasContempladas() {
  const [segmento, setSegmento] = useState<string>("todos");
  const [status, setStatus] = useState<string>("todos");
  const [administradora, setAdministradora] = useState<string>("todas");
  const [fonte, setFonte] = useState<string>("todas");
  const [taxaMax, setTaxaMax] = useState<string>("qualquer");
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("credito");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [selected, setSelected] = useState<CartaEnriquecida | null>(null);
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());

  const cartaKey = (c: Pick<Carta, "fonte" | "codigo">) =>
    `${c.fonte}-${c.codigo}`;

  const toggleSelected = (key: string) => {
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };
  const clearSelection = () => setSelectedKeys(new Set());

  const { data, isLoading, isFetching, refetch, error } = useQuery<ApiResponse>({
    queryKey: ["ldcred-contempladas"],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke(
        "ldcred-contempladas",
      );
      if (error) throw error;
      return data as ApiResponse;
    },
    staleTime: 15 * 60 * 1000,
  });

  const cartas = data?.cartas ?? [];
  const sources = data?.sources ?? [];

  const cartasEnriquecidas = useMemo<CartaEnriquecida[]>(() => {
    return cartas.map((c) => ({
      ...c,
      ...calcTaxaBCB(
        c.credito_cents,
        c.entrada_cents,
        c.parcelas,
        c.valor_parcela_cents,
      ),
    }));
  }, [cartas]);

  const administradoras = useMemo(() => {
    const set = new Set<string>();
    cartas.forEach((c) => {
      if (c.administradora) set.add(c.administradora);
    });
    return Array.from(set).sort();
  }, [cartas]);

  const filtered = useMemo(() => {
    let result = cartasEnriquecidas.slice();
    if (fonte !== "todas") {
      result = result.filter((c) => c.fonte === fonte);
    }
    if (segmento !== "todos") {
      const seg = normalize(segmento);
      result = result.filter((c) => normalize(c.categoria).includes(seg));
    }
    if (status !== "todos") {
      const st = normalize(status);
      result = result.filter((c) => normalize(c.status).includes(st));
    }
    if (administradora !== "todas") {
      result = result.filter((c) => c.administradora === administradora);
    }
    if (taxaMax !== "qualquer") {
      const lim = parseFloat(taxaMax);
      result = result.filter(
        (c) => c.taxaMensal !== null && c.taxaMensal <= lim,
      );
    }
    if (search.trim()) {
      const q = normalize(search);
      result = result.filter(
        (c) =>
          normalize(c.codigo).includes(q) ||
          normalize(c.administradora).includes(q) ||
          normalize(c.fonte_nome).includes(q),
      );
    }

    const keyMap: Record<SortKey, (c: CartaEnriquecida) => number> = {
      credito: (c) => c.credito_cents,
      entrada: (c) => c.entrada_cents,
      parcela: (c) => c.valor_parcela_cents,
      codigo: (c) => parseInt(c.codigo, 10) || 0,
      agio: (c) => c.agioPct,
      taxa: (c) => c.taxaMensal ?? Number.POSITIVE_INFINITY,
    };
    const fn = keyMap[sortKey];
    result.sort((a, b) => (sortDir === "asc" ? fn(a) - fn(b) : fn(b) - fn(a)));
    return result;
  }, [
    cartasEnriquecidas,
    segmento,
    status,
    administradora,
    fonte,
    taxaMax,
    search,
    sortKey,
    sortDir,
  ]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  const totals = useMemo(() => {
    const disponivel = cartas.filter((c) =>
      c.status.toLowerCase().includes("dispon"),
    ).length;
    const reservada = cartas.filter((c) =>
      c.status.toLowerCase().includes("reserv"),
    ).length;
    return { disponivel, reservada };
  }, [cartas]);

  const selectedCartas = useMemo(
    () => cartasEnriquecidas.filter((c) => selectedKeys.has(cartaKey(c))),
    [cartasEnriquecidas, selectedKeys],
  );

  const selectionTotals = useMemo(() => {
    let credito = 0;
    let entrada = 0;
    let parcela = 0;
    let saldoDevedor = 0;
    let taxaTransf = 0;
    let prazoMin = Infinity;
    let prazoMax = -Infinity;
    selectedCartas.forEach((c) => {
      credito += c.credito_cents;
      entrada += c.entrada_cents;
      parcela += c.valor_parcela_cents;
      // Saldo Devedor = parcelas restantes × valor da parcela
      saldoDevedor += c.parcelas * c.valor_parcela_cents;
      // Taxa de Transferência: 1,5% do crédito para cartas Contemplados RS
      if (c.fonte === "contempladosrs") {
        taxaTransf += Math.round(c.credito_cents * 0.015);
      }
      if (c.parcelas > 0) {
        if (c.parcelas < prazoMin) prazoMin = c.parcelas;
        if (c.parcelas > prazoMax) prazoMax = c.parcelas;
      }
    });

    // Faixas escalonadas: de 1 até a menor duração todas pagam,
    // depois da menor até a próxima só as restantes, etc.
    // Ex: A=195x 7515, B=171x 3232 → "1 à 171: R$ 10.747,00" + "172 à 195: R$ 7.515,00"
    const prazoFaixas: { from: number; to: number; valor_cents: number }[] = [];
    if (selectedCartas.length > 0 && isFinite(prazoMin)) {
      const breakpoints = Array.from(
        new Set(selectedCartas.map((c) => c.parcelas).filter((p) => p > 0)),
      ).sort((a, b) => a - b);
      let from = 1;
      for (const bp of breakpoints) {
        const valor_cents = selectedCartas
          .filter((c) => c.parcelas >= bp)
          .reduce((s, c) => s + c.valor_parcela_cents, 0);
        prazoFaixas.push({ from, to: bp, valor_cents });
        from = bp + 1;
      }
    }

    return {
      credito,
      entrada,
      parcela,
      saldoDevedor,
      taxaTransf,
      prazoFaixas,
      prazoMin: isFinite(prazoMin) ? prazoMin : 0,
      prazoMax: isFinite(prazoMax) ? prazoMax : 0,
      count: selectedCartas.length,
    };
  }, [selectedCartas]);

  const filteredKeys = useMemo(
    () => filtered.map((c) => cartaKey(c)),
    [filtered],
  );
  const allFilteredSelected =
    filteredKeys.length > 0 &&
    filteredKeys.every((k) => selectedKeys.has(k));
  const toggleSelectAllFiltered = () => {
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      if (allFilteredSelected) {
        filteredKeys.forEach((k) => next.delete(k));
      } else {
        filteredKeys.forEach((k) => next.add(k));
      }
      return next;
    });
  };

  return (
    <div className="p-4 sm:p-6 space-y-4 max-w-[1600px] mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold flex items-center gap-2">
            <Wallet className="w-5 h-5 sm:w-6 sm:h-6 text-amber-500" />
            Cartas Contempladas
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
            {data
              ? `${data.total} cartas em ${sources.length} fontes • ${totals.disponivel} disponíveis • ${totals.reservada} reservadas`
              : "Buscando dados..."}
            {data?.fetched_at && (
              <span className="ml-1">
                • atualizado em{" "}
                {new Date(data.fetched_at).toLocaleTimeString("pt-BR")}
              </span>
            )}
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isFetching}
          >
            <RefreshCw
              className={cn("w-4 h-4 mr-1", isFetching && "animate-spin")}
            />
            Atualizar
          </Button>
        </div>
      </div>

      {/* Source chips */}
      {sources.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setFonte("todas")}
            className={cn(
              "text-xs px-3 py-1.5 rounded-full border transition-colors",
              fonte === "todas"
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-muted/40 hover:bg-muted border-border/60",
            )}
          >
            Todas as fontes ({data?.total ?? 0})
          </button>
          {sources.map((s) => (
            <button
              key={s.id}
              onClick={() => setFonte(s.id)}
              className={cn(
                "text-xs px-3 py-1.5 rounded-full border transition-colors flex items-center gap-1.5",
                fonte === s.id
                  ? FONTE_CLASSES[s.color]
                  : "bg-muted/40 hover:bg-muted border-border/60",
              )}
              title={s.error ? `Erro: ${s.error}` : s.url}
            >
              <span
                className={cn(
                  "w-1.5 h-1.5 rounded-full",
                  s.color === "amber" && "bg-amber-500",
                  s.color === "emerald" && "bg-emerald-500",
                  s.color === "violet" && "bg-violet-500",
                  s.color === "sky" && "bg-sky-500",
                )}
              />
              {s.name} ({s.total})
              {s.error && <span className="text-destructive">⚠</span>}
            </button>
          ))}
        </div>
      )}

      {/* Filters */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2 p-3 rounded-lg bg-muted/30 border border-border/50">
        <div className="col-span-2 lg:col-span-2 relative">
          <Search className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por código ou administradora..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-9"
          />
        </div>
        <Select value={segmento} onValueChange={setSegmento}>
          <SelectTrigger className="h-9">
            <SelectValue placeholder="Segmento" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os segmentos</SelectItem>
            <SelectItem value="imovel">Imóvel</SelectItem>
            <SelectItem value="veiculo">Veículo</SelectItem>
          </SelectContent>
        </Select>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="h-9">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os status</SelectItem>
            <SelectItem value="dispon">Disponível</SelectItem>
            <SelectItem value="reservada">Reservada</SelectItem>
          </SelectContent>
        </Select>
        <Select value={administradora} onValueChange={setAdministradora}>
          <SelectTrigger className="h-9">
            <SelectValue placeholder="Administradora" />
          </SelectTrigger>
          <SelectContent className="max-h-64">
            <SelectItem value="todas">Todas administradoras</SelectItem>
            {administradoras.map((a) => (
              <SelectItem key={a} value={a}>
                {a}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={taxaMax} onValueChange={setTaxaMax}>
          <SelectTrigger className="h-9" title="Taxa de juros mensal embutida (metodologia BCB)">
            <SelectValue placeholder="Taxa máx." />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="qualquer">Qualquer taxa</SelectItem>
            <SelectItem value="0.005">≤ 0,50% a.m.</SelectItem>
            <SelectItem value="0.008">≤ 0,80% a.m.</SelectItem>
            <SelectItem value="0.010">≤ 1,00% a.m.</SelectItem>
            <SelectItem value="0.015">≤ 1,50% a.m.</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Result count */}
      <div className="text-xs text-muted-foreground">
        Mostrando <strong>{filtered.length}</strong> de {cartas.length} cartas
      </div>

      {/* Error */}
      {error && (
        <div className="p-4 rounded-lg bg-destructive/10 border border-destructive/30 text-sm text-destructive">
          Erro ao buscar cartas:{" "}
          {error instanceof Error ? error.message : "desconhecido"}
        </div>
      )}

      {/* Loading */}
      {isLoading && (
        <div className="space-y-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      )}

      {/* Table */}
      {!isLoading && (
        <div className="rounded-lg border border-border/50 overflow-hidden bg-card">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <Checkbox
                      checked={allFilteredSelected}
                      onCheckedChange={toggleSelectAllFiltered}
                      aria-label="Selecionar todas filtradas"
                    />
                  </TableHead>
                  <TableHead
                    className="cursor-pointer select-none"
                    onClick={() => toggleSort("codigo")}
                  >
                    <span className="inline-flex items-center gap-1">
                      Cód. <ArrowUpDown className="w-3 h-3" />
                    </span>
                  </TableHead>
                  <TableHead>Fonte</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead
                    className="cursor-pointer select-none text-right"
                    onClick={() => toggleSort("credito")}
                  >
                    <span className="inline-flex items-center gap-1">
                      Crédito <ArrowUpDown className="w-3 h-3" />
                    </span>
                  </TableHead>
                  <TableHead
                    className="cursor-pointer select-none text-right"
                    onClick={() => toggleSort("entrada")}
                  >
                    <span className="inline-flex items-center gap-1">
                      Entrada <ArrowUpDown className="w-3 h-3" />
                    </span>
                  </TableHead>
                  <TableHead
                    className="text-right"
                    title="Crédito Real = Crédito − Entrada"
                  >
                    Crédito Real
                  </TableHead>
                  <TableHead className="text-right">Parcelas</TableHead>
                  <TableHead
                    className="cursor-pointer select-none text-right"
                    onClick={() => toggleSort("parcela")}
                  >
                    <span className="inline-flex items-center gap-1">
                      Vlr Parcela <ArrowUpDown className="w-3 h-3" />
                    </span>
                  </TableHead>
                  <TableHead
                    className="cursor-pointer select-none text-right"
                    onClick={() => toggleSort("agio")}
                    title="Ágio sobre o crédito = (custo total − crédito) ÷ crédito"
                  >
                    <span className="inline-flex items-center gap-1">
                      Ágio <ArrowUpDown className="w-3 h-3" />
                    </span>
                  </TableHead>
                  <TableHead
                    className="cursor-pointer select-none text-right"
                    onClick={() => toggleSort("taxa")}
                    title="Taxa de juros mensal embutida — metodologia Calculadora do Cidadão (BCB)"
                  >
                    <span className="inline-flex items-center gap-1">
                      Taxa a.m. <ArrowUpDown className="w-3 h-3" />
                    </span>
                  </TableHead>
                  <TableHead>Administradora</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={13}
                      className="text-center text-muted-foreground py-8"
                    >
                      Nenhuma carta encontrada com esses filtros.
                    </TableCell>
                  </TableRow>
                )}
                {filtered.map((c, idx) => {
                  const isDisponivel = c.status
                    .toLowerCase()
                    .includes("dispon");
                  const agioClass =
                    c.agioPct <= 0
                      ? "text-emerald-600"
                      : c.agioPct <= 0.15
                        ? "text-amber-600"
                        : "text-destructive";
                  const taxaClass =
                    c.taxaMensal === null
                      ? "text-muted-foreground"
                      : c.taxaMensal <= 0.005
                        ? "text-emerald-600"
                        : c.taxaMensal <= 0.012
                          ? "text-amber-600"
                          : "text-destructive";
                  return (
                    <TableRow
                      key={`${c.fonte}-${c.codigo}-${idx}`}
                      className="cursor-pointer hover:bg-muted/40"
                      onClick={() => setSelected(c)}
                    >
                      <TableCell className="w-10">
                        <div
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleSelected(cartaKey(c));
                          }}
                          className="flex items-center justify-center cursor-pointer p-1 -m-1"
                        >
                          <Checkbox
                            checked={selectedKeys.has(cartaKey(c))}
                            aria-label={`Selecionar carta ${c.codigo}`}
                          />
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {c.codigo}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={cn(
                            "text-[10px]",
                            FONTE_CLASSES[c.fonte_cor],
                          )}
                        >
                          {c.fonte_nome}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-[10px]">
                          {c.categoria}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatBRL(c.credito_cents)}
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        {formatBRL(c.entrada_cents)}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatBRL(c.credito_cents - c.entrada_cents)}
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        {c.parcelas}x
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        {formatBRL(c.valor_parcela_cents)}
                      </TableCell>
                      <TableCell
                        className={cn(
                          "text-right font-medium tabular-nums",
                          agioClass,
                        )}
                      >
                        {formatPct(c.agioPct, 2)}
                      </TableCell>
                      <TableCell
                        className={cn(
                          "text-right font-medium tabular-nums",
                          taxaClass,
                        )}
                      >
                        {formatPct(c.taxaMensal, 4)}
                      </TableCell>
                      <TableCell className="text-xs">
                        {c.administradora}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={isDisponivel ? "default" : "secondary"}
                          className={cn(
                            "text-[10px]",
                            isDisponivel &&
                              "bg-emerald-500/15 text-emerald-600 border border-emerald-500/30 hover:bg-emerald-500/20",
                            !isDisponivel &&
                              "bg-amber-500/15 text-amber-600 border border-amber-500/30",
                          )}
                        >
                          {c.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      {/* Detail dialog */}
      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-md">
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Wallet className="w-5 h-5 text-amber-500" />
                  Cota #{selected.codigo}
                  <Badge
                    variant="outline"
                    className={cn(
                      "text-[10px] ml-auto",
                      FONTE_CLASSES[selected.fonte_cor],
                    )}
                  >
                    {selected.fonte_nome}
                  </Badge>
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-3 text-sm">
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Categoria" value={selected.categoria} />
                  <Field label="Status" value={selected.status} />
                  <Field
                    label="Crédito"
                    value={formatBRL(selected.credito_cents)}
                    highlight
                  />
                  <Field
                    label="Entrada"
                    value={formatBRL(selected.entrada_cents)}
                  />
                  <Field
                    label="Nº Parcelas"
                    value={`${selected.parcelas}x`}
                  />
                  <Field
                    label="Vlr Parcela"
                    value={formatBRL(selected.valor_parcela_cents)}
                  />
                  <Field
                    label="Saldo devedor"
                    value={formatBRL(selected.saldo_devedor_cents)}
                  />
                  <Field
                    label="Fundo comum"
                    value={formatBRL(selected.fundo_comum_cents)}
                  />
                  <Field
                    label="Ref. garantia"
                    value={formatBRL(selected.ref_garantia_cents)}
                  />
                  <Field
                    label="Administradora"
                    value={selected.administradora}
                  />
                </div>
                <div className="rounded-lg border border-border/60 bg-muted/30 p-3 space-y-2">
                  <div className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold">
                    Análise (metodologia BCB)
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <Field
                      label="Valor financiado"
                      value={formatBRL(
                        Math.round(selected.valorFinanciado * 100),
                      )}
                    />
                    <Field
                      label="Custo total"
                      value={formatBRL(Math.round(selected.custoTotal * 100))}
                    />
                    <Field
                      label="Ágio (R$)"
                      value={formatBRLSigned(selected.agioCents)}
                    />
                    <Field
                      label="Ágio (%)"
                      value={formatPct(selected.agioPct, 2)}
                    />
                    <Field
                      label="Entrada (%)"
                      value={formatPct(selected.entradaPct, 2)}
                    />
                    <Field
                      label="Taxa anual equiv."
                      value={formatPct(selected.taxaAnual, 2)}
                    />
                  </div>
                  <div className="pt-1 border-t border-border/50">
                    <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                      Taxa de juros mensal embutida
                    </div>
                    <div className="text-2xl font-bold text-primary tabular-nums">
                      {formatPct(selected.taxaMensal, 4)}
                      <span className="text-xs text-muted-foreground font-normal ml-1">
                        a.m.
                      </span>
                    </div>
                  </div>
                  <a
                    href="https://www3.bcb.gov.br/CALCIDADAO/publico/exibirMetodologiaFinanciamentoPrestacoesFixas.do?method=exibirMetodologiaFinanciamentoPrestacoesFixas"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[10px] text-muted-foreground hover:text-primary underline-offset-2 hover:underline inline-flex items-center gap-1"
                  >
                    Mesma metodologia da Calculadora do Cidadão / Banco Central
                    <ExternalLink className="w-2.5 h-2.5" />
                  </a>
                </div>
                <a
                  href={selected.whatsapp_link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block"
                >
                  <Button className="w-full gap-2 bg-emerald-600 hover:bg-emerald-700 text-white">
                    <MessageCircle className="w-4 h-4" />
                    Tenho interesse — WhatsApp
                  </Button>
                </a>
                <a
                  href={
                    sources.find((s) => s.id === selected.fonte)?.site ?? "#"
                  }
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block"
                >
                  <Button variant="outline" className="w-full gap-2">
                    <ExternalLink className="w-4 h-4" />
                    Ver site da fonte ({selected.fonte_nome})
                  </Button>
                </a>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Floating selection summary */}
      {selectionTotals.count > 0 && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 w-[min(960px,calc(100vw-2rem))]">
          <div className="rounded-xl border border-border/60 bg-card/95 backdrop-blur shadow-lg p-3 sm:p-4">
            <div className="flex flex-wrap items-center gap-3 sm:gap-6">
              <div className="flex items-center gap-2">
                <Badge className="bg-primary text-primary-foreground">
                  {selectionTotals.count} selecionada
                  {selectionTotals.count > 1 ? "s" : ""}
                </Badge>
              </div>
              <div className="flex flex-wrap gap-4 text-sm">
                <div>
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                    Soma Crédito
                  </div>
                  <div className="font-bold text-emerald-600 tabular-nums">
                    {formatBRL(selectionTotals.credito)}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                    Soma Entrada
                  </div>
                  <div className="font-medium tabular-nums">
                    {formatBRL(selectionTotals.entrada)}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                    Saldo Devedor
                  </div>
                  <div className="font-medium tabular-nums">
                    {formatBRL(selectionTotals.saldoDevedor)}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                    Taxa de Transf.
                  </div>
                  <div className="font-medium tabular-nums">
                    {formatBRL(selectionTotals.taxaTransf)}
                  </div>
                </div>
                <div className="min-w-[200px]">
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                    Prazo/Parcela
                  </div>
                  {selectionTotals.prazoFaixas.length === 0 ? (
                    <div className="font-medium tabular-nums">—</div>
                  ) : (
                    <div className="space-y-0.5">
                      {selectionTotals.prazoFaixas.map((f, i) => (
                        <div
                          key={i}
                          className="font-medium tabular-nums text-sm leading-tight"
                        >
                          {f.from} à {f.to}:{" "}
                          <span className="text-primary">
                            {formatBRL(f.valor_cents)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={clearSelection}
                className="ml-auto"
              >
                <X className="w-4 h-4 mr-1" />
                Limpar
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div
        className={cn(
          "text-sm font-medium",
          highlight && "text-emerald-600 font-bold",
        )}
      >
        {value || "—"}
      </div>
    </div>
  );
}
