import { useState, useMemo } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Users, Handshake, ListTodo, RefreshCw, Mail, Phone, Building2,
  DollarSign, Calendar, ArrowLeft, AlertTriangle, GitBranchPlus, Search, Filter, X,
  TrendingUp, Target, Clock, Activity, HeartPulse, AlertCircle, CheckCircle2, Flame,
  Shield, BarChart3,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useHubSpotContacts, useHubSpotDeals, useHubSpotTasks, useHubSpotPipelines, useHubSpotOwners } from "@/hooks/useHubSpotData";
import { usePiperunDeals, usePiperunPersons, usePiperunPipelines, usePiperunStages, usePiperunActivities, usePiperunUsers } from "@/hooks/usePiperunData";
import CRMFunnelMetrics from "@/components/admin/CRMFunnelMetrics";
import CRMSalesAlerts from "@/components/admin/CRMSalesAlerts";
import CRMSalesRanking from "@/components/admin/CRMSalesRanking";
import CRMForecastChart from "@/components/admin/CRMForecastChart";
import CRMSellerComparison from "@/components/admin/CRMSellerComparison";
import CRMGoalVsActual from "@/components/admin/CRMGoalVsActual";
import { isLeadership } from "@/lib/seller-names";
import { useGoogleSheetsData } from "@/hooks/useGoogleSheetsData";
import { normalizeName, ALL_BROKERS, BROKER_TEAMS } from "@/lib/seller-names";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { TeamFilterProvider, useTeamFilter, type TeamFilter } from "@/hooks/useTeamFilter";
import TeamComparisonChart from "@/components/admin/TeamComparisonChart";
import DailyPerformanceList from "@/components/admin/DailyPerformanceList";

function formatCurrency(val: string | number | null) {
  if (!val) return "—";
  return Number(val).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatDate(val: string | null) {
  if (!val) return "—";
  return new Date(val).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
}

function LoadingState({ label = "Carregando..." }: { label?: string }) {
  return (
    <div className="flex items-center justify-center py-16 text-muted-foreground">
      <div className="animate-pulse flex items-center gap-2 text-sm">
        <div className="w-2 h-2 rounded-full bg-primary animate-bounce" />
        {label}
      </div>
    </div>
  );
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="rounded-2xl border border-dashed border-destructive/30 p-8 text-center space-y-3">
      <AlertTriangle className="w-8 h-8 text-destructive mx-auto" />
      <p className="text-sm text-muted-foreground">{message}</p>
      <Button variant="outline" size="sm" onClick={onRetry}>Tentar novamente</Button>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-xl border border-dashed border-border/50 p-8 text-center">
      <p className="text-sm text-muted-foreground">{text}</p>
    </div>
  );
}

