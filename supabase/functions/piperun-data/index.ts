import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const PIPERUN_BASE = "https://api.pipe.run/v1";

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

    // Qualquer usuário autenticado pode consultar; o filtro por vendedor é feito no front

    const PIPERUN_TOKEN = (Deno.env.get("PIPERUN_API_TOKEN") || "").trim();
    if (!PIPERUN_TOKEN) {
      return new Response(JSON.stringify({ error: "PIPERUN_API_TOKEN not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const url = new URL(req.url);
    const resource = url.searchParams.get("resource") || "deals";
    const page = url.searchParams.get("page") || "1";
    const show = url.searchParams.get("show") || "50";
    const fetchAll = url.searchParams.get("all") === "true";

    const piperunHeaders: Record<string, string> = {
      token: PIPERUN_TOKEN,
      "Content-Type": "application/json",
    };

    // Helper: fetch all pages of a paginated resource
    async function fetchAllPages(baseUrl: string, perPage = 200, maxPages = 60): Promise<{ data: any[]; meta: any }> {
      let allData: any[] = [];
      let currentPage = 1;
      let totalPages = 1;
      let meta: any = {};

      while (currentPage <= totalPages && currentPage <= maxPages) {
        const separator = baseUrl.includes("?") ? "&" : "?";
        const pageUrl = `${baseUrl}${separator}show=${perPage}&page=${currentPage}`;
        const res = await fetch(pageUrl, { headers: piperunHeaders });
        const json = await res.json();
        if (!res.ok) throw new Error(`Piperun error: ${JSON.stringify(json)}`);
        if (json?.data) allData = allData.concat(json.data);
        meta = json?.meta || meta;
        totalPages = json?.meta?.total_pages || 1;
        currentPage++;
      }

      return { data: allData, meta: { ...meta, total_items: allData.length, fetched_pages: currentPage - 1 } };
    }

    switch (resource) {
      case "deals": {
        if (fetchAll) {
          const result = await fetchAllPages(`${PIPERUN_BASE}/deals`);
          return new Response(JSON.stringify(result), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        const piperunUrl = `${PIPERUN_BASE}/deals?show=${show}&page=${page}`;
        const response = await fetch(piperunUrl, { headers: piperunHeaders });
        const data = await response.json();
        if (!response.ok) {
          return new Response(JSON.stringify({ error: "Piperun API error", details: data }), {
            status: response.status,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        return new Response(JSON.stringify(data), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      case "persons": {
        const piperunUrl = `${PIPERUN_BASE}/persons?show=${show}&page=${page}`;
        const response = await fetch(piperunUrl, { headers: piperunHeaders });
        const data = await response.json();
        if (!response.ok) {
          return new Response(JSON.stringify({ error: "Piperun API error", details: data }), {
            status: response.status,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        return new Response(JSON.stringify(data), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      case "companies": {
        const piperunUrl = `${PIPERUN_BASE}/companies?show=${show}&page=${page}`;
        const response = await fetch(piperunUrl, { headers: piperunHeaders });
        const data = await response.json();
        if (!response.ok) {
          return new Response(JSON.stringify({ error: "Piperun API error", details: data }), {
            status: response.status,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        return new Response(JSON.stringify(data), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      case "activities": {
        if (fetchAll) {
          const result = await fetchAllPages(`${PIPERUN_BASE}/activities`);
          return new Response(JSON.stringify(result), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        const piperunUrl = `${PIPERUN_BASE}/activities?show=${show}&page=${page}`;
        const response = await fetch(piperunUrl, { headers: piperunHeaders });
        const data = await response.json();
        if (!response.ok) {
          return new Response(JSON.stringify({ error: "Piperun API error", details: data }), {
            status: response.status,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        return new Response(JSON.stringify(data), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      case "pipelines": {
        const response = await fetch(`${PIPERUN_BASE}/pipelines`, { headers: piperunHeaders });
        const data = await response.json();
        if (!response.ok) {
          return new Response(JSON.stringify({ error: "Piperun API error", details: data }), {
            status: response.status,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        return new Response(JSON.stringify(data), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      case "stages": {
        const pipelineId = url.searchParams.get("pipeline_id") || "";
        const baseStagesUrl = pipelineId
          ? `${PIPERUN_BASE}/stages?pipeline_id=${pipelineId}&show=100`
          : `${PIPERUN_BASE}/stages?show=100`;
        const stagesRes = await fetch(baseStagesUrl, { headers: piperunHeaders });
        const stagesData = await stagesRes.json();
        if (!stagesRes.ok) {
          return new Response(JSON.stringify({ error: "Piperun API error", details: stagesData }), {
            status: stagesRes.status,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        let allStages = stagesData?.data || [];
        const totalPages = stagesData?.meta?.total_pages || 1;
        for (let p = 2; p <= totalPages; p++) {
          const nextRes = await fetch(`${baseStagesUrl}&page=${p}`, { headers: piperunHeaders });
          const nextData = await nextRes.json();
          if (nextData?.data) allStages = allStages.concat(nextData.data);
        }
        return new Response(JSON.stringify({ ...stagesData, data: allStages }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      case "users": {
        const piperunUrl = `${PIPERUN_BASE}/users?show=${show}&page=${page}`;
        const response = await fetch(piperunUrl, { headers: piperunHeaders });
        const data = await response.json();
        if (data?.data && Array.isArray(data.data)) {
          const names = data.data.map((u: any) => `${u.id}: ${u.name || u.nome} (active=${u.active})`);
          console.log("[piperun-users]", JSON.stringify(names));
        }
        if (!response.ok) {
          return new Response(JSON.stringify({ error: "Piperun API error", details: data }), {
            status: response.status,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        return new Response(JSON.stringify(data), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      default:
        return new Response(JSON.stringify({ error: "Invalid resource" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
