import { useMemo, useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Users, Search, RefreshCw, TrendingUp, MapPin, Briefcase, DollarSign,
  Trophy, Building2, UserCheck, LayoutList, LayoutGrid,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useGesconVendas, type GesconVenda } from "@/hooks/useGesconVendas";
import { useUserRole } from "@/hooks/useUserRole";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
  PieChart, Pie, Cell, Legend,
} from "recharts";

const BRL = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

const parseMoney = (s: string | null | undefined): number => {
  if (!s) return 0;
  const cleaned = String(s).replace(/[^0-9,.-]/g, "").replace(/\.(?=\d{3})/g, "").replace(",", ".");
  const n = parseFloat(cleaned);
  return isNaN(n) ? 0 : n;
};

const COLORS = ["hsl(var(--primary))", "hsl(var(--chart-2, 220 70% 50%))", "hsl(var(--chart-3, 160 60% 45%))", "hsl(var(--chart-4, 40 80% 55%))", "hsl(var(--chart-5, 340 75% 55%))", "hsl(var(--muted-foreground))"];

// ─── Canonicalização de nomes de vendedores no filtro ───
// Junta variações históricas (HS-...) e novas grafias num único nome.
const SELLER_ALIASES: Record<string, string[]> = {
  "Gabriel Simão": ["HS-Gabriel", "GABRIEL SIMÃO", "GABRIEL SIMAO", "Gabriel Simao", "Gabriel", "Gabriel Costa Simão", "Gabriel Costa Simao", "GABRIEL COSTA SIMÃO", "GABRIEL COSTA SIMAO", "Simão", "SIMÃO"],
  "Alessandro Santos": ["HS-Alessandro Sombrio", "HS- Alessandro Sombrio", "ALESSANDRO SOMBRIO", "Alessandro Sombrio", "ALESSANDRO SANTOS", "Alessandro"],
  "Patrick": ["HS-Patrick", "HS-Patrick Bragato Rex", "HS- Patrick Bragato Rex", "PATRICK REX", "Patrick Rex", "PATRICK BRAGATO REX", "Patrick Bragato Rex", "PATRICK"],
  "Marcio": ["HS-Marcio", "HS- Marcio", "MARCIO PEREIRA", "Marcio Pereira", "MARCIO", "Márcio", "MÁRCIO", "Márcio Pereira", "MÁRCIO PEREIRA"],
  "Lucas Freitas": ["HS-Lucas Braco do Norte", "HS- Lucas Braco do Norte", "HS-Lucas Braço do Norte", "LUCAS FREITAS", "Lucas Freitas", "LUCAS"],
};
const _sellerMap = new Map<string, string>();
for (const [canonical, aliases] of Object.entries(SELLER_ALIASES)) {
  _sellerMap.set(canonical.toLowerCase().trim(), canonical);
  for (const a of aliases) _sellerMap.set(a.toLowerCase().trim(), canonical);
}
const canonSeller = (raw: string | null | undefined): string => {
  if (!raw) return "";
  const key = raw.toLowerCase().trim();
  return _sellerMap.get(key) || raw.trim();
};

