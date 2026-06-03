import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const PROCFY_BASE = "https://api.procfy.io/api/v1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Not authenticated" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Validate JWT using getUser
    const anonClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await anonClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = user.id;

    // Check admin role using service client
    const serviceClient = createClient(supabaseUrl, supabaseServiceKey);
    const { data: isAdmin } = await serviceClient.rpc("has_role", {
      _user_id: userId,
      _role: "admin",
    });
    const { data: isGestor } = await serviceClient.rpc("has_role", {
      _user_id: userId,
      _role: "gestor",
    });

    if (!isAdmin && !isGestor) {
      return new Response(JSON.stringify({ error: "Admin access required" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const PROCFY_API_KEY = Deno.env.get("PROCFY_API_KEY");
    if (!PROCFY_API_KEY) {
      return new Response(JSON.stringify({ error: "PROCFY_API_KEY not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const url = new URL(req.url);
    const endpoint = url.searchParams.get("endpoint") || "transactions";
    const startDate = url.searchParams.get("start_date") || "";
    const endDate = url.searchParams.get("end_date") || "";
    const page = url.searchParams.get("page") || "1";
    const items = url.searchParams.get("items") || "100";

    const procfyHeaders = {
      Authorization: `Bearer ${PROCFY_API_KEY}`,
      "Content-Type": "application/json",
    };

    let procfyUrl = `${PROCFY_BASE}/${endpoint}?page=${page}&items=${items}`;
    if (startDate) procfyUrl += `&start_date=${startDate}`;
    if (endDate) procfyUrl += `&end_date=${endDate}`;

    const response = await fetch(procfyUrl, { headers: procfyHeaders });
    const data = await response.json();

    if (!response.ok) {
      return new Response(JSON.stringify({ error: "Procfy API error", details: data }), {
        status: response.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
