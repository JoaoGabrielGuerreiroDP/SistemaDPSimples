import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Upload, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useInsertGrupos, type GrupoInput } from "../hooks/useSimuladorGrupos";

type Props = { open: boolean; onOpenChange: (o: boolean) => void };

type ParsedRow = {
  term_months: number;
  credit_value: number;
  payment_half: number;
  payment_full?: number;
  asset_type: "Imovel" | "Veiculo";
  administradora: string | null;
  source_pdf_name: string | null;
  grupo_numero?: string | null;
  admin_fee_percent?: number;
};

export function PdfImportDialog({ open, onOpenChange }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [administradora, setAdministradora] = useState("");
  const [parsing, setParsing] = useState(false);
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const insertMut = useInsertGrupos();

  const reset = () => {
    setFile(null);
    setRows([]);
    setAdministradora("");
  };

  const handleParse = async () => {
    if (!file) return;
    if (file.size > 20 * 1024 * 1024) {
      toast.error("PDF acima de 20MB");
      return;
    }
    setParsing(true);
    try {
      const buf = await file.arrayBuffer();
      const bytes = new Uint8Array(buf);
      let binary = "";
      const chunk = 0x8000;
      for (let i = 0; i < bytes.length; i += chunk) {
        binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunk)));
      }
      const base64 = btoa(binary);

      const { data, error } = await supabase.functions.invoke("pdf-parse-groups", {
        body: {
          pdfBase64: base64,
          administradora: administradora.trim() || null,
          fileName: file.name,
        },
      });

      if (error) throw error;
      if (!data?.groups?.length) {
        toast.error("Nenhuma linha extraída do PDF");
        return;
      }
      setRows(data.groups as ParsedRow[]);
      const imoveis = (data.groups as ParsedRow[]).filter((r) => r.asset_type === "Imovel").length;
      const veics = (data.groups as ParsedRow[]).filter((r) => r.asset_type === "Veiculo").length;
      toast.success(`${data.groups.length} linhas (${imoveis} imóveis, ${veics} veículos) — revise antes de salvar`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erro ao processar PDF";
      toast.error(msg);
    } finally {
      setParsing(false);
    }
  };

  const updateRow = (idx: number, patch: Partial<ParsedRow>) => {
    setRows((r) => r.map((row, i) => (i === idx ? { ...row, ...patch } : row)));
  };
  const removeRow = (idx: number) => setRows((r) => r.filter((_, i) => i !== idx));

  const handleSave = async () => {
    const valid = rows.filter(
      (r) => r.term_months > 0 && r.credit_value > 0 && r.payment_half > 0
    );
    if (!valid.length) {
      toast.error("Nenhuma linha válida");
      return;
    }
    const toInsert: GrupoInput[] = valid.map((r) => ({
      term_months: r.term_months,
      credit_value: r.credit_value,
      payment_half: r.payment_half,
      asset_type: r.asset_type,
      administradora: r.administradora,
      source_pdf_name: r.source_pdf_name,
      admin_fee_percent: Number(r.admin_fee_percent ?? 0) || 0,
    }));
    await insertMut.mutateAsync(toInsert);
    reset();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) reset(); }}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Importar grupos de PDF</DialogTitle>
          <DialogDescription>
            A IA detecta automaticamente Imóvel ou Veículo conforme indicado no PDF, e usa o valor da coluna "PARCELA" como meia parcela.
          </DialogDescription>
        </DialogHeader>

        {!rows.length && (
          <div className="space-y-4">
            <div>
              <Label>Administradora (opcional)</Label>
              <Input
                value={administradora}
                onChange={(e) => setAdministradora(e.target.value)}
                placeholder="Magalu, Âncora, Canopus..."
              />
            </div>
            <div>
              <Label>Arquivo PDF</Label>
              <Input
                type="file"
                accept="application/pdf"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
            </div>
            <Button onClick={handleParse} disabled={!file || parsing} className="w-full">
              {parsing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}
              {parsing ? "Extraindo com IA..." : "Extrair tabela"}
            </Button>
          </div>
        )}

        {rows.length > 0 && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              {rows.length} linhas extraídas. Confira o tipo (Imóvel/Veículo) de cada linha e edite se necessário.
            </p>
            <div className="border rounded-md overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Prazo (meses)</TableHead>
                    <TableHead>Crédito (R$)</TableHead>
                    <TableHead>Meia parcela (R$)</TableHead>
                    <TableHead>Taxa Adm (%)</TableHead>
                    <TableHead>Administradora</TableHead>
                    <TableHead className="w-12"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r, i) => (
                    <TableRow key={i}>
                      <TableCell>
                        <Select
                          value={r.asset_type}
                          onValueChange={(v) => updateRow(i, { asset_type: v as "Imovel" | "Veiculo" })}
                        >
                          <SelectTrigger className="h-8 w-28">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Imovel">Imóvel</SelectItem>
                            <SelectItem value="Veiculo">Veículo</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          value={r.term_months}
                          onChange={(e) => updateRow(i, { term_months: Number(e.target.value) })}
                          className="h-8 w-24"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          step="0.01"
                          value={r.credit_value}
                          onChange={(e) => updateRow(i, { credit_value: Number(e.target.value) })}
                          className="h-8 w-32"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          step="0.01"
                          value={r.payment_half}
                          onChange={(e) => updateRow(i, { payment_half: Number(e.target.value) })}
                          className="h-8 w-28"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          step="0.01"
                          value={r.admin_fee_percent ?? 0}
                          onChange={(e) => updateRow(i, { admin_fee_percent: Number(e.target.value) })}
                          className="h-8 w-24"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          value={r.administradora ?? ""}
                          onChange={(e) => updateRow(i, { administradora: e.target.value || null })}
                          className="h-8"
                        />
                      </TableCell>
                      <TableCell>
                        <Button size="icon" variant="ghost" onClick={() => removeRow(i)}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          {rows.length > 0 && (
            <Button onClick={handleSave} disabled={insertMut.isPending}>
              {insertMut.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Salvar {rows.length} grupos
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
