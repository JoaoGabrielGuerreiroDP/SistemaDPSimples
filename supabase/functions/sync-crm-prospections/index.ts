import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const PIPERUN_BASE = "https://api.pipe.run/v1";
const HUBSPOT_BASE = "https://api.hubapi.com";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
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
    const _svc = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: _isAdmin } = await _svc.rpc("has_role", { _user_id: _userData.user.id, _role: "admin" });
    const { data: _isGestor } = await _svc.rpc("has_role", { _user_id: _userData.user.id, _role: "gestor" });
    if (!_isAdmin && !_isGestor) {
      return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const db = createClient(supabaseUrl, serviceKey);

    // Get last sync date to only fetch newer records
    const { data: lastSync } = await db
      .from("crm_prospections")
      .select("synced_at")
      .order("synced_at", { ascending: false })
      .limit(1)
      .single();

    const sinceDate = lastSync?.synced_at
      ? new Date(lastSync.synced_at)
      : new Date(Date.now() - 90 * 24 * 60 * 60 * 1000); // default: last 90 days

    let totalPiperun = 0;
    let totalHubspot = 0;

    // ── PIPERUN SYNC ──
    const PIPERUN_TOKEN = (Deno.env.get("PIPERUN_API_TOKEN") || "").trim();
    if (PIPERUN_TOKEN) {
      const piperunHeaders: Record<string, string> = {
        token: PIPERUN_TOKEN,
        "Content-Type": "application/json",
      };

      // Fetch Piperun users for name mapping
      const usersRes = await fetch(`${PIPERUN_BASE}/users?show=200`, { headers: piperunHeaders });
      const usersJson = await usersRes.json();
      const usersMap: Record<string, string> = {};
      if (usersJson?.data) {
        for (const u of usersJson.data) {
          usersMap[String(u.id)] = (u.name || u.nome || "").trim().toUpperCase();
        }
      }

      // Paginate deals
      let page = 1;
      let hasMore = true;
      while (hasMore && page <= 30) {
        const res = await fetch(`${PIPERUN_BASE}/deals?show=200&page=${page}`, { headers: piperunHeaders });
        const json = await res.json();
        const deals = json?.data || [];
        if (deals.length === 0) { hasMore = false; break; }

        const rows = deals
          .filter((d: any) => new Date(d.created_at) >= sinceDate)
          .map((d: any) => {
            // Map Piperun status: 1=won, 2=lost, 0=open
            const stageFromStatus = d.status === 1 ? "closedwon"
              : d.status === 2 ? "closedlost"
              : d.stage_name || "open";
            return {
              source: "piperun" as const,
              external_id: String(d.id),
              seller_name: usersMap[String(d.owner_id)] || null,
              lead_name: (d.person_name || d.title || "").substring(0, 500),
              amount: Number(d.value) || 0,
              stage: stageFromStatus,
              pipeline_id: d.pipeline_id ? String(d.pipeline_id) : null,
              created_at_crm: d.created_at,
              synced_at: new Date().toISOString(),
            };
          });

        if (rows.length > 0) {
          const { error } = await db
            .from("crm_prospections")
            .upsert(rows, { onConflict: "source,external_id" });
          if (error) console.error("[piperun-upsert]", error.message);
          totalPiperun += rows.length;
        }

        const totalPages = json?.meta?.total_pages || 1;
        if (page >= totalPages) hasMore = false;
        page++;
      }
    }

    // ── HUBSPOT SYNC ──
    const HUBSPOT_API_KEY = (Deno.env.get("HUBSPOT_API_KEY") || "").trim();
    if (HUBSPOT_API_KEY) {
      const hubspotHeaders = {
        Authorization: `Bearer ${HUBSPOT_API_KEY}`,
        "Content-Type": "application/json",
      };

      // Fetch owners for name mapping
      const ownersRes = await fetch(`${HUBSPOT_BASE}/crm/v3/owners?limit=100`, { headers: hubspotHeaders });
      const ownersJson = await ownersRes.json();
      const ownersMap: Record<string, string> = {};
      if (ownersJson?.results) {
        for (const o of ownersJson.results) {
          ownersMap[String(o.id)] = `${o.firstName || ""} ${o.lastName || ""}`.trim().toUpperCase();
        }
      }

      // Paginate deals via search
      let after: string | undefined;
      let hsPage = 0;
      while (hsPage < 30) {
        const bodyObj: any = {
          limit: 100,
          properties: ["dealname", "amount", "dealstage", "pipeline", "closedate", "createdate", "hubspot_owner_id"],
          sorts: [{ propertyName: "createdate", direction: "DESCENDING" }],
        };
        if (after) bodyObj.after = after;

        const res = await fetch(`${HUBSPOT_BASE}/crm/v3/objects/deals/search`, {
          method: "POST",
          headers: hubspotHeaders,
          body: JSON.stringify(bodyObj),
        });
        const json = await res.json();
        const results = json?.results || [];
        if (results.length === 0) break;

        const rows = results
          .filter((d: any) => new Date(d.properties?.createdate) >= sinceDate)
          .map((d: any) => ({
            source: "hubspot" as const,
            external_id: String(d.id),
            seller_name: d.properties?.hubspot_owner_id
              ? ownersMap[d.properties.hubspot_owner_id] || null
              : null,
            lead_name: (d.properties?.dealname || "").substring(0, 500),
            amount: Number(d.properties?.amount) || 0,
            stage: d.properties?.dealstage || null,
            pipeline_id: d.properties?.pipeline || null,
            created_at_crm: d.properties?.createdate,
            synced_at: new Date().toISOString(),
          }));

        if (rows.length > 0) {
          const { error } = await db
            .from("crm_prospections")
            .upsert(rows, { onConflict: "source,external_id" });
          if (error) console.error("[hubspot-upsert]", error.message);
          totalHubspot += rows.length;
        }

        after = json?.paging?.next?.after;
        if (!after) break;
        hsPage++;
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        synced: { piperun: totalPiperun, hubspot: totalHubspot },
        since: sinceDate.toISOString(),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[sync-crm-prospections]", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
