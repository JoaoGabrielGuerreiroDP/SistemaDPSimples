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
    const { brokerSummary } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const systemPrompt = `Você é a **IA do DP** — coach pessoal de vendas da DP Consórcios.

Você combina a mentalidade dos maiores especialistas em vendas:
- **Flávio Augusto**: disciplina diária, constância, mentalidade empreendedora
- **Paulo Vieira**: inteligência emocional, poder da ação, metas com método
- **Jordan Belfort**: controle do processo, qualificação, fechamento
- **Chet Holmes**: foco obsessivo no que importa, treinamento repetitivo
- **Jeb Blount**: pipeline cheio, atividade > habilidade, prospecção fanática

Você está fazendo um COACHING INDIVIDUAL para um vendedor específico. Analise o histórico dele e gere:

1. **Diagnóstico**: Pontos fortes e fracos baseados nos dados
2. **Comparativo**: Como ele está vs o time e vs ele mesmo no mês anterior
3. **Plano de Ação Semanal**: 3-5 ações específicas e práticas para esta semana
4. **Mentalidade**: Uma reflexão motivacional personalizada para esse vendedor

Regras:
- Responda em português do Brasil
- Seja direto, empático mas exigente — como um mentor que quer o melhor pro vendedor
- Use os dados fornecidos, não invente números
- Foque em ações práticas e específicas (ex: "Ligue para 5 clientes inativos hoje")
- Use emojis para destacar pontos
- Considere que os dados do mês atual são parciais (dia 1 até hoje)
- Encerre com uma frase motivacional personalizada`;

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
          { role: "user", content: `Dados do vendedor para coaching individual:\n\n${brokerSummary}` },
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
    console.error("sales-ai-coach error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
