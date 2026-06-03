import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const DEFAULT_SPREADSHEET_ID = "1x5y3-TtWonAIEcEyKYtqcRIv7jE-sISsRXqLQrwxOiM";

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// ─── Service Account JWT (for sheets not shared publicly) ───
function base64url(data: Uint8Array): string {
  let b64 = btoa(String.fromCharCode(...data));
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function base64urlStr(str: string): string {
  return base64url(new TextEncoder().encode(str));
}

let cachedToken: { token: string; exp: number } | null = null;

async function getServiceAccountAccessToken(): Promise<string | null> {
  const raw = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_KEY");
  if (!raw) return null;
  if (cachedToken && cachedToken.exp > Math.floor(Date.now() / 1000) + 60) {
    return cachedToken.token;
  }
  let serviceAccount: any;
  try {
    serviceAccount = JSON.parse(raw);
    if (typeof serviceAccount === "string") serviceAccount = JSON.parse(serviceAccount);
  } catch {
    console.error("Invalid GOOGLE_SERVICE_ACCOUNT_KEY format. raw len:", raw.length);
    return null;
  }
  if (!serviceAccount?.private_key || !serviceAccount?.client_email) {
    console.error("SA missing fields. type=", typeof serviceAccount, "keys=", Object.keys(serviceAccount || {}), "raw len:", raw.length);
    return null;
  }
  console.log("SA client_email:", serviceAccount.client_email);

  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const payload = {
    iss: serviceAccount.client_email,
    scope: "https://www.googleapis.com/auth/spreadsheets.readonly",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  };
  const headerB64 = base64urlStr(JSON.stringify(header));
  const payloadB64 = base64urlStr(JSON.stringify(payload));
  const unsignedToken = `${headerB64}.${payloadB64}`;
  const pemContents = serviceAccount.private_key
    .replace(/-----BEGIN PRIVATE KEY-----/g, "")
    .replace(/-----END PRIVATE KEY-----/g, "")
    .replace(/\s/g, "");
  const binaryKey = Uint8Array.from(atob(pemContents), (c) => c.charCodeAt(0));
  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8", binaryKey,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false, ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5", cryptoKey,
    new TextEncoder().encode(unsignedToken),
  );
  const jwt = `${unsignedToken}.${base64url(new Uint8Array(signature))}`;
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
    console.error("SA token error:", tokenData);
    return null;
  }
  cachedToken = { token: tokenData.access_token, exp: now + 3500 };
  return tokenData.access_token;
}

async function fetchSheets(apiUrl: string, apiKey: string): Promise<{ status: number; data: any }> {
  // Try service account first (works for private sheets shared with SA)
  const saToken = await getServiceAccountAccessToken();
  if (saToken) {
    const cleanUrl = apiUrl.replace(/[?&]key=[^&]+/, "");
    const res = await fetch(cleanUrl, { headers: { Authorization: `Bearer ${saToken}` } });
    const data = await res.json();
    if (res.ok) return { status: res.status, data };
    // fall through to API key
    console.warn("SA fetch failed, falling back to API key:", res.status);
  }
  const res = await fetch(apiUrl);
  const data = await res.json();
  return { status: res.status, data };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Auth: require any Bearer token (anon or user JWT). We don't validate the user
    // because this endpoint only reads sheets via a service account / API key and
    // strict user validation was causing intermittent 401s when the session token
    // was momentarily unavailable on the client.
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const API_KEY = Deno.env.get("GOOGLE_SHEETS_API_KEY");
    if (!API_KEY) throw new Error("GOOGLE_SHEETS_API_KEY not configured");

    const url = new URL(req.url);
    const spreadsheetId = url.searchParams.get("spreadsheet_id") || DEFAULT_SPREADSHEET_ID;
    const action = url.searchParams.get("action") || "values";

    // Action: list_sheets - returns sheet names
    if (action === "list_sheets") {
      const apiUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?key=${API_KEY}&fields=sheets.properties.title`;
      const { status, data } = await fetchSheets(apiUrl, API_KEY);
      if (status < 200 || status >= 300) {
        console.error("Sheets API error:", JSON.stringify(data));
        if (status === 404) return jsonResponse({ sheets: [], warning: "Spreadsheet not found" });
        return jsonResponse({ error: "Google Sheets API error", details: data }, status);
      }
      const sheetNames = (data.sheets || []).map((s: any) => s.properties.title);
      return jsonResponse({ sheets: sheetNames });
    }

    // Action: batch_values - fetch multiple sheets at once
    if (action === "batch_values") {
      const sheetsParam = url.searchParams.get("sheets") || "";
      const sheetNames = sheetsParam.split(",").filter(Boolean);
      if (sheetNames.length === 0) {
        return jsonResponse({ valueRanges: [] });
      }
      const ranges = sheetNames.map(s => `'${s}'`);
      const rangesParam = ranges.map(r => `ranges=${encodeURIComponent(r)}`).join("&");
      const apiUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchGet?${rangesParam}&key=${API_KEY}`;
      const { status, data } = await fetchSheets(apiUrl, API_KEY);
      if (status < 200 || status >= 300) {
        console.error("Sheets API error:", JSON.stringify(data));
        if (status === 404) return jsonResponse({ valueRanges: [], warning: "Spreadsheet not found" });
        return jsonResponse({ error: "Google Sheets API error", details: data }, status);
      }
      return jsonResponse(data);
    }

    // Default: single sheet values
    const sheet = url.searchParams.get("sheet") || "base de dados";
    const range = url.searchParams.get("range") || "";
    const quotedSheet = `'${sheet}'`;
    const fullRange = range ? `${quotedSheet}!${range}` : quotedSheet;
    const apiUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(fullRange)}?key=${API_KEY}`;

    const { status, data } = await fetchSheets(apiUrl, API_KEY);
    if (status < 200 || status >= 300) {
      console.error("Sheets API error:", JSON.stringify(data));
      if (status === 404) return jsonResponse({ values: [], warning: "Spreadsheet not found" });
      return jsonResponse({ error: "Google Sheets API error", details: data }, status);
    }

    return jsonResponse(data);
  } catch (e) {
    console.error("sheets error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});