import { useState, useCallback, useMemo, useEffect } from "react";
import { SaleRow } from "@/hooks/useGoogleSheetsData";
import { Newspaper, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import ReactMarkdown from "react-markdown";

function formatBRL(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

import { isLeadership } from "@/lib/seller-names";

interface SalesDailySummaryProps {
  rows: SaleRow[];
  allRows: SaleRow[];
  getMonthRows: (y: number, m: number) => SaleRow[];
  selectedYear: number;
  selectedMonth: number;
}

function buildDailySummary(
  rows: SaleRow[],
  allRows: SaleRow[],
  getMonthRows: (y: number, m: number) => SaleRow[],
  selectedYear: number,
  selectedMonth: number
): string {
  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = `${String(yesterday.getDate()).padStart(2, "0")}/${String(yesterday.getMonth() + 1).padStart(2, "0")}/${yesterday.getFullYear()}`;

  // Yesterday's sales
  const yesterdayRows = rows.filter((r) => r.dataVenda === yesterdayStr);
  const yesterdayTotal = yesterdayRows.reduce((s, r) => s + r.valor, 0);

  // Month so far
  const monthTotal = rows.reduce((s, r) => s + r.valor, 0);
  const monthCount = rows.length;
  const currentDay = now.getDate();
  const totalDaysInMonth = new Date(selectedYear, selectedMonth + 1, 0).getDate();

  // Brokers who sold yesterday
  const yesterdayBrokers: Record<string, { total: number; count: number }> = {};
  yesterdayRows.forEach((r) => {
    if (!r.corretor) return;
    if (!yesterdayBrokers[r.corretor]) yesterdayBrokers[r.corretor] = { total: 0, count: 0 };
    yesterdayBrokers[r.corretor].total += r.valor;
    yesterdayBrokers[r.corretor].count += 1;
  });

  // Brokers without sales in last 3+ days
  const brokerLastSale: Record<string, Date> = {};
  rows.forEach((r) => {
    if (!r.corretor || isLeadership(r.corretor) || !r.dataVenda) return;
    const parts = r.dataVenda.split("/");
    if (parts.length < 3) return;
    const d = new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
    if (!brokerLastSale[r.corretor] || d > brokerLastSale[r.corretor]) {
      brokerLastSale[r.corretor] = d;
    }
  });
  const inactiveBrokers = Object.entries(brokerLastSale)
    .map(([name, lastDate]) => ({ name, days: Math.floor((now.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24)) }))
    .filter((b) => b.days >= 3)
    .sort((a, b) => b.days - a.days);

  // Streaks (consecutive days with sales, excluding sundays)
  const brokerDays: Record<string, Set<string>> = {};
  rows.forEach((r) => {
    if (!r.corretor || isLeadership(r.corretor) || !r.dataVenda) return;
    if (!brokerDays[r.corretor]) brokerDays[r.corretor] = new Set();
    brokerDays[r.corretor].add(r.dataVenda);
  });

  const lines: string[] = [];
  lines.push(`# Resumo Diário — ${now.toLocaleDateString("pt-BR")}`);
  lines.push(`Mês: Dia 1 ao Dia ${currentDay} de ${totalDaysInMonth}`);
  lines.push(`Acumulado mês: ${formatBRL(monthTotal)} (${monthCount} propostas)`);
  lines.push(`Média diária: ${formatBRL(monthTotal / currentDay)}/dia`);
  lines.push(`Projeção: ${formatBRL((monthTotal / currentDay) * totalDaysInMonth)}`);
  lines.push("");

  lines.push("## Vendas de Ontem");
  if (yesterdayRows.length === 0) {
    lines.push("Nenhuma venda registrada ontem.");
  } else {
    lines.push(`Total: ${formatBRL(yesterdayTotal)} (${yesterdayRows.length} propostas)`);
    Object.entries(yesterdayBrokers).sort((a, b) => b[1].total - a[1].total).forEach(([name, d]) => {
      lines.push(`- ${name}: ${formatBRL(d.total)} (${d.count}x)`);
    });
  }
  lines.push("");

  lines.push("## Vendedores Inativos (3+ dias sem vender)");
  if (inactiveBrokers.length === 0) {
    lines.push("Todos os vendedores venderam nos últimos 3 dias! ✅");
  } else {
    inactiveBrokers.forEach((b) => {
      lines.push(`- ⚠️ ${b.name}: ${b.days} dias sem vender`);
    });
  }
  lines.push("");

  // Top 5 ranking current month
  const brokerTotals: Record<string, number> = {};
  rows.forEach((r) => {
    if (!r.corretor || isLeadership(r.corretor)) return;
    brokerTotals[r.corretor] = (brokerTotals[r.corretor] || 0) + r.valor;
  });
  const ranking = Object.entries(brokerTotals).sort((a, b) => b[1] - a[1]).slice(0, 5);
  lines.push("## Top 5 do Mês");
  ranking.forEach(([name, total], i) => {
    lines.push(`${i + 1}. ${name}: ${formatBRL(total)}`);
  });

  return lines.join("\n");
}

export function SalesDailySummary({ rows, allRows, getMonthRows, selectedYear, selectedMonth }: SalesDailySummaryProps) {
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(false);
  const [generated, setGenerated] = useState(false);

  const now = new Date();
  const isCurrentMonth = selectedYear === now.getFullYear() && selectedMonth === now.getMonth();

  const dailySummary = useMemo(
    () => buildDailySummary(rows, allRows, getMonthRows, selectedYear, selectedMonth),
    [rows, allRows, getMonthRows, selectedYear, selectedMonth]
  );

  const generate = useCallback(async () => {
    setLoading(true);
    setContent("");
    setGenerated(true);

    try {
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/sales-ai-daily`;
      const resp = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ dailySummary }),
      });

      if (!resp.ok || !resp.body) {
        const err = await resp.json().catch(() => ({ error: "Erro desconhecido" }));
        setContent(`❌ ${err.error || "Erro ao gerar resumo"}`);
        setLoading(false);
        return;
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let fullText = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let newlineIndex: number;
        while ((newlineIndex = buffer.indexOf("\n")) !== -1) {
          let line = buffer.slice(0, newlineIndex);
          buffer = buffer.slice(newlineIndex + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (line.startsWith(":") || line.trim() === "") continue;
          if (!line.startsWith("data: ")) continue;
          const jsonStr = line.slice(6).trim();
          if (jsonStr === "[DONE]") break;
          try {
            const parsed = JSON.parse(jsonStr);
            const delta = parsed.choices?.[0]?.delta?.content;
            if (delta) { fullText += delta; setContent(fullText); }
          } catch { buffer = line + "\n" + buffer; break; }
        }
      }
    } catch { setContent("❌ Erro ao conectar com o serviço de IA."); }
    finally { setLoading(false); }
  }, [dailySummary]);

  // Auto-generate for current month
  useEffect(() => {
    if (isCurrentMonth && !generated && rows.length > 0) {
      generate();
    }
  }, [isCurrentMonth, generated, rows.length]);

  if (!isCurrentMonth && !generated) return null;

  return (
    <div className="glass-card p-3 sm:p-5 space-y-3 animate-fade-in border-l-4 border-l-amber-500/60">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Newspaper className="w-4 h-4 sm:w-5 sm:h-5 text-amber-400" />
          <h2 className="font-display text-sm sm:text-lg font-semibold text-foreground">
            Resumo do Dia
          </h2>
        </div>
        <Button variant="outline" size="sm" className="text-[10px] sm:text-xs h-6 sm:h-8 px-2 sm:px-3" onClick={generate} disabled={loading}>
          {loading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
          <span className="ml-1">Atualizar</span>
        </Button>
      </div>

      {(loading || content) && (
        <div className="prose prose-sm prose-invert max-w-none text-xs sm:text-sm leading-relaxed">
          <ReactMarkdown
            components={{
              p: ({ children }) => <p className="mb-2 text-foreground/90">{children}</p>,
              ul: ({ children }) => <ul className="space-y-1 mb-2">{children}</ul>,
              li: ({ children }) => <li className="text-foreground/85">{children}</li>,
              strong: ({ children }) => <strong className="text-foreground font-semibold">{children}</strong>,
              h2: ({ children }) => <h3 className="text-sm font-semibold text-foreground mt-3 mb-1">{children}</h3>,
              h3: ({ children }) => <h4 className="text-xs font-semibold text-foreground mt-2 mb-1">{children}</h4>,
            }}
          >
            {content}
          </ReactMarkdown>
          {loading && <span className="inline-block w-1.5 h-4 bg-primary/60 animate-pulse rounded-sm ml-0.5" />}
        </div>
      )}
    </div>
  );
}
