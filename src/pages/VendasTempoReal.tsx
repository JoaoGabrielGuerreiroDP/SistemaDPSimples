import { useState, useMemo } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { useGoogleSheetsData } from "@/hooks/useGoogleSheetsData";
import { Button } from "@/components/ui/button";
import { RefreshCw, ChevronLeft, ChevronRight, User, Users } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { SalesTab } from "@/components/admin/SalesTab";
import { OKRSummaryWidget } from "@/components/admin/OKRSummaryWidget";
import { IndividualGoalCard } from "@/components/admin/IndividualGoalCard";
import { useGoalNotification } from "@/hooks/useGoalNotification";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

// ─── Tipos e utilitários de período (inline) ──────────────────────────────────

type DateRangeMode = "month" | "range" | "year";

type DateRange = {
  mode: DateRangeMode;
  startYear: number;
  startMonth: number;
  endYear: number;
  endMonth: number;
};

const MONTH_NAMES = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

const MONTH_NAMES_SHORT = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

function getMonthsInRange(range: DateRange): { year: number; month: number }[] {
  const months: { year: number; month: number }[] = [];
  let y = range.startYear;
  let m = range.startMonth;
  while (y < range.endYear || (y === range.endYear && m <= range.endMonth)) {
    months.push({ year: y, month: m });
    m++;
    if (m > 11) {
      m = 0;
      y++;
    }
  }
  return months;
}

function rangeLabelShort(range: DateRange): string {
  if (range.mode === "year") return `${range.startYear}`;
  if (range.mode === "month") return `${MONTH_NAMES[range.startMonth]} ${range.startYear}`;
  return `${MONTH_NAMES_SHORT[range.startMonth]}/${range.startYear} – ${MONTH_NAMES_SHORT[range.endMonth]}/${range.endYear}`;
}

function currentMonthRange(): DateRange {
  const now = new Date();
  return {
    mode: "month",
    startYear: now.getFullYear(),
    startMonth: now.getMonth(),
    endYear: now.getFullYear(),
    endMonth: now.getMonth(),
  };
}

function buildYearMonthOptions(): { label: string; value: string }[] {
  const currentYear = new Date().getFullYear();
  const options: { label: string; value: string }[] = [];
  for (let y = currentYear - 2; y <= currentYear + 1; y++) {
    for (let m = 0; m < 12; m++) {
      options.push({ label: `${MONTH_NAMES[m]} ${y}`, value: `${y}-${m}` });
    }
  }
  return options;
}

const YEAR_MONTH_OPTIONS = buildYearMonthOptions();

// ─── Componente DateRangeSelector (inline) ────────────────────────────────────

