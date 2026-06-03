import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SPREADSHEET_ID = "1x5y3-TtWonAIEcEyKYtqcRIv7jE-sISsRXqLQrwxOiM";

function todayStr() { return new Date().toISOString().split("T")[0]; }

function parseBRDate(raw: string): Date | null {
  if (!raw) return null;
  const parts = raw.split("/");
  if (parts.length !== 3) return null;
  const [d, m, y] = parts.map(Number);
  return new Date(y, m - 1, d);
}

function parseBRL(raw: string): number {
  if (!raw) return 0;
  const cleaned = raw.replace(/[R$\s.]/g, "").replace(",", ".");
  const v = parseFloat(cleaned);
  return isNaN(v) ? 0 : v;
}

function normalizeName(s: string): string {
  return (s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

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
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const SHEETS_KEY = Deno.env.get("GOOGLE_SHEETS_API_KEY");
    if (!SHEETS_KEY) throw new Error("GOOGLE_SHEETS_API_KEY missing");

    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
    const url = new URL(req.url);
    const targetDate = url.searchParams.get("date") || todayStr(); // YYYY-MM-DD
    const [yy, mm, dd] = targetDate.split("-").map(Number);

    // 1. Buscar apostas pendentes do dia
    const { data: bets, error: betsErr } = await supabase
      .from("daily_bets")
      .select("*")
      .eq("bet_date", targetDate)
      .eq("status", "pending");
    if (betsErr) throw betsErr;
    if (!bets || bets.length === 0) {
      return new Response(JSON.stringify({ ok: true, message: "Sem apostas pendentes", date: targetDate }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // 2. Buscar vendas do dia da Google Sheet
    const sheetUrl = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/A:Q?key=${SHEETS_KEY}`;
    const sheetRes = await fetch(sheetUrl);
    if (!sheetRes.ok) throw new Error(`Sheets API ${sheetRes.status}`);
    const sheetJson = await sheetRes.json();
    const rows: string[][] = sheetJson.values || [];

    // Acumular vendas por corretor (normalized) na data alvo
    const salesByBroker: Record<string, number> = {};
    for (const r of rows.slice(1)) {
      const corretor = (r[4] || "").trim();
      const dataVenda = r[6] || "";
      const valor = parseBRL(r[7] || "");
      const d = parseBRDate(dataVenda);
      if (!d) continue;
      if (d.getFullYear() === yy && d.getMonth() === mm - 1 && d.getDate() === dd) {
        const k = normalizeName(corretor);
        if (!k) continue;
        salesByBroker[k] = (salesByBroker[k] || 0) + valor;
      }
    }

    // 3. Resolver cada aposta
    const results: any[] = [];
    for (const bet of bets) {
      const key = normalizeName(bet.broker_name);
      const actual = salesByBroker[key] || 0;
      const target = Number(bet.bet_amount) || 0;

      let status: "won" | "partial" | "lost" = "lost";
      let xp = -20;
      let title = "💸 Você errou a aposta";
      let message = `Apostou ${formatBRL(target)} · Vendeu ${formatBRL(actual)}`;

      if (target > 0) {
        if (actual >= target) {
          status = "won"; xp = 50;
          title = "🎯 Aposta batida!";
          message = `Apostou ${formatBRL(target)} · Vendeu ${formatBRL(actual)} (+${xp} XP)`;
        } else {
          const errorPct = (target - actual) / target;
          if (errorPct < 0.2) {
            status = "partial"; xp = 10;
            title = "👏 Quase lá";
            message = `Apostou ${formatBRL(target)} · Vendeu ${formatBRL(actual)} (+${xp} XP)`;
          }
        }
      } else {
        // aposta = 0: trata como lost com 0 xp
        xp = 0;
      }

      // Update aposta
      await supabase.from("daily_bets").update({
        actual_amount: actual,
        xp_earned: xp,
        status,
        resolved_at: new Date().toISOString(),
      }).eq("id", bet.id);

      // Update gamification (incremento) — best-effort
      if (xp !== 0) {
        const { data: gam } = await supabase.from("user_gamification")
          .select("xp, level, current_streak, best_streak, last_activity_date")
          .eq("user_id", bet.user_id).maybeSingle();
        if (gam) {
          const newXp = Math.max(0, (gam.xp || 0) + xp);
          await supabase.from("user_gamification").update({
            xp: newXp,
            level: Math.floor(newXp / 1000) + 1,
          }).eq("user_id", bet.user_id);
        } else {
          await supabase.from("user_gamification").insert({
            user_id: bet.user_id,
            xp: Math.max(0, xp),
            level: 1,
          });
        }
      }

      // Notificação
      await supabase.from("notifications").insert({
        user_id: bet.user_id,
        type: status === "won" ? "success" : status === "partial" ? "info" : "warning",
        title,
        message,
        metadata: { bet_id: bet.id, bet_amount: target, actual_amount: actual, xp },
      });

      results.push({ broker: bet.broker_name, target, actual, status, xp });
    }

    return new Response(JSON.stringify({ ok: true, date: targetDate, resolved: results.length, results }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("daily-bet-resolve error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "erro" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});

function formatBRL(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
}