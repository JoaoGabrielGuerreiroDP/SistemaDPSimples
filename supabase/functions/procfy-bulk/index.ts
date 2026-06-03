import { createClient } from "npm:@supabase/supabase-js@2.49.1";

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

    const serviceClient = createClient(supabaseUrl, supabaseServiceKey);
    const { data: isAdmin } = await serviceClient.rpc("has_role", {
      _user_id: user.id,
      _role: "admin",
    });
    const { data: isGestor } = await serviceClient.rpc("has_role", {
      _user_id: user.id,
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
    const itemsPerPage = 200; // max items per page for faster fetching

    const procfyHeaders = {
      Authorization: `Bearer ${PROCFY_API_KEY}`,
      "Content-Type": "application/json",
    };

    // First request to get total pages
    let procfyUrl = `${PROCFY_BASE}/${endpoint}?page=1&items=${itemsPerPage}`;
    if (startDate) procfyUrl += `&start_date=${startDate}`;
    if (endDate) procfyUrl += `&end_date=${endDate}`;

    const firstRes = await fetch(procfyUrl, { headers: procfyHeaders });
    if (!firstRes.ok) {
      const errData = await firstRes.json();
      return new Response(JSON.stringify({ error: "Procfy API error", details: errData }), {
        status: firstRes.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const firstResult = await firstRes.json();
    const allData: any[] = [...(firstResult.data || [])];
    const totalPages = firstResult.page?.pages || 1;

    // Fetch remaining pages in parallel batches of 5
    if (totalPages > 1) {
      const remainingPages = Array.from({ length: totalPages - 1 }, (_, i) => i + 2);
      const BATCH_SIZE = 5;

      for (let i = 0; i < remainingPages.length; i += BATCH_SIZE) {
        const batch = remainingPages.slice(i, i + BATCH_SIZE);
        const results = await Promise.all(
          batch.map(async (page) => {
            let batchUrl = `${PROCFY_BASE}/${endpoint}?page=${page}&items=${itemsPerPage}`;
            if (startDate) batchUrl += `&start_date=${startDate}`;
            if (endDate) batchUrl += `&end_date=${endDate}`;
            const res = await fetch(batchUrl, { headers: procfyHeaders });
            if (!res.ok) return [];
            const json = await res.json();
            return json.data || [];
          })
        );
        results.forEach((data) => allData.push(...data));
      }
    }

    return new Response(JSON.stringify({ data: allData, total: allData.length }), {
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
