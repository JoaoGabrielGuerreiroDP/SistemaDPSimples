import { useApi4ComCalls } from "@/hooks/useApi4ComCalls";
import { CallAnalyticsCharts } from "@/components/admin/CallAnalyticsCharts";
import { useMemo, useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import {
  Phone,
  ChevronLeft,
  ChevronRight,
  Loader2,
  CalendarIcon,
  X,
  PhoneCall,
  PhoneOff,
  Clock,
  CheckCircle,
  DollarSign,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}m ${s.toString().padStart(2, "0")}s`;
}

function formatDurationShort(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m < 60) return `${m}m${s > 0 ? ` ${s}s` : ""}`;
  const h = Math.floor(m / 60);
  const rm = m % 60;
  return `${h}h ${rm}m`;
}

function formatDateTime(iso: string): string {
  if (!iso) return "—";
  try {
    const cleaned = iso.replace("Z", "");
    const d = new Date(cleaned + "-03:00");
    return d.toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      timeZone: "America/Sao_Paulo",
    });
  } catch {
    return iso;
  }
}

function formatCurrency(value: number): string {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function hangupLabel(cause: string): string {
  const map: Record<string, string> = {
    NORMAL_CLEARING: "Normal",
    ORIGINATOR_CANCEL: "Cancelada pelo originador",
    NO_ANSWER: "Sem resposta",
    USER_BUSY: "Ocupado",
    CALL_REJECTED: "Rejeitada",
    NO_USER_RESPONSE: "Sem resposta do usuário",
    NORMAL_TEMPORARY_FAILURE: "Falha temporária",
    UNALLOCATED_NUMBER: "Número inexistente",
    RECOVERY_ON_TIMER_EXPIRE: "Timeout",
    NUMBER_CHANGED: "Número alterado",
  };
  return map[cause] || cause || "—";
}

function HangupBadge({ cause }: { cause: string }) {
  const isNormal = cause === "NORMAL_CLEARING";
  return (
    <Badge variant={isNormal ? "default" : "secondary"} className="text-[10px]">
      {hangupLabel(cause)}
    </Badge>
  );
}

interface StatsCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ReactNode;
  color: string;
}

function StatsCard({ title, value, subtitle, icon, color }: StatsCardProps) {
  return (
    <Card className="relative overflow-hidden">
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground">{title}</p>
            <p className="text-2xl font-bold">{value}</p>
            {subtitle && <p className="text-[11px] text-muted-foreground">{subtitle}</p>}
          </div>
          <div className={cn("rounded-full p-2.5", color)}>{icon}</div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function Indicadores() {
  const [selectedAttendant, setSelectedAttendant] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState<Date | undefined>();
  const [dateTo, setDateTo] = useState<Date | undefined>();

  const cutoffDate = useMemo(() => {
    if (dateFrom) {
      const d = new Date(dateFrom);
      d.setHours(0, 0, 0, 0);
      return d;
    }
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return today;
  }, [dateFrom]);

  const { data, isLoading, error } = useApi4ComCalls(cutoffDate);

  const calls = data?.data || [];

  const attendants = useMemo(() => {
    const names = new Set<string>();
    for (const call of calls) {
      const name = call.first_name || call.email;
      if (name) names.add(name);
    }
    return Array.from(names).sort();
  }, [calls]);

  const filteredCalls = useMemo(() => {
    return calls.filter((call) => {
      if (selectedAttendant !== "all") {
        const name = call.first_name || call.email || "";
        if (name !== selectedAttendant) return false;
      }
      if (dateFrom) {
        const callDate = new Date(call.started_at);
        const fromStart = new Date(dateFrom);
        fromStart.setHours(0, 0, 0, 0);
        if (callDate < fromStart) return false;
      }
      if (dateTo) {
        const callDate = new Date(call.started_at);
        const toEnd = new Date(dateTo);
        toEnd.setHours(23, 59, 59, 999);
        if (callDate > toEnd) return false;
      }
      return true;
    });
  }, [calls, selectedAttendant, dateFrom, dateTo]);

  const stats = useMemo(() => {
    const total = filteredCalls.length;
    const answered = filteredCalls.filter((c) => c.hangup_cause === "NORMAL_CLEARING").length;
    const unanswered = filteredCalls.filter((c) => c.hangup_cause !== "NORMAL_CLEARING").length;
    const totalDuration = filteredCalls.reduce((sum, c) => sum + (c.duration || 0), 0);
    const avgDuration = total > 0 ? Math.round(totalDuration / total) : 0;
    const answeredWithDuration = filteredCalls.filter((c) => c.duration > 0);
    const avgAnsweredDuration =
      answeredWithDuration.length > 0
        ? Math.round(answeredWithDuration.reduce((s, c) => s + c.duration, 0) / answeredWithDuration.length)
        : 0;
    const sla = total > 0 ? Math.round((answered / total) * 100) : 0;

    // Custo: soma de call_price de todas as chamadas filtradas
    const totalCost = filteredCalls.reduce((sum, c) => sum + (c.call_price ?? 0), 0);
    const avgCostPerCall = total > 0 ? totalCost / total : 0;
    const avgMinutePrice = filteredCalls
      .filter((c) => (c.minute_price ?? 0) > 0)
      .reduce((sum, c, _, arr) => sum + (c.minute_price ?? 0) / arr.length, 0);

    return {
      total,
      answered,
      unanswered,
      totalDuration,
      avgDuration,
      avgAnsweredDuration,
      sla,
      totalCost,
      avgCostPerCall,
      avgMinutePrice,
    };
  }, [filteredCalls]);

  const hasActiveFilters = selectedAttendant !== "all" || dateFrom || dateTo;

  const clearFilters = () => {
    setSelectedAttendant("all");
    setDateFrom(undefined);
    setDateTo(undefined);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Phone className="h-5 w-5 text-primary" />
        <h1 className="text-xl font-bold">Indicadores de Chamadas</h1>
      </div>

      {/* Filtros */}
      <Card>
        <CardContent className="pt-4 pb-3">
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Atendente</label>
              <Select value={selectedAttendant} onValueChange={setSelectedAttendant}>
                <SelectTrigger className="w-[180px] h-9">
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {attendants.map((name) => (
                    <SelectItem key={name} value={name}>
                      {name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Data início</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-[150px] h-9 justify-start text-left font-normal",
                      !dateFrom && "text-muted-foreground",
                    )}
                  >
                    <CalendarIcon className="mr-2 h-3.5 w-3.5" />
                    {dateFrom ? format(dateFrom, "dd/MM/yyyy") : "Selecionar"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={dateFrom}
                    onSelect={setDateFrom}
                    locale={ptBR}
                    initialFocus
                    className={cn("p-3 pointer-events-auto")}
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Data fim</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-[150px] h-9 justify-start text-left font-normal",
                      !dateTo && "text-muted-foreground",
                    )}
                  >
                    <CalendarIcon className="mr-2 h-3.5 w-3.5" />
                    {dateTo ? format(dateTo, "dd/MM/yyyy") : "Selecionar"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={dateTo}
                    onSelect={setDateTo}
                    locale={ptBR}
                    initialFocus
                    className={cn("p-3 pointer-events-auto")}
                  />
                </PopoverContent>
              </Popover>
            </div>
            {hasActiveFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters} className="h-9 text-xs gap-1">
                <X className="h-3 w-3" /> Limpar
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Cards de estatísticas */}
      {!isLoading && !error && (
        <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
          <StatsCard
            title="Chamadas"
            value={stats.total}
            subtitle={`${stats.answered} atendidas`}
            icon={<PhoneCall className="h-5 w-5 text-primary-foreground" />}
            color="bg-primary"
          />
          <StatsCard
            title="SLA"
            value={`${stats.sla}%`}
            subtitle={`${stats.unanswered} não atendidas`}
            icon={<CheckCircle className="h-5 w-5 text-primary-foreground" />}
            color="bg-emerald-500"
          />
          <StatsCard
            title="Duração Total"
            value={formatDurationShort(stats.totalDuration)}
            subtitle={`${stats.answered} chamadas atendidas`}
            icon={<Phone className="h-5 w-5 text-primary-foreground" />}
            color="bg-violet-500"
          />
          <StatsCard
            title="Duração Média"
            value={formatDurationShort(stats.avgAnsweredDuration)}
            subtitle="chamadas atendidas"
            icon={<Clock className="h-5 w-5 text-primary-foreground" />}
            color="bg-blue-500"
          />
          <StatsCard
            title="Não Atendidas"
            value={stats.unanswered}
            subtitle={stats.total > 0 ? `${Math.round((stats.unanswered / stats.total) * 100)}% do total` : "—"}
            icon={<PhoneOff className="h-5 w-5 text-primary-foreground" />}
            color="bg-destructive"
          />
          <StatsCard
            title="Custo Total"
            value={formatCurrency(stats.totalCost)}
            subtitle={`Média ${formatCurrency(stats.avgCostPerCall)}/chamada`}
            icon={<DollarSign className="h-5 w-5 text-primary-foreground" />}
            color="bg-amber-500"
          />
        </div>
      )}

      {/* Gráficos analíticos */}
      {!isLoading && !error && filteredCalls.length > 0 && (
        <CallAnalyticsCharts calls={filteredCalls} />
      )}

      {/* Tabela */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center justify-between">
            <span>Registro de Chamadas</span>
            {!isLoading && (
              <span className="text-xs font-normal text-muted-foreground">
                {filteredCalls.length} chamada{filteredCalls.length !== 1 ? "s" : ""}
                {stats.totalCost > 0 && (
                  <span className="ml-2 text-amber-600 dark:text-amber-400 font-medium">
                    · {formatCurrency(stats.totalCost)}
                  </span>
                )}
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : error ? (
            <div className="text-center py-8 text-destructive text-sm">
              Erro ao carregar chamadas: {(error as Error).message}
            </div>
          ) : filteredCalls.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm">Nenhuma chamada encontrada.</div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Atendente</TableHead>
                      <TableHead>Iniciou às</TableHead>
                      <TableHead>Finalizou às</TableHead>
                      <TableHead>Duração</TableHead>
                      <TableHead>Causa do Desligamento</TableHead>
                      <TableHead className="text-right">Custo</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredCalls.map((call) => (
                      <TableRow key={call.id}>
                        <TableCell className="font-medium">
                          {call.first_name || call.email || "—"}
                          {call.last_name ? ` ${call.last_name}` : ""}
                        </TableCell>
                        <TableCell className="text-xs">{formatDateTime(call.started_at)}</TableCell>
                        <TableCell className="text-xs">{formatDateTime(call.ended_at)}</TableCell>
                        <TableCell>{call.duration != null ? formatDuration(call.duration) : "—"}</TableCell>
                        <TableCell>
                          <HangupBadge cause={call.hangup_cause} />
                        </TableCell>
                        <TableCell className="text-right">
                          {call.call_price != null ? (
                            <span
                              className={cn(
                                "text-xs font-medium tabular-nums",
                                call.call_price > 0 ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground",
                              )}
                            >
                              {formatCurrency(call.call_price)}
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {data?.totalItems && (
                <div className="pt-4 flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">{data.totalItems} chamadas carregadas</span>
                  {stats.totalCost > 0 && (
                    <span className="text-xs text-muted-foreground">
                      Custo total filtrado:{" "}
                      <span className="font-medium text-amber-600 dark:text-amber-400">
                        {formatCurrency(stats.totalCost)}
                      </span>
                    </span>
                  )}
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
