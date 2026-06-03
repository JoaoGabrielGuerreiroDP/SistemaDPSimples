import { useState } from "react";
import { Button } from "@/components/ui/button";
import { FileText, Loader2 } from "lucide-react";
import jsPDF from "jspdf";
import "jspdf-autotable";

interface Props {
  summary: {
    revenue: number;
    expenses: number;
    paidExpenses: number;
    unpaidExpenses: number;
    paidExpenseCount: number;
    unpaidExpenseCount: number;
    profit: number;
    totalBalance: number;
    byType: Record<string, number>;
  };
  monthLabel: string;
  transactions?: any[];
}

function fmt(cents: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
}

const TYPE_LABELS: Record<string, string> = {
  revenue: "Receita",
  fixed_expense: "Despesa Fixa",
  variable_expense: "Despesa Variável",
  payroll: "Folha de Pagamento",
  tax: "Imposto",
  transfer: "Transferência",
};

export function FinanceiroExportPDF({ summary, monthLabel, transactions = [] }: Props) {
  const [loading, setLoading] = useState(false);

  async function handleExport() {
    setLoading(true);
    try {
      const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const pageW = doc.internal.pageSize.getWidth();
      const margin = 15;
      const contentW = pageW - margin * 2;
      let y = margin;

      // Colors
      const primary: [number, number, number] = [37, 99, 235];
      const danger: [number, number, number] = [220, 38, 38];
      const gray: [number, number, number] = [100, 116, 139];
      const dark: [number, number, number] = [15, 23, 42];
      const lightBg: [number, number, number] = [241, 245, 249];

      // Header bar
      doc.setFillColor(...primary);
      doc.rect(0, 0, pageW, 28, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(16);
      doc.setFont("helvetica", "bold");
      doc.text("Resumo Financeiro", margin, 12);
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.text(monthLabel, margin, 19);
      doc.text(`Gerado em: ${new Date().toLocaleDateString("pt-BR")}`, pageW - margin, 19, { align: "right" });
      y = 36;

      // === KPI Cards ===
      const cardH = 22;
      const cardW = contentW / 3 - 2;
      const cards: { label: string; value: string; color: [number, number, number] }[] = [
        { label: "Comissão Recebida", value: fmt(summary.revenue), color: primary },
        { label: "Total Despesas", value: fmt(summary.expenses), color: danger },
        { label: "Resultado", value: fmt(summary.profit), color: summary.profit >= 0 ? primary : danger },
      ];

      cards.forEach((card, i) => {
        const x = margin + i * (cardW + 3);
        doc.setFillColor(...lightBg);
        doc.roundedRect(x, y, cardW, cardH, 2, 2, "F");
        doc.setDrawColor(...card.color);
        doc.setLineWidth(0.8);
        doc.line(x, y + 2, x, y + cardH - 2);
        doc.setTextColor(...gray);
        doc.setFontSize(7);
        doc.setFont("helvetica", "normal");
        doc.text(card.label, x + 4, y + 7);
        doc.setTextColor(...card.color);
        doc.setFontSize(12);
        doc.setFont("helvetica", "bold");
        doc.text(card.value, x + 4, y + 16);
      });
      y += cardH + 6;

      // === Secondary KPIs ===
      const margin2 = summary.revenue > 0 ? ((summary.profit / summary.revenue) * 100).toFixed(1) + "%" : "—";
      const revenueCount = transactions.filter(t => t.transaction_type === "revenue" && t.category?.name === "Comissão").length;
      const ticketMedio = revenueCount > 0 ? fmt(summary.revenue / revenueCount) : "—";

      const row2 = [
        { label: "Despesas Pagas", value: `${fmt(summary.paidExpenses)} (${summary.paidExpenseCount})` },
        { label: "Despesas a Pagar", value: `${fmt(summary.unpaidExpenses)} (${summary.unpaidExpenseCount})` },
        { label: "Margem de Lucro", value: margin2 },
        { label: "Ticket Médio", value: ticketMedio },
      ];
      const smallCardW = contentW / 4 - 2;
      const smallCardH = 18;

      row2.forEach((item, i) => {
        const x = margin + i * (smallCardW + 2.6);
        doc.setFillColor(...lightBg);
        doc.roundedRect(x, y, smallCardW, smallCardH, 2, 2, "F");
        doc.setTextColor(...gray);
        doc.setFontSize(6);
        doc.setFont("helvetica", "normal");
        doc.text(item.label, x + 3, y + 6);
        doc.setTextColor(...dark);
        doc.setFontSize(9);
        doc.setFont("helvetica", "bold");
        doc.text(item.value, x + 3, y + 13);
      });
      y += smallCardH + 8;

      // === Breakdown by Type (bar chart simulation) ===
      doc.setTextColor(...dark);
      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.text("Distribuição por Tipo", margin, y);
      y += 6;

      const typeEntries = Object.entries(summary.byType).filter(([k]) => k !== "transfer");
      const maxVal = Math.max(...typeEntries.map(([, v]) => v), 1);
      const barH = 7;
      const labelW = 42;
      const barMaxW = contentW - labelW - 35;

      typeEntries.forEach(([key, value]) => {
        const label = TYPE_LABELS[key] || key;
        const barW = Math.max((value / maxVal) * barMaxW, 2);

        doc.setTextColor(...gray);
        doc.setFontSize(7);
        doc.setFont("helvetica", "normal");
        doc.text(label, margin, y + 5);

        const isRevenue = key === "revenue";
        doc.setFillColor(...(isRevenue ? primary : danger));
        doc.roundedRect(margin + labelW, y + 1, barW, barH - 2, 1, 1, "F");

        doc.setTextColor(...dark);
        doc.setFontSize(7);
        doc.setFont("helvetica", "bold");
        doc.text(fmt(value), margin + labelW + barW + 2, y + 5);

        y += barH + 1;
      });
      y += 6;

      // === Margin gauge ===
      if (summary.revenue > 0) {
        doc.setTextColor(...dark);
        doc.setFontSize(11);
        doc.setFont("helvetica", "bold");
        doc.text("Indicador de Margem", margin, y);
        y += 6;

        const pct = Math.min(Math.max((summary.profit / summary.revenue) * 100, -100), 100);
        const gaugeW = contentW;
        const gaugeH = 8;

        // Background
        doc.setFillColor(226, 232, 240);
        doc.roundedRect(margin, y, gaugeW, gaugeH, 2, 2, "F");

        // Fill
        const fillW = Math.abs(pct / 100) * gaugeW;
        doc.setFillColor(...(pct >= 0 ? primary : danger));
        doc.roundedRect(margin, y, fillW, gaugeH, 2, 2, "F");

        // Label
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(7);
        doc.setFont("helvetica", "bold");
        if (fillW > 20) {
          doc.text(`${pct.toFixed(1)}%`, margin + 4, y + 5.5);
        } else {
          doc.setTextColor(...dark);
          doc.text(`${pct.toFixed(1)}%`, margin + fillW + 3, y + 5.5);
        }
        y += gaugeH + 8;
      }

      // === Top expense categories table ===
      const expenseTxns = transactions.filter(
        (t: any) => t.transaction_type !== "revenue" && t.transaction_type !== "transfer" && t.category?.name !== "Operação"
      );
      const catTotals: Record<string, number> = {};
      expenseTxns.forEach((t: any) => {
        const cat = t.category?.name || "Outros";
        catTotals[cat] = (catTotals[cat] || 0) + t.amount_cents;
      });
      const topCats = Object.entries(catTotals)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 10);

      if (topCats.length > 0) {
        doc.setTextColor(...dark);
        doc.setFontSize(11);
        doc.setFont("helvetica", "bold");
        doc.text("Top 10 Categorias de Despesa", margin, y);
        y += 2;

        (doc as any).autoTable({
          startY: y,
          margin: { left: margin, right: margin },
          head: [["Categoria", "Valor", "% do Total"]],
          body: topCats.map(([cat, val]) => [
            cat,
            fmt(val),
            summary.expenses > 0 ? `${((val / summary.expenses) * 100).toFixed(1)}%` : "—",
          ]),
          styles: { fontSize: 7, cellPadding: 2, textColor: dark, lineColor: [226, 232, 240], lineWidth: 0.2 },
          headStyles: { fillColor: primary, textColor: [255, 255, 255], fontStyle: "bold", fontSize: 7 },
          alternateRowStyles: { fillColor: [248, 250, 252] },
          theme: "grid",
        });
        y = (doc as any).lastAutoTable.finalY + 8;
      }

      // === Saldo ===
      if (y > 260) { doc.addPage(); y = margin; }

      doc.setFillColor(...(summary.totalBalance >= 0 ? primary : danger));
      doc.roundedRect(margin, y, contentW, 16, 2, 2, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(8);
      doc.setFont("helvetica", "normal");
      doc.text("Saldo Bancário Total", margin + 5, y + 6);
      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.text(fmt(summary.totalBalance), margin + 5, y + 13);

      // Footer
      const pageH = doc.internal.pageSize.getHeight();
      doc.setTextColor(...gray);
      doc.setFontSize(6);
      doc.setFont("helvetica", "normal");
      doc.text("DP Consórcios • Relatório gerado automaticamente", margin, pageH - 5);
      doc.text(new Date().toLocaleString("pt-BR"), pageW - margin, pageH - 5, { align: "right" });

      doc.save(`resumo-financeiro-${monthLabel.replace(/\s+/g, "-").toLowerCase()}.pdf`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleExport}
      disabled={loading}
      className="text-[11px] sm:text-sm h-7 sm:h-9 px-2 sm:px-3"
    >
      {loading ? (
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
      ) : (
        <FileText className="w-3.5 h-3.5" />
      )}
      <span className="hidden sm:inline ml-1">PDF</span>
    </Button>
  );
}