// ── KPI Card ──────────────────────────────────────────────────
function KPICard({ icon: Icon, label, value, sub, color = "text-primary" }: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  sub?: string;
  color?: string;
}) {
  return (
    <Card className="border-border/30 bg-card/80">
      <CardContent className="p-4 flex items-center gap-3">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center bg-primary/10 ${color}`}>
          <Icon className="w-5 h-5" />
        </div>
        <div className="min-w-0">
          <p className="text-[11px] text-muted-foreground uppercase tracking-wide">{label}</p>
          <p className="text-lg font-bold text-foreground leading-tight">{value}</p>
          {sub && <p className="text-[10px] text-muted-foreground">{sub}</p>}
        </div>
      </CardContent>
    </Card>
  );
}

// ── Stage colors ──────────────────────────────────────────────
const STAGE_COLORS = [
  "from-blue-500/20 to-blue-500/5 border-blue-500/30",
  "from-cyan-500/20 to-cyan-500/5 border-cyan-500/30",
  "from-violet-500/20 to-violet-500/5 border-violet-500/30",
  "from-amber-500/20 to-amber-500/5 border-amber-500/30",
  "from-emerald-500/20 to-emerald-500/5 border-emerald-500/30",
  "from-rose-500/20 to-rose-500/5 border-rose-500/30",
  "from-indigo-500/20 to-indigo-500/5 border-indigo-500/30",
  "from-orange-500/20 to-orange-500/5 border-orange-500/30",
];

const STAGE_DOT_COLORS = [
  "bg-blue-500", "bg-cyan-500", "bg-violet-500", "bg-amber-500",
  "bg-emerald-500", "bg-rose-500", "bg-indigo-500", "bg-orange-500",
];

// ══════════════════════════════════════════════════════════════
// HUBSPOT SECTION
// ══════════════════════════════════════════════════════════════

function HubSpotPipelineTab() {
  const { data: dealsData, isLoading: dealsLoading, error: dealsError, refetch } = useHubSpotDeals(100);
  const { data: pipelinesData, isLoading: pipelinesLoading } = useHubSpotPipelines();
  const { data: ownersData } = useHubSpotOwners();

  const deals = dealsData?.results || [];
  const isLoading = dealsLoading || pipelinesLoading;

  const ownersMap = useMemo(() => {
    const map: Record<string, string> = {};
    for (const o of (ownersData?.results || [])) {
      const name = `${o.firstName || ""} ${o.lastName || ""}`.trim();
      if (name) map[String(o.id)] = name;
    }
    return map;
  }, [ownersData]);

  const stages = useMemo(() => {
    if (pipelinesData?.results?.length > 0) {
      const pipeline = pipelinesData.results[0];
      return (pipeline.stages || []).map((s: any) => ({ id: s.id, label: s.label }));
    }
    const uniqueStages = [...new Set(deals.map((d: any) => d.properties.dealstage).filter(Boolean))];
    return uniqueStages.map((s) => ({ id: s, label: s as string }));
  }, [pipelinesData, deals]);

  const stageDeals = useMemo(() => {
    const map: Record<string, any[]> = {};
    for (const s of stages) map[s.id] = [];
    for (const d of deals) {
      const stage = d.properties.dealstage;
      if (stage && map[stage]) map[stage].push(d);
    }
    return map;
  }, [stages, deals]);

  const totalValue = useMemo(() =>
    deals.reduce((sum: number, d: any) => sum + (Number(d.properties.amount) || 0), 0), [deals]);

  if (isLoading) return <LoadingState label="Carregando HubSpot..." />;
  if (dealsError) return <ErrorState message={(dealsError as Error).message} onRetry={refetch} />;

  const activeStages = stages.filter((s) => (stageDeals[s.id] || []).length > 0);
  const totalActiveDeals = activeStages.reduce((sum, s) => sum + (stageDeals[s.id] || []).length, 0);
  const totalActiveValue = activeStages.reduce((sum, s) =>
    sum + (stageDeals[s.id] || []).reduce((v: number, d: any) => v + (Number(d.properties.amount) || 0), 0), 0);

  const hubSellerSummary = (() => {
    const allDeals = activeStages.flatMap((s) => stageDeals[s.id] || []);
    const map: Record<string, { name: string; count: number; value: number }> = {};
    for (const d of allDeals) {
      const ownerId = d.properties.hubspot_owner_id;
      const name = ownerId && ownersMap[ownerId] ? ownersMap[ownerId] : "Sem atribuição";
      if (!map[name]) map[name] = { name, count: 0, value: 0 };
      map[name].count++;
      map[name].value += Number(d.properties.amount) || 0;
    }
    return Object.values(map).sort((a, b) => b.count - a.count);
  })();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Badge variant="secondary" className="text-xs font-bold px-2.5 py-1">{totalActiveDeals} deals ativos</Badge>
          {totalActiveValue > 0 && <span className="text-xs font-semibold text-emerald-500">{formatCurrency(totalActiveValue)}</span>}
        </div>
        <Button variant="ghost" size="sm" onClick={() => refetch()}><RefreshCw className="w-3.5 h-3.5 mr-1" /> Atualizar</Button>
      </div>

      {hubSellerSummary.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {hubSellerSummary.map((s) => (
            <div key={s.name} className="rounded-lg border border-border/30 bg-card/60 px-3 py-2 flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="text-[11px] font-semibold text-foreground truncate">{s.name}</p>
                <p className="text-[10px] text-muted-foreground">{formatCurrency(s.value)}</p>
              </div>
              <Badge variant="outline" className="text-[10px] shrink-0">{s.count}</Badge>
            </div>
          ))}
        </div>
      )}

      <div className="space-y-1.5">
        {activeStages.map((stage, i) => {
          const count = (stageDeals[stage.id] || []).length;
          const stageValue = (stageDeals[stage.id] || []).reduce((s: number, d: any) => s + (Number(d.properties.amount) || 0), 0);
          const maxCount = Math.max(...activeStages.map((s) => (stageDeals[s.id] || []).length), 1);
          const widthPct = Math.max(((count / maxCount) * 100), 8);
          return (
            <div key={stage.id} className="flex items-center gap-3">
              <div className="w-28 sm:w-36 shrink-0 text-right">
                <p className="text-[11px] font-medium text-foreground truncate">{stage.label}</p>
              </div>
              <div className="flex-1 relative">
                <div className={`h-9 rounded-lg bg-gradient-to-r border ${STAGE_COLORS[i % STAGE_COLORS.length]} flex items-center px-3 gap-2 transition-all`} style={{ width: `${widthPct}%`, minWidth: "80px" }}>
                  <span className={`w-2 h-2 rounded-full shrink-0 ${STAGE_DOT_COLORS[i % STAGE_DOT_COLORS.length]}`} />
                  <span className="text-xs font-semibold text-foreground">{count}</span>
                  {stageValue > 0 && <span className="text-[10px] text-muted-foreground ml-auto hidden sm:inline">{formatCurrency(stageValue)}</span>}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <ScrollArea className="w-full">
        <div className="flex gap-3 pb-4" style={{ minWidth: `${activeStages.length * 260}px` }}>
          {activeStages.map((stage, i) => {
            const sDeals = stageDeals[stage.id] || [];
            return (
              <div key={stage.id} className={`w-60 shrink-0 rounded-xl border bg-gradient-to-b ${STAGE_COLORS[i % STAGE_COLORS.length]} overflow-hidden`}>
                <div className="px-3 py-2.5 border-b border-border/20 flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className={`w-2 h-2 rounded-full ${STAGE_DOT_COLORS[i % STAGE_DOT_COLORS.length]}`} />
                    <span className="text-xs font-semibold text-foreground truncate">{stage.label}</span>
                  </div>
                  <span className="text-[10px] font-bold text-muted-foreground bg-muted/50 rounded px-1.5 py-0.5">{sDeals.length}</span>
                </div>
                <div className="p-2 space-y-1.5 max-h-72 overflow-y-auto">
                  {sDeals.map((d: any) => (
                    <div key={d.id} className="rounded-lg bg-card/80 border border-border/20 p-2.5 space-y-1">
                      <p className="text-[11px] font-semibold text-foreground leading-snug truncate">{d.properties.dealname || "Sem nome"}</p>
                      <div className="flex items-center justify-between">
                        {d.properties.amount ? <span className="text-[11px] font-bold text-emerald-500">{formatCurrency(d.properties.amount)}</span> : <span className="text-[10px] text-muted-foreground/50">Sem valor</span>}
                        {d.properties.closedate && <span className="text-[9px] text-muted-foreground flex items-center gap-0.5"><Calendar className="w-2.5 h-2.5" />{formatDate(d.properties.closedate)}</span>}
                      </div>
                      {d.properties.hubspot_owner_id && ownersMap[d.properties.hubspot_owner_id] && (
                        <p className="text-[9px] text-muted-foreground flex items-center gap-1">
                          <Users className="w-2.5 h-2.5" />
                          {ownersMap[d.properties.hubspot_owner_id]}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>
    </div>
  );
}

function HubSpotContactsTab() {
  const { data, isLoading, error, refetch } = useHubSpotContacts();
  const contacts = data?.results || [];
  const [search, setSearch] = useState("");
  const [stageFilter, setStageFilter] = useState("all");

  const lifecycleStages = useMemo(() => {
    const set = new Set(contacts.map((c: any) => c.properties.lifecyclestage).filter(Boolean));
    return [...set] as string[];
  }, [contacts]);

  const filtered = useMemo(() => {
    let list = contacts;
    if (search) {
      const q = search.toLowerCase();
      list = list.filter((c: any) => {
        const name = `${c.properties.firstname || ""} ${c.properties.lastname || ""}`.toLowerCase();
        const email = (c.properties.email || "").toLowerCase();
        const company = (c.properties.company || "").toLowerCase();
        return name.includes(q) || email.includes(q) || company.includes(q);
      });
    }
    if (stageFilter !== "all") list = list.filter((c: any) => c.properties.lifecyclestage === stageFilter);
    return list;
  }, [contacts, search, stageFilter]);

  if (isLoading) return <LoadingState label="Carregando contatos HubSpot..." />;
  if (error) return <ErrorState message={(error as Error).message} onRetry={refetch} />;

  return (
    <div className="space-y-3">
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input placeholder="Buscar por nome, e-mail ou empresa..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 h-9 text-xs" />
          {search && <button onClick={() => setSearch("")} className="absolute right-2.5 top-1/2 -translate-y-1/2"><X className="w-3.5 h-3.5 text-muted-foreground hover:text-foreground" /></button>}
        </div>
        {lifecycleStages.length > 0 && (
          <Select value={stageFilter} onValueChange={setStageFilter}>
            <SelectTrigger className="w-full sm:w-44 h-9 text-xs"><Filter className="w-3 h-3 mr-1.5 text-muted-foreground" /><SelectValue placeholder="Lifecycle" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os estágios</SelectItem>
              {lifecycleStages.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
      </div>
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{filtered.length}{filtered.length !== contacts.length ? ` de ${contacts.length}` : ""} contatos</p>
        <Button variant="ghost" size="sm" onClick={() => refetch()}><RefreshCw className="w-3.5 h-3.5 mr-1" /> Atualizar</Button>
      </div>
      <div className="space-y-2">
        {filtered.map((c: any) => (
          <div key={c.id} className="rounded-xl border border-border/30 bg-card p-4 space-y-2">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-foreground truncate">{c.properties.firstname || ""} {c.properties.lastname || ""}</p>
                {c.properties.company && <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5"><Building2 className="w-3 h-3" /> {c.properties.company}</p>}
              </div>
              {c.properties.lifecyclestage && <Badge variant="secondary" className="text-[10px] shrink-0">{c.properties.lifecyclestage}</Badge>}
            </div>
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              {c.properties.email && <span className="flex items-center gap-1 truncate"><Mail className="w-3 h-3" /> {c.properties.email}</span>}
              {c.properties.phone && <span className="flex items-center gap-1"><Phone className="w-3 h-3" /> {c.properties.phone}</span>}
            </div>
          </div>
        ))}
        {filtered.length === 0 && <EmptyState text={search || stageFilter !== "all" ? "Nenhum contato encontrado." : "Nenhum contato encontrado no HubSpot."} />}
      </div>
    </div>
  );
}

function HubSpotDealsTab() {
  const { data, isLoading, error, refetch } = useHubSpotDeals();
  const deals = data?.results || [];
  const [search, setSearch] = useState("");
  const [stageFilter, setStageFilter] = useState("all");

  const dealStages = useMemo(() => {
    const set = new Set(deals.map((d: any) => d.properties.dealstage).filter(Boolean));
    return [...set] as string[];
  }, [deals]);

  const filtered = useMemo(() => {
    let list = deals;
    if (search) {
      const q = search.toLowerCase();
      list = list.filter((d: any) => (d.properties.dealname || "").toLowerCase().includes(q));
    }
    if (stageFilter !== "all") list = list.filter((d: any) => d.properties.dealstage === stageFilter);
    return list;
  }, [deals, search, stageFilter]);

  const totalFiltered = useMemo(() => filtered.reduce((s: number, d: any) => s + (Number(d.properties.amount) || 0), 0), [filtered]);

  if (isLoading) return <LoadingState label="Carregando negócios HubSpot..." />;
  if (error) return <ErrorState message={(error as Error).message} onRetry={refetch} />;

  return (
    <div className="space-y-3">
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input placeholder="Buscar negócios..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 h-9 text-xs" />
          {search && <button onClick={() => setSearch("")} className="absolute right-2.5 top-1/2 -translate-y-1/2"><X className="w-3.5 h-3.5 text-muted-foreground hover:text-foreground" /></button>}
        </div>
        {dealStages.length > 0 && (
          <Select value={stageFilter} onValueChange={setStageFilter}>
            <SelectTrigger className="w-full sm:w-44 h-9 text-xs"><Filter className="w-3 h-3 mr-1.5 text-muted-foreground" /><SelectValue placeholder="Etapa" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as etapas</SelectItem>
              {dealStages.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
      </div>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <p className="text-sm text-muted-foreground">{filtered.length}{filtered.length !== deals.length ? ` de ${deals.length}` : ""} negócios</p>
          {totalFiltered > 0 && <span className="text-xs font-semibold text-foreground">{formatCurrency(totalFiltered)}</span>}
        </div>
        <Button variant="ghost" size="sm" onClick={() => refetch()}><RefreshCw className="w-3.5 h-3.5 mr-1" /> Atualizar</Button>
      </div>
      <div className="space-y-2">
        {filtered.map((d: any) => (
          <div key={d.id} className="rounded-xl border border-border/30 bg-card p-4 space-y-2">
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm font-semibold text-foreground truncate">{d.properties.dealname || "Sem nome"}</p>
              {d.properties.amount && <span className="text-sm font-bold text-emerald-500 shrink-0">{formatCurrency(d.properties.amount)}</span>}
            </div>
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              {d.properties.dealstage && <Badge variant="outline" className="text-[10px]">{d.properties.dealstage}</Badge>}
              {d.properties.closedate && <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> {formatDate(d.properties.closedate)}</span>}
            </div>
          </div>
        ))}
        {filtered.length === 0 && <EmptyState text={search || stageFilter !== "all" ? "Nenhum negócio encontrado." : "Nenhum negócio no HubSpot."} />}
      </div>
    </div>
  );
}

function HubSpotTasksTab() {
  const { data, isLoading, error, refetch } = useHubSpotTasks();
  const tasks = data?.results || [];

  if (isLoading) return <LoadingState label="Carregando atividades HubSpot..." />;
  if (error) return <ErrorState message={(error as Error).message} onRetry={refetch} />;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{tasks.length} atividades</p>
        <Button variant="ghost" size="sm" onClick={() => refetch()}><RefreshCw className="w-3.5 h-3.5 mr-1" /> Atualizar</Button>
      </div>
      <div className="space-y-2">
        {tasks.map((t: any) => (
          <div key={t.id} className="rounded-xl border border-border/30 bg-card p-4 space-y-1.5">
            <p className="text-sm font-semibold text-foreground">{t.properties.hs_task_subject || "Tarefa"}</p>
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              {t.properties.hs_task_status && <Badge variant="secondary" className="text-[10px]">{t.properties.hs_task_status}</Badge>}
              {t.properties.hs_task_priority && <span>Prioridade: {t.properties.hs_task_priority}</span>}
              {t.properties.hs_timestamp && <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> {formatDate(t.properties.hs_timestamp)}</span>}
            </div>
          </div>
        ))}
        {tasks.length === 0 && <EmptyState text="Nenhuma atividade no HubSpot." />}
      </div>
    </div>
  );
}

function HubSpotSection() {
  const { data: dealsData } = useHubSpotDeals(100);
  const { data: contactsData } = useHubSpotContacts();
  const { data: tasksData } = useHubSpotTasks();

  const deals = dealsData?.results || [];
  const contacts = contactsData?.results || [];
  const tasks = tasksData?.results || [];
  const totalValue = deals.reduce((s: number, d: any) => s + (Number(d.properties.amount) || 0), 0);
  const openDeals = deals.filter((d: any) => d.properties.dealstage !== "closedwon" && d.properties.dealstage !== "closedlost").length;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 pt-2 pb-1">
        <Handshake className="w-5 h-5 text-orange-500" />
        <h2 className="text-base sm:text-lg font-bold text-foreground">HubSpot</h2>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KPICard icon={Handshake} label="Negócios" value={deals.length} sub={`${openDeals} em aberto`} color="text-orange-500" />
        <KPICard icon={DollarSign} label="Valor Total" value={formatCurrency(totalValue)} color="text-emerald-500" />
        <KPICard icon={Users} label="Contatos" value={contacts.length} color="text-blue-500" />
        <KPICard icon={ListTodo} label="Atividades" value={tasks.length} color="text-violet-500" />
      </div>

      <Tabs defaultValue="pipeline" className="space-y-4">
        <TabsList className="w-full grid grid-cols-4">
          <TabsTrigger value="pipeline" className="gap-1.5 text-xs"><GitBranchPlus className="w-3.5 h-3.5" /> Pipeline</TabsTrigger>
          <TabsTrigger value="deals" className="gap-1.5 text-xs"><Handshake className="w-3.5 h-3.5" /> Negócios</TabsTrigger>
          <TabsTrigger value="contacts" className="gap-1.5 text-xs"><Users className="w-3.5 h-3.5" /> Contatos</TabsTrigger>
          <TabsTrigger value="tasks" className="gap-1.5 text-xs"><ListTodo className="w-3.5 h-3.5" /> Atividades</TabsTrigger>
        </TabsList>
        <TabsContent value="pipeline"><HubSpotPipelineTab /></TabsContent>
        <TabsContent value="deals"><HubSpotDealsTab /></TabsContent>
        <TabsContent value="contacts"><HubSpotContactsTab /></TabsContent>
        <TabsContent value="tasks"><HubSpotTasksTab /></TabsContent>
      </Tabs>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// PIPERUN SECTION
// ══════════════════════════════════════════════════════════════

function PiperunPipelineView() {
  const { data: dealsData, isLoading: dealsLoading, error: dealsError, refetch } = usePiperunDeals("200");
  const { data: pipelinesData, isLoading: pipLoading } = usePiperunPipelines();
  const { data: stagesData, isLoading: stagesLoading } = usePiperunStages();
  const { data: usersData } = usePiperunUsers();

  const deals: any[] = dealsData?.data || [];
  const pipelines: any[] = pipelinesData?.data || [];
  const allStages: any[] = stagesData?.data || [];
  const isLoading = dealsLoading || pipLoading || stagesLoading;

  const usersMap = useMemo(() => {
    const map: Record<string, string> = {};
    for (const u of (usersData?.data || [])) {
      map[String(u.id)] = (u.name || u.nome || "").trim();
    }
    return map;
  }, [usersData]);

  // Default to "Funil Vendas" (id 101570)
  const salesPipelineId = useMemo(() => {
    const sales = pipelines.find((p: any) => p.funnel_type === 0 || (p.name || "").toLowerCase().includes("vendas"));
    return sales ? String(sales.id) : (pipelines.length > 0 ? String(pipelines[0].id) : "all");
  }, [pipelines]);

  const [selectedPipeline, setSelectedPipeline] = useState<string>("");

  const activePipeline = selectedPipeline || salesPipelineId;

  const pipelineStages = useMemo(() => {
    if (activePipeline === "all") return allStages;
    return allStages
      .filter((s: any) => String(s.pipeline_id) === activePipeline)
      .sort((a: any, b: any) => (a.order ?? 0) - (b.order ?? 0));
  }, [allStages, activePipeline]);

  const stageDeals = useMemo(() => {
    const map: Record<string, any[]> = {};
    for (const s of pipelineStages) map[String(s.id)] = [];
    for (const d of deals) {
      const stageId = String(d.stage_id);
      if (map[stageId] && (activePipeline === "all" || String(d.pipeline_id) === activePipeline)) map[stageId].push(d);
    }
    return map;
  }, [pipelineStages, deals, activePipeline]);

  const activeStages = useMemo(() =>
    pipelineStages.filter((s: any) => (stageDeals[String(s.id)] || []).length > 0),
  [pipelineStages, stageDeals]);

  const totalActiveDeals = useMemo(() =>
    activeStages.reduce((sum: number, s: any) => sum + (stageDeals[String(s.id)] || []).length, 0),
  [activeStages, stageDeals]);

  const totalActiveValue = useMemo(() =>
    activeStages.reduce((sum: number, s: any) =>
      sum + (stageDeals[String(s.id)] || []).reduce((v: number, d: any) => v + (Number(d.value) || 0), 0), 0),
  [activeStages, stageDeals]);

  const { matchesTeam } = useTeamFilter();

  const sellerSummary = useMemo(() => {
    const allActiveDeals = activeStages.flatMap((s: any) => stageDeals[String(s.id)] || []);
    const map: Record<string, { name: string; count: number; value: number }> = {};
    for (const d of allActiveDeals) {
      const ownerId = String(d.owner_id);
      const name = usersMap[ownerId] || "Sem atribuição";
      if (!matchesTeam(name)) continue;
      if (!map[name]) map[name] = { name, count: 0, value: 0 };
      map[name].count++;
      map[name].value += Number(d.value) || 0;
    }
    return Object.values(map).sort((a, b) => b.count - a.count);
  }, [activeStages, stageDeals, usersMap, matchesTeam]);

  if (isLoading) return <LoadingState label="Carregando pipeline Piperun..." />;
  if (dealsError) return <ErrorState message={(dealsError as Error).message} onRetry={refetch} />;

  return (
    <div className="space-y-4">
      {pipelines.length > 1 && (
        <Select value={activePipeline} onValueChange={setSelectedPipeline}>
          <SelectTrigger className="w-full sm:w-60 h-9 text-xs">
            <SelectValue placeholder="Selecione o funil" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os funis</SelectItem>
            {pipelines.map((p: any) => <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>)}
          </SelectContent>
        </Select>
      )}

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Badge variant="secondary" className="text-xs font-bold px-2.5 py-1">{totalActiveDeals} deals ativos</Badge>
          {totalActiveValue > 0 && <span className="text-xs font-semibold text-emerald-500">{formatCurrency(totalActiveValue)}</span>}
        </div>
        <Button variant="ghost" size="sm" onClick={() => refetch()}><RefreshCw className="w-3.5 h-3.5 mr-1" /> Atualizar</Button>
      </div>

      {/* Resumo por vendedor */}
      {sellerSummary.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {sellerSummary.map((s) => (
            <div key={s.name} className="rounded-lg border border-border/30 bg-card/60 px-3 py-2 flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="text-[11px] font-semibold text-foreground truncate">{s.name}</p>
                {s.value > 0 && <p className="text-[10px] text-muted-foreground">{formatCurrency(s.value)}</p>}
              </div>
              <Badge variant="outline" className="text-[10px] font-bold shrink-0">{s.count}</Badge>
            </div>
          ))}
        </div>
      )}

      {/* Horizontal stage bars */}
      <div className="space-y-1.5">
        {activeStages.map((stage: any, i: number) => {
          const count = (stageDeals[String(stage.id)] || []).length;
          const stageValue = (stageDeals[String(stage.id)] || []).reduce((s: number, d: any) => s + (Number(d.value) || 0), 0);
          const maxCount = Math.max(...activeStages.map((s: any) => (stageDeals[String(s.id)] || []).length), 1);
          const widthPct = Math.max(((count / maxCount) * 100), 8);
          return (
            <div key={stage.id} className="flex items-center gap-3">
              <div className="w-28 sm:w-40 shrink-0 text-right">
                <p className="text-[11px] font-medium text-foreground truncate">{stage.name}</p>
              </div>
              <div className="flex-1 relative">
                <div className={`h-9 rounded-lg bg-gradient-to-r border ${STAGE_COLORS[i % STAGE_COLORS.length]} flex items-center px-3 gap-2 transition-all`} style={{ width: `${widthPct}%`, minWidth: "80px" }}>
                  <span className={`w-2 h-2 rounded-full shrink-0 ${STAGE_DOT_COLORS[i % STAGE_DOT_COLORS.length]}`} />
                  <span className="text-xs font-semibold text-foreground">{count}</span>
                  {stageValue > 0 && <span className="text-[10px] text-muted-foreground ml-auto hidden sm:inline">{formatCurrency(stageValue)}</span>}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Kanban cards */}
      <ScrollArea className="w-full">
        <div className="flex gap-3 pb-4" style={{ minWidth: `${activeStages.length * 260}px` }}>
          {activeStages.map((stage: any, i: number) => {
            const sDeals = stageDeals[String(stage.id)] || [];
            return (
              <div key={stage.id} className={`w-60 shrink-0 rounded-xl border bg-gradient-to-b ${STAGE_COLORS[i % STAGE_COLORS.length]} overflow-hidden`}>
                <div className="px-3 py-2.5 border-b border-border/20 flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className={`w-2 h-2 rounded-full ${STAGE_DOT_COLORS[i % STAGE_DOT_COLORS.length]}`} />
                    <span className="text-xs font-semibold text-foreground truncate">{stage.name}</span>
                  </div>
                  <span className="text-[10px] font-bold text-muted-foreground bg-muted/50 rounded px-1.5 py-0.5">{sDeals.length}</span>
                </div>
                <div className="p-2 space-y-1.5 max-h-72 overflow-y-auto">
                  {sDeals.map((d: any) => (
                    <div key={d.id} className="rounded-lg bg-card/80 border border-border/20 p-2.5 space-y-1">
                      <p className="text-[11px] font-semibold text-foreground leading-snug truncate">{d.title || "Sem título"}</p>
                      <div className="flex items-center justify-between">
                        {d.value ? <span className="text-[11px] font-bold text-emerald-500">{formatCurrency(d.value)}</span> : <span className="text-[10px] text-muted-foreground/50">Sem valor</span>}
                        <span className="text-[9px] text-muted-foreground">{formatDate(d.created_at)}</span>
                      </div>
                      {usersMap[String(d.owner_id)] && (
                        <p className="text-[9px] text-muted-foreground flex items-center gap-1">
                          <Users className="w-2.5 h-2.5" />
                          {usersMap[String(d.owner_id)]}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>
    </div>
  );
}

function PiperunDealsTab() {
  const { data, isLoading, error, refetch } = usePiperunDeals("100");
  const deals: any[] = data?.data || [];
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    if (!search) return deals;
    const q = search.toLowerCase();
    return deals.filter((d: any) => (d.title || "").toLowerCase().includes(q));
  }, [deals, search]);

  const totalValue = useMemo(() => filtered.reduce((s: number, d: any) => s + (Number(d.value) || 0), 0), [filtered]);

  if (isLoading) return <LoadingState label="Carregando negócios Piperun..." />;
  if (error) return <ErrorState message={(error as Error).message} onRetry={refetch} />;

  return (
    <div className="space-y-3">
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input placeholder="Buscar oportunidades..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 h-9 text-xs" />
          {search && <button onClick={() => setSearch("")} className="absolute right-2.5 top-1/2 -translate-y-1/2"><X className="w-3.5 h-3.5 text-muted-foreground hover:text-foreground" /></button>}
        </div>
      </div>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <p className="text-sm text-muted-foreground">{filtered.length} oportunidades</p>
          {totalValue > 0 && <span className="text-xs font-semibold text-foreground">{formatCurrency(totalValue)}</span>}
        </div>
        <Button variant="ghost" size="sm" onClick={() => refetch()}><RefreshCw className="w-3.5 h-3.5 mr-1" /> Atualizar</Button>
      </div>
      <div className="space-y-2">
        {filtered.map((d: any) => (
          <div key={d.id} className="rounded-xl border border-border/30 bg-card p-4 space-y-2">
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm font-semibold text-foreground truncate">{d.title || "Sem título"}</p>
              {d.value ? <span className="text-sm font-bold text-emerald-500 shrink-0">{formatCurrency(d.value)}</span> : null}
            </div>
            <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
              {d.status === 0 && <Badge variant="outline" className="text-[10px] border-blue-500/30 text-blue-400">Em aberto</Badge>}
              {d.status === 1 && <Badge variant="outline" className="text-[10px] border-emerald-500/30 text-emerald-400">Ganho</Badge>}
              {d.status === 2 && <Badge variant="outline" className="text-[10px] border-rose-500/30 text-rose-400">Perdido</Badge>}
              <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> {formatDate(d.created_at)}</span>
              {d.lead_time && <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {d.lead_time}d</span>}
            </div>
          </div>
        ))}
        {filtered.length === 0 && <EmptyState text={search ? "Nenhuma oportunidade encontrada." : "Nenhuma oportunidade no Piperun."} />}
      </div>
    </div>
  );
}

function PiperunPersonsTab() {
  const { data, isLoading, error, refetch } = usePiperunPersons();
  const persons: any[] = data?.data || [];
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    if (!search) return persons;
    const q = search.toLowerCase();
    return persons.filter((p: any) =>
      (p.name || "").toLowerCase().includes(q) ||
      (p.email || "").toLowerCase().includes(q) ||
      (p.company_name || "").toLowerCase().includes(q)
    );
  }, [persons, search]);

  if (isLoading) return <LoadingState label="Carregando pessoas Piperun..." />;
  if (error) return <ErrorState message={(error as Error).message} onRetry={refetch} />;

  return (
    <div className="space-y-3">
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input placeholder="Buscar por nome, e-mail ou empresa..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 h-9 text-xs" />
          {search && <button onClick={() => setSearch("")} className="absolute right-2.5 top-1/2 -translate-y-1/2"><X className="w-3.5 h-3.5 text-muted-foreground hover:text-foreground" /></button>}
        </div>
      </div>
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{filtered.length} pessoas</p>
        <Button variant="ghost" size="sm" onClick={() => refetch()}><RefreshCw className="w-3.5 h-3.5 mr-1" /> Atualizar</Button>
      </div>
      <div className="space-y-2">
        {filtered.map((p: any) => (
          <div key={p.id} className="rounded-xl border border-border/30 bg-card p-4 space-y-2">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-foreground truncate">{p.name || "Sem nome"}</p>
                {p.company_name && <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5"><Building2 className="w-3 h-3" /> {p.company_name}</p>}
              </div>
            </div>
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              {p.email && <span className="flex items-center gap-1 truncate"><Mail className="w-3 h-3" /> {p.email}</span>}
              {p.phone && <span className="flex items-center gap-1"><Phone className="w-3 h-3" /> {p.phone}</span>}
            </div>
          </div>
        ))}
        {filtered.length === 0 && <EmptyState text={search ? "Nenhuma pessoa encontrada." : "Nenhuma pessoa no Piperun."} />}
      </div>
    </div>
  );
}

function PiperunActivitiesTab() {
  const { data, isLoading, error, refetch } = usePiperunActivities();
  const activities: any[] = data?.data || [];

  if (isLoading) return <LoadingState label="Carregando atividades Piperun..." />;
  if (error) return <ErrorState message={(error as Error).message} onRetry={refetch} />;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{activities.length} atividades</p>
        <Button variant="ghost" size="sm" onClick={() => refetch()}><RefreshCw className="w-3.5 h-3.5 mr-1" /> Atualizar</Button>
      </div>
      <div className="space-y-2">
        {activities.map((a: any) => (
          <div key={a.id} className="rounded-xl border border-border/30 bg-card p-4 space-y-1.5">
            <p className="text-sm font-semibold text-foreground">{a.subject || a.type || "Atividade"}</p>
            <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
              {a.status && <Badge variant="secondary" className="text-[10px]">{a.status}</Badge>}
              {a.type && <span>{a.type}</span>}
              {a.due_date && <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> {formatDate(a.due_date)}</span>}
            </div>
          </div>
        ))}
        {activities.length === 0 && <EmptyState text="Nenhuma atividade no Piperun." />}
      </div>
    </div>
  );
}

function PiperunSection() {
  const { data: dealsData } = usePiperunDeals("200");
  const { data: personsData } = usePiperunPersons();
  const { data: activitiesData } = usePiperunActivities();

  const deals: any[] = dealsData?.data || [];
  const persons: any[] = personsData?.data || [];
  const activities: any[] = activitiesData?.data || [];
  const totalValue = deals.reduce((s: number, d: any) => s + (Number(d.value) || 0), 0);
  const openDeals = deals.filter((d: any) => d.status === 0).length;
  const wonDeals = deals.filter((d: any) => d.status === 1).length;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 pt-2 pb-1">
        <GitBranchPlus className="w-5 h-5 text-blue-500" />
        <h2 className="text-base sm:text-lg font-bold text-foreground">Piperun</h2>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KPICard icon={Target} label="Oportunidades" value={deals.length} sub={`${openDeals} abertas · ${wonDeals} ganhas`} color="text-blue-500" />
        <KPICard icon={DollarSign} label="Valor Total" value={formatCurrency(totalValue)} color="text-emerald-500" />
        <KPICard icon={Users} label="Pessoas" value={persons.length} color="text-cyan-500" />
        <KPICard icon={Activity} label="Atividades" value={activities.length} color="text-violet-500" />
      </div>

      <Tabs defaultValue="pipeline" className="space-y-4">
        <TabsList className="w-full grid grid-cols-4">
          <TabsTrigger value="pipeline" className="gap-1.5 text-xs"><GitBranchPlus className="w-3.5 h-3.5" /> Funil</TabsTrigger>
          <TabsTrigger value="deals" className="gap-1.5 text-xs"><Handshake className="w-3.5 h-3.5" /> Oportunidades</TabsTrigger>
          <TabsTrigger value="persons" className="gap-1.5 text-xs"><Users className="w-3.5 h-3.5" /> Pessoas</TabsTrigger>
          <TabsTrigger value="activities" className="gap-1.5 text-xs"><ListTodo className="w-3.5 h-3.5" /> Atividades</TabsTrigger>
        </TabsList>
        <TabsContent value="pipeline"><PiperunPipelineView /></TabsContent>
        <TabsContent value="deals"><PiperunDealsTab /></TabsContent>
        <TabsContent value="persons"><PiperunPersonsTab /></TabsContent>
        <TabsContent value="activities"><PiperunActivitiesTab /></TabsContent>
      </Tabs>
    </div>
  );
}

// ── Elite Metrics: Sales Velocity, Pipeline Coverage, Speed to Lead, Deal Aging Heatmap ──

function EliteMetrics() {
  const { matchesTeam, team, filteredBrokers } = useTeamFilter();
  const { data: prDealsData } = usePiperunDeals("200", true);
  const { data: prStagesData } = usePiperunStages();
  const { data: prPipelinesData } = usePiperunPipelines();
  const { data: prUsersData } = usePiperunUsers();
  const { data: prActivitiesData } = usePiperunActivities("200", true);
  const { data: hsDealsData } = useHubSpotDeals(100, true);
  const { data: hsOwnersData } = useHubSpotOwners();

  const now = new Date();
  const prDeals: any[] = prDealsData?.data || [];
  const hsDeals: any[] = hsDealsData?.results || [];
  const pipelines: any[] = prPipelinesData?.data || [];
  const allStages: any[] = prStagesData?.data || [];
  const activities: any[] = prActivitiesData?.data || [];

  const salesPipeline = pipelines.find((p: any) => p.funnel_type === 0);
  const salesPipelineId = salesPipeline ? String(salesPipeline.id) : "";

  const usersMap = useMemo(() => {
    const map: Record<string, string> = {};
    for (const u of (prUsersData?.data || [])) map[String(u.id)] = (u.name || u.nome || "").trim();
    return map;
  }, [prUsersData]);

  const hsOwnersMap = useMemo(() => {
    const map: Record<string, string> = {};
    for (const o of (hsOwnersData?.results || [])) {
      const name = `${o.firstName || ""} ${o.lastName || ""}`.trim();
      if (name) map[String(o.id)] = name;
    }
    return map;
  }, [hsOwnersData]);

  // All active deals (both CRMs)
  const prActive = prDeals.filter((d: any) => String(d.pipeline_id) === salesPipelineId && d.status === 0);
  const hsActive = hsDeals.filter((d: any) =>
    d.properties?.dealstage !== "closedwon" && d.properties?.dealstage !== "closedlost"
  );

  // ── PIPELINE COVERAGE (Sheets vendas × Pipeline prospecções) ──

  // ── PIPELINE COVERAGE (Sheets vendas × Pipeline prospecções) ──
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();
  const mesRef = `${currentYear}-${String(currentMonth + 1).padStart(2, "0")}`;
  const { data: goalsData } = useQuery({
    queryKey: ["sales_goals_elite", mesRef],
    queryFn: async () => {
      const { data } = await supabase.from("sales_goals").select("*").eq("mes_ref", mesRef);
      return data || [];
    },
  });
  const monthGoal = (goalsData || [])[0]?.meta || 0;

  const { data: individualGoals } = useQuery({
    queryKey: ["sales_goals_byname_elite", mesRef],
    queryFn: async () => {
      const { data } = await supabase.from("sales_goals_byname").select("*").eq("mes_ref", mesRef);
      return data || [];
    },
  });

  const { allRows } = useGoogleSheetsData();

  // Fetch real conversion rates from crm_prospections table
  const { data: crmConversionData } = useQuery({
    queryKey: ["crm_conversion_rates"],
    queryFn: async () => {
      const { data } = await supabase
        .from("crm_prospections")
        .select("seller_name, stage");
      return data || [];
    },
  });

  // Sync status: last sync date + total records
  const { data: syncStatus, refetch: refetchSyncStatus } = useQuery({
    queryKey: ["crm_sync_status"],
    queryFn: async () => {
      const { data: latest } = await supabase
        .from("crm_prospections")
        .select("synced_at")
        .order("synced_at", { ascending: false })
        .limit(1)
        .single();
      const { count } = await supabase
        .from("crm_prospections")
        .select("*", { count: "exact", head: true });
      return { lastSync: latest?.synced_at || null, totalRecords: count || 0 };
    },
  });

  const [isSyncing, setIsSyncing] = useState(false);
  const handleManualSync = async () => {
    setIsSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke("sync-crm-prospections");
      if (error) throw error;
      await refetchSyncStatus();
      // Also refetch conversion data
      // toast or similar
    } catch (e) {
      console.error("Sync error:", e);
    } finally {
      setIsSyncing(false);
    }
  };

  // Calculate per-seller conversion from archived CRM data
  const sellerConvRates = useMemo(() => {
    const rates: Record<string, { total: number; won: number; rate: number }> = {};
    let globalTotal = 0;
    let globalWon = 0;

    for (const row of crmConversionData || []) {
      if (!row.seller_name) continue;
      const name = normalizeName(row.seller_name);
      if (!rates[name]) rates[name] = { total: 0, won: 0, rate: 0 };
      rates[name].total++;
      globalTotal++;
      if (row.stage === "closedwon") {
        rates[name].won++;
        globalWon++;
      }
    }

    for (const key of Object.keys(rates)) {
      const r = rates[key];
      r.rate = r.total > 0 ? r.won / r.total : 0;
    }

    const globalRate = globalTotal > 0 ? globalWon / globalTotal : 0.03;
    return { rates, globalRate, globalTotal, globalWon };
  }, [crmConversionData]);

  // Coverage calculation — real conversion from DB
  const coverageCalc = useMemo(() => {
    const globalConvRate = sellerConvRates.globalRate || 0.03;

    // Current month sales from Sheets
    let currentMonthSalesCount = 0;
    let currentMonthCredits = 0;
    const salesBySeller: Record<string, { count: number; credits: number }> = {};

    for (const row of allRows) {
      if (!row.dataVenda) continue;
      const parts = String(row.dataVenda).split("/");
      if (parts.length < 3) continue;
      const d = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10) - 1;
      const y = parseInt(parts[2], 10);
      const fullYear = y < 100 ? 2000 + y : y;

      if (m === currentMonth && fullYear === currentYear) {
        currentMonthSalesCount++;
        currentMonthCredits += row.valor || 0;
        const seller = normalizeName(row.corretor || "");
        if (seller && ALL_BROKERS.includes(seller)) {
          if (!salesBySeller[seller]) salesBySeller[seller] = { count: 0, credits: 0 };
          salesBySeller[seller].count++;
          salesBySeller[seller].credits += row.valor || 0;
        }
      }
    }

    const totalSalesCount = currentMonthSalesCount;
    const avgTicket = totalSalesCount > 0 ? currentMonthCredits / totalSalesCount : 0;
    const remainingGoal = Math.max(0, monthGoal - currentMonthCredits);
    const salesNeeded = avgTicket > 0 ? Math.ceil(remainingGoal / avgTicket) : 0;
    const prospectsNeeded = salesNeeded > 0 ? Math.ceil(salesNeeded / globalConvRate) : 0;

    const activeProspects = prActive.length + hsActive.length;

    // Per-seller breakdown using individual goals + real conversion rates
    const brokersToShow = team === "all" ? ALL_BROKERS : filteredBrokers;
    const sellerConversion = brokersToShow.map(name => {
      const sales = salesBySeller[name]?.count || 0;
      const credits = salesBySeller[name]?.credits || 0;
      const sellerGoal = (individualGoals || []).find(g => normalizeName(g.broker_name) === name);
      const meta = sellerGoal?.meta || 0;
      const remaining = Math.max(0, meta - credits);
      const sellerTicket = sales > 0 ? credits / sales : (avgTicket || 150000);
      const sellerRate = sellerConvRates.rates[name]?.rate || globalConvRate;
      const sellerSalesNeeded = sellerTicket > 0 ? Math.ceil(remaining / sellerTicket) : 0;
      const sellerProspNeeded = sellerSalesNeeded > 0 ? Math.ceil(sellerSalesNeeded / sellerRate) : 0;
      const sellerConvPct = Math.round(sellerRate * 100 * 10) / 10;
      return { name, sales, credits, meta, remaining, sellerTicket, sellerProspNeeded, sellerConvPct, team: BROKER_TEAMS[name] || "—" };
    }).sort((a, b) => a.remaining - b.remaining);

    return {
      currentMonthSalesCount, currentMonthCredits, convRate: globalConvRate,
      avgTicket, remainingGoal, prospectsNeeded, activeProspects, sellerConversion,
    };
  }, [allRows, currentMonth, currentYear, monthGoal, prActive, hsActive, individualGoals, sellerConvRates, team, filteredBrokers]);

  const coverageStatus: "green" | "yellow" | "red" = coverageCalc.prospectsNeeded <= 0
    ? "green"
    : coverageCalc.activeProspects >= coverageCalc.prospectsNeeded ? "green"
    : coverageCalc.activeProspects >= coverageCalc.prospectsNeeded * 0.5 ? "yellow"
    : "red";

  // ── DEAL AGING HEATMAP ──

  // ── DEAL AGING HEATMAP ──
  const agingData = useMemo(() => {
    const buckets = ["0-2d", "3-5d", "6-10d", "11-20d", "20d+"];
    const sellerBuckets: Record<string, { name: string; buckets: number[] }> = {};

    const allActive = [
      ...prActive.map((d: any) => ({
        owner: usersMap[String(d.owner_id)] || "Sem atribuição",
        age: Math.floor((now.getTime() - new Date(d.last_stage_updated_at || d.updated_at || d.created_at).getTime()) / 86400000),
      })),
      ...hsActive.map((d: any) => ({
        owner: d.properties.hubspot_owner_id && hsOwnersMap[d.properties.hubspot_owner_id]
          ? hsOwnersMap[d.properties.hubspot_owner_id] : "Sem atribuição (HS)",
        age: Math.floor((now.getTime() - new Date(d.properties.hs_lastmodifieddate || d.properties.createdate).getTime()) / 86400000),
      })),
    ];

    for (const item of allActive) {
      if (!sellerBuckets[item.owner]) sellerBuckets[item.owner] = { name: item.owner, buckets: [0, 0, 0, 0, 0] };
      const b = item.age <= 2 ? 0 : item.age <= 5 ? 1 : item.age <= 10 ? 2 : item.age <= 20 ? 3 : 4;
      sellerBuckets[item.owner].buckets[b]++;
    }

    return {
      buckets,
      sellers: Object.values(sellerBuckets)
        .filter(s => !isLeadership(s.name) && matchesTeam(s.name))
        .sort((a, b) => (b.buckets[3] + b.buckets[4]) - (a.buckets[3] + a.buckets[4])),
    };
  }, [prActive, hsActive, usersMap, hsOwnersMap, matchesTeam]);

  const heatColor = (val: number, bucketIdx: number) => {
    if (val === 0) return "bg-muted/30 text-muted-foreground/50";
    if (bucketIdx <= 1) return val >= 5 ? "bg-emerald-500/30 text-emerald-400" : "bg-emerald-500/15 text-emerald-400";
    if (bucketIdx === 2) return val >= 3 ? "bg-amber-500/30 text-amber-400" : "bg-amber-500/15 text-amber-400";
    return val >= 3 ? "bg-red-500/30 text-red-400" : "bg-red-500/15 text-red-400";
  };

  const statusColors = {
    green: "border-emerald-500/40 bg-emerald-500/10 text-emerald-500",
    yellow: "border-amber-500/40 bg-amber-500/10 text-amber-500",
    red: "border-red-500/40 bg-red-500/10 text-red-500",
  };

  return (
    <div className="space-y-4">
      {/* Top row: Pipeline Coverage + CRM Sync */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">

        {/* Pipeline Coverage — Sheets vendas vs CRM prospecções */}
        <div className={`rounded-xl border-2 p-4 space-y-2 ${statusColors[coverageStatus]}`}>
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5" />
            <span className="text-xs font-bold uppercase tracking-wide">Cobertura de Pipeline</span>
          </div>
          <p className="text-2xl font-black">{(coverageCalc.convRate * 100).toFixed(1)}%</p>
          <p className="text-[10px] opacity-80">
            taxa real de conversão ({sellerConvRates.globalWon} ganhos de {sellerConvRates.globalTotal} prospecções)
          </p>
          <div className="text-[10px] opacity-80 space-y-0.5 pt-1">
            <p>💰 Ticket médio: {formatCurrency(coverageCalc.avgTicket)}</p>
            <p>📈 Este mês: {coverageCalc.currentMonthSalesCount} vendas · {formatCurrency(coverageCalc.currentMonthCredits)}</p>
            <p>🎯 Falta: {formatCurrency(coverageCalc.remainingGoal)} p/ meta</p>
            {coverageCalc.prospectsNeeded > 0 ? (
              <p className="font-bold pt-1">
                👉 Precisa de ~{coverageCalc.prospectsNeeded} prospecções p/ bater a meta
              </p>
            ) : (
              <p className="font-bold pt-1">✅ Meta já alcançada!</p>
            )}
            <p>📋 {coverageCalc.activeProspects} ativos no pipeline agora</p>
          </div>
          {/* Seller breakdown */}
          {coverageCalc.sellerConversion.length > 0 && (
            <div className="pt-2 border-t border-current/10 space-y-1">
              <p className="text-[9px] font-bold uppercase tracking-wider opacity-60">Prospecções necessárias por vendedor</p>
              {coverageCalc.sellerConversion.map((s) => (
                <div key={s.name} className="flex items-center justify-between gap-1 text-[10px]">
                  <div className="flex items-center gap-1 min-w-0 truncate">
                    <span className="truncate">{s.name}</span>
                    {team === "all" && s.team && (
                      <span className="text-[8px] opacity-50 shrink-0">({s.team})</span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="opacity-60">{s.sales}v · {s.sellerConvPct}%</span>
                    <span className={`font-bold ${s.remaining <= 0 ? "text-emerald-400" : s.sellerProspNeeded > 50 ? "text-red-400" : "text-amber-400"}`}>
                      {s.remaining <= 0 ? "✅" : `~${s.sellerProspNeeded}`}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* CRM Sync Status */}
        <div className="rounded-xl border-2 border-border/40 bg-card/60 p-4 space-y-2">
          <div className="flex items-center gap-2">
            <RefreshCw className="w-5 h-5 text-primary" />
            <span className="text-xs font-bold uppercase tracking-wide">Sync CRM</span>
          </div>
          <p className="text-2xl font-black">{(syncStatus?.totalRecords || 0).toLocaleString()}</p>
          <p className="text-[10px] text-muted-foreground">prospecções arquivadas</p>
          <div className="text-[10px] text-muted-foreground space-y-0.5 pt-1">
            <p>🔄 Última sync: {syncStatus?.lastSync
              ? new Date(syncStatus.lastSync).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })
              : "—"}</p>
            <p>⏰ Cron diário às 06:00 BRT</p>
          </div>
          <Button
            size="sm"
            variant="outline"
            className="w-full mt-2 text-xs"
            onClick={handleManualSync}
            disabled={isSyncing}
          >
            <RefreshCw className={`w-3 h-3 mr-1 ${isSyncing ? "animate-spin" : ""}`} />
            {isSyncing ? "Sincronizando..." : "Forçar Sync Agora"}
          </Button>
        </div>
      </div>

      {/* Deal Aging Heatmap */}
      {agingData.sellers.length > 0 && (
        <Card className="border-border/30 bg-card/80">
          <CardContent className="p-4 sm:p-5 space-y-3">
            <div className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-primary" />
              <span className="text-xs font-bold uppercase tracking-wide text-foreground">Deal Aging Heatmap</span>
              <span className="text-[10px] text-muted-foreground ml-auto">dias parado no estágio</span>
            </div>

            {/* Header */}
            <div className="grid gap-1" style={{ gridTemplateColumns: `minmax(90px, 1fr) repeat(5, 48px)` }}>
              <div />
              {agingData.buckets.map((b) => (
                <div key={b} className="text-center text-[9px] font-bold text-muted-foreground uppercase">{b}</div>
              ))}
            </div>

            {/* Rows */}
            {agingData.sellers.map((seller) => (
              <div key={seller.name} className="grid gap-1 items-center" style={{ gridTemplateColumns: `minmax(90px, 1fr) repeat(5, 48px)` }}>
                <span className="text-[11px] font-medium text-foreground truncate">{seller.name}</span>
                {seller.buckets.map((val, bi) => (
                  <div key={bi} className={`text-center rounded-md py-1 text-[11px] font-bold ${heatColor(val, bi)}`}>
                    {val || "·"}
                  </div>
                ))}
              </div>
            ))}

            {/* Legend */}
            <div className="flex items-center gap-3 pt-1 text-[9px] text-muted-foreground">
              <span className="flex items-center gap-1"><div className="w-2.5 h-2.5 rounded-sm bg-emerald-500/30" /> Saudável</span>
              <span className="flex items-center gap-1"><div className="w-2.5 h-2.5 rounded-sm bg-amber-500/30" /> Atenção</span>
              <span className="flex items-center gap-1"><div className="w-2.5 h-2.5 rounded-sm bg-red-500/30" /> Crítico</span>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ── Conversion Tracker (3 key stages) ─────────────────────────

const KEY_STAGES = ["contato estabelecido", "reunião agendada", "proposta apresentada"];

function ConversionTracker() {
  const { matchesTeam } = useTeamFilter();
  const { data: prDealsData } = usePiperunDeals("200", true);
  const { data: prStagesData } = usePiperunStages();
  const { data: prPipelinesData } = usePiperunPipelines();
  const { data: prUsersData } = usePiperunUsers();
  const { data: hsDealsData } = useHubSpotDeals(100, true);
  const { data: hsPipelinesData } = useHubSpotPipelines();
  const { data: hsOwnersData } = useHubSpotOwners();

  const prDeals: any[] = prDealsData?.data || [];
  const allStages: any[] = prStagesData?.data || [];
  const pipelines: any[] = prPipelinesData?.data || [];

  const salesPipeline = pipelines.find((p: any) => p.funnel_type === 0);
  const salesPipelineId = salesPipeline ? String(salesPipeline.id) : "";

  const usersMap = useMemo(() => {
    const map: Record<string, string> = {};
    for (const u of (prUsersData?.data || [])) map[String(u.id)] = (u.name || u.nome || "").trim();
    return map;
  }, [prUsersData]);

  const hsOwnersMap = useMemo(() => {
    const map: Record<string, string> = {};
    for (const o of (hsOwnersData?.results || [])) {
      const name = `${o.firstName || ""} ${o.lastName || ""}`.trim();
      if (name) map[String(o.id)] = name;
    }
    return map;
  }, [hsOwnersData]);

  // Find Piperun key stages
  const keyStagesPR = useMemo(() => {
    return allStages
      .filter((s: any) => String(s.pipeline_id) === salesPipelineId && KEY_STAGES.includes((s.name || "").toLowerCase()))
      .sort((a: any, b: any) => (a.order ?? 0) - (b.order ?? 0));
  }, [allStages, salesPipelineId]);

  // Find HubSpot key stages
  const hsStages = useMemo(() => {
    if (!hsPipelinesData?.results?.length) return [];
    const pipeline = hsPipelinesData.results[0];
    return (pipeline.stages || []).filter((s: any) =>
      KEY_STAGES.includes((s.label || "").toLowerCase())
    );
  }, [hsPipelinesData]);

  const hsDeals = hsDealsData?.results || [];

  const now = new Date();

  // Build per-stage, per-seller data for Piperun
  const prStageData = useMemo(() => {
    return keyStagesPR.map((stage: any) => {
      const stageId = String(stage.id);
      const deals = prDeals.filter((d: any) => String(d.stage_id) === stageId && String(d.pipeline_id) === salesPipelineId && d.status === 0);

      const bySeller: Record<string, { name: string; count: number; value: number; oldestDays: number; deals: any[] }> = {};
      for (const d of deals) {
        const name = usersMap[String(d.owner_id)] || "Sem atribuição";
        if (!bySeller[name]) bySeller[name] = { name, count: 0, value: 0, oldestDays: 0, deals: [] };
        bySeller[name].count++;
        bySeller[name].value += Number(d.value) || 0;
        const age = Math.floor((now.getTime() - new Date(d.last_stage_updated_at || d.updated_at || d.created_at).getTime()) / 86400000);
        if (age > bySeller[name].oldestDays) bySeller[name].oldestDays = age;
        bySeller[name].deals.push({ ...d, ageDays: age });
      }

      const sellers = Object.values(bySeller).sort((a, b) => b.count - a.count);
      const totalValue = deals.reduce((s: number, d: any) => s + (Number(d.value) || 0), 0);
      const stuckCount = deals.filter((d: any) => {
        const age = Math.floor((now.getTime() - new Date(d.last_stage_updated_at || d.updated_at || d.created_at).getTime()) / 86400000);
        return age >= 3;
      }).length;

      return {
        name: stage.name,
        total: deals.length,
        totalValue,
        stuckCount,
        sellers,
        source: "piperun" as const,
      };
    });
  }, [keyStagesPR, prDeals, salesPipelineId, usersMap]);

  // Build per-stage, per-seller data for HubSpot
  const hsStageData = useMemo(() => {
    return hsStages.map((stage: any) => {
      const deals = hsDeals.filter((d: any) => d.properties.dealstage === stage.id);

      const bySeller: Record<string, { name: string; count: number; value: number; oldestDays: number; deals: any[] }> = {};
      for (const d of deals) {
        const name = d.properties.hubspot_owner_id && hsOwnersMap[d.properties.hubspot_owner_id]
          ? hsOwnersMap[d.properties.hubspot_owner_id] : "Sem atribuição";
        if (!bySeller[name]) bySeller[name] = { name, count: 0, value: 0, oldestDays: 0, deals: [] };
        bySeller[name].count++;
        bySeller[name].value += Number(d.properties.amount) || 0;
        const age = Math.floor((now.getTime() - new Date(d.properties.hs_lastmodifieddate || d.properties.createdate).getTime()) / 86400000);
        if (age > bySeller[name].oldestDays) bySeller[name].oldestDays = age;
        bySeller[name].deals.push({ ...d, ageDays: age });
      }

      const sellers = Object.values(bySeller).sort((a, b) => b.count - a.count);
      const totalValue = deals.reduce((s: number, d: any) => s + (Number(d.properties.amount) || 0), 0);
      const stuckCount = deals.filter((d: any) => {
        const age = Math.floor((now.getTime() - new Date(d.properties.hs_lastmodifieddate || d.properties.createdate).getTime()) / 86400000);
        return age >= 3;
      }).length;

      return {
        name: stage.label,
        total: deals.length,
        totalValue,
        stuckCount,
        sellers,
        source: "hubspot" as const,
      };
    });
  }, [hsStages, hsDeals, hsOwnersMap]);

  // Merge both sources — group by normalized stage name
  const mergedStages = useMemo(() => {
    const map: Record<string, {
      name: string;
      prData: typeof prStageData[0] | null;
      hsData: typeof hsStageData[0] | null;
      combinedTotal: number;
      combinedValue: number;
      combinedStuck: number;
    }> = {};

    for (const s of prStageData) {
      const key = s.name.toLowerCase();
      if (!map[key]) map[key] = { name: s.name, prData: null, hsData: null, combinedTotal: 0, combinedValue: 0, combinedStuck: 0 };
      map[key].prData = s;
      map[key].combinedTotal += s.total;
      map[key].combinedValue += s.totalValue;
      map[key].combinedStuck += s.stuckCount;
    }
    for (const s of hsStageData) {
      const key = (s.name || "").toLowerCase();
      if (!map[key]) map[key] = { name: s.name, prData: null, hsData: null, combinedTotal: 0, combinedValue: 0, combinedStuck: 0 };
      map[key].hsData = s;
      map[key].combinedTotal += s.total;
      map[key].combinedValue += s.totalValue;
      map[key].combinedStuck += s.stuckCount;
    }

    // Order by the KEY_STAGES order
    return KEY_STAGES.map(k => map[k]).filter(Boolean);
  }, [prStageData, hsStageData]);

  if (mergedStages.length === 0) return null;

  const stageEmoji: Record<string, string> = {
    "contato estabelecido": "📞",
    "reunião agendada": "📅",
    "proposta apresentada": "📋",
  };

  return (
    <Card className="border-border/30 bg-card/80">
      <CardContent className="p-4 sm:p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Target className="w-4 h-4 text-primary" />
          <span className="text-xs font-bold uppercase tracking-wide text-foreground">Acompanhamento de Conversão</span>
        </div>

        {/* Stage summary cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {mergedStages.map((stage) => {
            const key = stage.name.toLowerCase();
            const emoji = stageEmoji[key] || "📊";
            const stuckPct = stage.combinedTotal > 0 ? Math.round((stage.combinedStuck / stage.combinedTotal) * 100) : 0;
            const stuckColor = stuckPct >= 50 ? "text-red-400" : stuckPct >= 25 ? "text-amber-400" : "text-emerald-400";

            return (
              <div key={stage.name} className="rounded-xl border border-border/30 bg-gradient-to-b from-card to-muted/20 p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <span className="text-lg">{emoji}</span>
                  <div>
                    <p className="text-xs font-bold text-foreground">{stage.name}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {stage.combinedTotal} deals · {formatCurrency(stage.combinedValue)}
                    </p>
                  </div>
                </div>

                {/* Stuck indicator */}
                {stage.combinedStuck > 0 && (
                  <div className={`flex items-center gap-1.5 text-[11px] font-medium ${stuckColor}`}>
                    <Clock className="w-3.5 h-3.5" />
                    {stage.combinedStuck} parado(s) há 3+ dias ({stuckPct}%)
                  </div>
                )}

                {/* Sellers breakdown */}
                <div className="space-y-1.5">
                  {(stage.prData?.sellers || []).concat(stage.hsData?.sellers || []).filter(s => matchesTeam(s.name)).map((seller) => (
                    <div key={seller.name} className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${seller.oldestDays >= 5 ? "bg-red-500" : seller.oldestDays >= 3 ? "bg-amber-500" : "bg-emerald-500"}`} />
                        <span className="text-[11px] text-foreground truncate">{seller.name}</span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-[10px] text-muted-foreground">{formatCurrency(seller.value)}</span>
                        <Badge variant="outline" className="text-[10px] font-bold">{seller.count}</Badge>
                        {seller.oldestDays >= 3 && (
                          <span className={`text-[9px] font-bold ${seller.oldestDays >= 5 ? "text-red-400" : "text-amber-400"}`}>
                            {seller.oldestDays}d
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {/* Conversion funnel flow */}
        <div className="flex items-center justify-center gap-2 py-2">
          {mergedStages.map((stage, i) => (
            <div key={stage.name} className="flex items-center gap-2">
              <div className="text-center">
                <p className="text-lg font-black text-foreground">{stage.combinedTotal}</p>
                <p className="text-[9px] text-muted-foreground leading-tight max-w-[80px]">{stage.name}</p>
              </div>
              {i < mergedStages.length - 1 && (
                <div className="flex flex-col items-center px-1">
                  <TrendingUp className="w-4 h-4 text-muted-foreground" />
                  {mergedStages[i + 1] && stage.combinedTotal > 0 && (
                    <span className="text-[9px] font-bold text-muted-foreground">
                      {Math.round((mergedStages[i + 1].combinedTotal / stage.combinedTotal) * 100)}%
                    </span>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// ── Consolidated metrics ──────────────────────────────────────

function ConsolidatedMetrics() {
  const { data: hsDealsData } = useHubSpotDeals(100, true);
  const { data: prDealsData } = usePiperunDeals("200", true);
  const { data: hsContactsData } = useHubSpotContacts();
  const { data: prPersonsData } = usePiperunPersons();

  const hsDeals = hsDealsData?.results || [];
  const prDeals: any[] = prDealsData?.data || [];
  const hsContacts = hsContactsData?.results || [];
  const prPersons: any[] = prPersonsData?.data || [];

  const totalDeals = hsDeals.length + prDeals.length;
  const hsValue = hsDeals.reduce((s: number, d: any) => s + (Number(d.properties?.amount) || 0), 0);
  const prValue = prDeals.reduce((s: number, d: any) => s + (Number(d.value) || 0), 0);
  const totalValue = hsValue + prValue;

  const hsWon = hsDeals.filter((d: any) => d.properties?.dealstage === "closedwon").length;
  const hsLost = hsDeals.filter((d: any) => d.properties?.dealstage === "closedlost").length;
  const prWon = prDeals.filter((d: any) => d.status === 1).length;
  const prLost = prDeals.filter((d: any) => d.status === 2).length;

  const totalWon = hsWon + prWon;
  const totalClosed = totalWon + hsLost + prLost;
  const conversionRate = totalClosed > 0 ? Math.round((totalWon / totalClosed) * 100) : 0;

  const totalContacts = hsContacts.length + prPersons.length;

  const openDeals = hsDeals.filter((d: any) =>
    d.properties?.dealstage !== "closedwon" && d.properties?.dealstage !== "closedlost"
  ).length + prDeals.filter((d: any) => d.status === 0).length;

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <Card className="border-border/30 bg-gradient-to-br from-primary/10 to-primary/5 col-span-1">
          <CardContent className="p-4 text-center space-y-1">
            <Target className="w-6 h-6 text-primary mx-auto" />
            <p className="text-2xl font-extrabold text-foreground">{totalDeals}</p>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Oportunidades</p>
            <p className="text-[10px] text-muted-foreground">{openDeals} abertas</p>
          </CardContent>
        </Card>

        <Card className="border-border/30 bg-gradient-to-br from-emerald-500/10 to-emerald-500/5 col-span-1">
          <CardContent className="p-4 text-center space-y-1">
            <DollarSign className="w-6 h-6 text-emerald-500 mx-auto" />
            <p className="text-2xl font-extrabold text-foreground">{formatCurrency(totalValue)}</p>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Valor Combinado</p>
          </CardContent>
        </Card>

        <Card className="border-border/30 bg-gradient-to-br from-blue-500/10 to-blue-500/5 col-span-1">
          <CardContent className="p-4 text-center space-y-1">
            <TrendingUp className="w-6 h-6 text-blue-500 mx-auto" />
            <p className="text-2xl font-extrabold text-foreground">{conversionRate}%</p>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Tx. Conversão</p>
            <p className="text-[10px] text-muted-foreground">{totalWon} de {totalClosed} fechados</p>
          </CardContent>
        </Card>

        <Card className="border-border/30 bg-gradient-to-br from-amber-500/10 to-amber-500/5 col-span-1">
          <CardContent className="p-4 text-center space-y-1">
            <Handshake className="w-6 h-6 text-amber-500 mx-auto" />
            <p className="text-2xl font-extrabold text-foreground">{totalWon}</p>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Ganhos</p>
          </CardContent>
        </Card>

        <Card className="border-border/30 bg-gradient-to-br from-cyan-500/10 to-cyan-500/5 col-span-2 sm:col-span-1">
          <CardContent className="p-4 text-center space-y-1">
            <Users className="w-6 h-6 text-cyan-500 mx-auto" />
            <p className="text-2xl font-extrabold text-foreground">{totalContacts}</p>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Contatos</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ── Advanced analytics wrapper ────────────────────────────────

function AdvancedAnalytics() {
  const { matchesTeam } = useTeamFilter();
  const { data: prDealsData } = usePiperunDeals("200", true);
  const { data: prStagesData } = usePiperunStages();
  const { data: prUsersData } = usePiperunUsers();
  const { data: hsDealsData } = useHubSpotDeals(100, true);
  const { data: hsPipelinesData } = useHubSpotPipelines();

  const prStages: any[] = prStagesData?.data || [];
  const hsDeals = hsDealsData?.results || [];

  // Filter out leadership (Kezia, Davi, etc.) from Piperun data
  const prUsersAll: any[] = prUsersData?.data || [];
  const leadershipIds = new Set(
    prUsersAll
      .filter((u: any) => isLeadership((u.name || u.nome || "").trim()))
      .map((u: any) => u.id)
  );

  // Also filter by team: build set of user IDs that match team
  const teamFilteredUsers = prUsersAll.filter((u: any) => {
    if (leadershipIds.has(u.id)) return false;
    const name = normalizeName((u.name || u.nome || "").trim());
    return matchesTeam(name);
  });
  const teamUserIds = new Set(teamFilteredUsers.map((u: any) => u.id));

  const prUsers = teamFilteredUsers;
  const prDeals: any[] = (prDealsData?.data || []).filter(
    (d: any) => teamUserIds.has(d.owner_id)
  );

  const hsStages = useMemo(() => {
    if (hsPipelinesData?.results?.length > 0) {
      const pipeline = hsPipelinesData.results[0];
      return (pipeline.stages || []).map((s: any) => ({ id: s.id, label: s.label }));
    }
    const unique = [...new Set(hsDeals.map((d: any) => d.properties?.dealstage).filter(Boolean))];
    return unique.map((s) => ({ id: s as string, label: s as string }));
  }, [hsPipelinesData, hsDeals]);

  return (
    <>
      <CRMSalesAlerts piperunDeals={prDeals} hubspotDeals={hsDeals} />

      <div className="border-t border-border/30" />

      <CRMFunnelMetrics
        piperunDeals={prDeals}
        piperunStages={prStages}
        hubspotDeals={hsDeals}
        hubspotStages={hsStages}
      />

      <div className="border-t border-border/30" />

      <CRMSalesRanking piperunDeals={prDeals} piperunUsers={prUsers} />

      <div className="border-t border-border/30" />

      <CRMSellerComparison piperunDeals={prDeals} piperunUsers={prUsers} />

      <div className="border-t border-border/30" />

      <CRMGoalVsActual piperunDeals={prDeals} piperunUsers={prUsers} />

      <div className="border-t border-border/30" />

      <CRMForecastChart piperunDeals={prDeals} hubspotDeals={hsDeals} />
    </>
  );
}

// ── Main page ─────────────────────────────────────────────────

// ── Health Semaphore ──────────────────────────────────────────
function HealthSemaphore() {
  const { matchesTeam, team } = useTeamFilter();
  const { allRows } = useGoogleSheetsData();
  const { data: prDealsData } = usePiperunDeals("200", true);
  const { data: prStagesData } = usePiperunStages();
  const { data: prPipelinesData } = usePiperunPipelines();

  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();
  const dayOfMonth = now.getDate();
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const monthProgress = (dayOfMonth / daysInMonth) * 100;

  const mesRef = `${currentYear}-${String(currentMonth + 1).padStart(2, "0")}`;
  const { data: goalsData } = useQuery({
    queryKey: ["sales_goals", mesRef],
    queryFn: async () => {
      const { data } = await supabase.from("sales_goals").select("*").eq("mes_ref", mesRef);
      return data || [];
    },
  });

  const monthGoal = (goalsData || [])[0]?.meta || 0;

  // Current month sales from Sheets (filtered by team)
  const monthSales = useMemo(() => {
    let total = 0;
    for (const row of allRows) {
      if (!row.dataVenda) continue;
      const parts = String(row.dataVenda).split("/");
      if (parts.length < 3) continue;
      const m = parseInt(parts[1], 10) - 1;
      const y = parseInt(parts[2], 10);
      const fullYear = y < 100 ? 2000 + y : y;
      if (m === currentMonth && fullYear === currentYear) {
        if (team !== "all") {
          const seller = normalizeName(row.corretor || "");
          if (!matchesTeam(seller)) continue;
        }
        total += row.valor || 0;
      }
    }
    return total;
  }, [allRows, currentMonth, currentYear, team, matchesTeam]);

  const goalPct = monthGoal > 0 ? (monthSales / monthGoal) * 100 : 0;
  const goalOnTrack = monthGoal > 0 ? goalPct >= monthProgress * 0.8 : true;
  const goalStatus: "green" | "yellow" | "red" = goalPct >= 80 ? "green" : goalPct >= 50 ? "yellow" : "red";

  // Pipeline health
  const prDeals: any[] = prDealsData?.data || [];
  const salesPipeline = (prPipelinesData?.data || []).find((p: any) => p.funnel_type === 0);
  const salesPipelineId = salesPipeline ? String(salesPipeline.id) : "";
  const activePipelineDeals = prDeals.filter((d: any) => String(d.pipeline_id) === salesPipelineId && d.status === 0);
  const pipelineStatus: "green" | "yellow" | "red" = activePipelineDeals.length >= 50 ? "green" : activePipelineDeals.length >= 20 ? "yellow" : "red";

  // Deals created this week vs last week
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - now.getDay());
  weekStart.setHours(0, 0, 0, 0);
  const lastWeekStart = new Date(weekStart);
  lastWeekStart.setDate(lastWeekStart.getDate() - 7);

  const thisWeekDeals = prDeals.filter((d: any) => new Date(d.created_at) >= weekStart).length;
  const lastWeekDeals = prDeals.filter((d: any) => {
    const dt = new Date(d.created_at);
    return dt >= lastWeekStart && dt < weekStart;
  }).length;
  const velocityTrend = thisWeekDeals >= lastWeekDeals ? "up" : "down";
  const velocityStatus: "green" | "yellow" | "red" = velocityTrend === "up" ? "green" : thisWeekDeals >= lastWeekDeals * 0.7 ? "yellow" : "red";

  const statusColors = {
    green: "border-emerald-500/40 bg-emerald-500/10 text-emerald-500",
    yellow: "border-amber-500/40 bg-amber-500/10 text-amber-500",
    red: "border-red-500/40 bg-red-500/10 text-red-500",
  };
  const statusIcons = {
    green: <CheckCircle2 className="w-5 h-5" />,
    yellow: <AlertCircle className="w-5 h-5" />,
    red: <AlertTriangle className="w-5 h-5" />,
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
      <div className={`rounded-xl border-2 p-4 ${statusColors[goalStatus]}`}>
        <div className="flex items-center gap-2 mb-2">
          {statusIcons[goalStatus]}
          <span className="text-xs font-bold uppercase tracking-wide">Meta do Mês</span>
        </div>
        <p className="text-2xl font-black">{goalPct.toFixed(0)}%</p>
        <p className="text-[10px] opacity-80">
          {formatCurrency(monthSales)} de {formatCurrency(monthGoal)} · {monthProgress.toFixed(0)}% do mês
        </p>
      </div>

      <div className={`rounded-xl border-2 p-4 ${statusColors[pipelineStatus]}`}>
        <div className="flex items-center gap-2 mb-2">
          {statusIcons[pipelineStatus]}
          <span className="text-xs font-bold uppercase tracking-wide">Pipeline Ativo</span>
        </div>
        <p className="text-2xl font-black">{activePipelineDeals.length}</p>
        <p className="text-[10px] opacity-80">deals abertos no funil de vendas</p>
      </div>

      <div className={`rounded-xl border-2 p-4 ${statusColors[velocityStatus]}`}>
        <div className="flex items-center gap-2 mb-2">
          {statusIcons[velocityStatus]}
          <span className="text-xs font-bold uppercase tracking-wide">Velocidade</span>
        </div>
        <p className="text-2xl font-black">{thisWeekDeals} <span className="text-sm font-semibold">{velocityTrend === "up" ? "↑" : "↓"}</span></p>
        <p className="text-[10px] opacity-80">novos deals esta semana (vs {lastWeekDeals} semana passada)</p>
      </div>
    </div>
  );
}

// ── Attention Alerts ─────────────────────────────────────────
function AttentionAlerts() {
  const { matchesTeam } = useTeamFilter();
  const { allRows } = useGoogleSheetsData();
  const { data: prDealsData } = usePiperunDeals("200", true);
  const { data: prUsersData } = usePiperunUsers();
  const { data: prPipelinesData } = usePiperunPipelines();

  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  const prDeals: any[] = prDealsData?.data || [];
  const prUsers: any[] = (prUsersData?.data || []).filter((u: any) => u.active);

  const salesPipeline = (prPipelinesData?.data || []).find((p: any) => p.funnel_type === 0);
  const salesPipelineId = salesPipeline ? String(salesPipeline.id) : "";

  const usersMap = useMemo(() => {
    const map: Record<string, string> = {};
    for (const u of prUsers) map[String(u.id)] = (u.name || u.nome || "").trim();
    return map;
  }, [prUsers]);

  // Sellers with zero sales this month
  const sellersWithSales = useMemo(() => {
    const set = new Set<string>();
    for (const row of allRows) {
      if (!row.dataVenda) continue;
      const parts = String(row.dataVenda).split("/");
      if (parts.length < 3) continue;
      const m = parseInt(parts[1], 10) - 1;
      const y = parseInt(parts[2], 10);
      const fullYear = y < 100 ? 2000 + y : y;
      if (m === currentMonth && fullYear === currentYear) {
        set.add(normalizeName(row.corretor));
      }
    }
    return set;
  }, [allRows, currentMonth, currentYear]);

  const zeroSalesSellers = ALL_BROKERS.filter(name => !isLeadership(name) && matchesTeam(name) && !sellersWithSales.has(normalizeName(name)));

  // Sellers with no active pipeline deals
  const sellersWithDeals = useMemo(() => {
    const set = new Set<string>();
    for (const d of prDeals) {
      if (String(d.pipeline_id) === salesPipelineId && d.status === 0) {
        const name = usersMap[String(d.owner_id)];
        if (name) set.add(name);
      }
    }
    return set;
  }, [prDeals, salesPipelineId, usersMap]);

  const emptyPipelineSellers = Object.values(usersMap).filter(name => !isLeadership(name) && matchesTeam(name) && !sellersWithDeals.has(name));

  // Deals stuck > 3 days
  const stuckDeals = useMemo(() => {
    const threeDaysAgo = new Date(now);
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
    return prDeals.filter((d: any) => {
      if (String(d.pipeline_id) !== salesPipelineId || d.status !== 0) return false;
      const lastUpdate = new Date(d.last_stage_updated_at || d.updated_at || d.created_at);
      return lastUpdate < threeDaysAgo;
    });
  }, [prDeals, salesPipelineId]);

  // Group stuck deals by seller
  const stuckBySeller = useMemo(() => {
    const map: Record<string, number> = {};
    for (const d of stuckDeals) {
      const name = usersMap[String(d.owner_id)] || "Sem atribuição";
      map[name] = (map[name] || 0) + 1;
    }
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [stuckDeals, usersMap]);

  const alerts: { icon: React.ReactNode; text: string; severity: "red" | "yellow" }[] = [];

  if (zeroSalesSellers.length > 0) {
    alerts.push({
      icon: <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />,
      text: `${zeroSalesSellers.length} vendedor(es) sem venda no mês: ${zeroSalesSellers.slice(0, 4).join(", ")}${zeroSalesSellers.length > 4 ? ` +${zeroSalesSellers.length - 4}` : ""}`,
      severity: "red",
    });
  }

  if (emptyPipelineSellers.length > 0) {
    alerts.push({
      icon: <AlertCircle className="w-4 h-4 text-amber-500 shrink-0" />,
      text: `${emptyPipelineSellers.length} vendedor(es) sem deals no funil: ${emptyPipelineSellers.slice(0, 4).join(", ")}${emptyPipelineSellers.length > 4 ? ` +${emptyPipelineSellers.length - 4}` : ""}`,
      severity: "yellow",
    });
  }

  for (const [name, count] of stuckBySeller.slice(0, 3)) {
    alerts.push({
      icon: <Clock className="w-4 h-4 text-amber-500 shrink-0" />,
      text: `${name} tem ${count} deal(s) parado(s) há mais de 3 dias`,
      severity: "yellow",
    });
  }

  if (alerts.length === 0) return null;

  return (
    <Card className="border-border/30 bg-card/80">
      <CardContent className="p-4 space-y-2">
        <div className="flex items-center gap-2 mb-1">
          <Flame className="w-4 h-4 text-orange-500" />
          <span className="text-xs font-bold uppercase tracking-wide text-foreground">Quem precisa de atenção</span>
        </div>
        {alerts.map((alert, i) => (
          <div key={i} className={`flex items-start gap-2.5 rounded-lg px-3 py-2 text-[11px] leading-relaxed ${
            alert.severity === "red" ? "bg-red-500/10 text-red-400" : "bg-amber-500/10 text-amber-400"
          }`}>
            {alert.icon}
            <span>{alert.text}</span>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

const TEAM_COLORS: Record<TeamFilter, string> = {
  all: "bg-primary text-primary-foreground",
  Swat: "bg-red-500/90 text-white",
  "The Closers": "bg-blue-500/90 text-white",
  Efraim: "bg-emerald-500/90 text-white",
};

function TeamTabs() {
  const { team, setTeam, teams } = useTeamFilter();
  return (
    <div className="flex gap-1.5 overflow-x-auto pb-1">
      {teams.map((t) => (
        <button
          key={t}
          onClick={() => setTeam(t)}
          className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
            team === t ? TEAM_COLORS[t] : "bg-muted/50 text-muted-foreground hover:bg-muted"
          }`}
        >
          {t === "all" ? "Geral" : t}
        </button>
      ))}
    </div>
  );
}

function DashboardContent() {
  const navigate = useNavigate();

  return (
    <div className="max-w-5xl mx-auto px-3 sm:px-4 py-4 sm:py-8 space-y-6">
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <HeartPulse className="w-5 h-5 sm:w-6 sm:h-6 text-red-500 shrink-0" />
            <h1 className="text-lg sm:text-2xl font-bold text-foreground tracking-tight">Dedo no Pulso</h1>
          </div>
          <p className="text-[11px] text-muted-foreground">Painel executivo comercial</p>
        </div>
      </div>

      <TeamTabs />

      <HealthSemaphore />

      <EliteMetrics />

      <TeamComparisonChart />

      <DailyPerformanceList />

      <ConversionTracker />

      <ConsolidatedMetrics />

      <div className="border-t border-border/30" />

      <PiperunSection />

      <div className="border-t border-border/30" />

      <HubSpotSection />

      <AdvancedAnalytics />

      <AttentionAlerts />
    </div>
  );
}

export default function HubSpotDashboard() {
  return (
    <TeamFilterProvider>
      <DashboardContent />
    </TeamFilterProvider>
  );
}
