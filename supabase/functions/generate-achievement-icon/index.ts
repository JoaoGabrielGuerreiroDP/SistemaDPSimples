import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { name, description } = await req.json();

    if (!name || typeof name !== "string" || name.length < 2) {
      return new Response(JSON.stringify({ error: "Nome inválido" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY ausente");

    // Auth: precisa estar logado (admin/gestor/líder validados pela RLS no INSERT depois)
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Não autenticado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );
    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "Não autenticado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Role check: only admin/gestor/team_manager can generate icons
    const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: user.id, _role: "admin" });
    const { data: isGestor } = await supabase.rpc("has_role", { _user_id: user.id, _role: "gestor" });
    const { data: isMgr } = await supabase.rpc("is_team_manager", { _user_id: user.id });
    if (!isAdmin && !isGestor && !isMgr) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Prompt no estilo dos ícones existentes
    const prompt = `Premium 3D rendered achievement badge icon, golden trophy or medal, ${description || name}, ` +
      `large readable Portuguese text saying "${name.toUpperCase()}" on a red ribbon banner below, ` +
      `metallic gold finish with glowing rays background, highly detailed, game achievement style, ` +
      `centered composition, on a solid white background`;

    console.log("[generate-achievement-icon] Gerando:", name);

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-pro-image-preview",
        messages: [{ role: "user", content: prompt }],
        modalities: ["image", "text"],
      }),
    });

    if (!aiRes.ok) {
      const errText = await aiRes.text();
      console.error("[generate-achievement-icon] AI error:", aiRes.status, errText);
      if (aiRes.status === 429) {
        return new Response(JSON.stringify({ error: "Muitas requisições. Aguarde um momento." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiRes.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos esgotados. Adicione créditos na workspace." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error(`AI Gateway: ${aiRes.status}`);
    }

    const aiData = await aiRes.json();
    const dataUrl: string | undefined =
      aiData.choices?.[0]?.message?.images?.[0]?.image_url?.url;
    if (!dataUrl?.startsWith("data:image/")) {
      throw new Error("Imagem não retornada pela IA");
    }

    // Decodifica base64 → bytes
    const base64 = dataUrl.split(",")[1];
    const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));

    // Upload ao bucket usando service role (RLS já validada em outra etapa)
    const slug = name.toLowerCase()
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")
      .slice(0, 40);
    const filename = `${slug}-${Date.now()}.png`;

    const { error: uploadErr } = await supabase.storage
      .from("achievement-icons")
      .upload(filename, bytes, { contentType: "image/png", upsert: false });

    if (uploadErr) throw uploadErr;

    const { data: pub } = supabase.storage.from("achievement-icons").getPublicUrl(filename);

    return new Response(
      JSON.stringify({ icon_url: pub.publicUrl, filename }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("[generate-achievement-icon] error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
