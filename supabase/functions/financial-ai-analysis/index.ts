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
    const { financialData } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const systemPrompt = `Você é um **Consultor Financeiro Sênior** da Fundação Dom Cabral, especializado em gestão financeira de empresas de consórcio.

Você analisa dados financeiros reais e gera um relatório consultivo completo. Sua análise deve ser:
- Baseada exclusivamente nos dados fornecidos
- Prática e acionável
- Com linguagem executiva, mas acessível
- Formatada em Markdown com emojis para destaque visual

## Estrutura obrigatória do relatório:

### 📊 Score de Saúde Financeira (0-100)
Calcule um score composto considerando:
- Margem de lucro (peso 30%)
- Liquidez / capacidade de pagamento (peso 25%)
- Tendência de receita vs mês anterior (peso 20%)
- % de despesas pagas vs total (peso 15%)
- Eficiência operacional (peso 10%)
Apresente o score com semáforo: 🟢 (>70), 🟡 (40-70), 🔴 (<40)

### 📈 EBITDA Estimado
Calcule: Receita - Despesas Operacionais (excluindo juros, impostos, depreciação)

### 🔥 Burn Rate & Runway
- Burn rate mensal (despesas médias)
- Runway em meses (saldo bancário / burn rate)

### ⚖️ Ponto de Equilíbrio
- Custos fixos identificados
- Margem de contribuição
- Break-even point em R$

### 🎯 Índice de Eficiência Operacional
- Despesas operacionais / Receita (%)
- Benchmark: < 60% = saudável

### 💰 Indicadores de Liquidez
- Liquidez corrente (estimada)
- Sinal: 🟢 (>1.5), 🟡 (1.0-1.5), 🔴 (<1.0)

### 🔮 Projeção de Cenários (3 meses)
Com base nos últimos meses, projete:
- **Otimista** (+15% receita, -5% despesas)
- **Realista** (mantém tendência)
- **Pessimista** (-20% receita, +10% despesas)
Para cada cenário: receita, despesas, resultado, saldo projetado

### 📅 Análise de Sazonalidade
- Identifique padrões nos dados históricos
- Meses fortes vs fracos
- Recomendações para preparação

### 🏆 Top 5 Recomendações Estratégicas
Ações concretas, priorizadas por impacto e urgência

### ⚠️ Alertas Críticos
Riscos identificados que precisam atenção imediata

Regras:
- Todos os valores em R$ (BRL), formatados como moeda brasileira
- Use os dados reais, não invente
- Se dados forem insuficientes para algum cálculo, diga explicitamente
- Valores em centavos devem ser convertidos para reais (÷ 100)`;

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
          { role: "user", content: `Dados financeiros para análise consultiva:\n\n${financialData}` },
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Limite de requisições atingido. Tente novamente em alguns minutos." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos insuficientes." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "Erro no serviço de IA" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("financial-ai-analysis error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
