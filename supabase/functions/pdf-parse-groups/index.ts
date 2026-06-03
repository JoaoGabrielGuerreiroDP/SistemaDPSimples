// Edge function: parse PDF de tabela de parcelas e devolve linhas normalizadas
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
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
    const raw = await req.text();
    if (!raw || !raw.trim()) {
      return new Response(JSON.stringify({ error: "Body vazio" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    let payload: { pdfBase64?: string; administradora?: string | null; fileName?: string | null };
    try {
      payload = JSON.parse(raw);
    } catch {
      return new Response(JSON.stringify({ error: "JSON inválido" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { pdfBase64, administradora, fileName } = payload;

    if (!pdfBase64 || typeof pdfBase64 !== "string") {
      return new Response(JSON.stringify({ error: "pdfBase64 obrigatório" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY não configurada");

    const systemPrompt = `Você extrai TODAS as linhas de tabelas de planos de consórcio de PDFs.

REGRAS:
- O PDF pode ter MÚLTIPLAS PÁGINAS, MÚLTIPLOS GRUPOS e MISTURAR Imóveis e Veículos. Extraia TODAS as linhas.
- Para CADA LINHA, identifique o tipo do bem (Imóvel ou Veículo). O PDF indica isso por:
  · cabeçalho/título do grupo ("IMÓVEL", "IMOVEIS", "VEÍCULO", "AUTO", "VEICULOS", "CARRO")
  · seção/categoria do grupo
  Use "Imovel" para imóveis e "Veiculo" para veículos/automóveis.
- Para cada linha extraia: prazo (meses), valor do crédito (R$) e o valor da coluna PARCELA (R$).
- O valor da coluna PARCELA já é a MEIA PARCELA — use exatamente esse número como payment_half. NÃO divida por 2.
- IGNORE colunas C/SEGURO, TAXA+FUNDO, VAGAS, PARTICIPANTES, observações, cabeçalhos, rodapés.
- Não invente linhas. Não pule linhas. Devolva tudo.
- Se o grupo tiver número (ex: GRUPO 6040), inclua em "grupo_numero".
- TAXA DE ADMINISTRAÇÃO: o PDF normalmente informa a taxa total de administração do grupo (ex: "Taxa de Administração: 21%", "Tx Adm 21%", "TA 21,00%"). Capture esse valor em "admin_fee_percent" como número (ex: 21 para 21%, 18.5 para 18,5%). Se houver taxas diferentes por grupo/linha, use a taxa correspondente. Se não encontrar, use 0.`;

    const userPrompt = `Extraia TODAS as linhas das tabelas deste PDF de consórcio${administradora ? ` (administradora ${administradora})` : ""}. Para cada linha, identifique se é Imóvel ou Veículo conforme indicado no PDF. Retorne via tool call. Não corte resultados.`;

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-pro",
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: [
              { type: "text", text: userPrompt },
              {
                type: "image_url",
                image_url: { url: `data:application/pdf;base64,${pdfBase64}` },
              },
            ],
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "save_groups",
              description: "Salva TODAS as linhas das tabelas extraídas",
              parameters: {
                type: "object",
                properties: {
                  groups: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        asset_type: { type: "string", enum: ["Imovel", "Veiculo"], description: "Tipo do bem desta linha" },
                        term_months: { type: "integer", description: "Prazo em meses" },
                        credit_value: { type: "number", description: "Valor do crédito em reais" },
                        payment_half: { type: "number", description: "Valor da coluna PARCELA em reais (já é a meia parcela)" },
                        grupo_numero: { type: "string", description: "Número do grupo (opcional)" },
                        admin_fee_percent: { type: "number", description: "Taxa de administração em % (ex: 21 para 21%). 0 se não encontrada." },
                      },
                      required: ["asset_type", "term_months", "credit_value", "payment_half"],
                      additionalProperties: false,
                    },
                  },
                },
                required: ["groups"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "save_groups" } },
      }),
    });

    if (!aiResp.ok) {
      const txt = await aiResp.text();
      console.error("AI gateway error:", aiResp.status, txt);
      if (aiResp.status === 429) {
        return new Response(JSON.stringify({ error: "Limite de requisições. Tente em instantes." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiResp.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos da IA esgotados. Adicione em Workspace > Usage." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ error: "Falha na IA: " + txt }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await aiResp.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) {
      return new Response(JSON.stringify({ error: "IA não retornou tabela", raw: data }), {
        status: 422,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const args = JSON.parse(toolCall.function.arguments);
    const groups = (args.groups || []).map((g: { asset_type: string; term_months: number; credit_value: number; payment_half: number; grupo_numero?: string; admin_fee_percent?: number }) => {
      const half = Number(g.payment_half);
      return {
        asset_type: g.asset_type === "Veiculo" ? "Veiculo" : "Imovel",
        term_months: Number(g.term_months),
        credit_value: Number(g.credit_value),
        payment_half: half,
        payment_full: Number((half * 2).toFixed(2)),
        administradora: administradora || null,
        source_pdf_name: fileName || null,
        grupo_numero: g.grupo_numero || null,
        admin_fee_percent: Number(g.admin_fee_percent ?? 0) || 0,
      };
    });

    return new Response(JSON.stringify({ groups }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("pdf-parse-groups error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
