const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Helper: base64url encode
function base64url(data: Uint8Array): string {
  let b64 = btoa(String.fromCharCode(...data));
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64urlStr(str: string): string {
  return base64url(new TextEncoder().encode(str));
}

async function getServiceAccountToken(
  serviceAccount: any,
  userEmail: string
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const payload = {
    iss: serviceAccount.client_email,
    sub: userEmail,
    scope: "https://www.googleapis.com/auth/calendar.readonly",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  };

  const headerB64 = base64urlStr(JSON.stringify(header));
  const payloadB64 = base64urlStr(JSON.stringify(payload));
  const unsignedToken = `${headerB64}.${payloadB64}`;

  // Import the private key
  const pemContents = serviceAccount.private_key
    .replace(/-----BEGIN PRIVATE KEY-----/g, "")
    .replace(/-----END PRIVATE KEY-----/g, "")
    .replace(/\s/g, "");
  const binaryKey = Uint8Array.from(atob(pemContents), (c) => c.charCodeAt(0));

  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8",
    binaryKey,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    cryptoKey,
    new TextEncoder().encode(unsignedToken)
  );

  const jwt = `${unsignedToken}.${base64url(new Uint8Array(signature))}`;

  // Exchange JWT for access token
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });

  const tokenData = await tokenRes.json();
  if (!tokenRes.ok) {
    console.error("Token error for", userEmail, tokenData);
    throw new Error(`Token error for ${userEmail}: ${tokenData.error_description || tokenData.error}`);
  }
  return tokenData.access_token;
}

async function fetchCalendarEvents(
  accessToken: string,
  timeMin: string,
  timeMax: string
) {
  const params = new URLSearchParams({
    timeMin,
    timeMax,
    singleEvents: "true",
    orderBy: "startTime",
    maxResults: "250",
  });

  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events?${params}`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );

  if (!res.ok) {
    const err = await res.text();
    console.error("Calendar API error:", err);
    return [];
  }

  const data = await res.json();
  return data.items || [];
}

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
    const serviceAccountRaw = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_KEY");
    if (!serviceAccountRaw) {
      throw new Error("GOOGLE_SERVICE_ACCOUNT_KEY not configured");
    }

    let serviceAccount: any;
    try {
      serviceAccount = JSON.parse(serviceAccountRaw);
      // Handle double-encoded JSON
      if (typeof serviceAccount === "string") {
        serviceAccount = JSON.parse(serviceAccount);
      }
    } catch {
      throw new Error("Invalid GOOGLE_SERVICE_ACCOUNT_KEY format");
    }

    if (!serviceAccount.private_key) {
      console.error("Service account keys:", Object.keys(serviceAccount));
      throw new Error("Service account missing private_key field");
    }
    if (!timeMin || !timeMax) {
      return new Response(JSON.stringify({ error: "timeMin and timeMax required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get all @dpconsorcios.com.br users from profiles table
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const sb = createClient(supabaseUrl, supabaseKey);

    const { data: profiles, error: profilesError } = await sb
      .from("profiles")
      .select("email, display_name")
      .like("email", "%@dpconsorcios.com.br");

    if (profilesError) {
      console.error("Profiles error:", profilesError);
      throw new Error("Failed to fetch profiles");
    }

    const emails = (profiles || [])
      .map((p: any) => ({ email: p.email, name: p.display_name }))
      .filter((p: any) => p.email);

    console.log(`Fetching calendars for ${emails.length} users`);

    // Fetch events for each user using domain-wide delegation
    const allEvents: any[] = [];
    const errors: string[] = [];

    await Promise.allSettled(
      emails.map(async (user: { email: string; name: string }) => {
        try {
          const token = await getServiceAccountToken(serviceAccount, user.email);
          const events = await fetchCalendarEvents(token, timeMin, timeMax);
          for (const event of events) {
            allEvents.push({
              id: event.id,
              summary: event.summary || "(Sem título)",
              description: event.description || "",
              start: event.start?.dateTime || event.start?.date || "",
              end: event.end?.dateTime || event.end?.date || "",
              allDay: !!event.start?.date,
              location: event.location || "",
              userEmail: user.email,
              userName: user.name || user.email.split("@")[0],
              status: event.status,
              htmlLink: event.htmlLink,
            });
          }
        } catch (err) {
          console.error(`Error fetching for ${user.email}:`, err);
          errors.push(user.email);
        }
      })
    );

    // Sort by start time
    allEvents.sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());

    return new Response(
      JSON.stringify({ events: allEvents, totalUsers: emails.length, errors }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Edge function error:", err);
    return new Response(
      JSON.stringify({ error: err.message || "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
