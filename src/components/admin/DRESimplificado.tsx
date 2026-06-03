import { ProcfyTransaction } from "@/hooks/useProcfyData";
import { Button } from "@/components/ui/button";
import { FileSpreadsheet } from "lucide-react";
import * as XLSX from "xlsx";

const TYPE_LABELS: Record<string, string> = {
  revenue: "Receita",
  fixed_expense: "Despesa Fixa",
  variable_expense: "Despesa Variável",
  payroll: "Folha de Pagamento",
  tax: "Imposto",
  transfer: "Transferência",
};

function formatCurrency(cents: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
}

interface DREProps {
  transactions: ProcfyTransaction[];
  monthLabel: string;
}

interface DRELine {
  label: string;
  value: number;
  bold?: boolean;
  indent?: boolean;
  separator?: boolean;
}

function buildDRE(transactions: ProcfyTransaction[]): DRELine[] {
  const REVENUE_CATEGORIES = ["Comissão"];

  const revenue = transactions
    .filter((t) => t.transaction_type === "revenue" && REVENUE_CATEGORIES.includes(t.category?.name || ""))
    .reduce((sum, t) => sum + t.amount_cents, 0);

  const byType: Record<string, number> = {};
  transactions
    .filter((t) => t.transaction_type !== "revenue" && t.transaction_type !== "transfer")
    .forEach((t) => {
      const type = t.transaction_type;
      byType[type] = (byType[type] || 0) + t.amount_cents;
    });

  const totalExpenses = Object.values(byType).reduce((a, b) => a + b, 0);
  const result = revenue - totalExpenses;

  const lines: DRELine[] = [
    { label: "Receita Bruta (Comissões)", value: revenue, bold: true },
    { label: "", value: 0, separator: true },
  ];

  Object.entries(byType)
    .sort(([, a], [, b]) => b - a)
    .forEach(([type, value]) => {
      lines.push({ label: `(-) ${TYPE_LABELS[type] || type}`, value: -value, indent: true });
    });

  lines.push(
    { label: "", value: 0, separator: true },
    { label: "(=) Total de Despesas", value: -totalExpenses, bold: true },
    { label: "", value: 0, separator: true },
    { label: "(=) Resultado Líquido", value: result, bold: true }
  );

  return lines;
}

export function DRESimplificado({ transactions, monthLabel }: DREProps) {
  const lines = buildDRE(transactions);

  function exportToExcel() {
    const rows = lines
      .filter((l) => !l.separator)
      .map((l) => ({
        Descrição: l.label,
        "Valor (R$)": l.value / 100,
      }));

    const ws = XLSX.utils.json_to_sheet(rows);
    ws["!cols"] = [{ wch: 35 }, { wch: 18 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "DRE");

    // Add transactions detail sheet
    const txnRows = transactions
      .filter((t) => t.transaction_type !== "transfer")
      .map((t) => ({
        Vencimento: t.due_date,
        Nome: t.name,
        Categoria: t.category?.name || "",
        "Centro de Custo": t.cost_center?.name?.trim() || "",
        Tipo: TYPE_LABELS[t.transaction_type] || t.transaction_type,
        "Valor (R$)": t.amount_cents / 100,
        Status: t.paid ? "Pago" : "A pagar",
      }));

    const wsTxn = XLSX.utils.json_to_sheet(txnRows);
    wsTxn["!cols"] = [{ wch: 12 }, { wch: 30 }, { wch: 20 }, { wch: 20 }, { wch: 18 }, { wch: 15 }, { wch: 10 }];
    XLSX.utils.book_append_sheet(wb, wsTxn, "Transações");

    XLSX.writeFile(wb, `DRE_${monthLabel.replace(/ /g, "_")}.xlsx`);
  }

  return (
    <div className="glass-card p-4 sm:p-5 space-y-3 sm:space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-base sm:text-lg font-semibold text-foreground">
          DRE Simplificado — {monthLabel}
        </h2>
        <Button variant="outline" size="sm" className="text-[11px] sm:text-sm h-7 sm:h-9 gap-1.5" onClick={exportToExcel}>
          <FileSpreadsheet className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          <span className="hidden sm:inline">Exportar Excel</span>
          <span className="sm:hidden">Excel</span>
        </Button>
      </div>

      <div className="rounded-lg border border-border overflow-hidden">
        {lines.map((line, i) => {
          if (line.separator) {
            return <div key={i} className="border-t border-border" />;
          }
          const isPositive = line.value >= 0;
          const isResult = line.label.includes("Resultado");
          return (
            <div
              key={i}
              className={`flex items-center justify-between px-3 sm:px-4 py-2 sm:py-2.5 ${
                line.bold ? "bg-muted/30" : ""
              } ${isResult ? (isPositive ? "bg-primary/10" : "bg-destructive/10") : ""}`}
            >
              <span
                className={`text-xs sm:text-sm ${line.bold ? "font-semibold text-foreground" : "text-muted-foreground"} ${
                  line.indent ? "pl-3 sm:pl-4" : ""
                }`}
              >
                {line.label}
              </span>
              <span
                className={`font-mono text-xs sm:text-sm font-medium ${
                  isResult
                    ? isPositive
                      ? "text-primary"
                      : "text-destructive"
                    : line.value >= 0
                    ? "text-foreground"
                    : "text-destructive"
                }`}
              >
                {formatCurrency(Math.abs(line.value))}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
