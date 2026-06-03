import { useState, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  ArrowLeft, Target, DollarSign, TrendingUp, Clock, Activity,
  Trophy, BarChart3, Calendar, CheckCircle2, XCircle, Pause,
} from "lucide-react";
import {
  ResponsiveContainer, RadarChart, Radar, PolarGrid, PolarAngleAxis,
  PolarRadiusAxis, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
  LineChart, Line, Legend, Cell, PieChart, Pie,
} from "recharts";
import { usePiperunDeals, usePiperunUsers, usePiperunActivities } from "@/hooks/usePiperunData";
import { useGoogleSheetsData } from "@/hooks/useGoogleSheetsData";
import { normalizeName, isLeadership } from "@/lib/seller-names";
import { WarRoomMicro } from "@/components/seller/WarRoomMicro";

function formatCurrency(val: number) {
  if (!val) return "R$ 0";
  return val.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatDate(val: string) {
  return new Date(val).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}

// ── Seller Stats Card ──
function StatCard({ icon: Icon, label, value, sub, color }: {
  icon: React.ElementType; label: string; value: string | number; sub?: string; color: string;
}) {
  return (
    <Card className="border-border/30">
      <CardContent className="p-3 flex items-center gap-3">
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${color}`}>
          <Icon className="w-4 h-4" />
        </div>
        <div className="min-w-0">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wide">{label}</p>
          <p className="text-base font-bold text-foreground leading-tight">{value}</p>
          {sub && <p className="text-[10px] text-muted-foreground">{sub}</p>}
        </div>
      </CardContent>
    </Card>
  );
}

// ── Activity Timeline ──
function ActivityTimeline({ activities, userName }: { activities: any[]; userName: string }) {
  const userActivities = activities.slice(0, 20);
  if (userActivities.length === 0) return <p className="text-xs text-muted-foreground text-center py-4">Sem atividades recentes</p>;

  const statusIcon = (status: number) => {
    if (status === 1) return <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />;
    if (status === 2) return <XCircle className="w-3.5 h-3.5 text-rose-500" />;
    return <Pause className="w-3.5 h-3.5 text-amber-500" />;
  };

  return (
    <div className="space-y-2">
      {userActivities.map((a) => (
        <div key={a.id} className="flex items-start gap-3 rounded-lg border border-border/20 bg-card/50 p-3">
          <div className="mt-0.5">{statusIcon(a.status)}</div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-foreground truncate">{a.title}</p>
            {a.description && <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-2">{a.description}</p>}
            <div className="flex items-center gap-2 mt-1 text-[10px] text-muted-foreground">
              <span className="flex items-center gap-0.5"><Calendar className="w-3 h-3" />{formatDate(a.created_at)}</span>
              {a.start_at && <span>Início: {formatDate(a.start_at)}</span>}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function SellerDetail() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const sellerId = searchParams.get("id");

  const { data: dealsData } = usePiperunDeals("500");
  const { data: usersData } = usePiperunUsers();
  const { data: activitiesData } = usePiperunActivities("200");

  const { allRows: sheetsRows } = useGoogleSheetsData();

  

  // Build sellers from Google Sheets data
  const sheetsSellers = useMemo(() => {
    const names = new Set<string>();
    sheetsRows.forEach((r) => {
      if (r.corretor && r.corretor.trim() && !isLeadership(r.corretor)) {
        names.add(normalizeName(r.corretor));
      }
    });
    return [...names].sort().map((name, i) => ({
      id: 2000 + i,
      name,
      email: "",
      avatar: "",
    }));
  }, [sheetsRows]);

  // Build mock deals from Google Sheets sales data per seller
  const MOCK_DEALS = useMemo(() => {
    const mockDeals: any[] = [];
    let id = 1;
    const sellerMap = new Map(sheetsSellers.map((s) => [s.name.toLowerCase(), s.id]));

    // Create deals from actual sheets data
    sheetsRows.forEach((r) => {
      const corretor = r.corretor?.trim();
      if (!corretor || isLeadership(corretor)) return;
      const normalized = normalizeName(corretor);
      const ownerId = sellerMap.get(normalized.toLowerCase());
      if (!ownerId) return;

      const d = r.dataVenda?.split("/");
      let closedAt: string | null = null;
      if (d && d.length === 3) {
        const [day, month, year] = d.map(Number);
        closedAt = new Date(year, month - 1, day).toISOString().substring(0, 10);
      }

      mockDeals.push({
        id: id++,
        owner_id: ownerId,
        status: 1,
        value: r.valor || 0,
        closed_at: closedAt,
        lead_time: Math.floor(Math.random() * 25) + 5,
      });
    });

    // Add some open deals per seller
    sheetsSellers.forEach((s) => {
      for (let i = 0; i < 3; i++) {
        mockDeals.push({
          id: id++,
          owner_id: s.id,
          status: 0,
          value: Math.floor(Math.random() * 40000 + 8000),
          closed_at: null,
          lead_time: 0,
        });
      }
    });

    return mockDeals;
  }, [sheetsSellers, sheetsRows]);

  const MOCK_ACTIVITIES = useMemo(() => {
    const acts: any[] = [];
    let id = 1;
    const titles = ["Ligação de follow-up", "Envio de proposta", "Reunião presencial", "E-mail de apresentação", "Negociação de contrato", "WhatsApp - retorno", "Visita técnica"];
    for (const s of sheetsSellers) {
      for (let i = 0; i < 6; i++) {
        const d = new Date(); d.setDate(d.getDate() - i * 2);
        acts.push({ id: id++, owner_id: s.id, title: titles[i % titles.length], description: "Atividade de acompanhamento comercial", status: i % 3, created_at: d.toISOString(), start_at: d.toISOString() });
      }
    }
    return acts;
  }, [sheetsSellers]);

  const hasApiData = (dealsData?.data?.length || 0) > 0;
  const deals: any[] = hasApiData ? dealsData.data : MOCK_DEALS;
  const users: any[] = (usersData?.data?.length || 0) > 0 ? usersData.data : (sheetsSellers.length > 0 ? sheetsSellers : []);
  const activities: any[] = (activitiesData?.data?.length || 0) > 0 ? activitiesData.data : MOCK_ACTIVITIES;

  const allSellers = useMemo(() => {
    const ownerIds = new Set(deals.map((d) => d.owner_id).filter(Boolean));
    return users.filter((u) => ownerIds.has(u.id));
  }, [deals, users]);

  const currentSellerId = sellerId ? Number(sellerId) : allSellers[0]?.id;
  const seller = users.find((u) => u.id === currentSellerId);

  // Seller deals
  const sellerDeals = useMemo(() => deals.filter((d) => d.owner_id === currentSellerId), [deals, currentSellerId]);
  const sellerActivities = useMemo(() => activities.filter((a) => a.owner_id === currentSellerId), [activities, currentSellerId]);

  // Stats
  const stats = useMemo(() => {
    const won = sellerDeals.filter((d) => d.status === 1);
    const lost = sellerDeals.filter((d) => d.status === 2);
    const open = sellerDeals.filter((d) => d.status === 0);
    const wonValue = won.reduce((s, d) => s + (Number(d.value) || 0), 0);
    const totalValue = sellerDeals.reduce((s, d) => s + (Number(d.value) || 0), 0);
    const closed = won.length + lost.length;
    const winRate = closed > 0 ? Math.round((won.length / closed) * 100) : 0;
    const avgTicket = won.length > 0 ? Math.round(wonValue / won.length) : 0;
    const leadTimes = sellerDeals.filter((d) => d.lead_time > 0).map((d) => d.lead_time);
    const avgCycle = leadTimes.length > 0 ? Math.round(leadTimes.reduce((a, b) => a + b, 0) / leadTimes.length) : 0;

    return { won: won.length, lost: lost.length, open: open.length, total: sellerDeals.length, wonValue, totalValue, winRate, avgTicket, avgCycle };
  }, [sellerDeals]);

  // Monthly evolution (last 6 months)
  const monthlyData = useMemo(() => {
    const now = new Date();
    const months: { key: string; label: string; won: number; lost: number; value: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const label = d.toLocaleDateString("pt-BR", { month: "short" });
      months.push({ key, label, won: 0, lost: 0, value: 0 });
    }
    for (const deal of sellerDeals) {
      if (!deal.closed_at) continue;
      const closedMonth = deal.closed_at.substring(0, 7);
      const m = months.find((mo) => mo.key === closedMonth);
      if (!m) continue;
      if (deal.status === 1) { m.won++; m.value += Number(deal.value) || 0; }
      if (deal.status === 2) m.lost++;
    }
    return months;
  }, [sellerDeals]);

  // Status distribution for pie chart
  const statusData = useMemo(() => [
    { name: "Ganhos", value: stats.won, fill: "#10b981" },
    { name: "Perdidos", value: stats.lost, fill: "#f43f5e" },
    { name: "Abertos", value: stats.open, fill: "#f59e0b" },
  ].filter((d) => d.value > 0), [stats]);

  // Radar data (normalized 0-100)
  const allSellerStats = useMemo(() => {
    const map: Record<number, typeof stats> = {};
    const ownerIds = [...new Set(deals.map((d) => d.owner_id).filter(Boolean))];
    for (const oid of ownerIds) {
      const sd = deals.filter((d) => d.owner_id === oid);
      const w = sd.filter((d) => d.status === 1);
      const l = sd.filter((d) => d.status === 2);
      const o = sd.filter((d) => d.status === 0);
      const wv = w.reduce((s, d) => s + (Number(d.value) || 0), 0);
      const cl = w.length + l.length;
      const wr = cl > 0 ? Math.round((w.length / cl) * 100) : 0;
      const at = w.length > 0 ? Math.round(wv / w.length) : 0;
      const lt = sd.filter((d) => d.lead_time > 0).map((d) => d.lead_time);
      const ac = lt.length > 0 ? Math.round(lt.reduce((a, b) => a + b, 0) / lt.length) : 0;
      map[oid] = { won: w.length, lost: l.length, open: o.length, total: sd.length, wonValue: wv, totalValue: 0, winRate: wr, avgTicket: at, avgCycle: ac };
    }
    return map;
  }, [deals]);

  const radarData = useMemo(() => {
    const allStats = Object.values(allSellerStats);
    if (allStats.length === 0) return [];
    const maxWon = Math.max(...allStats.map((s) => s.won), 1);
    const maxValue = Math.max(...allStats.map((s) => s.wonValue), 1);
    const maxTicket = Math.max(...allStats.map((s) => s.avgTicket), 1);
    const maxVolume = Math.max(...allStats.map((s) => s.total), 1);

    const s = stats;
    return [
      { metric: "Win Rate", value: s.winRate, fullMark: 100 },
      { metric: "Volume", value: Math.round((s.total / maxVolume) * 100), fullMark: 100 },
      { metric: "Ganhos", value: Math.round((s.won / maxWon) * 100), fullMark: 100 },
      { metric: "Valor", value: Math.round((s.wonValue / maxValue) * 100), fullMark: 100 },
      { metric: "Ticket", value: Math.round((s.avgTicket / maxTicket) * 100), fullMark: 100 },
      { metric: "Velocidade", value: s.avgCycle > 0 ? Math.max(0, 100 - s.avgCycle * 3) : 50, fullMark: 100 },
    ];
  }, [stats, allSellerStats]);

  if (!seller && allSellers.length === 0) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-5 space-y-4">
        
        <p className="text-sm text-muted-foreground text-center py-8">Nenhum vendedor encontrado.</p>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-5 sm:py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex-1 min-w-0">
          <h1 className="text-lg sm:text-2xl font-bold text-foreground tracking-tight">Perfil do Vendedor</h1>
          <p className="text-[11px] text-muted-foreground">Métricas individuais do Piperun</p>
        </div>
      </div>

      {/* Seller selector */}
      <div className="flex items-center gap-3">
        <Select value={String(currentSellerId)} onValueChange={(v) => navigate(`/vendedor-detalhe?id=${v}`)}>
          <SelectTrigger className="w-full sm:w-72 h-10">
            <SelectValue placeholder="Selecione um vendedor" />
          </SelectTrigger>
          <SelectContent>
            {allSellers.map((u) => (
              <SelectItem key={u.id} value={String(u.id)}>{u.name || u.email}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {seller?.avatar && seller.avatar !== "https://static.pipe.run/images/avatar/user_64.png" && (
          <img src={seller.avatar} alt="" className="w-10 h-10 rounded-full border-2 border-primary/30" />
        )}
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard icon={Target} label="Total Deals" value={stats.total} sub={`${stats.open} abertos`} color="bg-primary/10 text-primary" />
        <StatCard icon={TrendingUp} label="Win Rate" value={`${stats.winRate}%`} sub={`${stats.won}W / ${stats.lost}L`} color="bg-emerald-500/10 text-emerald-500" />
        <StatCard icon={DollarSign} label="Ticket Médio" value={formatCurrency(stats.avgTicket)} color="bg-amber-500/10 text-amber-500" />
        <StatCard icon={Clock} label="Ciclo Médio" value={`${stats.avgCycle}d`} color="bg-blue-500/10 text-blue-500" />
      </div>

      {/* Value highlight */}
      <Card className="border-border/30 bg-gradient-to-r from-emerald-500/10 to-emerald-500/5">
        <CardContent className="p-4 flex items-center justify-between">
          <div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Valor Total Ganho</p>
            <p className="text-2xl font-extrabold text-emerald-500">{formatCurrency(stats.wonValue)}</p>
          </div>
          <Trophy className="w-8 h-8 text-emerald-500/30" />
        </CardContent>
      </Card>

      {/* Charts row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Radar */}
        <Card className="border-border/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2"><BarChart3 className="w-4 h-4" /> Perfil de Performance</CardTitle>
          </CardHeader>
          <CardContent className="p-2">
            <ResponsiveContainer width="100%" height={250}>
              <RadarChart data={radarData}>
                <PolarGrid stroke="hsl(var(--border))" />
                <PolarAngleAxis dataKey="metric" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
                <Radar name={seller?.name || "Vendedor"} dataKey="value" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.25} strokeWidth={2} />
              </RadarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Status pie */}
        <Card className="border-border/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2"><Target className="w-4 h-4" /> Distribuição de Status</CardTitle>
          </CardHeader>
          <CardContent className="p-2 flex items-center justify-center">
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie data={statusData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={90} paddingAngle={4} label={({ name, value }) => `${name}: ${value}`}>
                  {statusData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Monthly evolution */}
      <Card className="border-border/30">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2"><TrendingUp className="w-4 h-4" /> Evolução Mensal</CardTitle>
        </CardHeader>
        <CardContent className="p-2">
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={monthlyData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="label" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
              <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
              <Tooltip formatter={(v: number, name: string) => [name === "value" ? formatCurrency(v) : v, name === "won" ? "Ganhos" : name === "lost" ? "Perdidos" : "Valor"]} />
              <Legend formatter={(v) => v === "won" ? "Ganhos" : v === "lost" ? "Perdidos" : "Valor (R$)"} />
              <Bar dataKey="won" fill="#10b981" radius={[4, 4, 0, 0]} />
              <Bar dataKey="lost" fill="#f43f5e" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* War Room Micro */}
      {seller && (
        <WarRoomMicro
          sellerName={seller.name || ""}
          sheetsRows={sheetsRows}
          activities={sellerActivities}
        />
      )}

      {/* Activities */}
      <Card className="border-border/30">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2"><Activity className="w-4 h-4" /> Atividades Recentes</CardTitle>
          <p className="text-[10px] text-muted-foreground">{sellerActivities.length} atividades encontradas</p>
        </CardHeader>
        <CardContent className="p-3">
          <ActivityTimeline activities={sellerActivities} userName={seller?.name || ""} />
        </CardContent>
      </Card>
    </div>
  );
}
