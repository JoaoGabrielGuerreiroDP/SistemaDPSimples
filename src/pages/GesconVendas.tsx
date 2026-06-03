import { useGesconVendas, GesconVenda } from "@/hooks/useGesconVendas";
import { SellerScoreTab, useSellerScores } from "@/components/admin/SellerScoreCard";
import { ConversionFunnel } from "@/components/admin/ConversionFunnel";
import { SeasonalityTab } from "@/components/admin/SeasonalityTab";
import { CommissionProjection } from "@/components/admin/CommissionProjection";
import { CancellationAlerts } from "@/components/admin/CancellationAlerts";
import { GesconAISummary } from "@/components/admin/GesconAISummary";
import { GesconGoalsTab } from "@/components/admin/GesconGoalsTab";
import { GesconRecordsPanel } from "@/components/admin/GesconRecordsPanel";
import { GesconMonthCompare } from "@/components/admin/GesconMonthCompare";
import { GesconExportPDF } from "@/components/admin/GesconExportPDF";
import { useGesconAlerts } from "@/hooks/useGesconAlerts";
import { useMemo, useState } from "react";
import { format, subMonths, differenceInYears, parse, startOfYear, getDay, addMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Loader2, CalendarIcon, X, ShoppingCart, DollarSign, Users, MapPin, TrendingUp, Clock, Target, Award, BarChart3, PieChart, Filter, Wallet, UserCheck, Globe, Activity, Star, ArrowDownUp, CalendarDays, Banknote, AlertTriangle, Sparkles, Trophy } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, PieChart as RechartsPie, Pie, Cell, AreaChart, Area,
  Legend, RadialBarChart, RadialBar,
} from "recharts";

const COLORS = [
  "hsl(var(--primary))", "#10b981", "#f59e0b", "#8b5cf6", "#ef4444",
  "#06b6d4", "#ec4899", "#84cc16", "#f97316", "#6366f1",
  "#14b8a6", "#e11d48", "#0ea5e9", "#a855f7", "#eab308",
];

const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const fmtNum = (v: number) => v.toLocaleString("pt-BR");

