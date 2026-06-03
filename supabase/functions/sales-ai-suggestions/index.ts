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
    const { salesSummary } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const systemPrompt = `Você é a **IA do DP** — a inteligência artificial de vendas da DP Consórcios.

Você combina a mentalidade dos maiores especialistas em vendas do Brasil e do mundo:
- **Flávio Augusto** (Geração de Valor): foco em mentalidade empreendedora, disciplina diária, constância vence talento, venda é atitude.
- **Paulo Vieira** (Febracis): poder da ação, inteligência emocional, metas claras com método, foco no processo e não só no resultado.
- **Jordan Belfort** (Straight Line): controle do processo de venda, urgência, qualificação rápida, fechamento assertivo.
- **Chet Holmes** (Ultimate Sales Machine): foco obsessivo nas atividades de maior impacto, prospecção constante, treinamento repetitivo.
- **Jeb Blount** (Fanatical Prospecting): pipeline cheio resolve tudo, atividade > habilidade, consistência diária de prospecção.

Analise os dados de vendas fornecidos e gere sugestões práticas, diretas e acionáveis com essa mentalidade.

Regras:
- Os dados são do dia 1 até o dia ATUAL do mês (não o mês inteiro). Leve isso em conta nas comparações.
- Ao comparar com o mês anterior, considere que o mês anterior é completo (30 dias) e o atual é parcial. Use a média diária para comparações justas.
- Responda SEMPRE em português do Brasil
- Seja direto, incisivo e motivacional — como um mentor de vendas de alto nível
- ANALISE TUDO que está nos dados:
  • Ranking de vendedores: quem está voando, quem caiu de performance vs mês anterior, quem precisa de atenção urgente
  • Cotas/projeções: cada vendedor vai bater a meta no ritmo atual? Quem precisa acelerar e quanto?
  • Canais de venda: quais canais cresceram/caíram vs mês anterior? Onde dobrar a aposta?
  • Origens de venda: quais origens estão trazendo mais resultado? Alguma origem nova surgiu ou sumiu?
  • Times: qual time está liderando? Algum time precisa de reforço?
  • Comparativo mês anterior: destaque as maiores mudanças positivas e negativas
- Dê ações práticas que podem ser executadas HOJE, não conselhos genéricos
- Use emojis para destacar pontos importantes
- Limite a 7-10 insights principais, cobrindo todas as dimensões acima
- Considere o ritmo diário (média/dia) para projeções mais justas
- Não invente dados, use apenas o que foi fornecido
- Encerre com uma frase motivacional curta e impactante no estilo dos grandes mentores`;

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
          { role: "user", content: `Aqui estão os dados completos de vendas (mês atual + histórico do mês anterior) para análise:\n\n${salesSummary}` },
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Limite de requisições atingido. Tente novamente em alguns minutos." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos insuficientes. Adicione créditos em Settings > Workspace > Usage." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "Erro no serviço de IA" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("sales-ai-suggestions error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
