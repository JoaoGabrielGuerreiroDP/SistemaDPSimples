import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Phone, FileText, Users2, MapPin, Globe, MessageSquare,
  Target, CheckCircle2, Clock, TrendingUp,
} from "lucide-react";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell,
  PieChart, Pie,
} from "recharts";
import type { SaleRow } from "@/hooks/useGoogleSheetsData";

const COLORS = ["hsl(var(--primary))", "#10b981", "#f59e0b", "#8b5cf6", "#f43f5e", "#06b6d4", "#ec4899"];

function formatCurrency(val: number) {
  if (!val) return "R$ 0";
  return val.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
}

function parseBRDate(raw: string): Date | null {
  if (!raw) return null;
  const parts = raw.split("/");
  if (parts.length !== 3) return null;
  const [day, month, year] = parts.map(Number);
  return new Date(year, month - 1, day);
}

interface WarRoomMicroProps {
  sellerName: string;
  sheetsRows: SaleRow[];
  activities: any[];
}

export function WarRoomMicro({ sellerName, sheetsRows, activities }: WarRoomMicroProps) {
  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  const sellerRows = useMemo(() =>
    sheetsRows.filter((r) => r.corretor?.trim().toLowerCase() === sellerName.toLowerCase()),
    [sheetsRows, sellerName]
  );

  const monthRows = useMemo(() =>
    sellerRows.filter((r) => {
      const d = parseBRDate(r.dataVenda);
      return d && d.getFullYear() === currentYear && d.getMonth() === currentMonth;
    }),
    [sellerRows]
  );

  // ── Contact Sources ──
  const sourceData = useMemo(() => {
    const map: Record<string, number> = {};
    monthRows.forEach((r) => {
      const src = r.origemVenda?.trim() || r.canalVenda?.trim() || "Direto";
      map[src] = (map[src] || 0) + 1;
    });
    return Object.entries(map)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 7);
  }, [monthRows]);

  // ── Pipeline by administradora ──
  const pipelineData = useMemo(() => {
    const stages: Record<string, { count: number; value: number }> = {};
    monthRows.forEach((r) => {
      const stage = r.administradora?.trim() || "Outros";
      if (!stages[stage]) stages[stage] = { count: 0, value: 0 };
      stages[stage].count++;
      stages[stage].value += r.valor;
    });
    return Object.entries(stages)
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.value - a.value);
  }, [monthRows]);

  // ── Daily/Weekly Goals ──
  const today = new Date(currentYear, now.getMonth(), now.getDate());
  const dayOfWeek = today.getDay();
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const weekStart = new Date(today);
  weekStart.setDate(today.getDate() + mondayOffset);

  const weekRows = useMemo(() =>
    sellerRows.filter((r) => {
      const d = parseBRDate(r.dataVenda);
      return d && d >= weekStart && d <= today;
    }),
    [sellerRows]
  );

  const todayRows = useMemo(() =>
    sellerRows.filter((r) => {
      const d = parseBRDate(r.dataVenda);
      return d && d.getFullYear() === today.getFullYear() && d.getMonth() === today.getMonth() && d.getDate() === today.getDate();
    }),
    [sellerRows]
  );

  // Goals (targets - can be tuned)
  const dailyGoal = 2;
  const weeklyGoal = 5;
  const monthlyGoal = 15;

  const todayCount = todayRows.length;
  const weekCount = weekRows.length;
  const monthCount = monthRows.length;

  // ── Activities today ──
  const todayActivities = useMemo(() => {
    const todayStr = today.toISOString().substring(0, 10);
    return activities.filter((a) => {
      const created = a.created_at?.substring(0, 10);
      return created === todayStr;
    });
  }, [activities]);

  const activityCounts = useMemo(() => {
    const done = todayActivities.filter((a) => a.status === 1).length;
    const pending = todayActivities.filter((a) => a.status === 0).length;
    const cancelled = todayActivities.filter((a) => a.status === 2).length;
    return { done, pending, cancelled, total: todayActivities.length };
  }, [todayActivities]);

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
        <Target className="w-4 h-4 text-amber-500" /> War Room — Visão Micro
      </h3>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Contact Sources */}
        <Card className="border-border/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs flex items-center gap-2">
              <Globe className="w-3.5 h-3.5" /> Fonte de Contatos
            </CardTitle>
          </CardHeader>
          <CardContent className="p-2">
            {sourceData.length > 0 ? (
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie
                    data={sourceData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={35}
                    outerRadius={70}
                    paddingAngle={3}
                    label={({ name, value }) => `${name}: ${value}`}
                  >
                    {sourceData.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-xs text-muted-foreground text-center py-8">Sem dados no mês</p>
            )}
          </CardContent>
        </Card>

        {/* Pipeline by stage/administradora */}
        <Card className="border-border/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs flex items-center gap-2">
              <TrendingUp className="w-3.5 h-3.5" /> Pipeline por Administradora
            </CardTitle>
          </CardHeader>
          <CardContent className="p-2">
            {pipelineData.length > 0 ? (
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={pipelineData} layout="vertical">
                  <XAxis type="number" tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }} width={80} />
                  <Tooltip formatter={(v: number) => formatCurrency(v)} />
                  <Bar dataKey="value" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-xs text-muted-foreground text-center py-8">Sem dados no mês</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Daily/Weekly Goals */}
      <Card className="border-border/30">
        <CardHeader className="pb-2">
          <CardTitle className="text-xs flex items-center gap-2">
            <CheckCircle2 className="w-3.5 h-3.5" /> Metas Diárias / Semanais
          </CardTitle>
        </CardHeader>
        <CardContent className="p-3 space-y-3">
          <GoalRow label="Hoje" current={todayCount} goal={dailyGoal} />
          <GoalRow label="Semana" current={weekCount} goal={weeklyGoal} />
          <GoalRow label="Mês" current={monthCount} goal={monthlyGoal} />
        </CardContent>
      </Card>

      {/* Activities today */}
      <Card className="border-border/30">
        <CardHeader className="pb-2">
          <CardTitle className="text-xs flex items-center gap-2">
            <Phone className="w-3.5 h-3.5" /> Atividades de Hoje
          </CardTitle>
        </CardHeader>
        <CardContent className="p-3">
          <div className="grid grid-cols-4 gap-2 text-center">
            <MiniStat label="Total" value={activityCounts.total} />
            <MiniStat label="Feitas" value={activityCounts.done} color="text-emerald-500" />
            <MiniStat label="Pendentes" value={activityCounts.pending} color="text-amber-500" />
            <MiniStat label="Canceladas" value={activityCounts.cancelled} color="text-rose-500" />
          </div>
          {todayActivities.length === 0 && (
            <p className="text-xs text-muted-foreground text-center mt-3">Sem atividades registradas hoje</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function GoalRow({ label, current, goal }: { label: string; current: number; goal: number }) {
  const pct = Math.min(Math.round((current / goal) * 100), 100);
  const hit = current >= goal;
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">{label}</span>
        <span className={`text-xs font-bold ${hit ? "text-emerald-500" : "text-foreground"}`}>
          {current}/{goal} {hit && "✓"}
        </span>
      </div>
      <Progress value={pct} className="h-2" />
    </div>
  );
}

function MiniStat({ label, value, color }: { label: string; value: number; color?: string }) {
  return (
    <div>
      <p className="text-[9px] text-muted-foreground uppercase">{label}</p>
      <p className={`text-lg font-bold ${color || "text-foreground"}`}>{value}</p>
    </div>
  );
}
