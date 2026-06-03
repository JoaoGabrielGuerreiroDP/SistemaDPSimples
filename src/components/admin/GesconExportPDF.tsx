import { useState } from "react";
import { Button } from "@/components/ui/button";
import { FileDown, Loader2 } from "lucide-react";
import { toast } from "sonner";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

interface SellerRow {
  name: string;
  qtd: number;
  credito: number;
  ticket: number;
}

interface AdminRow {
  name: string;
  qtd: number;
  credito: number;
}

interface MonthRow {
  mes: string;
  qtd: number;
  credito: number;
}

interface GesconExportPDFProps {
  stats: {
    total: number;
    totalCredito: number;
    ticket: number;
    sellers: number;
    cities: number;
    confirmadas: number;
    taxaConf: number;
  };
  sellerRanking: SellerRow[];
  byAdmin: AdminRow[];
  byMonth: MonthRow[];
  dateFrom?: Date;
  dateTo?: Date;
}

const fmt = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

export function GesconExportPDF({ stats, sellerRanking, byAdmin, byMonth, dateFrom, dateTo }: GesconExportPDFProps) {
  const [loading, setLoading] = useState(false);

  const handleExport = async () => {
    setLoading(true);
    try {
      const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const w = doc.internal.pageSize.getWidth();
      const margin = 14;
      let y = 16;

      // Header
      doc.setFillColor(15, 23, 42); // dark bg
      doc.rect(0, 0, w, 36, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(18);
      doc.setFont("helvetica", "bold");
      doc.text("GESCON — Relatório de Vendas", margin, y + 6);
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      const period = `Período: ${dateFrom ? dateFrom.toLocaleDateString("pt-BR") : "—"} a ${dateTo ? dateTo.toLocaleDateString("pt-BR") : "—"}`;
      doc.text(period, margin, y + 14);
      doc.text(`Gerado em: ${new Date().toLocaleDateString("pt-BR")} às ${new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`, margin, y + 20);

      y = 44;

      // KPI Cards
      doc.setTextColor(30, 30, 30);
      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.text("Resumo Geral", margin, y);
      y += 6;

      const kpis = [
        ["Total de Vendas", String(stats.total)],
        ["Crédito Total", fmt(stats.totalCredito)],
        ["Ticket Médio", fmt(stats.ticket)],
        ["Vendedores Ativos", String(stats.sellers)],
        ["Cidades", String(stats.cities)],
        ["Taxa Confirmação", `${stats.taxaConf.toFixed(1)}%`],
        ["Confirmadas", String(stats.confirmadas)],
      ];

      const cardW = (w - margin * 2 - 6) / 2;
      const cardH = 16;
      kpis.forEach((kpi, i) => {
        const col = i % 2;
        const row = Math.floor(i / 2);
        const cx = margin + col * (cardW + 6);
        const cy = y + row * (cardH + 3);
        doc.setFillColor(241, 245, 249);
        doc.roundedRect(cx, cy, cardW, cardH, 2, 2, "F");
        doc.setFontSize(8);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(100, 116, 139);
        doc.text(kpi[0].toUpperCase(), cx + 4, cy + 5.5);
        doc.setFontSize(13);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(15, 23, 42);
        doc.text(kpi[1], cx + 4, cy + 12.5);
      });

      y += Math.ceil(kpis.length / 2) * (cardH + 3) + 6;

      // Ranking de Vendedores
      doc.setTextColor(30, 30, 30);
      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.text("Ranking de Vendedores", margin, y);
      y += 2;

      autoTable(doc, {
        startY: y,
        margin: { left: margin, right: margin },
        head: [["#", "Vendedor", "Vendas", "Crédito", "Ticket Médio"]],
        body: sellerRanking.slice(0, 20).map((s, i) => [
          String(i + 1),
          s.name,
          String(s.qtd),
          fmt(s.credito),
          fmt(s.ticket),
        ]),
        styles: { fontSize: 8, cellPadding: 2 },
        headStyles: { fillColor: [15, 23, 42], textColor: 255, fontStyle: "bold" },
        alternateRowStyles: { fillColor: [241, 245, 249] },
        columnStyles: {
          0: { cellWidth: 8, halign: "center" },
          2: { halign: "right", cellWidth: 18 },
          3: { halign: "right", cellWidth: 30 },
          4: { halign: "right", cellWidth: 30 },
        },
      });

      y = (doc as any).lastAutoTable.finalY + 8;

      // Check page break
      if (y > 240) { doc.addPage(); y = 16; }

      // Por Administradora
      doc.setTextColor(30, 30, 30);
      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.text("Vendas por Administradora", margin, y);
      y += 2;

      autoTable(doc, {
        startY: y,
        margin: { left: margin, right: margin },
        head: [["Administradora", "Vendas", "Crédito", "% do Total"]],
        body: byAdmin.map(a => [
          a.name,
          String(a.qtd),
          fmt(a.credito),
          `${stats.total > 0 ? ((a.qtd / stats.total) * 100).toFixed(1) : 0}%`,
        ]),
        styles: { fontSize: 8, cellPadding: 2 },
        headStyles: { fillColor: [15, 23, 42], textColor: 255, fontStyle: "bold" },
        alternateRowStyles: { fillColor: [241, 245, 249] },
        columnStyles: {
          1: { halign: "right", cellWidth: 18 },
          2: { halign: "right", cellWidth: 30 },
          3: { halign: "right", cellWidth: 22 },
        },
      });

      y = (doc as any).lastAutoTable.finalY + 8;
      if (y > 240) { doc.addPage(); y = 16; }

      // Evolução Mensal
      doc.setTextColor(30, 30, 30);
      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.text("Evolução Mensal", margin, y);
      y += 2;

      const monthRows = byMonth.map((m, i) => {
        const prev = i > 0 ? byMonth[i - 1] : null;
        const varQtd = prev ? (((m.qtd - prev.qtd) / prev.qtd) * 100).toFixed(1) + "%" : "—";
        const varCred = prev ? (((m.credito - prev.credito) / prev.credito) * 100).toFixed(1) + "%" : "—";
        const ticket = m.qtd > 0 ? m.credito / m.qtd : 0;
        return [m.mes, String(m.qtd), varQtd, fmt(m.credito), varCred, fmt(ticket)];
      });

      autoTable(doc, {
        startY: y,
        margin: { left: margin, right: margin },
        head: [["Mês", "Vendas", "Var.", "Crédito", "Var.", "Ticket"]],
        body: monthRows,
        styles: { fontSize: 8, cellPadding: 2 },
        headStyles: { fillColor: [15, 23, 42], textColor: 255, fontStyle: "bold" },
        alternateRowStyles: { fillColor: [241, 245, 249] },
        columnStyles: {
          1: { halign: "right", cellWidth: 16 },
          2: { halign: "right", cellWidth: 16 },
          3: { halign: "right", cellWidth: 28 },
          4: { halign: "right", cellWidth: 16 },
          5: { halign: "right", cellWidth: 28 },
        },
      });

      // Footer on every page
      const totalPages = doc.getNumberOfPages();
      for (let p = 1; p <= totalPages; p++) {
        doc.setPage(p);
        doc.setFontSize(7);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(150, 150, 150);
        doc.text(`DP Consórcios — GESCON  |  Página ${p}/${totalPages}`, margin, doc.internal.pageSize.getHeight() - 6);
      }

      doc.save(`GESCON_Relatorio_${dateFrom ? dateFrom.toISOString().slice(0, 10) : "inicio"}_${dateTo ? dateTo.toISOString().slice(0, 10) : "fim"}.pdf`);
      toast.success("Relatório PDF exportado com sucesso!");
    } catch (err) {
      console.error("Erro ao gerar PDF:", err);
      toast.error("Erro ao gerar o relatório PDF.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button variant="outline" size="sm" onClick={handleExport} disabled={loading} className="gap-1.5">
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />}
      Exportar PDF
    </Button>
  );
}
