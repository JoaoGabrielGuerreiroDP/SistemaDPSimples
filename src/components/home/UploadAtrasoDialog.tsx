import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Upload, Loader2, FileSpreadsheet } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import * as XLSX from "xlsx";

interface Props {
  trigger: React.ReactNode;
  onSuccess: () => void;
}

export function UploadAtrasoDialog({ trigger, onSuccess }: Props) {
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string[][]>([]);
  const [uploading, setUploading] = useState(false);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    try {
      const buf = await f.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });
      setPreview(rows.slice(0, 6).map((r) => r.map((c) => String(c ?? ""))));
    } catch {
      setPreview([]);
    }
  }

  async function handleUpload() {
    if (!file) return;
    setUploading(true);
    try {
      const buf = await file.arrayBuffer();
      const bytes = new Uint8Array(buf);
      let bin = "";
      const chunkSize = 0x8000;
      for (let i = 0; i < bytes.length; i += chunkSize) {
        bin += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
      }
      const fileBase64 = btoa(bin);

      const { data, error } = await supabase.functions.invoke("upload-broker-atraso", {
        body: { fileBase64, fileName: file.name },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);

      toast.success(`Planilha de atraso atualizada: ${(data as any).rows} linhas, ${(data as any).vendedores} vendedores`);
      setOpen(false);
      setFile(null);
      setPreview([]);
      onSuccess();
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || "Erro ao enviar planilha");
    } finally {
      setUploading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5" /> Atualizar planilha de atraso
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="border-2 border-dashed border-border rounded-lg p-6 text-center hover:bg-muted/30 transition-colors">
            <input
              id="planilha-atraso-input"
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={handleFileChange}
              className="hidden"
            />
            <label htmlFor="planilha-atraso-input" className="cursor-pointer flex flex-col items-center gap-2">
              <Upload className="w-8 h-8 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">
                {file ? file.name : "Clique para selecionar arquivo .xlsx ou .csv"}
              </span>
            </label>
          </div>

          {preview.length > 0 && (
            <div className="border rounded-lg overflow-hidden">
              <p className="text-xs text-muted-foreground p-2 bg-muted/30">Pré-visualização (primeiras linhas)</p>
              <div className="overflow-x-auto max-h-48">
                <table className="text-xs w-full">
                  <tbody>
                    {preview.map((row, i) => (
                      <tr key={i} className={i === 0 ? "bg-muted/50 font-semibold" : "border-t border-border/30"}>
                        {row.slice(0, 9).map((c, j) => (
                          <td key={j} className="px-2 py-1 truncate max-w-[120px]">{c}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)} disabled={uploading}>Cancelar</Button>
          <Button onClick={handleUpload} disabled={!file || uploading}>
            {uploading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Enviar e atualizar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}