import { useState } from "react";
import * as XLSX from "xlsx";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Download, FileSpreadsheet, FileText } from "lucide-react";
import { toast } from "sonner";
import { HubPartner } from "@/hooks/useHubData";

interface HubExportButtonProps {
  partners: HubPartner[];
}

const STATUS_MAP: Record<string, string> = {
  Aprovado: "✅ Aprovado",
  Enviado: "📤 Enviado",
  Aguardando: "⏳ Aguardando",
  Pendente: "❌ Pendente",
};

function formatStatus(s: string | null) {
  return s ? STATUS_MAP[s] || s : "—";
}

function buildRows(partners: HubPartner[]) {
  return partners.map((p) => ({
    Nome: p.nome,
    Escritório: p.escritorio || "",
    Cidade: p.cidade || "",
    Etapa: p.etapa,
    
    Responsável: p.responsavel || "",
    Prazo: p.prazo ? new Date(p.prazo).toLocaleDateString("pt-BR") : "",
    "Status Magalu": formatStatus(p.status_mag),
    "Docs Magalu": p.docs_mag || "",
    "Status Âncora": formatStatus(p.status_anc),
    "Docs Âncora": p.docs_anc || "",
    "Status Canopus": formatStatus(p.status_can),
    "Docs Canopus": p.docs_can || "",
    "Próxima Ação": p.prox_acao || "",
  }));
}

function exportExcel(partners: HubPartner[]) {
  const rows = buildRows(partners);
  const ws = XLSX.utils.json_to_sheet(rows);

  // Auto-width columns
  const colWidths = Object.keys(rows[0] || {}).map((key) => ({
    wch: Math.max(key.length, ...rows.map((r) => String((r as any)[key] || "").length)) + 2,
  }));
  ws["!cols"] = colWidths;

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Parceiros HUB");
  XLSX.writeFile(wb, `hub_parceiros_${new Date().toISOString().slice(0, 10)}.xlsx`);
  toast.success("Excel exportado com sucesso!");
}

function exportPDF(partners: HubPartner[]) {
  const rows = buildRows(partners);
  const cols = Object.keys(rows[0] || {});

  const html = `
    <html><head><title>HUB — Parceiros</title>
    <style>
      body { font-family: Arial, sans-serif; font-size: 10px; margin: 20px; }
      h1 { font-size: 16px; margin-bottom: 4px; }
      p { font-size: 10px; color: #666; margin-bottom: 12px; }
      table { border-collapse: collapse; width: 100%; }
      th, td { border: 1px solid #ccc; padding: 4px 6px; text-align: left; white-space: nowrap; }
      th { background: #1a1a2e; color: #fff; font-size: 9px; }
      td { font-size: 9px; }
      tr:nth-child(even) { background: #f5f5f5; }
      @media print { body { margin: 0; } }
    </style></head><body>
    <h1>🏢 HUB — Corretoras Master</h1>
    <p>Exportado em ${new Date().toLocaleDateString("pt-BR")} · ${partners.length} parceiros</p>
    <table>
      <thead><tr>${cols.map((c) => `<th>${c}</th>`).join("")}</tr></thead>
      <tbody>${rows.map((r) => `<tr>${cols.map((c) => `<td>${(r as any)[c]}</td>`).join("")}</tr>`).join("")}</tbody>
    </table>
    </body></html>`;

  const win = window.open("", "_blank");
  if (!win) { toast.error("Popup bloqueado. Permita popups para exportar PDF."); return; }
  win.document.write(html);
  win.document.close();
  win.onload = () => { win.print(); };
  toast.success("PDF aberto para impressão!");
}

export function HubExportButton({ partners }: HubExportButtonProps) {
  if (partners.length === 0) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm">
          <Download className="w-4 h-4 mr-1" /> Exportar
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => exportExcel(partners)}>
          <FileSpreadsheet className="w-4 h-4 mr-2" /> Excel (.xlsx)
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => exportPDF(partners)}>
          <FileText className="w-4 h-4 mr-2" /> PDF (Imprimir)
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
