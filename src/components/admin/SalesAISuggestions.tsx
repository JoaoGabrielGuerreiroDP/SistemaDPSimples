import { useState, useCallback, useMemo } from "react";
import { SaleRow } from "@/hooks/useGoogleSheetsData";
import { Sparkles, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import ReactMarkdown from "react-markdown";

import { isLeadership } from "@/lib/seller-names";

function formatBRL(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

interface SalesAISuggestionsProps {
  rows: SaleRow[];
  allRows: SaleRow[];
  monthLabel: string;
  getMonthRows: (year: number, month: number) => SaleRow[];
  selectedYear: number;
  selectedMonth: number;
}

function buildSalesSummary(
  rows: SaleRow[],
  allRows: SaleRow[],
  monthLabel: string,
  getMonthRows: (y: number, m: number) => SaleRow[],
  selectedYear: number,
  selectedMonth: number
): string {
  // Current month stats
  const totalValue = rows.reduce((s, r) => s + r.valor, 0);
  const totalCount = rows.length;

  // Broker ranking
  const brokerMap: Record<string, { total: number; count: number }> = {};
  rows.forEach((r) => {
    if (!r.corretor) return;
    if (!brokerMap[r.corretor]) brokerMap[r.corretor] = { total: 0, count: 0 };
    brokerMap[r.corretor].total += r.valor;
    brokerMap[r.corretor].count += 1;
  });
  const brokerRanking = Object.entries(brokerMap)
    .map(([name, d]) => ({ name, ...d, isLeader: isLeadership(name) }))
    .sort((a, b) => b.total - a.total);

  // Channel breakdown
  const channelMap: Record<string, { total: number; count: number }> = {};
  rows.forEach((r) => {
    const ch = (r.canalVenda || "Não informado").trim();
    if (!channelMap[ch]) channelMap[ch] = { total: 0, count: 0 };
    channelMap[ch].total += r.valor;
    channelMap[ch].count += 1;
  });

  // Origin breakdown
  const originMap: Record<string, { total: number; count: number }> = {};
  rows.forEach((r) => {
    const og = (r.origemVenda || "Não informado").trim();
    if (!originMap[og]) originMap[og] = { total: 0, count: 0 };
    originMap[og].total += r.valor;
    originMap[og].count += 1;
  });

  // Previous month comparison
  let prevY = selectedYear;
  let prevM = selectedMonth - 1;
  if (prevM < 0) { prevM = 11; prevY -= 1; }
  const prevRows = getMonthRows(prevY, prevM);
  const prevTotal = prevRows.reduce((s, r) => s + r.valor, 0);
  const prevCount = prevRows.length;

  // Previous month broker
  const prevBrokerMap: Record<string, { total: number; count: number }> = {};
  prevRows.forEach((r) => {
    if (!r.corretor) return;
    if (!prevBrokerMap[r.corretor]) prevBrokerMap[r.corretor] = { total: 0, count: 0 };
    prevBrokerMap[r.corretor].total += r.valor;
    prevBrokerMap[r.corretor].count += 1;
  });

  // Previous month channel
  const prevChannelMap: Record<string, { total: number; count: number }> = {};
  prevRows.forEach((r) => {
    const ch = (r.canalVenda || "Não informado").trim();
    if (!prevChannelMap[ch]) prevChannelMap[ch] = { total: 0, count: 0 };
    prevChannelMap[ch].total += r.valor;
    prevChannelMap[ch].count += 1;
  });

  // Previous month origin
  const prevOriginMap: Record<string, { total: number; count: number }> = {};
  prevRows.forEach((r) => {
    const og = (r.origemVenda || "Não informado").trim();
    if (!prevOriginMap[og]) prevOriginMap[og] = { total: 0, count: 0 };
    prevOriginMap[og].total += r.valor;
    prevOriginMap[og].count += 1;
  });

  // Previous month team
  const prevTeamMap: Record<string, { total: number; count: number }> = {};
  prevRows.forEach((r) => {
    const t = r.time || "Sem time";
    if (!prevTeamMap[t]) prevTeamMap[t] = { total: 0, count: 0 };
    prevTeamMap[t].total += r.valor;
    prevTeamMap[t].count += 1;
  });

  // Team breakdown (current)
  const teamMap: Record<string, { total: number; count: number }> = {};
  rows.forEach((r) => {
    const t = r.time || "Sem time";
    if (!teamMap[t]) teamMap[t] = { total: 0, count: 0 };
    teamMap[t].total += r.valor;
    teamMap[t].count += 1;
  });

  // Calculate days elapsed
  const now = new Date();
  const isCurrentMonth = selectedYear === now.getFullYear() && selectedMonth === now.getMonth();
  const currentDay = isCurrentMonth ? now.getDate() : new Date(selectedYear, selectedMonth + 1, 0).getDate();
  const totalDaysInMonth = new Date(selectedYear, selectedMonth + 1, 0).getDate();
  const daysRemaining = totalDaysInMonth - currentDay;
  const prevDaysInMonth = new Date(prevY, prevM + 1, 0).getDate();

  const lines: string[] = [];
  lines.push(`## Resumo de Vendas — ${monthLabel}`);
  lines.push(`Período analisado: Dia 1 até Dia ${currentDay} (${currentDay} dias${isCurrentMonth ? `, faltam ${daysRemaining} dias úteis` : " — mês encerrado"})`);
  lines.push(`Hoje: ${now.toLocaleDateString("pt-BR")}`);
  lines.push(`Total vendido: ${formatBRL(totalValue)} (${totalCount} propostas)`);
  lines.push(`Média por dia: ${formatBRL(totalValue / currentDay)}/dia`);
  lines.push(`Mês anterior (completo, ${prevDaysInMonth} dias): ${formatBRL(prevTotal)} (${prevCount} propostas) — média ${formatBRL(prevTotal / prevDaysInMonth)}/dia`);
  lines.push(`Variação: ${prevTotal > 0 ? (((totalValue - prevTotal) / prevTotal) * 100).toFixed(1) : "N/A"}%`);
  if (isCurrentMonth && prevTotal > 0) {
    const projectedTotal = (totalValue / currentDay) * totalDaysInMonth;
    lines.push(`Projeção p/ fim do mês (ritmo atual): ${formatBRL(projectedTotal)}`);
    lines.push(`Comparação proporcional: em ${currentDay} dias vendemos ${formatBRL(totalValue)}, no mês anterior inteiro foram ${formatBRL(prevTotal)}`);
  }
  lines.push("");

  lines.push("## Ranking de Vendedores (mês atual)");
  brokerRanking.forEach((b, i) => {
    const prev = prevBrokerMap[b.name];
    const prevInfo = prev ? ` (mês ant: ${formatBRL(prev.total)}, ${prev.count}x)` : " (sem vendas mês ant.)";
    const dailyAvg = b.total / currentDay;
    const projected = dailyAvg * totalDaysInMonth;
    lines.push(`${i + 1}. ${b.name}${b.isLeader ? " [LIDERANÇA]" : ""}: ${formatBRL(b.total)} (${b.count} vendas, média ${formatBRL(dailyAvg)}/dia, projeção ${formatBRL(projected)})${prevInfo}`);
  });
  lines.push("");

  // Previous month full ranking
  const prevBrokerRanking = Object.entries(prevBrokerMap)
    .map(([name, d]) => ({ name, ...d, isLeader: isLeadership(name) }))
    .sort((a, b) => b.total - a.total);
  lines.push("## Ranking de Vendedores (mês anterior completo)");
  prevBrokerRanking.forEach((b, i) => {
    const current = brokerMap[b.name];
    const currentInfo = current ? ` (mês atual até agora: ${formatBRL(current.total)}, ${current.count}x)` : " (sem vendas mês atual)";
    lines.push(`${i + 1}. ${b.name}${b.isLeader ? " [LIDERANÇA]" : ""}: ${formatBRL(b.total)} (${b.count} vendas)${currentInfo}`);
  });
  lines.push("");

  lines.push("## Vendas por Canal (mês atual)");
  Object.entries(channelMap).sort((a, b) => b[1].total - a[1].total).forEach(([ch, d]) => {
    const prev = prevChannelMap[ch];
    const prevInfo = prev ? ` | mês ant: ${formatBRL(prev.total)} (${prev.count}x)` : "";
    lines.push(`- ${ch}: ${formatBRL(d.total)} (${d.count}x)${prevInfo}`);
  });
  lines.push("");

  lines.push("## Vendas por Origem (mês atual)");
  Object.entries(originMap).sort((a, b) => b[1].total - a[1].total).forEach(([og, d]) => {
    const prev = prevOriginMap[og];
    const prevInfo = prev ? ` | mês ant: ${formatBRL(prev.total)} (${prev.count}x)` : "";
    lines.push(`- ${og}: ${formatBRL(d.total)} (${d.count}x)${prevInfo}`);
  });
  lines.push("");

  lines.push("## Vendas por Time (mês atual)");
  Object.entries(teamMap).sort((a, b) => b[1].total - a[1].total).forEach(([t, d]) => {
    const prev = prevTeamMap[t];
    const prevInfo = prev ? ` | mês ant: ${formatBRL(prev.total)} (${prev.count}x)` : "";
    lines.push(`- ${t}: ${formatBRL(d.total)} (${d.count}x)${prevInfo}`);
  });

  return lines.join("\n");
}

export function SalesAISuggestions({ rows, allRows, monthLabel, getMonthRows, selectedYear, selectedMonth }: SalesAISuggestionsProps) {
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(false);
  const [hasGenerated, setHasGenerated] = useState(false);

  const salesSummary = useMemo(
    () => buildSalesSummary(rows, allRows, monthLabel, getMonthRows, selectedYear, selectedMonth),
    [rows, allRows, monthLabel, getMonthRows, selectedYear, selectedMonth]
  );

  const generate = useCallback(async () => {
    setLoading(true);
    setContent("");
    setHasGenerated(true);

    try {
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/sales-ai-suggestions`;
      const resp = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ salesSummary }),
      });

      if (!resp.ok || !resp.body) {
        const err = await resp.json().catch(() => ({ error: "Erro desconhecido" }));
        setContent(`❌ ${err.error || "Erro ao gerar sugestões"}`);
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
            if (delta) {
              fullText += delta;
              setContent(fullText);
            }
          } catch {
            buffer = line + "\n" + buffer;
            break;
          }
        }
      }
    } catch (e) {
      setContent("❌ Erro ao conectar com o serviço de IA.");
    } finally {
      setLoading(false);
    }
  }, [salesSummary]);

  return (
    <div className="glass-card p-3 sm:p-5 space-y-3 animate-fade-in">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 sm:w-5 sm:h-5 text-amber-400" />
          <h2 className="font-display text-sm sm:text-lg font-semibold text-foreground">
            IA do DP
          </h2>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="text-[10px] sm:text-xs h-6 sm:h-8 px-2 sm:px-3"
          onClick={generate}
          disabled={loading}
        >
          {loading ? (
            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Sparkles className="w-3.5 h-3.5" />
          )}
          <span className="ml-1">{hasGenerated ? "Atualizar" : "Gerar Análise"}</span>
        </Button>
      </div>

      {!hasGenerated && !loading && (
        <p className="text-xs sm:text-sm text-muted-foreground text-center py-4">
          Clique em <strong>"Gerar Análise"</strong> para a IA analisar seus dados de vendas e sugerir ações.
        </p>
      )}

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
          {loading && (
            <span className="inline-block w-1.5 h-4 bg-primary/60 animate-pulse rounded-sm ml-0.5" />
          )}
        </div>
      )}
    </div>
  );
}
