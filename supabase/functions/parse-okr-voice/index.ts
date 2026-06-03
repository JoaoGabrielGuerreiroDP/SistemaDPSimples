import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

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
    const { transcript, mode, existingDepartments } = await req.json();

    if (!transcript || typeof transcript !== "string") {
      return new Response(
        JSON.stringify({ error: "Transcript is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const deptList = (existingDepartments || []).map((d: any) => `- ${d.name} (id: ${d.id}, icon: ${d.icon})`).join("\n");

    const systemPrompt = `Você é um assistente que interpreta comandos de voz para criar OKRs (Objectives and Key Results).

O usuário vai falar algo como "Criar objetivo de vendas com meta de 100 clientes e faturamento de 1 milhão" e você deve estruturar isso.

Departamentos existentes:
${deptList || "Nenhum departamento cadastrado ainda."}

Regras:
- Se o usuário mencionar um departamento existente, use o id dele no campo "existing_department_id"
- Se for um departamento novo, preencha "new_department" com nome e emoji adequado
- Crie objetivos claros e concisos
- Crie key results mensuráveis e específicos
- Sempre em português do Brasil
- Se não conseguir interpretar, retorne uma mensagem amigável no campo "error"`;

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
          { role: "user", content: transcript },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "create_okrs",
              description: "Cria OKRs estruturados a partir da fala do usuário",
              parameters: {
                type: "object",
                properties: {
                  existing_department_id: {
                    type: "string",
                    description: "ID do departamento existente, se aplicável",
                  },
                  new_department: {
                    type: "object",
                    properties: {
                      name: { type: "string" },
                      icon: { type: "string", description: "Emoji representativo" },
                    },
                  },
                  objectives: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        title: { type: "string" },
                        key_results: {
                          type: "array",
                          items: {
                            type: "object",
                            properties: {
                              title: { type: "string" },
                            },
                            required: ["title"],
                          },
                        },
                      },
                      required: ["title", "key_results"],
                    },
                  },
                  error: {
                    type: "string",
                    description: "Mensagem de erro se não conseguir interpretar",
                  },
                },
                required: ["objectives"],
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "create_okrs" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em alguns segundos." }), {
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
      throw new Error("AI gateway error");
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];

    if (!toolCall) {
      throw new Error("No tool call in response");
    }

    const parsed = JSON.parse(toolCall.function.arguments);

    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("parse-okr-voice error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
