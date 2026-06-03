import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const clientId = Deno.env.get("GOOGLE_CALENDAR_CLIENT_ID")!;
  const clientSecret = Deno.env.get("GOOGLE_CALENDAR_CLIENT_SECRET")!;

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const token = authHeader.replace("Bearer ", "");
  const { data: claimsData, error: claimsError } = await userClient.auth.getClaims(token);
  if (claimsError || !claimsData?.claims) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const userId = claimsData.claims.sub;

  const adminClient = createClient(supabaseUrl, serviceRoleKey);
  const { data: tokenData, error: tokenError } = await adminClient
    .from("google_calendar_tokens")
    .select("*")
    .eq("user_id", userId)
    .single();

  if (tokenError || !tokenData) {
    return new Response(JSON.stringify({ error: "not_connected", message: "Google Calendar não conectado" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let accessToken = tokenData.access_token;

  if (new Date(tokenData.expires_at) <= new Date()) {
    const refreshRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: tokenData.refresh_token,
        grant_type: "refresh_token",
      }),
    });

    const refreshData = await refreshRes.json();

    if (!refreshData.access_token) {
      console.error("Token refresh failed:", refreshData);
      return new Response(JSON.stringify({ error: "token_refresh_failed" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    accessToken = refreshData.access_token;
    const newExpiry = new Date(Date.now() + refreshData.expires_in * 1000).toISOString();

    await adminClient.from("google_calendar_tokens").update({
      access_token: accessToken,
      expires_at: newExpiry,
    }).eq("user_id", userId);
  }

  const body = await req.json();
  const { summary, description, start, end, attendees } = body;

  if (!summary || !start || !end) {
    return new Response(JSON.stringify({ error: "Missing required fields: summary, start, end" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const eventPayload: Record<string, unknown> = {
    summary,
    description: description || "",
    start: { dateTime: start, timeZone: "America/Sao_Paulo" },
    end: { dateTime: end, timeZone: "America/Sao_Paulo" },
  };

  if (attendees && attendees.length > 0) {
    eventPayload.attendees = attendees.map((email: string) => ({ email }));
  }

  const calRes = await fetch(
    "https://www.googleapis.com/calendar/v3/calendars/primary/events?sendUpdates=all",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(eventPayload),
    }
  );

  const calData = await calRes.json();

  if (!calRes.ok) {
    console.error("Google Calendar API error:", calData);
    return new Response(JSON.stringify({ error: "calendar_api_error", details: calData }), {
      status: calRes.status, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ success: true, event: calData }), {
    status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
