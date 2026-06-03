import { useState } from "react";
import { ProcfyTransaction } from "@/hooks/useProcfyData";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CheckCircle2, Clock, Search } from "lucide-react";

const TYPE_LABELS: Record<string, string> = {
  revenue: "Receita",
  fixed_expense: "Despesa Fixa",
  variable_expense: "Despesa Variável",
  payroll: "Folha de Pagamento",
  tax: "Imposto",
  transfer: "Transferência",
};

const TYPE_COLORS: Record<string, string> = {
  revenue: "bg-primary/20 text-primary border-primary/30",
  fixed_expense: "bg-destructive/20 text-destructive border-destructive/30",
  variable_expense: "bg-orange-500/20 text-orange-400 border-orange-500/30",
  payroll: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  tax: "bg-red-500/20 text-red-400 border-red-500/30",
  transfer: "bg-blue-500/20 text-blue-400 border-blue-500/30",
};

function formatCurrency(cents: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(cents / 100);
}

function formatDate(dateStr: string) {
  const date = new Date(dateStr + "T00:00:00");
  return date.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
  });
}

interface TransactionsTableProps {
  transactions: ProcfyTransaction[];
  uniqueCategories: string[];
  uniqueCostCenters: string[];
}

export function TransactionsTable({ transactions, uniqueCategories, uniqueCostCenters }: TransactionsTableProps) {
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [costCenterFilter, setCostCenterFilter] = useState<string>("all");

  const filtered = transactions.filter((t) => {
    const matchesSearch =
      !search ||
      t.name.toLowerCase().includes(search.toLowerCase()) ||
      (t.description || "").toLowerCase().includes(search.toLowerCase());
    const matchesType = typeFilter === "all" || t.transaction_type === typeFilter;
    const matchesCategory = categoryFilter === "all" || t.category?.name === categoryFilter;
    const matchesCostCenter = costCenterFilter === "all" || t.cost_center?.name?.trim() === costCenterFilter;
    return matchesSearch && matchesType && matchesCategory && matchesCostCenter;
  });

  const filteredTotal = filtered.reduce((sum, t) => {
    if (t.transaction_type === "revenue") return sum + t.amount_cents;
    return sum - t.amount_cents;
  }, 0);

  const uniqueTypes = [...new Set(transactions.map((t) => t.transaction_type))];

  return (
    <div className="glass-card p-5 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="font-display text-lg font-semibold text-foreground">
          Transações do Mês ({transactions.length})
        </h2>
        {(categoryFilter !== "all" || costCenterFilter !== "all" || typeFilter !== "all") && (
          <div className="text-sm font-medium">
            <span className="text-muted-foreground">Total filtrado: </span>
            <span className={filteredTotal >= 0 ? "text-primary" : "text-destructive"}>
              {formatCurrency(Math.abs(filteredTotal))}
            </span>
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-card border-border"
          />
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-full sm:w-[180px] bg-card border-border">
            <SelectValue placeholder="Tipo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os tipos</SelectItem>
            {uniqueTypes.map((type) => (
              <SelectItem key={type} value={type}>
                {TYPE_LABELS[type] || type}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-full sm:w-[180px] bg-card border-border">
            <SelectValue placeholder="Categoria" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas categorias</SelectItem>
            {uniqueCategories.sort().map((cat) => (
              <SelectItem key={cat} value={cat}>
                {cat}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={costCenterFilter} onValueChange={setCostCenterFilter}>
          <SelectTrigger className="w-full sm:w-[180px] bg-card border-border">
            <SelectValue placeholder="Centro de custo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos centros</SelectItem>
            {uniqueCostCenters.sort().map((cc) => (
              <SelectItem key={cc} value={cc}>
                {cc}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="rounded-lg border border-border overflow-auto max-h-[500px]">
        <Table>
          <TableHeader>
            <TableRow className="border-border hover:bg-transparent">
              <TableHead className="text-muted-foreground">Vencimento</TableHead>
              <TableHead className="text-muted-foreground">Nome</TableHead>
              <TableHead className="text-muted-foreground">Categoria</TableHead>
              <TableHead className="text-muted-foreground">Centro</TableHead>
              <TableHead className="text-muted-foreground">Tipo</TableHead>
              <TableHead className="text-muted-foreground text-right">Valor</TableHead>
              <TableHead className="text-muted-foreground text-center">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                  Nenhuma transação encontrada
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((t) => (
                <TableRow key={t.id} className="border-border">
                  <TableCell className="text-muted-foreground text-sm">
                    {formatDate(t.due_date)}
                  </TableCell>
                  <TableCell className="font-medium text-foreground max-w-[200px] truncate">
                    {t.name}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {t.category?.name || "—"}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {t.cost_center?.name?.trim() || "—"}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={`text-xs ${TYPE_COLORS[t.transaction_type] || "bg-muted text-muted-foreground"}`}
                    >
                      {TYPE_LABELS[t.transaction_type] || t.transaction_type}
                    </Badge>
                  </TableCell>
                  <TableCell
                    className={`text-right font-mono font-medium ${
                      t.transaction_type === "revenue"
                        ? "text-primary"
                        : "text-destructive"
                    }`}
                  >
                    {t.transaction_type === "revenue" ? "+" : "-"}
                    {formatCurrency(t.amount_cents)}
                  </TableCell>
                  <TableCell className="text-center">
                    {t.paid ? (
                      <CheckCircle2 className="w-4 h-4 text-primary mx-auto" />
                    ) : (
                      <Clock className="w-4 h-4 text-muted-foreground mx-auto" />
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {filtered.length > 0 && (
        <div className="text-xs text-muted-foreground text-right">
          Exibindo {filtered.length} de {transactions.length} transações
        </div>
      )}
    </div>
  );
}