function DateRangeSelector({ value, onChange }: { value: DateRange; onChange: (r: DateRange) => void }) {
  const now = new Date();

  const atCurrentMonth =
    value.mode === "month" && value.startYear === now.getFullYear() && value.startMonth === now.getMonth();

  const canGoNextMonth = !(value.startYear === now.getFullYear() && value.startMonth >= now.getMonth());

  function setMode(mode: DateRangeMode) {
    const y = now.getFullYear();
    const m = now.getMonth();
    if (mode === "month") {
      onChange({ mode, startYear: y, startMonth: m, endYear: y, endMonth: m });
    } else if (mode === "range") {
      onChange({ mode, startYear: y, startMonth: 0, endYear: y, endMonth: m });
    } else {
      onChange({ mode, startYear: y, startMonth: 0, endYear: y, endMonth: 11 });
    }
  }

  function navMonth(dir: number) {
    let m = value.startMonth + dir;
    let y = value.startYear;
    if (m < 0) {
      m = 11;
      y--;
    }
    if (m > 11) {
      m = 0;
      y++;
    }
    onChange({ ...value, startYear: y, startMonth: m, endYear: y, endMonth: m });
  }

  function navYear(dir: number) {
    const y = value.startYear + dir;
    onChange({ ...value, startYear: y, startMonth: 0, endYear: y, endMonth: 11 });
  }

  function goToToday() {
    const y = now.getFullYear();
    const m = now.getMonth();
    onChange({ mode: "month", startYear: y, startMonth: m, endYear: y, endMonth: m });
  }

  function setRangeStart(raw: string) {
    const [y, m] = raw.split("-").map(Number);
    const pastEnd = y > value.endYear || (y === value.endYear && m > value.endMonth);
    onChange({
      ...value,
      startYear: y,
      startMonth: m,
      ...(pastEnd ? { endYear: y, endMonth: m } : {}),
    });
  }

  function setRangeEnd(raw: string) {
    const [y, m] = raw.split("-").map(Number);
    const beforeStart = y < value.startYear || (y === value.startYear && m < value.startMonth);
    onChange({
      ...value,
      endYear: y,
      endMonth: m,
      ...(beforeStart ? { startYear: y, startMonth: m } : {}),
    });
  }

  const modes: { key: DateRangeMode; label: string }[] = [
    { key: "month", label: "Mês" },
    { key: "range", label: "Período" },
    { key: "year", label: "Ano" },
  ];

  return (
    <div className="glass-card p-3 sm:p-4 space-y-3">
      {/* Abas de modo */}
      <div className="flex gap-1 p-1 bg-muted/40 rounded-lg w-fit">
        {modes.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setMode(key)}
            className={cn(
              "px-3 sm:px-4 py-1 rounded-md text-[11px] sm:text-xs font-medium transition-all",
              value.mode === key
                ? "bg-background shadow text-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Mês único */}
      {value.mode === "month" && (
        <div className="flex items-center justify-between gap-2">
          <Button variant="ghost" size="icon" className="h-8 w-8 sm:h-10 sm:w-10" onClick={() => navMonth(-1)}>
            <ChevronLeft className="w-4 h-4 sm:w-5 sm:h-5" />
          </Button>
          <div className="flex items-center gap-2 sm:gap-3">
            <span className="font-display text-sm sm:text-lg font-semibold text-foreground">
              {MONTH_NAMES[value.startMonth]} {value.startYear}
            </span>
            {!atCurrentMonth && (
              <Button
                variant="outline"
                size="sm"
                onClick={goToToday}
                className="text-[10px] sm:text-xs h-6 sm:h-8 px-2"
              >
                Hoje
              </Button>
            )}
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 sm:h-10 sm:w-10"
            onClick={() => navMonth(1)}
            disabled={!canGoNextMonth}
          >
            <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5" />
          </Button>
        </div>
      )}

      {/* Período personalizado */}
      {value.mode === "range" && (
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-muted-foreground uppercase tracking-wider shrink-0">De</span>
            <Select value={`${value.startYear}-${value.startMonth}`} onValueChange={setRangeStart}>
              <SelectTrigger className="h-8 text-[11px] sm:text-xs w-36 sm:w-40 bg-background/50">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="max-h-60">
                {YEAR_MONTH_OPTIONS.map(({ label, value: v }) => (
                  <SelectItem key={v} value={v} className="text-xs">
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <ChevronRight className="w-3.5 h-3.5 text-muted-foreground shrink-0" />

          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-muted-foreground uppercase tracking-wider shrink-0">Até</span>
            <Select value={`${value.endYear}-${value.endMonth}`} onValueChange={setRangeEnd}>
              <SelectTrigger className="h-8 text-[11px] sm:text-xs w-36 sm:w-40 bg-background/50">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="max-h-60">
                {YEAR_MONTH_OPTIONS.map(({ label, value: v }) => (
                  <SelectItem key={v} value={v} className="text-xs">
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      )}

      {/* Ano completo */}
      {value.mode === "year" && (
        <div className="flex items-center justify-between gap-2">
          <Button variant="ghost" size="icon" className="h-8 w-8 sm:h-10 sm:w-10" onClick={() => navYear(-1)}>
            <ChevronLeft className="w-4 h-4 sm:w-5 sm:h-5" />
          </Button>
          <span className="font-display text-sm sm:text-lg font-semibold text-foreground">
            {value.startYear} — Ano completo
          </span>
          <Button variant="ghost" size="icon" className="h-8 w-8 sm:h-10 sm:w-10" onClick={() => navYear(1)}>
            <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5" />
          </Button>
        </div>
      )}
    </div>
  );
}

// ─── Página principal ─────────────────────────────────────────────────────────

export default function VendasTempoReal() {
  const [dateRange, setDateRange] = useState<DateRange>(currentMonthRange());

  const { user } = useAuth();
  const { role, isAdmin, isGestor, loading: adminLoading } = useUserRole();
  const navigate = useNavigate();
  const sheetsData = useGoogleSheetsData();

  // Agrega todas as linhas dos meses dentro do range selecionado
  const monthRows = useMemo(() => {
    const months = getMonthsInRange(dateRange);
    return months.flatMap(({ year, month }) => sheetsData.getMonthRows(year, month));
  }, [sheetsData, dateRange]);

  const monthLabel = rangeLabelShort(dateRange);
  const userName = user?.user_metadata?.display_name || user?.email || "";

  // ── Filtro de corretor ──
  const [selectedBroker, setSelectedBroker] = useState<string>("todos");

  const brokerNames = useMemo(() => {
    const set = new Set<string>();
    monthRows.forEach((r) => {
      if (r.corretor) set.add(r.corretor);
    });
    return Array.from(set).sort();
  }, [monthRows]);

  const availableBrokers = useMemo(() => {
    if (role === "vendedor") {
      const match = brokerNames.find(
        (b) => b.toLowerCase().includes(userName.toLowerCase()) || userName.toLowerCase().includes(b.toLowerCase()),
      );
      return match ? [match] : [];
    }
    return brokerNames;
  }, [role, brokerNames, userName]);

  const filteredRows = useMemo(() => {
    if (selectedBroker === "todos") return monthRows;
    return monthRows.filter((r) => r.corretor === selectedBroker);
  }, [monthRows, selectedBroker]);

  const filteredAllRows = useMemo(() => {
    if (selectedBroker === "todos") return sheetsData.allRows;
    return sheetsData.allRows.filter((r) => r.corretor === selectedBroker);
  }, [sheetsData.allRows, selectedBroker]);

  const filteredGetMonthRows = useMemo(() => {
    if (selectedBroker === "todos") return sheetsData.getMonthRows;
    return (y: number, m: number) => sheetsData.getMonthRows(y, m).filter((r) => r.corretor === selectedBroker);
  }, [sheetsData.getMonthRows, selectedBroker]);

  const filteredMonthLabel = selectedBroker === "todos" ? monthLabel : `${monthLabel} — ${selectedBroker}`;

  const vendedorTotal = useMemo(() => {
    if (role !== "vendedor") return 0;
    return monthRows
      .filter((r) => r.corretor?.toLowerCase().includes(userName.toLowerCase()))
      .reduce((s, r) => s + r.valor, 0);
  }, [monthRows, role, userName]);

  useGoalNotification(dateRange.startYear, dateRange.startMonth, role === "vendedor" ? vendedorTotal : 0);

  if (adminLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center text-muted-foreground">
        Carregando...
      </div>
    );
  }

  if (!role) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <p className="text-destructive font-medium">Acesso restrito.</p>
          <Button variant="outline" onClick={() => navigate("/")}>
            Voltar
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-6xl mx-auto px-3 sm:px-4 py-4 sm:py-12 space-y-4 sm:space-y-6">
        {/* Header */}
        <div className="flex items-start sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <div className="min-w-0">
              <h1 className="font-display text-base sm:text-3xl font-bold text-foreground tracking-tight truncate">
                Vendas Tempo Real
              </h1>
              <p className="text-[10px] sm:text-sm text-muted-foreground truncate">
                {role === "vendedor" ? `Olá, ${userName}` : "Dados de vendas"}
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="shrink-0 text-[11px] sm:text-sm h-7 sm:h-9 px-2 sm:px-3"
            onClick={() => sheetsData.reload?.()}
            disabled={sheetsData.loading}
          >
            <RefreshCw className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${sheetsData.loading ? "animate-spin" : ""}`} />
            <span className="hidden sm:inline ml-1">Atualizar</span>
          </Button>
        </div>

        {/* Seletor de período dinâmico */}
        <DateRangeSelector value={dateRange} onChange={setDateRange} />

        {/* Filtro de corretor */}
        {availableBrokers.length > 0 && (
          <div className="glass-card p-3 sm:p-4">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="flex items-center gap-1.5 text-muted-foreground">
                {selectedBroker === "todos" ? <Users className="w-4 h-4" /> : <User className="w-4 h-4" />}
                <span className="text-[10px] sm:text-xs font-medium uppercase tracking-wider">Visualizar</span>
              </div>
              <Select value={selectedBroker} onValueChange={setSelectedBroker}>
                <SelectTrigger className="flex-1 h-8 sm:h-9 text-[11px] sm:text-sm bg-background/50">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">
                    <span className="flex items-center gap-1.5">
                      <Users className="w-3.5 h-3.5" />
                      Empresa (Todos)
                    </span>
                  </SelectItem>
                  {availableBrokers.map((name) => (
                    <SelectItem key={name} value={name}>
                      <span className="flex items-center gap-1.5">
                        <User className="w-3.5 h-3.5" />
                        {name}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        {/* Meta individual — só exibe no modo "mês" */}
        {selectedBroker !== "todos" && role === "vendedor" && user && dateRange.mode === "month" && (
          <IndividualGoalCard
            userId={user.id}
            userName={selectedBroker}
            selectedYear={dateRange.startYear}
            selectedMonth={dateRange.startMonth}
            totalVendido={filteredRows.reduce((s, r) => s + r.valor, 0)}
          />
        )}

        {/* Conteúdo de vendas */}
        <SalesTab
          rows={filteredRows}
          allRows={filteredAllRows}
          loading={sheetsData.loading}
          error={sheetsData.error}
          monthLabel={filteredMonthLabel}
          getMonthRows={filteredGetMonthRows}
          selectedYear={dateRange.startYear}
          selectedMonth={dateRange.startMonth}
        />

        {/* OKR */}
        {(role === "gestor" || role === "vendedor") && <OKRSummaryWidget />}
      </div>
    </div>
  );
}
