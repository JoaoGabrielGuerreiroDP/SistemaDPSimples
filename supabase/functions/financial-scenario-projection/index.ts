import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const _authClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: _userData, error: _userErr } = await _authClient.auth.getUser(authHeader.replace("Bearer ", ""));
    if (_userErr || !_userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const { historicalData, budgetData, currentMonth, currentYear, salesEstimates } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const systemPrompt = `Você é um analista financeiro especializado em projeções de comissões para empresas de consórcio.

## Contexto da empresa:
A receita vem de comissões de consórcios vendidos por 4 administradoras. As comissões são PARCELADAS:
- **Magalu**: comissão parcelada em **10x**
- **Âncora**: comissão parcelada em **16x**
- **Canopus**: comissão parcelada em **6x**
- **HS Consórcios**: comissão **à vista** (apenas dobras de contemplados)

## Como funciona:
Quando um vendedor vende R$ 1.000.000 em créditos Magalu com 2% de comissão, a empresa recebe R$ 20.000 dividido em 10 parcelas de R$ 2.000/mês.
Isso significa que a comissão de um mês é a SOMA das parcelas de vendas passadas + novas vendas.

## Dados que você recebe:
1. Histórico real de comissão recebida nos últimos 6 meses
2. Premissas orçamentárias (budget) da empresa
3. Estimativas de vendas do gestor para o próximo mês, por administradora

## Sua tarefa:
Com base nas estimativas de vendas informadas e considerando o parcelamento:
1. Calcule a comissão mensal projetada para os próximos 3 meses
2. Lembre que vendas anteriores continuam gerando parcelas nos meses futuros
3. Novas vendas de cada mês começam a gerar parcelas a partir do mês seguinte
4. O cenário realista usa as estimativas informadas como base
5. Otimista: +20-30% nas vendas estimadas
6. Pessimista: -20-30% nas vendas estimadas

Responda EXCLUSIVAMENTE em JSON válido (sem markdown, sem backticks):
{
  "scenarios": {
    "optimistic": {
      "label": "Otimista",
      "description": "Breve justificativa",
      "months": [
        { "month": "Mês/Ano", "commission": 0, "growth": 0, "breakdown": { "magalu": 0, "ancora": 0, "canopus": 0, "hs": 0 } }
      ]
    },
    "realistic": { "label": "Realista", "description": "...", "months": [...] },
    "pessimistic": { "label": "Pessimista", "description": "...", "months": [...] }
  },
  "insights": ["insight1", "insight2", "insight3"],
  "risks": ["risco1", "risco2"],
  "keyAssumptions": ["premissa1", "premissa2"]
}

- commission: valor total em centavos da comissão projetada para o mês
- growth: % de crescimento em relação ao mês anterior
- breakdown: comissão por administradora em centavos
- Valores em centavos (inteiros)`;

    const inadimplenciaInfo = salesEstimates?.inadimplencia > 0
      ? `\n\nEstimativa de perda mensal (inadimplência, pula parcela, grupo novo): R$ ${(salesEstimates.inadimplencia / 100).toFixed(2)}\nIMPORTANTE: Desconte este valor da comissão projetada de CADA mês em todos os cenários. Isso representa parcelas que não serão recebidas por inadimplência, grupos novos ou parcelas puladas.`
      : "";

    const salesInfo = salesEstimates
      ? `\n\nEstimativas de vendas (crédito) para o próximo mês:\n- Magalu: R$ ${(salesEstimates.magalu / 100).toFixed(2)} (comissão em 10x)\n- Âncora: R$ ${(salesEstimates.ancora / 100).toFixed(2)} (comissão em 16x)\n- Canopus: R$ ${(salesEstimates.canopus / 100).toFixed(2)} (comissão em 6x)\n- HS: R$ ${(salesEstimates.hs / 100).toFixed(2)} (comissão à vista)${inadimplenciaInfo}`
      : "";

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Mês atual: ${currentMonth}/${currentYear}\n\nDados históricos reais de comissão (últimos 6 meses):\n${historicalData}\n\nPremissas orçamentárias:\n${budgetData}${salesInfo}` },
        ],
        stream: false,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Limite de requisições atingido." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos insuficientes." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI error:", response.status, t);
      return new Response(JSON.stringify({ error: "Erro no serviço de IA" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const result = await response.json();
    const content = result.choices?.[0]?.message?.content || "";

    let parsed;
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      parsed = JSON.parse(jsonMatch ? jsonMatch[0] : content);
    } catch {
      return new Response(JSON.stringify({ error: "Erro ao processar resposta da IA", raw: content }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("scenario-projection error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