export default function Clientes() {
  const [search, setSearch] = useState("");
  const [seller, setSeller] = useState<string>("__all");
  const [city, setCity] = useState<string>("__all");
  const [months, setMonths] = useState<string>("120");
  const [viewMode, setViewMode] = useState<"clientes" | "cotas">("clientes");

  const { user } = useAuth();
  const { isGestor, loading: roleLoading } = useUserRole();
  const [myName, setMyName] = useState<string | null>(null);

  // Busca o display_name do vendedor logado para filtrar pelos seus clientes
  useEffect(() => {
    if (!user || isGestor) return;
    supabase
      .from("profiles")
      .select("display_name")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        setMyName((data?.display_name || user.email || "").trim());
      });
  }, [user, isGestor]);

  const dateFrom = useMemo(() => {
    if (months === "all") {
      // Pega todo histórico — usa data bem antiga
      return new Date(2000, 0, 1);
    }
    const d = new Date();
    d.setMonth(d.getMonth() - parseInt(months));
    return d;
  }, [months]);

  const gescon = useGesconVendas(dateFrom, new Date());
  const sales = gescon.data || [];

  // Dedup clientes por nome (mantendo a venda mais recente como referência)
  const clients = useMemo(() => {
    const map = new Map<string, GesconVenda & { totalCredito: number; numVendas: number }>();
    const norm = (s: string | null | undefined) =>
      (s || "").trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    // Canonicaliza o nome do usuário logado (ex.: "Lucas Cardoso De Freitas" → "Lucas Freitas")
    // e também guarda tokens individuais como fallback (primeiro + último nome).
    const meCanonical = canonSeller(myName);
    const meNorm = norm(meCanonical);
    const meTokens = norm(myName).split(/\s+/).filter((t) => t.length >= 3);
    sales.forEach((v) => {
      // Vendedor comum: vê apenas suas próprias vendas
      if (!isGestor && meNorm) {
        const vCanonical = canonSeller(v.vendedor);
        const vNorm = norm(vCanonical);
        const vRawNorm = norm(v.vendedor);
        // Match se canonicalização bate, ou se primeiro+último nome aparecem no vendedor
        const canonicalMatch = vNorm === meNorm || vNorm.includes(meNorm) || meNorm.includes(vNorm);
        const tokenMatch =
          meTokens.length >= 2 &&
          vRawNorm.includes(meTokens[0]) &&
          vRawNorm.includes(meTokens[meTokens.length - 1]);
        if (!canonicalMatch && !tokenMatch) return;
      }
      const key = (v.nome || "").trim().toLowerCase();
      if (!key) return;
      const credito = parseMoney(v.credito);
      const vendorCanonical = canonSeller(v.vendedor);
      const vNormalized = { ...v, vendedor: vendorCanonical };
      const existing = map.get(key);
      if (!existing) {
        map.set(key, { ...vNormalized, totalCredito: credito, numVendas: 1 });
      } else {
        existing.totalCredito += credito;
        existing.numVendas += 1;
        if (new Date(v.data_venda || 0) > new Date(existing.data_venda || 0)) {
          Object.assign(existing, vNormalized, { totalCredito: existing.totalCredito, numVendas: existing.numVendas });
        }
      }
    });
    return Array.from(map.values());
  }, [sales, isGestor, myName]);

  // Lista plana de TODAS as cotas (uma linha por venda), aplicando o mesmo filtro de vendedor
  const allCotas = useMemo(() => {
    const norm = (s: string | null | undefined) =>
      (s || "").trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const meCanonical = canonSeller(myName);
    const meNorm = norm(meCanonical);
    const meTokens = norm(myName).split(/\s+/).filter((t) => t.length >= 3);
    return sales
      .filter((v) => {
        if (isGestor || !meNorm) return true;
        const vCanonical = canonSeller(v.vendedor);
        const vNorm = norm(vCanonical);
        const vRawNorm = norm(v.vendedor);
        const canonicalMatch = vNorm === meNorm || vNorm.includes(meNorm) || meNorm.includes(vNorm);
        const tokenMatch =
          meTokens.length >= 2 &&
          vRawNorm.includes(meTokens[0]) &&
          vRawNorm.includes(meTokens[meTokens.length - 1]);
        return canonicalMatch || tokenMatch;
      })
      .map((v) => ({
        ...v,
        vendedor: canonSeller(v.vendedor),
        creditoNum: parseMoney(v.credito),
      }));
  }, [sales, isGestor, myName]);

  const sellers = useMemo(
    () => Array.from(new Set(clients.map((c) => c.vendedor).filter(Boolean))).sort(),
    [clients]
  );
  const cities = useMemo(
    () => Array.from(new Set(clients.map((c) => c.cidade).filter(Boolean))).sort() as string[],
    [clients]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return clients.filter((c) => {
      if (seller !== "__all" && c.vendedor !== seller) return false;
      if (city !== "__all" && c.cidade !== city) return false;
      if (!q) return true;
      return (
        (c.nome || "").toLowerCase().includes(q) ||
        (c.vendedor || "").toLowerCase().includes(q) ||
        (c.cidade || "").toLowerCase().includes(q) ||
        (c.profissao || "").toLowerCase().includes(q) ||
        (c.cota || "").toLowerCase().includes(q) ||
        (c.grupo || "").toLowerCase().includes(q)
      );
    });
  }, [clients, search, seller, city]);

  const filteredCotas = useMemo(() => {
    const q = search.trim().toLowerCase();
    return allCotas.filter((c) => {
      if (seller !== "__all" && c.vendedor !== seller) return false;
      if (city !== "__all" && c.cidade !== city) return false;
      if (!q) return true;
      return (
        (c.nome || "").toLowerCase().includes(q) ||
        (c.vendedor || "").toLowerCase().includes(q) ||
        (c.cidade || "").toLowerCase().includes(q) ||
        (c.profissao || "").toLowerCase().includes(q) ||
        (c.cota || "").toLowerCase().includes(q) ||
        (c.grupo || "").toLowerCase().includes(q) ||
        (c.contrato || "").toLowerCase().includes(q)
      );
    });
  }, [allCotas, search, seller, city]);

  // ── Análises ──
  const stats = useMemo(() => {
    const totalCredito = filtered.reduce((s, c) => s + c.totalCredito, 0);
    const ativos = filtered.filter((c) => /ativ/i.test(c.situacao || "")).length;
    const ticketMedio = filtered.length ? totalCredito / filtered.length : 0;
    return { total: filtered.length, totalCredito, ativos, ticketMedio };
  }, [filtered]);

  const bySeller = useMemo(() => {
    const m = new Map<string, { vendedor: string; clientes: number; credito: number }>();
    filtered.forEach((c) => {
      const k = c.vendedor || "—";
      const cur = m.get(k) || { vendedor: k, clientes: 0, credito: 0 };
      cur.clientes += 1;
      cur.credito += c.totalCredito;
      m.set(k, cur);
    });
    return Array.from(m.values()).sort((a, b) => b.credito - a.credito).slice(0, 10);
  }, [filtered]);

  const byCity = useMemo(() => {
    const m = new Map<string, number>();
    filtered.forEach((c) => {
      const k = c.cidade || "—";
      m.set(k, (m.get(k) || 0) + 1);
    });
    return Array.from(m.entries())
      .map(([cidade, qtd]) => ({ cidade, qtd }))
      .sort((a, b) => b.qtd - a.qtd)
      .slice(0, 8);
  }, [filtered]);

  const byProfissao = useMemo(() => {
    const m = new Map<string, number>();
    filtered.forEach((c) => {
      const k = (c.profissao || "Não informado").trim() || "Não informado";
      m.set(k, (m.get(k) || 0) + 1);
    });
    return Array.from(m.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 6);
  }, [filtered]);

  const byAdministradora = useMemo(() => {
    const m = new Map<string, number>();
    filtered.forEach((c) => {
      const k = c.administradora || "—";
      m.set(k, (m.get(k) || 0) + 1);
    });
    return Array.from(m.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [filtered]);

  const bySituacao = useMemo(() => {
    const m = new Map<string, number>();
    filtered.forEach((c) => {
      const k = c.situacao || "—";
      m.set(k, (m.get(k) || 0) + 1);
    });
    return Array.from(m.entries()).map(([name, value]) => ({ name, value }));
  }, [filtered]);

  return (
    <div className="p-4 sm:p-6 space-y-4 max-w-[1500px] mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Users className="w-5 h-5 text-primary" />
          <h1 className="text-xl sm:text-2xl font-bold">Clientes</h1>
          <Badge variant="secondary" className="ml-2">{filtered.length}</Badge>
          <Badge variant="outline" className="text-[10px]">GESCON</Badge>
        </div>
        <div className="flex items-center gap-2">
          <Select value={months} onValueChange={setMonths}>
            <SelectTrigger className="h-9 w-[140px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="3">Últimos 3 meses</SelectItem>
              <SelectItem value="6">Últimos 6 meses</SelectItem>
              <SelectItem value="12">Últimos 12 meses</SelectItem>
              <SelectItem value="24">Últimos 24 meses</SelectItem>
              <SelectItem value="60">Últimos 5 anos</SelectItem>
              <SelectItem value="120">Últimos 10 anos</SelectItem>
              <SelectItem value="240">Últimos 20 anos</SelectItem>
              <SelectItem value="all">Todo o histórico</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={() => gescon.refetch()} disabled={gescon.isLoading}>
            <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${gescon.isLoading ? "animate-spin" : ""}`} />
            Atualizar
          </Button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Clientes únicos</p>
                <p className="text-2xl font-bold">{stats.total}</p>
              </div>
              <Users className="w-8 h-8 text-primary opacity-60" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Crédito total</p>
                <p className="text-xl font-bold">{BRL(stats.totalCredito)}</p>
              </div>
              <DollarSign className="w-8 h-8 text-primary opacity-60" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Ticket médio</p>
                <p className="text-xl font-bold">{BRL(stats.ticketMedio)}</p>
              </div>
              <TrendingUp className="w-8 h-8 text-primary opacity-60" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Ativos</p>
                <p className="text-2xl font-bold">{stats.ativos}</p>
              </div>
              <UserCheck className="w-8 h-8 text-primary opacity-60" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Trophy className="w-4 h-4 text-primary" /> Top vendedores por crédito
            </CardTitle>
          </CardHeader>
          <CardContent className="h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={bySeller} layout="vertical" margin={{ left: 60 }}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                <XAxis type="number" tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} fontSize={10} />
                <YAxis type="category" dataKey="vendedor" fontSize={10} width={100} />
                <Tooltip formatter={(v: number) => BRL(v)} contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} />
                <Bar dataKey="credito" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <MapPin className="w-4 h-4 text-primary" /> Top cidades
            </CardTitle>
          </CardHeader>
          <CardContent className="h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={byCity}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                <XAxis dataKey="cidade" fontSize={10} angle={-25} textAnchor="end" height={60} />
                <YAxis fontSize={10} />
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} />
                <Bar dataKey="qtd" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Briefcase className="w-4 h-4 text-primary" /> Profissões
            </CardTitle>
          </CardHeader>
          <CardContent className="h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={byProfissao} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={(e: any) => `${e.name} (${e.value})`} fontSize={10}>
                  {byProfissao.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Building2 className="w-4 h-4 text-primary" /> Administradoras × Situação
            </CardTitle>
          </CardHeader>
          <CardContent className="h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={byAdministradora} dataKey="value" nameKey="name" cx="30%" cy="50%" outerRadius={70} label fontSize={10}>
                  {byAdministradora.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Pie data={bySituacao} dataKey="value" nameKey="name" cx="75%" cy="50%" innerRadius={35} outerRadius={70} label fontSize={10}>
                  {bySituacao.map((_, i) => <Cell key={i} fill={COLORS[(i + 2) % COLORS.length]} />)}
                </Pie>
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} />
                <Legend wrapperStyle={{ fontSize: 10 }} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Tabela */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <CardTitle className="text-sm">
              {viewMode === "clientes" ? "Carteira de clientes" : "Todas as cotas"}
              <Badge variant="secondary" className="ml-2">
                {viewMode === "clientes" ? filtered.length : filteredCotas.length}
              </Badge>
            </CardTitle>
            <div className="inline-flex rounded-md border bg-background p-0.5">
              <Button
                size="sm"
                variant={viewMode === "clientes" ? "default" : "ghost"}
                className="h-7 px-2 text-xs"
                onClick={() => setViewMode("clientes")}
              >
                <LayoutGrid className="w-3.5 h-3.5 mr-1" /> Por cliente
              </Button>
              <Button
                size="sm"
                variant={viewMode === "cotas" ? "default" : "ghost"}
                className="h-7 px-2 text-xs"
                onClick={() => setViewMode("cotas")}
              >
                <LayoutList className="w-3.5 h-3.5 mr-1" /> Todas as cotas
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <div className="relative flex-1 min-w-[220px]">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome, vendedor, cidade, profissão, cota, grupo..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 h-9"
              />
            </div>
            {isGestor && (
              <Select value={seller} onValueChange={setSeller}>
                <SelectTrigger className="h-9 w-[200px]"><SelectValue placeholder="Vendedor" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all">Todos os vendedores</SelectItem>
                  {sellers.map((s) => <SelectItem key={s} value={s!}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            )}
            <Select value={city} onValueChange={setCity}>
              <SelectTrigger className="h-9 w-[180px]"><SelectValue placeholder="Cidade" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__all">Todas as cidades</SelectItem>
                {cities.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {gescon.isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
            </div>
          ) : viewMode === "clientes" ? (
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Vendedor</TableHead>
                    <TableHead>Cidade</TableHead>
                    <TableHead>Profissão</TableHead>
                    <TableHead>Adm</TableHead>
                    <TableHead>Grupo/Cota</TableHead>
                    <TableHead className="text-right">Crédito</TableHead>
                    <TableHead>Situação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                        Nenhum cliente encontrado
                      </TableCell>
                    </TableRow>
                  ) : (
                    filtered.slice(0, 500).map((c) => (
                      <TableRow key={`${c.nome}-${c.codigo || c.cota}`}>
                        <TableCell className="font-medium">
                          <div className="flex flex-col">
                            <span>{c.nome}</span>
                            {c.numVendas > 1 && (
                              <span className="text-[10px] text-muted-foreground">{c.numVendas} vendas</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-sm">{c.vendedor || "—"}</TableCell>
                        <TableCell className="text-sm">{c.cidade || "—"}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{c.profissao || "—"}</TableCell>
                        <TableCell className="text-xs">{c.administradora || "—"}</TableCell>
                        <TableCell className="text-xs font-mono">{c.grupo}/{c.cota}</TableCell>
                        <TableCell className="text-right font-medium">{BRL(c.totalCredito)}</TableCell>
                        <TableCell>
                          <Badge
                            variant={/ativ/i.test(c.situacao || "") ? "default" : "secondary"}
                            className="text-[10px]"
                          >
                            {c.situacao || "—"}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
              {filtered.length > 500 && (
                <p className="text-xs text-muted-foreground text-center py-2">
                  Mostrando primeiros 500 de {filtered.length}. Use os filtros para refinar.
                </p>
              )}
            </div>
          ) : (
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Vendedor</TableHead>
                    <TableHead>Adm</TableHead>
                    <TableHead>Grupo/Cota</TableHead>
                    <TableHead>Contrato</TableHead>
                    <TableHead>Data Venda</TableHead>
                    <TableHead>Cidade</TableHead>
                    <TableHead className="text-right">Crédito</TableHead>
                    <TableHead>Situação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredCotas.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                        Nenhuma cota encontrada
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredCotas.slice(0, 1000).map((c, i) => (
                      <TableRow key={`${c.codigo || ""}-${c.grupo}-${c.cota}-${i}`}>
                        <TableCell className="font-medium text-sm">{c.nome || "—"}</TableCell>
                        <TableCell className="text-sm">{c.vendedor || "—"}</TableCell>
                        <TableCell className="text-xs">{c.administradora || "—"}</TableCell>
                        <TableCell className="text-xs font-mono">{c.grupo}/{c.cota}</TableCell>
                        <TableCell className="text-xs font-mono text-muted-foreground">{c.contrato || "—"}</TableCell>
                        <TableCell className="text-xs whitespace-nowrap">{c.data_venda || "—"}</TableCell>
                        <TableCell className="text-sm">{c.cidade || "—"}</TableCell>
                        <TableCell className="text-right font-medium">{BRL(c.creditoNum)}</TableCell>
                        <TableCell>
                          <Badge
                            variant={/ativ/i.test(c.situacao || "") ? "default" : "secondary"}
                            className="text-[10px]"
                          >
                            {c.situacao || "—"}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
              {filteredCotas.length > 1000 && (
                <p className="text-xs text-muted-foreground text-center py-2">
                  Mostrando primeiras 1000 de {filteredCotas.length}. Use os filtros para refinar.
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
