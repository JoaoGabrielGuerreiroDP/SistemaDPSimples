import { useState, useMemo } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { useProcfyData } from "@/hooks/useProcfyData";
import { useGoogleSheetsData } from "@/hooks/useGoogleSheetsData";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, RefreshCw, TrendingUp, TrendingDown, Wallet, CreditCard, CheckCircle2, Clock, ChevronLeft, ChevronRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { TransactionsTable } from "@/components/admin/TransactionsTable";
import { MonthlyComparisonChart } from "@/components/admin/MonthlyComparisonChart";
import { OKRSummaryWidget } from "@/components/admin/OKRSummaryWidget";
import { SalesTab } from "@/components/admin/SalesTab";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";

const TYPE_LABELS: Record<string, string> = {
  revenue: "Receita",
  fixed_expense: "Despesa Fixa",
  variable_expense: "Despesa Variável",
  payroll: "Folha de Pagamento",
  tax: "Imposto",
  transfer: "Transferência",
};

// Company groupings by bank account name
const COMPANY_GROUPS: Record<string, string[]> = {
  "Todas": [],
  "DP Consórcios": [
    "Sicoob DP Consorcios",
    "Santander DP Consorcios",
    "Conta Azul - DP Soluções",
    "UNICRED ITAJAÍ",
    "UNICRED DP Intermediações",
  ],
  "DP Contempladas e Canceladas": [
    "Contempladas SICRED DP Intermediações",
    "NOVA Contempladas Sicred DP Consorcios",
    "Contempladas SANTANDER DP Intermediações",
    "Excluidas Unicred DP Consorcios",
    "Contempladas SICOOB DP Intermediações",
  ],
};

const CHART_COLORS = [
  "hsl(150, 60%, 45%)",
  "hsl(217, 85%, 55%)",
  "hsl(270, 60%, 58%)",
  "hsl(30, 90%, 55%)",
  "hsl(180, 55%, 45%)",
  "hsl(0, 72%, 55%)",
];

function formatCurrency(cents: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(cents / 100);
}

const MONTH_NAMES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

function getMonthPeriod(year: number, month: number) {
  const startDate = new Date(year, month, 1).toISOString().split("T")[0];
  const endDate = new Date(year, month + 1, 0).toISOString().split("T")[0];
  return { startDate, endDate };
}

