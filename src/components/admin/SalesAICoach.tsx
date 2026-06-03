import { useState, useCallback } from "react";
import { SaleRow } from "@/hooks/useGoogleSheetsData";
import { UserCheck, X, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import ReactMarkdown from "react-markdown";

function formatBRL(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

import { isLeadership } from "@/lib/seller-names";

interface SalesAICoachProps {
  brokerName: string;
  rows: SaleRow[];
  allRows: SaleRow[];
  getMonthRows: (y: number, m: number) => SaleRow[];
  selectedYear: number;
  selectedMonth: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function buildBrokerSummary(
  brokerName: string,
  rows: SaleRow[],
  allRows: SaleRow[],
  getMonthRows: (y: number, m: number) => SaleRow[],
  selectedYear: number,
  selectedMonth: number
): string {
  const now = new Date();
  const isCurrentMonth = selectedYear === now.getFullYear() && selectedMonth === now.getMonth();
  const currentDay = isCurrentMonth ? now.getDate() : new Date(selectedYear, selectedMonth + 1, 0).getDate();
  const totalDaysInMonth = new Date(selectedYear, selectedMonth + 1, 0).getDate();

  // Current month - this broker
  const brokerRows = rows.filter((r) => r.corretor === brokerName);
  const brokerTotal = brokerRows.reduce((s, r) => s + r.valor, 0);
  const brokerCount = brokerRows.length;

  // Current month - team totals (excluding leadership)
  const teamRows = rows.filter((r) => r.corretor && !isLeadership(r.corretor));
  const teamTotal = teamRows.reduce((s, r) => s + r.valor, 0);
  const teamBrokers = new Set(teamRows.map((r) => r.corretor)).size;

  // Previous month - this broker
  let prevY = selectedYear, prevM = selectedMonth - 1;
  if (prevM < 0) { prevM = 11; prevY -= 1; }
  const prevMonthRows = getMonthRows(prevY, prevM);
  const prevBrokerRows = prevMonthRows.filter((r) => r.corretor === brokerName);
  const prevBrokerTotal = prevBrokerRows.reduce((s, r) => s + r.valor, 0);
  const prevBrokerCount = prevBrokerRows.length;

  // Channel/origin for this broker
  const channelMap: Record<string, { total: number; count: number }> = {};
  const originMap: Record<string, { total: number; count: number }> = {};
  brokerRows.forEach((r) => {
    const ch = (r.canalVenda || "Não informado").trim();
    if (!channelMap[ch]) channelMap[ch] = { total: 0, count: 0 };
    channelMap[ch].total += r.valor;
    channelMap[ch].count += 1;
    const og = (r.origemVenda || "Não informado").trim();
    if (!originMap[og]) originMap[og] = { total: 0, count: 0 };
    originMap[og].total += r.valor;
    originMap[og].count += 1;
  });

  // Last sale date
  const dates = brokerRows.map((r) => {
    if (!r.dataVenda) return null;
    const parts = r.dataVenda.split("/");
    if (parts.length >= 3) return new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
    return null;
  }).filter(Boolean) as Date[];
  const lastSaleDate = dates.length > 0 ? dates.sort((a, b) => b.getTime() - a.getTime())[0] : null;
  const daysSinceLastSale = lastSaleDate ? Math.floor((now.getTime() - lastSaleDate.getTime()) / (1000 * 60 * 60 * 24)) : null;

  // 3-month history
  const history: string[] = [];
  for (let i = 2; i >= 0; i--) {
    let hy = selectedYear, hm = selectedMonth - i;
    while (hm < 0) { hm += 12; hy -= 1; }
    const hRows = getMonthRows(hy, hm).filter((r) => r.corretor === brokerName);
    const hTotal = hRows.reduce((s, r) => s + r.valor, 0);
    const monthNames = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
    history.push(`${monthNames[hm]}/${hy}: ${formatBRL(hTotal)} (${hRows.length} vendas)`);
  }

  const lines: string[] = [];
  lines.push(`# Coach Individual: ${brokerName}`);
  lines.push(`Período: Dia 1 até Dia ${currentDay} de ${totalDaysInMonth} (${isCurrentMonth ? "mês atual em andamento" : "mês encerrado"})`);
  lines.push(`Hoje: ${now.toLocaleDateString("pt-BR")}`);
  lines.push("");
  lines.push("## Performance Atual");
  lines.push(`Total vendido: ${formatBRL(brokerTotal)} (${brokerCount} propostas)`);
  lines.push(`Média diária: ${formatBRL(brokerTotal / currentDay)}/dia`);
  lines.push(`Projeção mês: ${formatBRL((brokerTotal / currentDay) * totalDaysInMonth)}`);
  lines.push(`Ticket médio: ${brokerCount > 0 ? formatBRL(brokerTotal / brokerCount) : "N/A"}`);
  if (daysSinceLastSale !== null) lines.push(`Dias desde última venda: ${daysSinceLastSale}`);
  lines.push("");
  lines.push("## Mês Anterior (completo)");
  lines.push(`Total: ${formatBRL(prevBrokerTotal)} (${prevBrokerCount} propostas)`);
  lines.push(`Variação: ${prevBrokerTotal > 0 ? (((brokerTotal - prevBrokerTotal) / prevBrokerTotal) * 100).toFixed(1) + "%" : "N/A"}`);
  lines.push("");
  lines.push("## Histórico (3 meses)");
  history.forEach((h) => lines.push(`- ${h}`));
  lines.push("");
  lines.push("## Posição no Time");
  lines.push(`Média do time: ${teamBrokers > 0 ? formatBRL(teamTotal / teamBrokers) : "N/A"} (${teamBrokers} vendedores)`);
  lines.push(`${brokerName} está ${teamBrokers > 0 && brokerTotal > teamTotal / teamBrokers ? "ACIMA" : "ABAIXO"} da média`);
  lines.push("");
  lines.push("## Canais de Venda");
  Object.entries(channelMap).sort((a, b) => b[1].total - a[1].total).forEach(([ch, d]) => {
    lines.push(`- ${ch}: ${formatBRL(d.total)} (${d.count}x)`);
  });
  lines.push("");
  lines.push("## Origens de Venda");
  Object.entries(originMap).sort((a, b) => b[1].total - a[1].total).forEach(([og, d]) => {
    lines.push(`- ${og}: ${formatBRL(d.total)} (${d.count}x)`);
  });

  return lines.join("\n");
}

export function SalesAICoach({ brokerName, rows, allRows, getMonthRows, selectedYear, selectedMonth, open, onOpenChange }: SalesAICoachProps) {
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(false);

  const generate = useCallback(async () => {
    setLoading(true);
    setContent("");

    const brokerSummary = buildBrokerSummary(brokerName, rows, allRows, getMonthRows, selectedYear, selectedMonth);

    try {
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/sales-ai-coach`;
      const resp = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ brokerSummary }),
      });

      if (!resp.ok || !resp.body) {
        const err = await resp.json().catch(() => ({ error: "Erro desconhecido" }));
        setContent(`❌ ${err.error || "Erro ao gerar coaching"}`);
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
  }, [brokerName, rows, allRows, getMonthRows, selectedYear, selectedMonth]);

  // Auto-generate on open
  const handleOpenChange = (isOpen: boolean) => {
    onOpenChange(isOpen);
    if (isOpen && !content && !loading) generate();
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserCheck className="w-5 h-5 text-primary" />
            Coach IA — {brokerName}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="flex justify-end">
            <Button variant="outline" size="sm" onClick={generate} disabled={loading} className="text-xs h-7">
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
                  h1: ({ children }) => <h2 className="text-base font-bold text-foreground mt-3 mb-1">{children}</h2>,
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
      </DialogContent>
    </Dialog>
  );
}
