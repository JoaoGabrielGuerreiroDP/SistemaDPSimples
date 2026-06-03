import { useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Sparkles, Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface SalesDataSummary {
  totalVendas: number;
  totalCredito: number;
  ticketMedio: number;
  taxaConfirmacao: number;
  totalVendedores: number;
  totalCidades: number;
  rankingVendedores: { name: string; qtd: number; credito: number }[];
  porAdministradora: { name: string; qtd: number; credito: number }[];
  porSituacao: { name: string; value: number }[];
  porOrigem: { name: string; value: number }[];
  porMes: { mes: string; qtd: number; credito: number }[];
  porCidade: { name: string; qtd: number }[];
}

interface GesconAISummaryProps {
  salesData: SalesDataSummary;
}

export function GesconAISummary({ salesData }: GesconAISummaryProps) {
  const [summary, setSummary] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const generateSummary = useCallback(async () => {
    setIsLoading(true);
    setSummary("");

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;

      const resp = await fetch(
        `https://${projectId}.supabase.co/functions/v1/gescon-ai-summary`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify({ salesData }),
        }
      );

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ error: "Erro desconhecido" }));
        throw new Error(err.error || `Erro ${resp.status}`);
      }

      if (!resp.body) throw new Error("Sem resposta do servidor");

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
            const content = parsed.choices?.[0]?.delta?.content as string | undefined;
            if (content) {
              fullText += content;
              setSummary(fullText);
            }
          } catch {
            buffer = line + "\n" + buffer;
            break;
          }
        }
      }

      // Flush remaining
      if (buffer.trim()) {
        for (let raw of buffer.split("\n")) {
          if (!raw) continue;
          if (raw.endsWith("\r")) raw = raw.slice(0, -1);
          if (!raw.startsWith("data: ")) continue;
          const jsonStr = raw.slice(6).trim();
          if (jsonStr === "[DONE]") continue;
          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content as string | undefined;
            if (content) {
              fullText += content;
              setSummary(fullText);
            }
          } catch { /* ignore */ }
        }
      }
    } catch (e: any) {
      console.error("AI summary error:", e);
      toast.error(e.message || "Erro ao gerar resumo com IA");
    } finally {
      setIsLoading(false);
    }
  }, [salesData]);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Resumo Executivo com IA
          </CardTitle>
          <Button
            onClick={generateSummary}
            disabled={isLoading}
            size="sm"
            className="gap-2"
          >
            {isLoading ? (
              <><Loader2 className="h-4 w-4 animate-spin" />Analisando...</>
            ) : summary ? (
              <><RefreshCw className="h-4 w-4" />Atualizar</>
            ) : (
              <><Sparkles className="h-4 w-4" />Gerar Análise</>
            )}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {!summary && !isLoading && (
          <p className="text-sm text-muted-foreground text-center py-8">
            Clique em "Gerar Análise" para que a IA analise seus dados de vendas e gere insights automáticos.
          </p>
        )}
        {(summary || isLoading) && (
          <div className="prose prose-sm dark:prose-invert max-w-none">
            <div
              className="text-sm leading-relaxed whitespace-pre-wrap"
              dangerouslySetInnerHTML={{
                __html: summary
                  .replace(/## (.*)/g, '<h3 class="text-base font-semibold mt-4 mb-2">$1</h3>')
                  .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                  .replace(/\n- /g, '\n• ')
                  .replace(/\n(\d+)\. /g, '\n<strong>$1.</strong> ')
              }}
            />
            {isLoading && <span className="inline-block w-2 h-4 bg-primary animate-pulse ml-1" />}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
