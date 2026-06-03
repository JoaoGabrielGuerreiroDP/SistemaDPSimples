import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const HUBSPOT_BASE = "https://api.hubapi.com";

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

    const HUBSPOT_API_KEY = (Deno.env.get("HUBSPOT_API_KEY") || "").trim();
    if (!HUBSPOT_API_KEY) {
      return new Response(JSON.stringify({ error: "HUBSPOT_API_KEY not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const url = new URL(req.url);
    const resource = url.searchParams.get("resource") || "contacts";
    const limit = Number(url.searchParams.get("limit") || "50");
    const fetchAll = url.searchParams.get("all") === "true";

    const hubspotHeaders = {
      Authorization: `Bearer ${HUBSPOT_API_KEY}`,
      "Content-Type": "application/json",
    };

    // Helper: fetch all pages via HubSpot search API (uses `after` cursor)
    async function fetchAllSearchPages(
      searchUrl: string,
      properties: string[],
      sorts: any[],
      maxPages = 20
    ): Promise<{ results: any[]; total: number }> {
      let allResults: any[] = [];
      let after: string | undefined;
      let page = 0;

      while (page < maxPages) {
        const bodyObj: any = {
          limit: 100, // HubSpot max per search request
          properties,
          sorts,
        };
        if (after) bodyObj.after = after;

        const res = await fetch(searchUrl, {
          method: "POST",
          headers: hubspotHeaders,
          body: JSON.stringify(bodyObj),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(`HubSpot error: ${JSON.stringify(json)}`);

        if (json?.results) allResults = allResults.concat(json.results);
        
        // Check for next page
        after = json?.paging?.next?.after;
        if (!after) break;
        page++;
      }

      return { results: allResults, total: allResults.length };
    }

    switch (resource) {
      case "contacts": {
        const properties = ["firstname", "lastname", "email", "phone", "company", "lifecyclestage", "createdate", "lastmodifieddate", "hubspot_owner_id"];
        const sorts = [{ propertyName: "lastmodifieddate", direction: "DESCENDING" }];
        
        if (fetchAll) {
          const result = await fetchAllSearchPages(`${HUBSPOT_BASE}/crm/v3/objects/contacts/search`, properties, sorts);
          return new Response(JSON.stringify(result), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const response = await fetch(`${HUBSPOT_BASE}/crm/v3/objects/contacts/search`, {
          method: "POST",
          headers: hubspotHeaders,
          body: JSON.stringify({ limit, properties, sorts }),
        });
        const data = await response.json();
        if (!response.ok) {
          return new Response(JSON.stringify({ error: "HubSpot API error", details: data }), {
            status: response.status,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        return new Response(JSON.stringify(data), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      case "deals": {
        const baseDealProperties = ["dealname", "amount", "dealstage", "pipeline", "closedate", "createdate", "hubspot_owner_id", "hs_lastmodifieddate"];
        let stageEntryProperties: string[] = [];

        try {
          const [pipelinesRes, propsRes] = await Promise.all([
            fetch(`${HUBSPOT_BASE}/crm/v3/pipelines/deals`, { headers: hubspotHeaders }),
            fetch(`${HUBSPOT_BASE}/crm/v3/properties/deals?archived=false`, { headers: hubspotHeaders }),
          ]);
          const [pipelinesData, propsData] = await Promise.all([pipelinesRes.json(), propsRes.json()]);
          const availableProperties = new Set((propsData?.results || []).map((prop: any) => String(prop.name)));
          const stageIds = (pipelinesData?.results || [])
            .flatMap((pipeline: any) => pipeline?.stages || [])
            .map((stage: any) => String(stage.id))
            .filter(Boolean);
          stageEntryProperties = stageIds.flatMap((stageId: string) => [
            `hs_date_entered_${stageId}`,
            `hs_v2_date_entered_${stageId}`,
          ]).filter((propertyName: string) => availableProperties.has(propertyName));
        } catch (error) {
          console.warn("[hubspot-data] Could not load deal stage entry properties", error);
        }

        const properties = Array.from(new Set([...baseDealProperties, ...stageEntryProperties]));
        const sorts = [{ propertyName: "hs_lastmodifieddate", direction: "DESCENDING" }];
        
        if (fetchAll) {
          const result = await fetchAllSearchPages(`${HUBSPOT_BASE}/crm/v3/objects/deals/search`, properties, sorts);
          return new Response(JSON.stringify(result), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const response = await fetch(`${HUBSPOT_BASE}/crm/v3/objects/deals/search`, {
          method: "POST",
          headers: hubspotHeaders,
          body: JSON.stringify({ limit, properties, sorts }),
        });
        const data = await response.json();
        if (!response.ok) {
          return new Response(JSON.stringify({ error: "HubSpot API error", details: data }), {
            status: response.status,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        return new Response(JSON.stringify(data), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      case "tasks": {
        const properties = ["hs_task_subject", "hs_task_status", "hs_task_priority", "hs_timestamp"];
        const sorts = [{ propertyName: "hs_timestamp", direction: "DESCENDING" }];

        if (fetchAll) {
          const result = await fetchAllSearchPages(`${HUBSPOT_BASE}/crm/v3/objects/tasks/search`, properties, sorts);
          return new Response(JSON.stringify(result), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const response = await fetch(`${HUBSPOT_BASE}/crm/v3/objects/tasks/search`, {
          method: "POST",
          headers: hubspotHeaders,
          body: JSON.stringify({ limit, properties, sorts }),
        });
        const data = await response.json();
        if (!response.ok) {
          return new Response(JSON.stringify({ error: "HubSpot API error", details: data }), {
            status: response.status,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        return new Response(JSON.stringify(data), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      case "pipelines": {
        const response = await fetch(`${HUBSPOT_BASE}/crm/v3/pipelines/deals`, { headers: hubspotHeaders });
        const data = await response.json();
        if (!response.ok) {
          return new Response(JSON.stringify({ error: "HubSpot API error", details: data }), {
            status: response.status,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        return new Response(JSON.stringify(data), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      case "owners": {
        const response = await fetch(`${HUBSPOT_BASE}/crm/v3/owners?limit=100`, { headers: hubspotHeaders });
        const data = await response.json();
        if (data?.results && Array.isArray(data.results)) {
          const names = data.results.map((o: any) => `${o.id}: ${o.firstName} ${o.lastName} (email=${o.email})`);
          console.log("[hubspot-owners]", JSON.stringify(names));
        }
        if (!response.ok) {
          return new Response(JSON.stringify({ error: "HubSpot API error", details: data }), {
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
