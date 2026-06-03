import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function getToken(): string {
  let token = Deno.env.get("FORMULA_CONSORCIO_TOKEN") || "";
  if (token.startsWith("http")) {
    try {
      const url = new URL(token);
      token = url.searchParams.get("token") || "";
    } catch {
      token = "";
    }
  }
  if (!token) {
    throw new Error("FORMULA_CONSORCIO_TOKEN not configured");
  }
  return token;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    if (userError || !userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const FORMULA_TOKEN = getToken();
    const baseUrl = "https://api.formuladoconsorcio.com.br/services/relatorios";

    // Fetch both endpoints in parallel
    const [historicoRes, vendasRes] = await Promise.all([
      fetch(`${baseUrl}/buscar_historico.php?token=${FORMULA_TOKEN}`, {
        method: "GET",
        headers: { "Content-Type": "application/json" },
      }),
      fetch(`${baseUrl}/buscar_vendas.php?token=${FORMULA_TOKEN}`, {
        method: "GET",
        headers: { "Content-Type": "application/json" },
      }),
    ]);

    if (!historicoRes.ok) {
      const errorText = await historicoRes.text();
      console.error(`Formula historico error [${historicoRes.status}]: ${errorText}`);
      // Consume vendasRes body to avoid leak
      await vendasRes.text();
      return new Response(
        JSON.stringify({ error: `Formula API request failed: ${historicoRes.status}` }),
        { status: historicoRes.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const historico = await historicoRes.json();

    let vendasDetalhadas = null;
    if (vendasRes.ok) {
      try {
        vendasDetalhadas = await vendasRes.json();
      } catch {
        console.error("Failed to parse vendas response");
      }
    } else {
      await vendasRes.text(); // consume body
    }

    // Merge both responses
    const result = {
      ...historico,
      vendas_detalhadas: vendasDetalhadas?.arrayVendas || [],
      vendas_periodo: vendasDetalhadas?.periodo || null,
    };

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error in formula-consorcio:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
