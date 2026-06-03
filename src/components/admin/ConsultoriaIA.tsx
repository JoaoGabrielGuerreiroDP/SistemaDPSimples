import { useState, useCallback } from "react";
import { Brain, Loader2, RefreshCw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAuth } from "@/hooks/useAuth";
import ReactMarkdown from "react-markdown";

interface ConsultoriaIAProps {
  financialSummary: {
    revenue: number;
    expenses: number;
    paidExpenses: number;
    unpaidExpenses: number;
    profit: number;
    totalBalance: number;
    paidExpenseCount: number;
    unpaidExpenseCount: number;
    totalCount: number;
    byType: Record<string, number>;
  };
  transactions: any[];
  bankAccounts: any[];
  multiMonthData: { month: string; year: number; revenue: number; expenses: number }[];
  selectedMonth: number;
  selectedYear: number;
}

const MONTH_NAMES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

function formatCurrency(cents: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(cents / 100);
}

export function ConsultoriaIA({
  financialSummary,
  transactions,
  bankAccounts,
  multiMonthData,
  selectedMonth,
  selectedYear,
}: ConsultoriaIAProps) {
  const { session } = useAuth();
  const [open, setOpen] = useState(false);
  const [analysis, setAnalysis] = useState("");
  const [loading, setLoading] = useState(false);
  const [hasGenerated, setHasGenerated] = useState(false);

  const buildFinancialDataPrompt = useCallback(() => {
    const margin = financialSummary.revenue > 0
      ? ((financialSummary.profit / financialSummary.revenue) * 100).toFixed(1)
      : "0";

    const efficiencyIndex = financialSummary.revenue > 0
      ? ((financialSummary.expenses / financialSummary.revenue) * 100).toFixed(1)
      : "N/A";

    // Categorize expenses
    const expensesByCategory: Record<string, number> = {};
    const fixedExpenses: number[] = [];
    const variableExpenses: number[] = [];

    transactions.forEach((t: any) => {
      if (t.transaction_type === "revenue" || t.transaction_type === "transfer") return;
      if (t.category?.name === "Operação") return;
      const cat = t.category?.name || "Sem categoria";
      expensesByCategory[cat] = (expensesByCategory[cat] || 0) + t.amount_cents;
      if (t.transaction_type === "fixed_expense") {
        fixedExpenses.push(t.amount_cents);
      } else {
        variableExpenses.push(t.amount_cents);
      }
    });

    const topExpenses = Object.entries(expensesByCategory)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([cat, val]) => `  - ${cat}: ${formatCurrency(val)}`)
      .join("\n");

    const totalFixed = fixedExpenses.reduce((s, v) => s + v, 0);
    const totalVariable = variableExpenses.reduce((s, v) => s + v, 0);

    const bankSummary = bankAccounts
      .map((a: any) => `  - ${a.name}: ${formatCurrency(a.balance_cents)}`)
      .join("\n");

    const historicalData = multiMonthData
      .map((m) => `  - ${m.month}/${m.year}: Receita ${formatCurrency(m.revenue)} | Despesas ${formatCurrency(m.expenses)} | Resultado ${formatCurrency(m.revenue - m.expenses)}`)
      .join("\n");

    return `## Período: ${MONTH_NAMES[selectedMonth]} ${selectedYear}

## Resumo Financeiro
- Receita (Comissão): ${formatCurrency(financialSummary.revenue)}
- Despesas Totais: ${formatCurrency(financialSummary.expenses)}
  - Despesas Fixas: ${formatCurrency(totalFixed)}
  - Despesas Variáveis: ${formatCurrency(totalVariable)}
- Despesas Pagas: ${formatCurrency(financialSummary.paidExpenses)} (${financialSummary.paidExpenseCount} transações)
- Despesas a Pagar: ${formatCurrency(financialSummary.unpaidExpenses)} (${financialSummary.unpaidExpenseCount} transações)
- Resultado: ${formatCurrency(financialSummary.profit)}
- Margem de Lucro: ${margin}%
- Índice de Eficiência: ${efficiencyIndex}%

## Por Tipo de Transação
${Object.entries(financialSummary.byType).map(([k, v]) => `  - ${k}: ${formatCurrency(v)}`).join("\n")}

## Top 10 Categorias de Despesa
${topExpenses}

## Saldos Bancários
${bankSummary}
- Saldo Total: ${formatCurrency(financialSummary.totalBalance)}

## Histórico (últimos 6 meses)
${historicalData}

## Transações Totais no Mês: ${financialSummary.totalCount}`;
  }, [financialSummary, transactions, bankAccounts, multiMonthData, selectedMonth, selectedYear]);

  const generateAnalysis = useCallback(async () => {
    if (!session) return;
    setLoading(true);
    setAnalysis("");
    setHasGenerated(true);

    const financialData = buildFinancialDataPrompt();

    try {
      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/financial-ai-analysis`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({ financialData }),
        }
      );

      if (!resp.ok || !resp.body) {
        const err = await resp.json().catch(() => ({ error: "Erro desconhecido" }));
        setAnalysis(`❌ Erro: ${err.error || "Falha ao gerar análise"}`);
        setLoading(false);
        return;
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let textBuffer = "";
      let fullText = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        textBuffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = textBuffer.indexOf("\n")) !== -1) {
          let line = textBuffer.slice(0, newlineIndex);
          textBuffer = textBuffer.slice(newlineIndex + 1);

          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (line.startsWith(":") || line.trim() === "") continue;
          if (!line.startsWith("data: ")) continue;

          const jsonStr = line.slice(6).trim();
          if (jsonStr === "[DONE]") break;

          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) {
              fullText += content;
              setAnalysis(fullText);
            }
          } catch {
            textBuffer = line + "\n" + textBuffer;
            break;
          }
        }
      }
    } catch (e) {
      console.error("Financial AI error:", e);
      setAnalysis("❌ Erro ao conectar com o serviço de IA.");
    } finally {
      setLoading(false);
    }
  }, [session, buildFinancialDataPrompt]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button className="inline-flex items-center justify-center w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-primary/15 hover:bg-primary/25 transition-colors focus:outline-none focus:ring-2 focus:ring-primary/40">
          <Brain className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl h-[90vh] flex flex-col p-0">
        <DialogHeader className="px-4 sm:px-6 pt-4 sm:pt-6 pb-2 border-b border-border shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 sm:gap-3">
              <Brain className="w-5 h-5 sm:w-6 sm:h-6 text-primary" />
              <div>
                <DialogTitle className="font-display text-base sm:text-xl font-bold">
                  Consultoria IA
                </DialogTitle>
                <p className="text-[10px] sm:text-xs text-muted-foreground">
                  {MONTH_NAMES[selectedMonth]} {selectedYear} • Análise Dom Cabral
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {hasGenerated && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={generateAnalysis}
                  disabled={loading}
                  className="text-[11px] sm:text-xs h-7 sm:h-8"
                >
                  <RefreshCw className={`w-3 h-3 sm:w-3.5 sm:h-3.5 ${loading ? "animate-spin" : ""}`} />
                  <span className="hidden sm:inline ml-1">Regenerar</span>
                </Button>
              )}
            </div>
          </div>
        </DialogHeader>

        <ScrollArea className="flex-1 px-4 sm:px-6 py-4">
          {!hasGenerated ? (
            <div className="flex flex-col items-center justify-center h-full min-h-[300px] gap-4 sm:gap-6 text-center">
              <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-primary/10 flex items-center justify-center">
                <Brain className="w-8 h-8 sm:w-10 sm:h-10 text-primary" />
              </div>
              <div className="space-y-2 max-w-sm">
                <h3 className="font-display text-base sm:text-lg font-semibold text-foreground">
                  Análise Estratégica Completa
                </h3>
                <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                  A IA analisará seus dados financeiros e gerará um relatório consultivo com:
                </p>
                <ul className="text-[11px] sm:text-xs text-muted-foreground space-y-1 text-left mx-auto max-w-xs">
                  <li>📊 Score de Saúde Financeira (0-100)</li>
                  <li>📈 EBITDA Estimado</li>
                  <li>🔥 Burn Rate & Runway</li>
                  <li>⚖️ Ponto de Equilíbrio</li>
                  <li>🎯 Eficiência Operacional</li>
                  <li>💰 Indicadores de Liquidez</li>
                  <li>🔮 Projeção de Cenários</li>
                  <li>📅 Análise de Sazonalidade</li>
                  <li>🏆 Top 5 Recomendações</li>
                  <li>⚠️ Alertas Críticos</li>
                </ul>
              </div>
              <Button
                onClick={generateAnalysis}
                disabled={loading}
                className="gap-2 bg-gradient-to-r from-primary to-primary/80"
                size="lg"
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Brain className="w-4 h-4" />
                )}
                Gerar Análise Completa
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {loading && !analysis && (
                <div className="flex items-center gap-3 p-4 rounded-lg bg-primary/5 border border-primary/20">
                  <Loader2 className="w-5 h-5 animate-spin text-primary" />
                  <div>
                    <p className="text-sm font-medium text-foreground">Analisando dados financeiros...</p>
                    <p className="text-xs text-muted-foreground">Gerando relatório consultivo completo</p>
                  </div>
                </div>
              )}
              {analysis && (
                <div className="prose prose-sm dark:prose-invert max-w-none
                  prose-headings:font-display prose-headings:text-foreground
                  prose-h2:text-base prose-h2:sm:text-lg prose-h2:mt-6 prose-h2:mb-3 prose-h2:border-b prose-h2:border-border prose-h2:pb-2
                  prose-h3:text-sm prose-h3:sm:text-base prose-h3:mt-4 prose-h3:mb-2
                  prose-p:text-xs prose-p:sm:text-sm prose-p:text-muted-foreground prose-p:leading-relaxed
                  prose-li:text-xs prose-li:sm:text-sm prose-li:text-muted-foreground
                  prose-strong:text-foreground
                  prose-ul:my-2 prose-ol:my-2
                ">
                  <ReactMarkdown>{analysis}</ReactMarkdown>
                </div>
              )}
              {loading && analysis && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground animate-pulse">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  Gerando...
                </div>
              )}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