export default function AdminDashboard() {
  const now = new Date();
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth());
  const period = getMonthPeriod(selectedYear, selectedMonth);
  const isCurrentMonth = selectedYear === now.getFullYear() && selectedMonth === now.getMonth();

  const { user } = useAuth();
  const { role, isAdmin, isGestor, loading: adminLoading } = useUserRole();
  const navigate = useNavigate();
  const { loading, error, summary, bankAccounts, transactions, uniqueCategories, uniqueCostCenters, reload } = useProcfyData(period);
  const [selectedCompany, setSelectedCompany] = useState("Todas");
  const sheetsData = useGoogleSheetsData();
  const monthRows = useMemo(
    () => sheetsData.getMonthRows(selectedYear, selectedMonth),
    [sheetsData, selectedYear, selectedMonth]
  );
  const monthLabel = `${MONTH_NAMES[selectedMonth]} ${selectedYear}`;

  // Filter transactions and bank accounts by selected company
  const filteredTransactions = useMemo(() => {
    if (selectedCompany === "Todas") return transactions;
    const accountNames = COMPANY_GROUPS[selectedCompany] || [];
    return transactions.filter((t) => {
      const name = t.bank_account?.name?.trim() || "";
      return accountNames.some((an) => name.includes(an.trim()));
    });
  }, [transactions, selectedCompany]);

  const filteredBankAccounts = useMemo(() => {
    if (selectedCompany === "Todas") return bankAccounts;
    const accountNames = COMPANY_GROUPS[selectedCompany] || [];
    return bankAccounts.filter((a) => accountNames.some((an) => a.name.trim().includes(an.trim())));
  }, [bankAccounts, selectedCompany]);

  // Recalculate summary for filtered data
  const filteredSummary = useMemo(() => {
    const REVENUE_CATEGORIES = ["Comissão"];
    const revenue = filteredTransactions
      .filter((t) => t.transaction_type === "revenue" && REVENUE_CATEGORIES.includes(t.category?.name || ""))
      .reduce((sum, t) => sum + t.amount_cents, 0);
    const expenseTransactions = filteredTransactions
      .filter((t) => t.transaction_type !== "revenue" && t.transaction_type !== "transfer");
    const expenses = expenseTransactions.reduce((sum, t) => sum + t.amount_cents, 0);
    const paidExpenses = expenseTransactions.filter((t) => t.paid).reduce((sum, t) => sum + t.amount_cents, 0);
    const unpaidExpenses = expenseTransactions.filter((t) => !t.paid).reduce((sum, t) => sum + t.amount_cents, 0);
    const paidExpenseCount = expenseTransactions.filter((t) => t.paid).length;
    const unpaidExpenseCount = expenseTransactions.filter((t) => !t.paid).length;
    const paid = filteredTransactions.filter((t) => t.paid);
    const unpaid = filteredTransactions.filter((t) => !t.paid);
    const totalBalance = filteredBankAccounts.reduce((sum, a) => sum + a.balance_cents, 0);
    const byType = filteredTransactions.reduce((acc, t) => {
      const type = t.transaction_type;
      acc[type] = (acc[type] || 0) + t.amount_cents;
      return acc;
    }, {} as Record<string, number>);
    const byAccount = filteredTransactions.reduce((acc, t) => {
      const name = t.bank_account?.name || "Sem conta";
      acc[name] = (acc[name] || 0) + t.amount_cents;
      return acc;
    }, {} as Record<string, number>);
    return {
      revenue,
      expenses,
      paidExpenses,
      unpaidExpenses,
      paidExpenseCount,
      unpaidExpenseCount,
      profit: revenue - expenses,
      totalBalance,
      paidCount: paid.length,
      unpaidCount: unpaid.length,
      totalCount: filteredTransactions.length,
      byType,
      byAccount,
    };
  }, [filteredTransactions, filteredBankAccounts]);

  function goToPrevMonth() {
    if (selectedMonth === 0) {
      setSelectedMonth(11);
      setSelectedYear((y) => y - 1);
    } else {
      setSelectedMonth((m) => m - 1);
    }
  }

  function goToNextMonth() {
    if (selectedMonth === 11) {
      setSelectedMonth(0);
      setSelectedYear((y) => y + 1);
    } else {
      setSelectedMonth((m) => m + 1);
    }
  }

  function goToCurrentMonth() {
    setSelectedYear(now.getFullYear());
    setSelectedMonth(now.getMonth());
  }

  if (adminLoading || loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center text-muted-foreground">
        Carregando dashboard...
      </div>
    );
  }

  if (!role) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <p className="text-destructive font-medium">Acesso restrito. Solicite um papel ao administrador.</p>
          <Button variant="outline" onClick={() => navigate("/")}>
            Voltar
          </Button>
        </div>
      </div>
    );
  }

  // Vendedor: filter sales by their display name
  const userName = user?.user_metadata?.display_name || user?.email || "";
  const vendedorRows = role === "vendedor"
    ? monthRows.filter((r) => r.corretor?.toLowerCase().includes(userName.toLowerCase()))
    : monthRows;

  const typeChartData = Object.entries(filteredSummary.byType).map(([key, value]) => ({
    name: TYPE_LABELS[key] || key,
    valor: value / 100,
  }));

  const accountChartData = Object.entries(filteredSummary.byAccount).map(([name, value]) => ({
    name,
    valor: value / 100,
  }));

  const stats = [
    {
      label: "Receita",
      value: formatCurrency(filteredSummary.revenue),
      icon: TrendingUp,
      color: "text-primary",
    },
    {
      label: "Despesas",
      value: formatCurrency(filteredSummary.expenses),
      icon: TrendingDown,
      color: "text-destructive",
    },
    {
      label: "Resultado",
      value: formatCurrency(filteredSummary.profit),
      icon: Wallet,
      color: filteredSummary.profit >= 0 ? "text-primary" : "text-destructive",
    },
    {
      label: "Saldo Total",
      value: formatCurrency(filteredSummary.totalBalance),
      icon: CreditCard,
      color: "text-foreground",
    },
  ];

  const paymentStats = [
    {
      label: "Pagas",
      value: filteredSummary.paidCount,
      icon: CheckCircle2,
      color: "text-primary",
    },
    {
      label: "A pagar",
      value: filteredSummary.unpaidCount,
      icon: Clock,
      color: "text-dept-solucoes",
    },
    {
      label: "Total",
      value: filteredSummary.totalCount,
      icon: CreditCard,
      color: "text-foreground",
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-6xl mx-auto px-3 sm:px-4 py-4 sm:py-12 space-y-4 sm:space-y-6">
        {/* Header */}
        <div className="flex items-start sm:items-center justify-between gap-2">
           <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <div className="min-w-0">
              <h1 className="font-display text-base sm:text-3xl font-bold text-foreground tracking-tight truncate">
                {isAdmin ? "Dashboard Financeiro" : role === "gestor" ? "Painel do Gestor" : "Painel do Vendedor"}
              </h1>
              <p className="text-[10px] sm:text-sm text-muted-foreground truncate">
                {isAdmin ? "Dados do Procfy" : role === "gestor" ? "Vendas e OKRs" : `Olá, ${userName}`}
              </p>
            </div>
          </div>
          <Button variant="outline" size="sm" className="shrink-0 text-[11px] sm:text-sm h-7 sm:h-9 px-2 sm:px-3" onClick={reload} disabled={loading}>
            <RefreshCw className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${loading ? "animate-spin" : ""}`} />
            <span className="hidden sm:inline ml-1">Atualizar</span>
          </Button>
        </div>

        {/* Month Selector */}
        <div className="glass-card p-3 sm:p-4 flex items-center justify-between">
          <Button variant="ghost" size="icon" className="h-8 w-8 sm:h-10 sm:w-10" onClick={goToPrevMonth}>
            <ChevronLeft className="w-4 h-4 sm:w-5 sm:h-5" />
          </Button>
          <div className="flex items-center gap-2 sm:gap-3">
            <span className="font-display text-sm sm:text-lg font-semibold text-foreground">
              {MONTH_NAMES[selectedMonth]} {selectedYear}
            </span>
            {!isCurrentMonth && (
              <Button variant="outline" size="sm" onClick={goToCurrentMonth} className="text-[10px] sm:text-xs h-6 sm:h-8 px-2">
                Ir para Mês Atual
              </Button>
            )}
          </div>
          <Button variant="ghost" size="icon" className="h-8 w-8 sm:h-10 sm:w-10" onClick={goToNextMonth} disabled={isCurrentMonth}>
            <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5" />
          </Button>
        </div>

        {/* Tabs */}
        <Tabs defaultValue={isAdmin ? "financeiro" : "vendas"} className="space-y-6">
          <TabsList className={`grid w-full ${isAdmin ? "grid-cols-2" : role === "vendedor" ? "grid-cols-2" : "grid-cols-1"}`}>
            {isAdmin && <TabsTrigger value="financeiro">Financeiro</TabsTrigger>}
            <TabsTrigger value="vendas">{role === "vendedor" ? "Vendas Gerais" : "Vendas"}</TabsTrigger>
            {role === "vendedor" && <TabsTrigger value="minhas-vendas">Minhas Vendas</TabsTrigger>}
          </TabsList>

          {isAdmin && (
            <TabsContent value="financeiro" className="space-y-6">
              {/* Company Filter */}
              <div className="flex gap-1.5 sm:gap-2 flex-wrap">
                {Object.keys(COMPANY_GROUPS).map((company) => (
                  <Button
                    key={company}
                    variant={selectedCompany === company ? "default" : "outline"}
                    size="sm"
                    className="text-[11px] sm:text-sm h-7 sm:h-9 px-2 sm:px-3"
                    onClick={() => setSelectedCompany(company)}
                  >
                    {company}
                  </Button>
                ))}
              </div>

              {error && (
                <div className="glass-card p-3 sm:p-4 border-destructive/50 bg-destructive/10 text-destructive text-xs sm:text-sm">
                  {error}
                </div>
              )}

              {/* Hero Card: Comissão Recebida */}
              <div className="glass-card p-4 sm:p-6 space-y-1.5 sm:space-y-2 border-l-4 border-l-primary">
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
                  <span className="text-[11px] sm:text-sm text-muted-foreground font-medium">Comissão Recebida</span>
                </div>
                <div className="font-display text-xl sm:text-4xl font-bold text-primary">
                  {formatCurrency(filteredSummary.revenue)}
                </div>
              </div>

              {/* Despesas Breakdown */}
              <div className="space-y-2.5 sm:space-y-3">
                <div className="glass-card p-3.5 sm:p-5 space-y-2 sm:space-y-3 border-l-4 border-l-destructive">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <TrendingDown className="w-4 h-4 sm:w-5 sm:h-5 text-destructive" />
                      <span className="text-[11px] sm:text-sm text-muted-foreground font-medium">Total de Despesas</span>
                    </div>
                    <span className="font-display text-lg sm:text-3xl font-bold text-destructive">
                      {formatCurrency(filteredSummary.expenses)}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
                  <div className="glass-card p-3 sm:p-4 space-y-1 border-l-4 border-l-primary">
                    <div className="flex items-center gap-1.5 sm:gap-2">
                      <CheckCircle2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-primary" />
                      <span className="text-[10px] sm:text-xs text-muted-foreground">Pagas</span>
                      <span className="text-[9px] sm:text-xs text-muted-foreground/60">({filteredSummary.paidExpenseCount})</span>
                    </div>
                    <div className="font-display text-sm sm:text-xl font-bold text-primary">
                      {formatCurrency(filteredSummary.paidExpenses)}
                    </div>
                  </div>
                  <div className="glass-card p-3 sm:p-4 space-y-1 border-l-4 border-l-dept-solucoes">
                    <div className="flex items-center gap-1.5 sm:gap-2">
                      <Clock className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-dept-solucoes" />
                      <span className="text-[10px] sm:text-xs text-muted-foreground">A Pagar</span>
                      <span className="text-[9px] sm:text-xs text-muted-foreground/60">({filteredSummary.unpaidExpenseCount})</span>
                    </div>
                    <div className="font-display text-sm sm:text-xl font-bold text-dept-solucoes">
                      {formatCurrency(filteredSummary.unpaidExpenses)}
                    </div>
                  </div>
                </div>
              </div>

              {/* Resultado */}
              <div className={`glass-card p-3.5 sm:p-5 space-y-1 border-l-4 ${filteredSummary.profit >= 0 ? "border-l-primary" : "border-l-destructive"}`}>
                <div className="flex items-center gap-2">
                  <Wallet className="w-4 h-4 sm:w-5 sm:h-5 text-foreground" />
                  <span className="text-[11px] sm:text-sm text-muted-foreground font-medium">Resultado</span>
                </div>
                <div className={`font-display text-lg sm:text-3xl font-bold ${filteredSummary.profit >= 0 ? "text-primary" : "text-destructive"}`}>
                  {formatCurrency(filteredSummary.profit)}
                </div>
              </div>

              {/* Charts */}
              {typeChartData.length > 0 && (
                <div className="glass-card p-5 space-y-4">
                  <h2 className="font-display text-lg font-semibold text-foreground">Por Tipo</h2>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={typeChartData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis dataKey="name" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} />
                        <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} tickFormatter={(v) => formatCurrency(v * 100)} />
                        <Tooltip formatter={(v: number) => formatCurrency(v * 100)} contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, color: "hsl(var(--foreground))" }} />
                        <Bar dataKey="valor" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

              {/* Multi-month */}
              <MonthlyComparisonChart />

              {/* OKR Summary */}
              <OKRSummaryWidget />

              {/* Transactions Table */}
              <TransactionsTable transactions={filteredTransactions} uniqueCategories={uniqueCategories} uniqueCostCenters={uniqueCostCenters} />

              {/* Bank Accounts */}
              <div className="glass-card p-5 space-y-4">
                <h2 className="font-display text-lg font-semibold text-foreground">Contas Bancárias</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {filteredBankAccounts.map((account) => (
                    <div key={account.id} className="rounded-lg border border-border bg-card p-4 space-y-1">
                      <div className="text-sm text-muted-foreground">{account.name}</div>
                      <div className={`font-display text-lg font-bold ${account.balance_cents >= 0 ? "text-primary" : "text-destructive"}`}>
                        {formatCurrency(account.balance_cents)}
                      </div>
                    </div>
                  ))}
                  {filteredBankAccounts.length === 0 && (
                    <p className="text-sm text-muted-foreground">Nenhuma conta encontrada</p>
                  )}
                </div>
              </div>
            </TabsContent>
          )}

          <TabsContent value="vendas" className="space-y-6">
            <SalesTab
              rows={monthRows}
              allRows={sheetsData.allRows}
              loading={sheetsData.loading}
              error={sheetsData.error}
              monthLabel={monthLabel}
              getMonthRows={sheetsData.getMonthRows}
              selectedYear={selectedYear}
              selectedMonth={selectedMonth}
            />
          </TabsContent>

          {role === "vendedor" && (
            <TabsContent value="minhas-vendas" className="space-y-6">
              {vendedorRows.length === 0 ? (
                <div className="glass-card p-8 text-center text-muted-foreground">
                  Nenhuma venda encontrada para {userName} em {monthLabel}.
                </div>
              ) : (
                <SalesTab
                  rows={vendedorRows}
                  allRows={sheetsData.allRows.filter((r) => r.corretor?.toLowerCase().includes(userName.toLowerCase()))}
                  loading={sheetsData.loading}
                  error={sheetsData.error}
                  monthLabel={`${monthLabel} — ${userName}`}
                  getMonthRows={(y, m) => sheetsData.getMonthRows(y, m).filter((r) => r.corretor?.toLowerCase().includes(userName.toLowerCase()))}
                  selectedYear={selectedYear}
                  selectedMonth={selectedMonth}
                />
              )}
            </TabsContent>
          )}
        </Tabs>

        {/* OKR Section for gestor and vendedor */}
        {(role === "gestor" || role === "vendedor") && (
          <OKRSummaryWidget />
        )}
      </div>
    </div>
  );
}