function StatsCard({ title, value, subtitle, icon, color }: { title: string; value: string | number; subtitle?: string; icon: React.ReactNode; color: string }) {
  return (
    <Card className="relative overflow-hidden">
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="space-y-1 min-w-0 flex-1">
            <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">{title}</p>
            <p className="text-xl font-bold truncate">{value}</p>
            {subtitle && <p className="text-[10px] text-muted-foreground">{subtitle}</p>}
          </div>
          <div className={cn("rounded-full p-2.5 shrink-0", color)}>
            {icon}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ChartCard({ title, children, className }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <Card className={className}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold">{title}</CardTitle>
      </CardHeader>
      <CardContent className="pt-0">{children}</CardContent>
    </Card>
  );
}

function parseCredito(v: string) { return parseFloat(v) || 0; }

function calcAge(dataNasc: string | null): number | null {
  if (!dataNasc) return null;
  try {
    // Try both dd-MM-yyyy and dd/MM/yyyy formats
    const sep = dataNasc.includes("/") ? "/" : "-";
    const d = parse(dataNasc, `dd${sep}MM${sep}yyyy`, new Date());
    if (isNaN(d.getTime())) return null;
    return differenceInYears(new Date(), d);
  } catch { return null; }
}

const WEEKDAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

export default function GesconVendas() {
  const [selectedSeller, setSelectedSeller] = useState<string>("all");
  const [selectedAdmin, setSelectedAdmin] = useState<string>("all");
  const [selectedCity, setSelectedCity] = useState<string>("all");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [selectedGender, setSelectedGender] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState<Date | undefined>(startOfYear(new Date()));
  const [dateTo, setDateTo] = useState<Date | undefined>(new Date());

  const { data: vendas, isLoading, error } = useGesconVendas(dateFrom, dateTo);

  // Auto-check GESCON alerts (goals hit, inactivity)
  useGesconAlerts(vendas);

  // Filter options
  const sellers = useMemo(() => {
    if (!vendas) return [];
    return Array.from(new Set(vendas.map(v => v.vendedor).filter(Boolean))).sort();
  }, [vendas]);

  const admins = useMemo(() => {
    if (!vendas) return [];
    return Array.from(new Set(vendas.map(v => v.administradora).filter(Boolean))).sort();
  }, [vendas]);

  const cities = useMemo(() => {
    if (!vendas) return [];
    return Array.from(new Set(vendas.map(v => v.cidade).filter(Boolean) as string[])).sort();
  }, [vendas]);

  const statuses = useMemo(() => {
    if (!vendas) return [];
    return Array.from(new Set(vendas.map(v => v.situacao).filter(Boolean))).sort();
  }, [vendas]);

  // Apply filters
  const filtered = useMemo(() => {
    if (!vendas) return [];
    return vendas.filter(v => {
      if (selectedSeller !== "all" && v.vendedor !== selectedSeller) return false;
      if (selectedAdmin !== "all" && v.administradora !== selectedAdmin) return false;
      if (selectedCity !== "all" && v.cidade !== selectedCity) return false;
      if (selectedStatus !== "all" && v.situacao !== selectedStatus) return false;
      if (selectedGender !== "all" && v.genero !== selectedGender) return false;
      return true;
    });
  }, [vendas, selectedSeller, selectedAdmin, selectedCity, selectedStatus, selectedGender]);

  // ====== STATS ======
  const stats = useMemo(() => {
    const total = filtered.length;
    const totalCredito = filtered.reduce((s, v) => s + parseCredito(v.credito), 0);
    const ticket = total > 0 ? totalCredito / total : 0;
    const sellersSet = new Set(filtered.map(v => v.vendedor));
    const citiesSet = new Set(filtered.filter(v => v.cidade).map(v => v.cidade));
    const confirmadas = filtered.filter(v => v.situacao === "Confirmada").length;
    const taxaConf = total > 0 ? (confirmadas / total) * 100 : 0;
    return { total, totalCredito, ticket, sellers: sellersSet.size, cities: citiesSet.size, confirmadas, taxaConf };
  }, [filtered]);

  // ====== RANKING DE VENDEDORES ======
  const sellerRanking = useMemo(() => {
    const map = new Map<string, { qtd: number; credito: number }>();
    for (const v of filtered) {
      const cur = map.get(v.vendedor) || { qtd: 0, credito: 0 };
      cur.qtd++;
      cur.credito += parseCredito(v.credito);
      map.set(v.vendedor, cur);
    }
    return Array.from(map.entries())
      .map(([name, d]) => ({ name, ...d, ticket: d.qtd > 0 ? d.credito / d.qtd : 0 }))
      .sort((a, b) => b.credito - a.credito);
  }, [filtered]);

  // ====== VENDAS POR DIA ======
  const dailySales = useMemo(() => {
    const map = new Map<string, { date: string; qtd: number; credito: number }>();
    for (const v of filtered) {
      const d = v.data_venda;
      const cur = map.get(d) || { date: d, qtd: 0, credito: 0 };
      cur.qtd++;
      cur.credito += parseCredito(v.credito);
      map.set(d, cur);
    }
    return Array.from(map.values()).sort((a, b) => {
      const da = a.date.split(/[\/-]/).reverse().join("");
      const db = b.date.split(/[\/-]/).reverse().join("");
      return da.localeCompare(db);
    });
  }, [filtered]);

  // ====== ACUMULADO DIÁRIO ======
  const cumulativeSales = useMemo(() => {
    let acc = 0;
    let accCredito = 0;
    return dailySales.map(d => {
      acc += d.qtd;
      accCredito += d.credito;
      return { ...d, acumulado: acc, creditoAcum: accCredito };
    });
  }, [dailySales]);

  // ====== POR ADMINISTRADORA ======
  const byAdmin = useMemo(() => {
    const map = new Map<string, { name: string; qtd: number; credito: number }>();
    for (const v of filtered) {
      const cur = map.get(v.administradora) || { name: v.administradora, qtd: 0, credito: 0 };
      cur.qtd++;
      cur.credito += parseCredito(v.credito);
      map.set(v.administradora, cur);
    }
    return Array.from(map.values()).sort((a, b) => b.credito - a.credito);
  }, [filtered]);

  // ====== POR CIDADE ======
  const byCity = useMemo(() => {
    const map = new Map<string, { name: string; qtd: number; credito: number }>();
    for (const v of filtered) {
      const city = v.cidade || "Não informado";
      const cur = map.get(city) || { name: city, qtd: 0, credito: 0 };
      cur.qtd++;
      cur.credito += parseCredito(v.credito);
      map.set(city, cur);
    }
    return Array.from(map.values()).sort((a, b) => b.qtd - a.qtd).slice(0, 15);
  }, [filtered]);

  // ====== POR REGIÃO ======
  const byRegion = useMemo(() => {
    const map = new Map<string, { name: string; qtd: number; credito: number }>();
    for (const v of filtered) {
      const region = v.regiao || "Não informado";
      const cur = map.get(region) || { name: region, qtd: 0, credito: 0 };
      cur.qtd++;
      cur.credito += parseCredito(v.credito);
      map.set(region, cur);
    }
    return Array.from(map.values()).sort((a, b) => b.qtd - a.qtd);
  }, [filtered]);

  // ====== POR SITUAÇÃO ======
  const bySituacao = useMemo(() => {
    const map = new Map<string, number>();
    for (const v of filtered) {
      map.set(v.situacao, (map.get(v.situacao) || 0) + 1);
    }
    return Array.from(map.entries()).map(([name, value]) => ({ name, value }));
  }, [filtered]);

  // ====== POR GÊNERO ======
  const byGender = useMemo(() => {
    const map = new Map<string, number>();
    for (const v of filtered) {
      const g = v.genero || "Não informado";
      map.set(g, (map.get(g) || 0) + 1);
    }
    return Array.from(map.entries()).map(([name, value]) => ({ name, value }));
  }, [filtered]);

  // ====== POR PROFISSÃO ======
  const byProfession = useMemo(() => {
    const map = new Map<string, { name: string; qtd: number; credito: number }>();
    for (const v of filtered) {
      const p = v.profissao || "Não informado";
      const cur = map.get(p) || { name: p, qtd: 0, credito: 0 };
      cur.qtd++;
      cur.credito += parseCredito(v.credito);
      map.set(p, cur);
    }
    return Array.from(map.values()).sort((a, b) => b.qtd - a.qtd).slice(0, 15);
  }, [filtered]);

  // ====== FAIXA ETÁRIA ======
  const byAge = useMemo(() => {
    const buckets: Record<string, number> = { "18-25": 0, "26-35": 0, "36-45": 0, "46-55": 0, "56-65": 0, "65+": 0, "N/I": 0 };
    for (const v of filtered) {
      const age = calcAge(v.data_nascimento);
      if (age === null) { buckets["N/I"]++; continue; }
      if (age <= 25) buckets["18-25"]++;
      else if (age <= 35) buckets["26-35"]++;
      else if (age <= 45) buckets["36-45"]++;
      else if (age <= 55) buckets["46-55"]++;
      else if (age <= 65) buckets["56-65"]++;
      else buckets["65+"]++;
    }
    return Object.entries(buckets).filter(([, v]) => v > 0).map(([name, value]) => ({ name, value }));
  }, [filtered]);

  // ====== FAIXA DE CRÉDITO ======
  const byCreditRange = useMemo(() => {
    const buckets: Record<string, number> = {
      "Até 50k": 0, "50-100k": 0, "100-200k": 0, "200-500k": 0, "500k+": 0,
    };
    for (const v of filtered) {
      const c = parseCredito(v.credito);
      if (c <= 50000) buckets["Até 50k"]++;
      else if (c <= 100000) buckets["50-100k"]++;
      else if (c <= 200000) buckets["100-200k"]++;
      else if (c <= 500000) buckets["200-500k"]++;
      else buckets["500k+"]++;
    }
    return Object.entries(buckets).map(([name, value]) => ({ name, value }));
  }, [filtered]);

  // ====== POR DIA DA SEMANA ======
  const byWeekday = useMemo(() => {
    const counts = [0, 0, 0, 0, 0, 0, 0];
    for (const v of filtered) {
      try {
        const parts = v.data_venda.split(/[/-]/);
        const d = new Date(+parts[2], +parts[1] - 1, +parts[0]);
        counts[getDay(d)]++;
      } catch { }
    }
    return WEEKDAYS.map((name, i) => ({ name, vendas: counts[i] }));
  }, [filtered]);

  // ====== POR ORIGEM ======
  const byOrigem = useMemo(() => {
    const map = new Map<string, number>();
    for (const v of filtered) {
      const o = v.origem || "Não informado";
      map.set(o, (map.get(o) || 0) + 1);
    }
    return Array.from(map.entries()).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [filtered]);

  // ====== POR MÊS ======
  const byMonth = useMemo(() => {
    const map = new Map<string, { mes: string; qtd: number; credito: number }>();
    for (const v of filtered) {
      try {
        const parts = v.data_venda.split(/[/-]/);
        const key = `${parts[1]}/${parts[2]}`;
        const cur = map.get(key) || { mes: key, qtd: 0, credito: 0 };
        cur.qtd++;
        cur.credito += parseCredito(v.credito);
        map.set(key, cur);
      } catch { }
    }
    return Array.from(map.values()).sort((a, b) => {
      const [ma, ya] = a.mes.split("/");
      const [mb, yb] = b.mes.split("/");
      return (ya + ma).localeCompare(yb + mb);
    });
  }, [filtered]);

  // ====== TEMPO DE FECHAMENTO ======
  const tempoFechamento = useMemo(() => {
    const tempos: number[] = [];
    for (const v of filtered) {
      if (v.tempo_fechamento) {
        const n = parseInt(v.tempo_fechamento);
        if (!isNaN(n)) tempos.push(n);
      }
    }
    if (tempos.length === 0) return null;
    const avg = tempos.reduce((s, t) => s + t, 0) / tempos.length;
    const min = Math.min(...tempos);
    const max = Math.max(...tempos);
    return { avg: Math.round(avg), min, max, total: tempos.length };
  }, [filtered]);

  // ====== TEMPO MÉDIO POR VENDEDOR ======
  const tempoByVendedor = useMemo(() => {
    const map = new Map<string, number[]>();
    for (const v of filtered) {
      if (v.tempo_fechamento) {
        const n = parseInt(v.tempo_fechamento);
        if (!isNaN(n)) {
          const arr = map.get(v.vendedor) || [];
          arr.push(n);
          map.set(v.vendedor, arr);
        }
      }
    }
    return Array.from(map.entries())
      .map(([name, tempos]) => ({ name, media: Math.round(tempos.reduce((s, t) => s + t, 0) / tempos.length) }))
      .sort((a, b) => a.media - b.media);
  }, [filtered]);

  // ====== FAIXA DE RENDA ======
  const byIncome = useMemo(() => {
    const buckets: Record<string, number> = {
      "Até 3k": 0, "3-5k": 0, "5-10k": 0, "10-20k": 0, "20k+": 0, "N/I": 0,
    };
    for (const v of filtered) {
      if (!v.renda_cliente) { buckets["N/I"]++; continue; }
      const r = parseFloat(v.renda_cliente.replace(/[^\d.,]/g, "").replace(",", ".")) || 0;
      if (r === 0) buckets["N/I"]++;
      else if (r <= 3000) buckets["Até 3k"]++;
      else if (r <= 5000) buckets["3-5k"]++;
      else if (r <= 10000) buckets["5-10k"]++;
      else if (r <= 20000) buckets["10-20k"]++;
      else buckets["20k+"]++;
    }
    return Object.entries(buckets).filter(([, v]) => v > 0).map(([name, value]) => ({ name, value }));
  }, [filtered]);

  // ====== MOTIVO CONSÓRCIO ======
  const byMotivo = useMemo(() => {
    const map = new Map<string, number>();
    for (const v of filtered) {
      const m = v.motivo_consorcio || "Não informado";
      map.set(m, (map.get(m) || 0) + 1);
    }
    return Array.from(map.entries()).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 10);
  }, [filtered]);

  // ====== COMISSÃO ======
  const COMMISSION_RULES: Record<string, { pct: number; parcelas: number; label: string }> = {
    "Magazine Luiza": { pct: 0.025, parcelas: 10, label: "Magalu" },
    "Magalu": { pct: 0.025, parcelas: 10, label: "Magalu" },
    "Âncora": { pct: 0.05, parcelas: 16, label: "Âncora" },
    "Ancora": { pct: 0.05, parcelas: 16, label: "Âncora" },
    "Canopus": { pct: 0.04, parcelas: 6, label: "Canopus" },
    "HS Consórcios": { pct: 0.02, parcelas: 1, label: "HS" },
    "HS": { pct: 0.02, parcelas: 1, label: "HS" },
  };

  function getCommissionRule(admin: string) {
    for (const [key, rule] of Object.entries(COMMISSION_RULES)) {
      if (admin.toLowerCase().includes(key.toLowerCase())) return rule;
    }
    return { pct: 0.025, parcelas: 10, label: admin }; // fallback
  }

  const commissionData = useMemo(() => {
    const totalComissao = filtered.reduce((sum, v) => {
      const rule = getCommissionRule(v.administradora);
      return sum + parseCredito(v.credito) * rule.pct;
    }, 0);

    // By admin
    const byAdminComm = new Map<string, { name: string; credito: number; comissao: number; parcelas: number; parcelaMensal: number; qtd: number }>();
    for (const v of filtered) {
      const rule = getCommissionRule(v.administradora);
      const key = rule.label;
      const cur = byAdminComm.get(key) || { name: key, credito: 0, comissao: 0, parcelas: rule.parcelas, parcelaMensal: 0, qtd: 0 };
      const cred = parseCredito(v.credito);
      cur.credito += cred;
      cur.comissao += cred * rule.pct;
      cur.qtd++;
      byAdminComm.set(key, cur);
    }
    const adminList = Array.from(byAdminComm.values()).map(a => ({
      ...a,
      parcelaMensal: a.parcelas > 0 ? a.comissao / a.parcelas : a.comissao,
    })).sort((a, b) => b.comissao - a.comissao);

    // By seller
    const bySellerComm = new Map<string, { name: string; credito: number; comissao: number }>();
    for (const v of filtered) {
      const rule = getCommissionRule(v.administradora);
      const cur = bySellerComm.get(v.vendedor) || { name: v.vendedor, credito: 0, comissao: 0 };
      const cred = parseCredito(v.credito);
      cur.credito += cred;
      cur.comissao += cred * rule.pct;
      bySellerComm.set(v.vendedor, cur);
    }
    const sellerList = Array.from(bySellerComm.values()).sort((a, b) => b.comissao - a.comissao);

    // Monthly cashflow projection (when each installment arrives)
    const cashflow = new Map<string, number>();
    for (const v of filtered) {
      const rule = getCommissionRule(v.administradora);
      const cred = parseCredito(v.credito);
      const totalComm = cred * rule.pct;
      const parcelaVal = rule.parcelas > 0 ? totalComm / rule.parcelas : totalComm;
      try {
        const parts = v.data_venda.split(/[/-]/);
        const saleDate = new Date(+parts[2], +parts[1] - 1, +parts[0]);
        for (let i = 0; i < rule.parcelas; i++) {
          const payDate = addMonths(saleDate, i + 1);
          const key = format(payDate, "MM/yyyy");
          cashflow.set(key, (cashflow.get(key) || 0) + parcelaVal);
        }
      } catch { }
    }
    const cashflowList = Array.from(cashflow.entries())
      .map(([mes, valor]) => ({ mes, valor }))
      .sort((a, b) => {
        const [ma, ya] = a.mes.split("/");
        const [mb, yb] = b.mes.split("/");
        return (ya + ma).localeCompare(yb + mb);
      });

    // By month (commission earned in sale month)
    const byMonthComm = new Map<string, { mes: string; comissao: number }>();
    for (const v of filtered) {
      try {
        const parts = v.data_venda.split(/[/-]/);
        const key = `${parts[1]}/${parts[2]}`;
        const rule = getCommissionRule(v.administradora);
        const cur = byMonthComm.get(key) || { mes: key, comissao: 0 };
        cur.comissao += parseCredito(v.credito) * rule.pct;
        byMonthComm.set(key, cur);
      } catch { }
    }
    const monthList = Array.from(byMonthComm.values()).sort((a, b) => {
      const [ma, ya] = a.mes.split("/");
      const [mb, yb] = b.mes.split("/");
      return (ya + ma).localeCompare(yb + mb);
    });

    return { totalComissao, adminList, sellerList, cashflowList, monthList };
  }, [filtered]);

  // ====== CROSS-ANALYSIS: Demográfico ======
  const genderStats = useMemo(() => {
    const map = new Map<string, { label: string; qtd: number; credito: number }>();
    for (const v of filtered) {
      const g = v.genero === "M" ? "Masculino" : v.genero === "F" ? "Feminino" : "Não informado";
      const cur = map.get(g) || { label: g, qtd: 0, credito: 0 };
      cur.qtd++;
      cur.credito += parseCredito(v.credito);
      map.set(g, cur);
    }
    return Array.from(map.values()).map(g => ({ ...g, ticket: g.qtd > 0 ? g.credito / g.qtd : 0 })).sort((a, b) => b.credito - a.credito);
  }, [filtered]);

  const genderByAdmin = useMemo(() => {
    const map = new Map<string, { admin: string; M: number; F: number; NI: number }>();
    for (const v of filtered) {
      const rule = getCommissionRule(v.administradora);
      const cur = map.get(rule.label) || { admin: rule.label, M: 0, F: 0, NI: 0 };
      if (v.genero === "M") cur.M++;
      else if (v.genero === "F") cur.F++;
      else cur.NI++;
      map.set(rule.label, cur);
    }
    return Array.from(map.values());
  }, [filtered]);

  const originStats = useMemo(() => {
    const map = new Map<string, { name: string; qtd: number; credito: number }>();
    for (const v of filtered) {
      const o = v.origem || "Não informado";
      const cur = map.get(o) || { name: o, qtd: 0, credito: 0 };
      cur.qtd++;
      cur.credito += parseCredito(v.credito);
      map.set(o, cur);
    }
    return Array.from(map.values()).map(o => ({ ...o, ticket: o.qtd > 0 ? o.credito / o.qtd : 0 })).sort((a, b) => b.credito - a.credito);
  }, [filtered]);

  const statusStats = useMemo(() => {
    const map = new Map<string, { name: string; qtd: number; credito: number }>();
    for (const v of filtered) {
      const cur = map.get(v.situacao) || { name: v.situacao, qtd: 0, credito: 0 };
      cur.qtd++;
      cur.credito += parseCredito(v.credito);
      map.set(v.situacao, cur);
    }
    return Array.from(map.values()).map(s => ({ ...s, pct: stats.total > 0 ? (s.qtd / stats.total) * 100 : 0 })).sort((a, b) => b.qtd - a.qtd);
  }, [filtered, stats.total]);

  const avgAgeByVendedor = useMemo(() => {
    const map = new Map<string, number[]>();
    for (const v of filtered) {
      const age = calcAge(v.data_nascimento);
      if (age !== null && age > 0 && age < 120) {
        const arr = map.get(v.vendedor) || [];
        arr.push(age);
        map.set(v.vendedor, arr);
      }
    }
    return Array.from(map.entries())
      .map(([name, ages]) => ({ name, idadeMedia: Math.round(ages.reduce((s, a) => s + a, 0) / ages.length) }))
      .sort((a, b) => a.idadeMedia - b.idadeMedia);
  }, [filtered]);

  const cityTicket = useMemo(() => {
    const map = new Map<string, { name: string; qtd: number; credito: number }>();
    for (const v of filtered) {
      const city = v.cidade || "Não informado";
      const cur = map.get(city) || { name: city, qtd: 0, credito: 0 };
      cur.qtd++;
      cur.credito += parseCredito(v.credito);
      map.set(city, cur);
    }
    return Array.from(map.values())
      .filter(c => c.qtd >= 2)
      .map(c => ({ ...c, ticket: c.credito / c.qtd }))
      .sort((a, b) => b.ticket - a.ticket)
      .slice(0, 15);
  }, [filtered]);

  const ageByCredito = useMemo(() => {
    const buckets: Record<string, { faixa: string; credito: number; qtd: number }> = {
      "18-25": { faixa: "18-25", credito: 0, qtd: 0 },
      "26-35": { faixa: "26-35", credito: 0, qtd: 0 },
      "36-45": { faixa: "36-45", credito: 0, qtd: 0 },
      "46-55": { faixa: "46-55", credito: 0, qtd: 0 },
      "56-65": { faixa: "56-65", credito: 0, qtd: 0 },
      "65+": { faixa: "65+", credito: 0, qtd: 0 },
    };
    for (const v of filtered) {
      const age = calcAge(v.data_nascimento);
      if (age === null) continue;
      let key = "";
      if (age <= 25) key = "18-25";
      else if (age <= 35) key = "26-35";
      else if (age <= 45) key = "36-45";
      else if (age <= 55) key = "46-55";
      else if (age <= 65) key = "56-65";
      else key = "65+";
      buckets[key].credito += parseCredito(v.credito);
      buckets[key].qtd++;
    }
    return Object.values(buckets).filter(b => b.qtd > 0).map(b => ({ ...b, ticket: b.credito / b.qtd }));
  }, [filtered]);

  const originByMonth = useMemo(() => {
    const origins = new Set<string>();
    const map = new Map<string, Record<string, number>>();
    for (const v of filtered) {
      const o = v.origem || "Não informado";
      origins.add(o);
      try {
        const parts = v.data_venda.split(/[/-]/);
        const key = `${parts[1]}/${parts[2]}`;
        const cur = map.get(key) || {};
        cur[o] = (cur[o] || 0) + 1;
        map.set(key, cur);
      } catch { }
    }
    const sorted = Array.from(map.entries())
      .map(([mes, data]) => ({ mes, ...data }))
      .sort((a, b) => {
        const [ma, ya] = a.mes.split("/");
        const [mb, yb] = b.mes.split("/");
        return (ya + ma).localeCompare(yb + mb);
      });
    return { data: sorted, origins: Array.from(origins) };
  }, [filtered]);

  // ====== SELLER SCORES ======
  const sellerScores = useSellerScores(filtered as any);

  const hasActiveFilters = selectedSeller !== "all" || selectedAdmin !== "all" || selectedCity !== "all" || selectedStatus !== "all" || selectedGender !== "all";
  const clearFilters = () => { setSelectedSeller("all"); setSelectedAdmin("all"); setSelectedCity("all"); setSelectedStatus("all"); setSelectedGender("all"); };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    return (
      <div className="bg-popover border rounded-lg shadow-lg p-3 text-xs">
        <p className="font-medium mb-1">{label}</p>
        {payload.map((p: any, i: number) => (
          <p key={i} style={{ color: p.color }}>
            {p.name}: {typeof p.value === "number" && p.value > 1000 ? fmt(p.value) : fmtNum(p.value)}
          </p>
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <ShoppingCart className="h-5 w-5 text-primary" />
          <h1 className="text-xl font-bold">GESCON — Indicadores Completos</h1>
        </div>
        {!isLoading && filtered.length > 0 && (
          <GesconExportPDF
            stats={stats}
            sellerRanking={sellerRanking}
            byAdmin={byAdmin}
            byMonth={byMonth}
            dateFrom={dateFrom}
            dateTo={dateTo}
          />
        )}
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-4 pb-3">
          <div className="flex items-center gap-1.5 mb-2">
            <Filter className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-xs font-medium text-muted-foreground">Filtros</span>
          </div>
          <div className="flex flex-wrap items-end gap-2">
            <div className="space-y-1">
              <label className="text-[10px] font-medium text-muted-foreground">De</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-[130px] h-8 justify-start text-left font-normal text-xs", !dateFrom && "text-muted-foreground")}>
                    <CalendarIcon className="mr-1.5 h-3 w-3" />
                    {dateFrom ? format(dateFrom, "dd/MM/yyyy") : "Início"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={dateFrom} onSelect={setDateFrom} locale={ptBR} initialFocus className="p-3 pointer-events-auto" />
                </PopoverContent>
              </Popover>
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-medium text-muted-foreground">Até</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-[130px] h-8 justify-start text-left font-normal text-xs", !dateTo && "text-muted-foreground")}>
                    <CalendarIcon className="mr-1.5 h-3 w-3" />
                    {dateTo ? format(dateTo, "dd/MM/yyyy") : "Fim"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={dateTo} onSelect={setDateTo} locale={ptBR} initialFocus className="p-3 pointer-events-auto" />
                </PopoverContent>
              </Popover>
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-medium text-muted-foreground">Vendedor</label>
              <Select value={selectedSeller} onValueChange={setSelectedSeller}>
                <SelectTrigger className="w-[140px] h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {sellers.map(n => <SelectItem key={n} value={n}>{n}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-medium text-muted-foreground">Administradora</label>
              <Select value={selectedAdmin} onValueChange={setSelectedAdmin}>
                <SelectTrigger className="w-[140px] h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  {admins.map(n => <SelectItem key={n} value={n}>{n}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-medium text-muted-foreground">Cidade</label>
              <Select value={selectedCity} onValueChange={setSelectedCity}>
                <SelectTrigger className="w-[130px] h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  {cities.map(n => <SelectItem key={n} value={n}>{n}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-medium text-muted-foreground">Situação</label>
              <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                <SelectTrigger className="w-[120px] h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  {statuses.map(n => <SelectItem key={n} value={n}>{n}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-medium text-muted-foreground">Gênero</label>
              <Select value={selectedGender} onValueChange={setSelectedGender}>
                <SelectTrigger className="w-[110px] h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="Masculino">Masculino</SelectItem>
                  <SelectItem value="Feminino">Feminino</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {hasActiveFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters} className="h-8 text-xs gap-1">
                <X className="h-3 w-3" /> Limpar
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : error ? (
        <Card><CardContent className="py-8 text-center text-destructive text-sm">Erro: {(error as Error).message}</CardContent></Card>
      ) : (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-2">
            <StatsCard title="Vendas" value={fmtNum(stats.total)} icon={<ShoppingCart className="h-4 w-4 text-primary-foreground" />} color="bg-primary" />
            <StatsCard title="Crédito Total" value={fmt(stats.totalCredito)} icon={<DollarSign className="h-4 w-4 text-primary-foreground" />} color="bg-emerald-500" />
            <StatsCard title="Ticket Médio" value={fmt(stats.ticket)} icon={<TrendingUp className="h-4 w-4 text-primary-foreground" />} color="bg-violet-500" />
            <StatsCard title="Vendedores" value={stats.sellers} icon={<Users className="h-4 w-4 text-primary-foreground" />} color="bg-blue-500" />
            <StatsCard title="Cidades" value={stats.cities} icon={<MapPin className="h-4 w-4 text-primary-foreground" />} color="bg-amber-500" />
            <StatsCard title="Confirmadas" value={`${stats.taxaConf.toFixed(0)}%`} subtitle={`${stats.confirmadas} de ${stats.total}`} icon={<Target className="h-4 w-4 text-primary-foreground" />} color="bg-teal-500" />
            {tempoFechamento && (
              <StatsCard title="Tempo Médio" value={`${tempoFechamento.avg}d`} subtitle={`${tempoFechamento.min}–${tempoFechamento.max} dias`} icon={<Clock className="h-4 w-4 text-primary-foreground" />} color="bg-rose-500" />
            )}
          </div>

          {/* Tabs */}
          <Tabs defaultValue="volume" className="space-y-3">
            <TabsList className="flex flex-wrap h-auto gap-1">
              <TabsTrigger value="volume" className="text-xs gap-1"><BarChart3 className="h-3 w-3" />Volume</TabsTrigger>
              <TabsTrigger value="ranking" className="text-xs gap-1"><Award className="h-3 w-3" />Ranking</TabsTrigger>
              <TabsTrigger value="financeiro" className="text-xs gap-1"><DollarSign className="h-3 w-3" />Financeiro</TabsTrigger>
              
              <TabsTrigger value="geo" className="text-xs gap-1"><MapPin className="h-3 w-3" />Geográfico</TabsTrigger>
              <TabsTrigger value="perfil" className="text-xs gap-1"><Users className="h-3 w-3" />Perfil</TabsTrigger>
              <TabsTrigger value="demografico" className="text-xs gap-1"><UserCheck className="h-3 w-3" />Demográfico</TabsTrigger>
              <TabsTrigger value="origens" className="text-xs gap-1"><Globe className="h-3 w-3" />Origens</TabsTrigger>
              <TabsTrigger value="situacao" className="text-xs gap-1"><Activity className="h-3 w-3" />Situação</TabsTrigger>
              <TabsTrigger value="funil" className="text-xs gap-1"><ArrowDownUp className="h-3 w-3" />Funil</TabsTrigger>
              <TabsTrigger value="score" className="text-xs gap-1"><Star className="h-3 w-3" />Score</TabsTrigger>
              <TabsTrigger value="sazonalidade" className="text-xs gap-1"><CalendarDays className="h-3 w-3" />Sazonalidade</TabsTrigger>
              
              <TabsTrigger value="alertas" className="text-xs gap-1"><AlertTriangle className="h-3 w-3" />Alertas</TabsTrigger>
              <TabsTrigger value="metas" className="text-xs gap-1"><Target className="h-3 w-3" />Metas</TabsTrigger>
              <TabsTrigger value="ia" className="text-xs gap-1"><Sparkles className="h-3 w-3" />IA</TabsTrigger>
              <TabsTrigger value="records" className="text-xs gap-1"><Trophy className="h-3 w-3" />Records</TabsTrigger>
              <TabsTrigger value="comparativo" className="text-xs gap-1"><TrendingUp className="h-3 w-3" />Comparativo</TabsTrigger>
              <TabsTrigger value="performance" className="text-xs gap-1"><Clock className="h-3 w-3" />Performance</TabsTrigger>
              <TabsTrigger value="tabela" className="text-xs gap-1"><Filter className="h-3 w-3" />Tabela</TabsTrigger>
            </TabsList>

            {/* TAB: Volume */}
            <TabsContent value="volume" className="space-y-3">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                <ChartCard title="Vendas por Dia">
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={dailySales}>
                      <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                      <XAxis dataKey="date" tick={{ fontSize: 10 }} angle={-45} textAnchor="end" height={60} />
                      <YAxis tick={{ fontSize: 10 }} />
                      <Tooltip content={<CustomTooltip />} />
                      <Bar dataKey="qtd" name="Vendas" fill="hsl(var(--primary))" radius={[3, 3, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </ChartCard>

                <ChartCard title="Vendas Acumuladas">
                  <ResponsiveContainer width="100%" height={260}>
                    <AreaChart data={cumulativeSales}>
                      <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                      <XAxis dataKey="date" tick={{ fontSize: 10 }} angle={-45} textAnchor="end" height={60} />
                      <YAxis tick={{ fontSize: 10 }} />
                      <Tooltip content={<CustomTooltip />} />
                      <Area type="monotone" dataKey="acumulado" name="Acumulado" fill="hsl(var(--primary))" fillOpacity={0.2} stroke="hsl(var(--primary))" strokeWidth={2} />
                    </AreaChart>
                  </ResponsiveContainer>
                </ChartCard>

                <ChartCard title="Evolução Mensal">
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={byMonth}>
                      <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                      <XAxis dataKey="mes" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 10 }} />
                      <Tooltip content={<CustomTooltip />} />
                      <Bar dataKey="qtd" name="Vendas" fill="#10b981" radius={[3, 3, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </ChartCard>

                <ChartCard title="Vendas por Dia da Semana">
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={byWeekday}>
                      <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                      <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 10 }} />
                      <Tooltip content={<CustomTooltip />} />
                      <Bar dataKey="vendas" name="Vendas" fill="#8b5cf6" radius={[3, 3, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </ChartCard>

                <ChartCard title="Por Situação">
                  <ResponsiveContainer width="100%" height={260}>
                    <RechartsPie>
                      <Pie data={bySituacao} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false} fontSize={10}>
                        {bySituacao.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                      </Pie>
                      <Tooltip />
                    </RechartsPie>
                  </ResponsiveContainer>
                </ChartCard>

                <ChartCard title="Por Origem">
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={byOrigem} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                      <XAxis type="number" tick={{ fontSize: 10 }} />
                      <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={100} />
                      <Tooltip content={<CustomTooltip />} />
                      <Bar dataKey="value" name="Vendas" fill="#f59e0b" radius={[0, 3, 3, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </ChartCard>
              </div>
            </TabsContent>

            {/* TAB: Ranking */}
            <TabsContent value="ranking" className="space-y-3">
              {/* Pódio */}
              {sellerRanking.length >= 3 && (
                <div className="grid grid-cols-3 gap-2">
                  {[1, 0, 2].map((idx) => {
                    const s = sellerRanking[idx];
                    if (!s) return null;
                    const medals = ["🥇", "🥈", "🥉"];
                    const heights = ["h-28", "h-36", "h-24"];
                    return (
                      <Card key={idx} className="text-center">
                        <CardContent className="pt-4 pb-3">
                          <div className="text-3xl mb-1">{medals[idx]}</div>
                          <p className="text-sm font-bold truncate">{s.name}</p>
                          <p className="text-xs text-muted-foreground">{s.qtd} vendas</p>
                          <p className="text-sm font-semibold text-primary">{fmt(s.credito)}</p>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                <ChartCard title="Ranking por Crédito">
                  <ResponsiveContainer width="100%" height={Math.max(260, sellerRanking.length * 32)}>
                    <BarChart data={sellerRanking} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                      <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                      <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={100} />
                      <Tooltip content={<CustomTooltip />} />
                      <Bar dataKey="credito" name="Crédito" fill="hsl(var(--primary))" radius={[0, 3, 3, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </ChartCard>

                <ChartCard title="Ranking por Quantidade">
                  <ResponsiveContainer width="100%" height={Math.max(260, sellerRanking.length * 32)}>
                    <BarChart data={[...sellerRanking].sort((a, b) => b.qtd - a.qtd)} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                      <XAxis type="number" tick={{ fontSize: 10 }} />
                      <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={100} />
                      <Tooltip content={<CustomTooltip />} />
                      <Bar dataKey="qtd" name="Vendas" fill="#10b981" radius={[0, 3, 3, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </ChartCard>
              </div>

              {/* Tabela completa ranking */}
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm">Ranking Completo</CardTitle></CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-8">#</TableHead>
                          <TableHead>Vendedor</TableHead>
                          <TableHead className="text-right">Vendas</TableHead>
                          <TableHead className="text-right">Crédito</TableHead>
                          <TableHead className="text-right">Ticket Médio</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {sellerRanking.map((s, i) => (
                          <TableRow key={s.name}>
                            <TableCell className="text-xs font-bold">{i + 1}</TableCell>
                            <TableCell className="text-xs font-medium">{s.name}</TableCell>
                            <TableCell className="text-xs text-right">{s.qtd}</TableCell>
                            <TableCell className="text-xs text-right font-medium">{fmt(s.credito)}</TableCell>
                            <TableCell className="text-xs text-right">{fmt(s.ticket)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* TAB: Financeiro */}
            <TabsContent value="financeiro" className="space-y-3">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                <ChartCard title="Crédito por Dia">
                  <ResponsiveContainer width="100%" height={260}>
                    <AreaChart data={dailySales}>
                      <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                      <XAxis dataKey="date" tick={{ fontSize: 10 }} angle={-45} textAnchor="end" height={60} />
                      <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                      <Tooltip content={<CustomTooltip />} />
                      <Area type="monotone" dataKey="credito" name="Crédito" fill="#10b981" fillOpacity={0.2} stroke="#10b981" strokeWidth={2} />
                    </AreaChart>
                  </ResponsiveContainer>
                </ChartCard>

                <ChartCard title="Crédito Acumulado">
                  <ResponsiveContainer width="100%" height={260}>
                    <LineChart data={cumulativeSales}>
                      <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                      <XAxis dataKey="date" tick={{ fontSize: 10 }} angle={-45} textAnchor="end" height={60} />
                      <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `${(v / 1000000).toFixed(1)}M`} />
                      <Tooltip content={<CustomTooltip />} />
                      <Line type="monotone" dataKey="creditoAcum" name="Crédito Acumulado" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </ChartCard>

                <ChartCard title="Crédito Mensal">
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={byMonth}>
                      <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                      <XAxis dataKey="mes" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                      <Tooltip content={<CustomTooltip />} />
                      <Bar dataKey="credito" name="Crédito" fill="#8b5cf6" radius={[3, 3, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </ChartCard>

                <ChartCard title="Faixa de Crédito">
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={byCreditRange}>
                      <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                      <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 10 }} />
                      <Tooltip content={<CustomTooltip />} />
                      <Bar dataKey="value" name="Vendas" fill="#f59e0b" radius={[3, 3, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </ChartCard>

                <ChartCard title="Crédito por Administradora">
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={byAdmin}>
                      <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                      <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                      <Tooltip content={<CustomTooltip />} />
                      <Bar dataKey="credito" name="Crédito" fill="#06b6d4" radius={[3, 3, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </ChartCard>

                <ChartCard title="Ticket Médio por Vendedor">
                  <ResponsiveContainer width="100%" height={Math.max(260, sellerRanking.length * 32)}>
                    <BarChart data={[...sellerRanking].sort((a, b) => b.ticket - a.ticket)} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                      <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                      <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={100} />
                      <Tooltip content={<CustomTooltip />} />
                      <Bar dataKey="ticket" name="Ticket Médio" fill="#ec4899" radius={[0, 3, 3, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </ChartCard>
              </div>
            </TabsContent>


            {/* TAB: Geográfico */}
            <TabsContent value="geo" className="space-y-3">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                <ChartCard title="Top Cidades por Vendas">
                  <ResponsiveContainer width="100%" height={Math.max(260, byCity.length * 28)}>
                    <BarChart data={byCity} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                      <XAxis type="number" tick={{ fontSize: 10 }} />
                      <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={120} />
                      <Tooltip content={<CustomTooltip />} />
                      <Bar dataKey="qtd" name="Vendas" fill="#0ea5e9" radius={[0, 3, 3, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </ChartCard>

                <ChartCard title="Crédito por Cidade">
                  <ResponsiveContainer width="100%" height={Math.max(260, byCity.length * 28)}>
                    <BarChart data={[...byCity].sort((a, b) => b.credito - a.credito)} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                      <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                      <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={120} />
                      <Tooltip content={<CustomTooltip />} />
                      <Bar dataKey="credito" name="Crédito" fill="#10b981" radius={[0, 3, 3, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </ChartCard>

                <ChartCard title="Vendas por Região">
                  <ResponsiveContainer width="100%" height={260}>
                    <RechartsPie>
                      <Pie data={byRegion} dataKey="qtd" nameKey="name" cx="50%" cy="50%" outerRadius={90} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false} fontSize={10}>
                        {byRegion.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                      </Pie>
                      <Tooltip />
                    </RechartsPie>
                  </ResponsiveContainer>
                </ChartCard>

                <ChartCard title="Crédito por Região">
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={byRegion}>
                      <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                      <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                      <Tooltip content={<CustomTooltip />} />
                      <Bar dataKey="credito" name="Crédito" fill="#a855f7" radius={[3, 3, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </ChartCard>
              </div>
            </TabsContent>

            {/* TAB: Perfil do Cliente */}
            <TabsContent value="perfil" className="space-y-3">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                <ChartCard title="Distribuição por Gênero">
                  <ResponsiveContainer width="100%" height={260}>
                    <RechartsPie>
                      <Pie data={byGender} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false} fontSize={10}>
                        {byGender.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                      </Pie>
                      <Tooltip />
                    </RechartsPie>
                  </ResponsiveContainer>
                </ChartCard>

                <ChartCard title="Faixa Etária">
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={byAge}>
                      <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                      <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 10 }} />
                      <Tooltip content={<CustomTooltip />} />
                      <Bar dataKey="value" name="Clientes" fill="#ec4899" radius={[3, 3, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </ChartCard>

                <ChartCard title="Top Profissões">
                  <ResponsiveContainer width="100%" height={Math.max(260, byProfession.length * 28)}>
                    <BarChart data={byProfession} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                      <XAxis type="number" tick={{ fontSize: 10 }} />
                      <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={120} />
                      <Tooltip content={<CustomTooltip />} />
                      <Bar dataKey="qtd" name="Vendas" fill="#14b8a6" radius={[0, 3, 3, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </ChartCard>

                <ChartCard title="Faixa de Renda">
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={byIncome}>
                      <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                      <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 10 }} />
                      <Tooltip content={<CustomTooltip />} />
                      <Bar dataKey="value" name="Clientes" fill="#f97316" radius={[3, 3, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </ChartCard>

                <ChartCard title="Motivo do Consórcio">
                  <ResponsiveContainer width="100%" height={Math.max(260, byMotivo.length * 28)}>
                    <BarChart data={byMotivo} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                      <XAxis type="number" tick={{ fontSize: 10 }} />
                      <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={120} />
                      <Tooltip content={<CustomTooltip />} />
                      <Bar dataKey="value" name="Vendas" fill="#6366f1" radius={[0, 3, 3, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </ChartCard>

                <ChartCard title="Mix por Administradora">
                  <ResponsiveContainer width="100%" height={260}>
                    <RechartsPie>
                      <Pie data={byAdmin} dataKey="qtd" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={90} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false} fontSize={10}>
                        {byAdmin.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                      </Pie>
                      <Tooltip />
                    </RechartsPie>
                  </ResponsiveContainer>
                </ChartCard>
              </div>
            </TabsContent>

            {/* TAB: Demográfico (Cross-Analysis) */}
            <TabsContent value="demografico" className="space-y-3">
              {/* KPIs demográficos */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {genderStats.map((g) => (
                  <StatsCard
                    key={g.label}
                    title={g.label}
                    value={`${g.qtd} vendas`}
                    subtitle={`Ticket ${fmt(g.ticket)}`}
                    icon={<Users className="h-4 w-4 text-primary-foreground" />}
                    color={g.label === "Masculino" ? "bg-blue-500" : g.label === "Feminino" ? "bg-pink-500" : "bg-gray-500"}
                  />
                ))}
                {avgAgeByVendedor.length > 0 && (
                  <StatsCard
                    title="Idade Média Geral"
                    value={`${Math.round(filtered.reduce((s, v) => { const a = calcAge(v.data_nascimento); return a ? s + a : s; }, 0) / Math.max(1, filtered.filter(v => calcAge(v.data_nascimento) !== null).length))} anos`}
                    icon={<UserCheck className="h-4 w-4 text-primary-foreground" />}
                    color="bg-violet-500"
                  />
                )}
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                <ChartCard title="Ticket Médio por Gênero">
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={genderStats}>
                      <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                      <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                      <Tooltip content={<CustomTooltip />} />
                      <Bar dataKey="ticket" name="Ticket Médio" fill="#ec4899" radius={[3, 3, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </ChartCard>

                <ChartCard title="Crédito Total por Gênero">
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={genderStats}>
                      <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                      <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `${(v / 1000000).toFixed(1)}M`} />
                      <Tooltip content={<CustomTooltip />} />
                      <Bar dataKey="credito" name="Crédito" fill="hsl(var(--primary))" radius={[3, 3, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </ChartCard>

                <ChartCard title="Gênero por Administradora">
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={genderByAdmin}>
                      <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                      <XAxis dataKey="admin" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 10 }} />
                      <Tooltip content={<CustomTooltip />} />
                      <Legend wrapperStyle={{ fontSize: 10 }} />
                      <Bar dataKey="M" name="Masculino" stackId="a" fill="#3b82f6" />
                      <Bar dataKey="F" name="Feminino" stackId="a" fill="#ec4899" />
                      <Bar dataKey="NI" name="N/I" stackId="a" fill="#6b7280" />
                    </BarChart>
                  </ResponsiveContainer>
                </ChartCard>

                <ChartCard title="Ticket Médio por Faixa Etária">
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={ageByCredito}>
                      <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                      <XAxis dataKey="faixa" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                      <Tooltip content={<CustomTooltip />} />
                      <Bar dataKey="ticket" name="Ticket Médio" fill="#8b5cf6" radius={[3, 3, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </ChartCard>

                <ChartCard title="Crédito Total por Faixa Etária">
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={ageByCredito}>
                      <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                      <XAxis dataKey="faixa" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `${(v / 1000000).toFixed(1)}M`} />
                      <Tooltip content={<CustomTooltip />} />
                      <Bar dataKey="credito" name="Crédito" fill="#10b981" radius={[3, 3, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </ChartCard>

                <ChartCard title="Idade Média dos Clientes por Vendedor">
                  <ResponsiveContainer width="100%" height={Math.max(260, avgAgeByVendedor.length * 32)}>
                    <BarChart data={avgAgeByVendedor} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                      <XAxis type="number" tick={{ fontSize: 10 }} domain={[0, 'auto']} />
                      <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={100} />
                      <Tooltip content={<CustomTooltip />} />
                      <Bar dataKey="idadeMedia" name="Idade Média" fill="#f59e0b" radius={[0, 3, 3, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </ChartCard>

                <ChartCard title="Top Cidades por Ticket Médio (mín. 2 vendas)" className="lg:col-span-2">
                  <ResponsiveContainer width="100%" height={Math.max(260, cityTicket.length * 28)}>
                    <BarChart data={cityTicket} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                      <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                      <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={130} />
                      <Tooltip content={<CustomTooltip />} />
                      <Bar dataKey="ticket" name="Ticket Médio" fill="#06b6d4" radius={[0, 3, 3, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </ChartCard>
              </div>
            </TabsContent>

            {/* TAB: Origens */}
            <TabsContent value="origens" className="space-y-3">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {originStats.slice(0, 4).map((o) => (
                  <StatsCard
                    key={o.name}
                    title={o.name}
                    value={`${o.qtd} vendas`}
                    subtitle={`Ticket ${fmt(o.ticket)}`}
                    icon={<Globe className="h-4 w-4 text-primary-foreground" />}
                    color="bg-amber-500"
                  />
                ))}
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                <ChartCard title="Crédito por Origem">
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={originStats}>
                      <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                      <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `${(v / 1000000).toFixed(1)}M`} />
                      <Tooltip content={<CustomTooltip />} />
                      <Bar dataKey="credito" name="Crédito" fill="#f59e0b" radius={[3, 3, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </ChartCard>

                <ChartCard title="Ticket Médio por Origem">
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={originStats}>
                      <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                      <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                      <Tooltip content={<CustomTooltip />} />
                      <Bar dataKey="ticket" name="Ticket Médio" fill="#8b5cf6" radius={[3, 3, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </ChartCard>

                <ChartCard title="Distribuição por Origem">
                  <ResponsiveContainer width="100%" height={260}>
                    <RechartsPie>
                      <Pie data={originStats} dataKey="qtd" nameKey="name" cx="50%" cy="50%" outerRadius={90} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false} fontSize={10}>
                        {originStats.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                      </Pie>
                      <Tooltip />
                    </RechartsPie>
                  </ResponsiveContainer>
                </ChartCard>

                <ChartCard title="Evolução de Origens por Mês">
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={originByMonth.data}>
                      <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                      <XAxis dataKey="mes" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 10 }} />
                      <Tooltip content={<CustomTooltip />} />
                      <Legend wrapperStyle={{ fontSize: 10 }} />
                      {originByMonth.origins.map((o, i) => (
                        <Bar key={o} dataKey={o} name={o} stackId="a" fill={COLORS[i % COLORS.length]} />
                      ))}
                    </BarChart>
                  </ResponsiveContainer>
                </ChartCard>
              </div>
            </TabsContent>

            {/* TAB: Situação dos Contratos */}
            <TabsContent value="situacao" className="space-y-3">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {statusStats.map((s) => (
                  <StatsCard
                    key={s.name}
                    title={s.name}
                    value={`${s.qtd} (${s.pct.toFixed(0)}%)`}
                    subtitle={fmt(s.credito)}
                    icon={<Activity className="h-4 w-4 text-primary-foreground" />}
                    color={s.name === "Confirmada" ? "bg-emerald-500" : s.name === "Cancelada" ? "bg-red-500" : "bg-amber-500"}
                  />
                ))}
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                <ChartCard title="Crédito por Situação">
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={statusStats}>
                      <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                      <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `${(v / 1000000).toFixed(1)}M`} />
                      <Tooltip content={<CustomTooltip />} />
                      <Bar dataKey="credito" name="Crédito" fill="#10b981" radius={[3, 3, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </ChartCard>

                <ChartCard title="Distribuição de Situações">
                  <ResponsiveContainer width="100%" height={260}>
                    <RechartsPie>
                      <Pie data={statusStats} dataKey="qtd" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={90} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false} fontSize={10}>
                        {statusStats.map((s, i) => (
                          <Cell key={i} fill={s.name === "Confirmada" ? "#10b981" : s.name === "Cancelada" ? "#ef4444" : COLORS[i % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </RechartsPie>
                  </ResponsiveContainer>
                </ChartCard>

                <ChartCard title="Tabela de Situações" className="lg:col-span-2">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Situação</TableHead>
                          <TableHead className="text-right">Vendas</TableHead>
                          <TableHead className="text-right">%</TableHead>
                          <TableHead className="text-right">Crédito Total</TableHead>
                          <TableHead className="text-right">Ticket Médio</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {statusStats.map((s) => (
                          <TableRow key={s.name}>
                            <TableCell className="text-xs font-medium">
                              <Badge variant={s.name === "Confirmada" ? "default" : "secondary"} className="text-[10px]">{s.name}</Badge>
                            </TableCell>
                            <TableCell className="text-xs text-right">{s.qtd}</TableCell>
                            <TableCell className="text-xs text-right">{s.pct.toFixed(1)}%</TableCell>
                            <TableCell className="text-xs text-right font-medium">{fmt(s.credito)}</TableCell>
                            <TableCell className="text-xs text-right">{fmt(s.qtd > 0 ? s.credito / s.qtd : 0)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </ChartCard>
              </div>
            </TabsContent>


            <TabsContent value="performance" className="space-y-3">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                {tempoByVendedor.length > 0 && (
                  <ChartCard title="Tempo Médio de Fechamento por Vendedor (dias)">
                    <ResponsiveContainer width="100%" height={Math.max(260, tempoByVendedor.length * 32)}>
                      <BarChart data={tempoByVendedor} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                        <XAxis type="number" tick={{ fontSize: 10 }} />
                        <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={100} />
                        <Tooltip content={<CustomTooltip />} />
                        <Bar dataKey="media" name="Dias" fill="#ef4444" radius={[0, 3, 3, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </ChartCard>
                )}

                <ChartCard title="Média Vendas/Dia">
                  <div className="flex flex-col items-center justify-center h-[260px]">
                    <p className="text-5xl font-bold text-primary">{dailySales.length > 0 ? (stats.total / dailySales.length).toFixed(1) : "0"}</p>
                    <p className="text-sm text-muted-foreground mt-2">vendas por dia ativo</p>
                    <p className="text-xs text-muted-foreground mt-1">{dailySales.length} dias com vendas</p>
                  </div>
                </ChartCard>

                <ChartCard title="Crédito Médio por Dia Ativo">
                  <div className="flex flex-col items-center justify-center h-[260px]">
                    <p className="text-4xl font-bold text-emerald-500">{dailySales.length > 0 ? fmt(stats.totalCredito / dailySales.length) : fmt(0)}</p>
                    <p className="text-sm text-muted-foreground mt-2">crédito por dia ativo</p>
                  </div>
                </ChartCard>

                <ChartCard title="Projeção Mensal (30 dias)">
                  <div className="flex flex-col items-center justify-center h-[260px]">
                    {dailySales.length > 0 ? (
                      <>
                        <p className="text-4xl font-bold text-violet-500">{fmtNum(Math.round((stats.total / dailySales.length) * 22))}</p>
                        <p className="text-sm text-muted-foreground mt-2">vendas projetadas (22 dias úteis)</p>
                        <p className="text-3xl font-bold text-primary mt-4">{fmt((stats.totalCredito / dailySales.length) * 22)}</p>
                        <p className="text-sm text-muted-foreground mt-1">crédito projetado</p>
                      </>
                    ) : (
                      <p className="text-muted-foreground">Sem dados</p>
                    )}
                  </div>
                </ChartCard>
              </div>
            </TabsContent>

            {/* TAB: Tabela */}
            <TabsContent value="tabela" className="space-y-3">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center justify-between">
                    <span>Registro de Vendas</span>
                    <span className="text-xs font-normal text-muted-foreground">{filtered.length} venda{filtered.length !== 1 ? "s" : ""}</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {filtered.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground text-sm">Nenhuma venda encontrada.</div>
                  ) : (
                    <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Vendedor</TableHead>
                            <TableHead>Cliente</TableHead>
                            <TableHead>Data</TableHead>
                            <TableHead>Crédito</TableHead>
                            <TableHead>Grupo/Cota</TableHead>
                            <TableHead>Admin.</TableHead>
                            <TableHead>Situação</TableHead>
                            <TableHead>Cidade</TableHead>
                            <TableHead>Região</TableHead>
                            <TableHead>Gênero</TableHead>
                            <TableHead>Profissão</TableHead>
                            <TableHead>Origem</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filtered.map((v) => (
                            <TableRow key={v.codigo}>
                              <TableCell className="font-medium text-xs whitespace-nowrap">{v.vendedor}</TableCell>
                              <TableCell className="text-xs max-w-[150px] truncate">{v.nome}</TableCell>
                              <TableCell className="text-xs whitespace-nowrap">{v.data_venda}</TableCell>
                              <TableCell className="text-xs font-medium whitespace-nowrap">{fmt(parseCredito(v.credito))}</TableCell>
                              <TableCell className="text-xs">{v.grupo}/{v.cota}</TableCell>
                              <TableCell className="text-xs">{v.administradora}</TableCell>
                              <TableCell>
                                <Badge variant={v.situacao === "Confirmada" ? "default" : "secondary"} className="text-[10px]">{v.situacao}</Badge>
                              </TableCell>
                              <TableCell className="text-xs">{v.cidade || "—"}</TableCell>
                              <TableCell className="text-xs">{v.regiao || "—"}</TableCell>
                              <TableCell className="text-xs">{v.genero || "—"}</TableCell>
                              <TableCell className="text-xs">{v.profissao || "—"}</TableCell>
                              <TableCell className="text-xs">{v.origem || "—"}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
            {/* TAB: Funil de Conversão */}
            <TabsContent value="funil" className="space-y-3">
              <ConversionFunnel vendas={filtered as any} />
            </TabsContent>

            {/* TAB: Score de Vendedor */}
            <TabsContent value="score" className="space-y-3">
              <SellerScoreTab scores={sellerScores} />
            </TabsContent>

            {/* TAB: Sazonalidade */}
            <TabsContent value="sazonalidade" className="space-y-3">
              <SeasonalityTab vendas={filtered as any} />
            </TabsContent>


            {/* TAB: Alertas de Cancelamento */}
            <TabsContent value="alertas" className="space-y-3">
              <CancellationAlerts vendas={filtered as any} threshold={20} />
            </TabsContent>

            {/* TAB: Metas */}
            <TabsContent value="metas" className="space-y-3">
              <GesconGoalsTab vendas={filtered} sellers={sellers} />
            </TabsContent>

            {/* TAB: Records */}
            <TabsContent value="records" className="space-y-3">
              <GesconRecordsPanel vendas={filtered} />
            </TabsContent>

            {/* TAB: Comparativo Mensal */}
            <TabsContent value="comparativo" className="space-y-3">
              <GesconMonthCompare vendas={filtered} />
            </TabsContent>

            {/* TAB: Resumo IA */}
            <TabsContent value="ia" className="space-y-3">
              <GesconAISummary salesData={{
                totalVendas: stats.total,
                totalCredito: stats.totalCredito,
                ticketMedio: stats.ticket,
                taxaConfirmacao: stats.taxaConf,
                totalVendedores: stats.sellers,
                totalCidades: stats.cities,
                rankingVendedores: sellerRanking.slice(0, 10),
                porAdministradora: byAdmin,
                porSituacao: bySituacao,
                porOrigem: byOrigem,
                porMes: byMonth,
                porCidade: byCity.slice(0, 10),
              }} />
            </TabsContent>

          </Tabs>
        </>
      )}
    </div>
  );
}
