import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useGoogleSheetsData } from "@/hooks/useGoogleSheetsData";
import { useUserRole } from "@/hooks/useUserRole";
import { normalizeName } from "@/lib/seller-names";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertTriangle, CalendarClock, Clock } from "lucide-react";

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

function parseBRDate(raw: string): Date | null {
  if (!raw) return null;
  const parts = raw.split("/");
  if (parts.length !== 3) return null;
  const [day, month, year] = parts.map(Number);
  if (!day || !month || !year) return null;
  const d = new Date(year, month - 1, day);
  return isNaN(d.getTime()) ? null : d;
}

function formatDate(d: Date) {
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

function daysUntilDate(d: Date) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.ceil((d.getTime() - today.getTime()) / 86400000);
}

/**
 * Popup exibido uma única vez por login mostrando os boletos da
 * "Base de dados vendas - Gráfico DP" (Google Sheets) que:
 *  - NÃO estão cancelados
 *  - possuem data preenchida na coluna Vencimento
 *  - vencem nos próximos 7 dias (inclui vencidos em aberto)
 * Controle de exibição via sessionStorage com a chave do user.id.
 */
export function WeeklyBillsPopup() {
  const { user } = useAuth();
  const { isGestor, loading: roleLoading } = useUserRole();
  const { allRows, loading } = useGoogleSheetsData();
  const [open, setOpen] = useState(false);
  const [checked, setChecked] = useState(false);

  const weekBills = useMemo(() => {
    // Fim desta semana = próximo domingo (semana = seg→dom)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dow = today.getDay(); // 0=dom, 1=seg, ... 6=sáb
    const daysUntilSunday = dow === 0 ? 0 : 7 - dow;
    const endOfWeek = new Date(today);
    endOfWeek.setDate(today.getDate() + daysUntilSunday);

    // Vendedor (não gestor) só enxerga as próprias vendas
    const loggedName =
      (user?.user_metadata as { display_name?: string; full_name?: string } | undefined)
        ?.display_name ||
      (user?.user_metadata as { full_name?: string } | undefined)?.full_name ||
      user?.email ||
      "";
    const normalizedSelf = normalizeName(loggedName);

    return allRows
      .filter((r) => {
        const status = (r.status || "").toLowerCase();
        // exclui cancelados
        if (status.includes("cancel")) return false;
        // precisa ter data de vencimento válida
        const due = parseBRDate(r.vencimento);
        if (!due) return false;
        // se não for gestor/admin, filtra pelo corretor logado
        if (!isGestor) {
          if (!r.corretor) return false;
          if (normalizeName(r.corretor) !== normalizedSelf) return false;
        }
        return true;
      })
      .map((r) => {
        const due = parseBRDate(r.vencimento)!;
        return { ...r, _due: due, _days: daysUntilDate(due) };
      })
      // mostra apenas o que vence entre hoje e o fim desta semana (sem vencidos)
      .filter((r) => r._days >= 0 && r._due.getTime() <= endOfWeek.getTime())
      .sort((a, b) => a._days - b._days);
  }, [allRows, isGestor, user]);

  useEffect(() => {
    if (!user || loading || roleLoading || checked) return;
    if (weekBills.length > 0) {
      setOpen(true);
    }
    setChecked(true);
  }, [user, loading, roleLoading, isGestor, weekBills.length, checked]);

  const total = weekBills.reduce((sum, r) => sum + (r.valor || 0), 0);
  const overdueCount = weekBills.filter((r) => r._days < 0).length;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarClock className="w-5 h-5 text-dept-solucoes" />
            Boletos da semana
          </DialogTitle>
          <DialogDescription>
            Estes boletos vencem ainda esta semana.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-1.5 max-h-[360px] overflow-y-auto pr-1">
          {weekBills.map((r, idx) => {
            const isOverdue = r._days < 0;
            const title = r.cliente || r.proposta || "—";
            return (
              <div
                key={`${r.proposta || "row"}-${idx}`}
                className={`flex items-center justify-between gap-2 px-3 py-2 rounded-lg border text-xs sm:text-sm ${
                  isOverdue
                    ? "border-destructive/30 bg-destructive/5"
                    : "border-dept-solucoes/30 bg-dept-solucoes/5"
                }`}
              >
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  {isOverdue ? (
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-destructive" />
                  ) : (
                    <Clock className="w-3.5 h-3.5 shrink-0 text-dept-solucoes" />
                  )}
                  <span className="truncate text-foreground font-medium">{title}</span>
                </div>
                <div className="flex items-center gap-2 sm:gap-3 shrink-0">
                  <span className="text-muted-foreground text-[10px] sm:text-xs">
                    {isOverdue
                      ? `${Math.abs(r._days)}d atraso`
                      : r._days === 0
                        ? "Hoje"
                        : `${r._days}d`}
                  </span>
                  <span className="text-muted-foreground text-[10px] sm:text-xs">
                    {formatDate(r._due)}
                  </span>
                  <span className="font-mono font-medium text-destructive">
                    {formatCurrency(r.valor || 0)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-border">
          <span className="text-xs text-muted-foreground">Total a pagar na semana</span>
          <span className="font-display text-base font-bold text-foreground">
            {formatCurrency(total)}
          </span>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
