import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");

  if (!code) {
    return new Response("Missing code", { status: 400, headers: corsHeaders });
  }

  const clientId = Deno.env.get("GOOGLE_CALENDAR_CLIENT_ID")!;
  const clientSecret = Deno.env.get("GOOGLE_CALENDAR_CLIENT_SECRET")!;
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const redirectUri = `${supabaseUrl}/functions/v1/google-calendar-callback`;

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });

  const tokens = await tokenRes.json();

  if (!tokens.access_token || !tokens.refresh_token) {
    console.error("Token exchange failed:", tokens);
    let errorRedirect = "https://localhost:3000";
    try {
      const parsed = JSON.parse(atob(state || ""));
      errorRedirect = parsed.redirect;
    } catch {}
    return Response.redirect(`${errorRedirect}?gcal_error=token_exchange_failed`, 302);
  }

  let userId: string;
  let appRedirect: string;
  try {
    const parsed = JSON.parse(atob(state || ""));
    userId = parsed.user_id;
    appRedirect = parsed.redirect;
  } catch {
    return new Response("Invalid state", { status: 400, headers: corsHeaders });
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);
  const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

  const { error } = await supabase.from("google_calendar_tokens").upsert({
    user_id: userId,
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    expires_at: expiresAt,
  }, { onConflict: "user_id" });

  if (error) {
    console.error("Failed to save tokens:", error);
    return Response.redirect(`${appRedirect}?gcal_error=save_failed`, 302);
  }

  return Response.redirect(`${appRedirect}?gcal_connected=true`, 302);
});
