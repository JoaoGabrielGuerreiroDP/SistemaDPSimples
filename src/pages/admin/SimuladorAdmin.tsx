import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Plus, Trash2, Power } from "lucide-react";
import { PdfImportDialog } from "@/features/simulador/components/PdfImportDialog";
import {
  useSimuladorGrupos,
  useDeleteGrupo,
  useUpdateGrupo,
} from "@/features/simulador/hooks/useSimuladorGrupos";

const fmt = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

function GruposTable({ assetType }: { assetType: "Imovel" | "Veiculo" }) {
  const { data: grupos = [], isLoading } = useSimuladorGrupos(assetType, false);
  const del = useDeleteGrupo();
  const upd = useUpdateGrupo();

  if (isLoading) return <p className="text-muted-foreground p-4">Carregando...</p>;
  if (!grupos.length)
    return (
      <p className="text-muted-foreground p-4">
        Nenhum grupo cadastrado. Importe um PDF para começar.
      </p>
    );

  return (
    <div className="border rounded-md overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Prazo</TableHead>
            <TableHead>Crédito</TableHead>
            <TableHead>Meia parcela</TableHead>
            <TableHead>Taxa Adm</TableHead>
            <TableHead>Administradora</TableHead>
            <TableHead>Origem</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="w-24">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {grupos.map((g) => (
            <TableRow key={g.id} className={!g.active ? "opacity-50" : ""}>
              <TableCell>{g.term_months}m</TableCell>
              <TableCell>{fmt(g.credit_value)}</TableCell>
              <TableCell>{fmt(g.payment_half)}</TableCell>
              <TableCell>
                <input
                  type="number"
                  step="0.01"
                  defaultValue={g.admin_fee_percent ?? 0}
                  onBlur={(e) => {
                    const v = Number(e.target.value);
                    if (v !== Number(g.admin_fee_percent ?? 0)) {
                      upd.mutate({ id: g.id, admin_fee_percent: v });
                    }
                  }}
                  className="h-8 w-20 px-2 rounded-md border bg-background text-sm"
                />
                <span className="ml-1 text-xs text-muted-foreground">%</span>
              </TableCell>
              <TableCell>{g.administradora ?? "—"}</TableCell>
              <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">
                {g.source_pdf_name ?? "manual"}
              </TableCell>
              <TableCell>
                {g.active ? (
                  <Badge variant="default">Ativo</Badge>
                ) : (
                  <Badge variant="secondary">Inativo</Badge>
                )}
              </TableCell>
              <TableCell>
                <div className="flex gap-1">
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => upd.mutate({ id: g.id, active: !g.active })}
                    title={g.active ? "Desativar" : "Ativar"}
                  >
                    <Power className="w-4 h-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => {
                      if (confirm("Remover este grupo?")) del.mutate(g.id);
                    }}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

export default function SimuladorAdmin() {
  const [importOpen, setImportOpen] = useState(false);

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Admin · Simulador de Consórcio</h1>
          <p className="text-muted-foreground">Gerencie os grupos disponíveis no simulador</p>
        </div>
        <Button onClick={() => setImportOpen(true)}>
          <Plus className="w-4 h-4 mr-2" /> Importar PDF
        </Button>
      </div>

      <Card className="p-4">
        <Tabs defaultValue="Imovel">
          <TabsList>
            <TabsTrigger value="Imovel">Imóveis</TabsTrigger>
            <TabsTrigger value="Veiculo">Veículos</TabsTrigger>
          </TabsList>
          <TabsContent value="Imovel" className="mt-4">
            <GruposTable assetType="Imovel" />
          </TabsContent>
          <TabsContent value="Veiculo" className="mt-4">
            <GruposTable assetType="Veiculo" />
          </TabsContent>
        </Tabs>
      </Card>

      <PdfImportDialog open={importOpen} onOpenChange={setImportOpen} />
    </div>
  );
}
