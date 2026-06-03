import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import * as XLSX from "https://esm.sh/xlsx@0.18.5";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

/* ── Seller normalization (mirror of src/lib/seller-names.ts) ── */
const ALIASES: Record<string, string[]> = {
  "Vinícius Oliveira":  ["VINICIUS","Vinicius","Vinícius","VINICIUS OLIVEIRA","Vinicíus Oliveira","VINICÍUS OLIVEIRA","Vinicíus","VINICÍUS","Vinicius Oliveira"],
  "Luan":               ["LUAN","Luan Pereira","LUAN PEREIRA"],
  "Alexander":          ["ALEXANDER","ALEXANDER ","Alexander Generoso","ALEXANDER GENEROSO"],
  "João Gabriel":       ["JOÃO GABRIEL","JOAO GABRIEL","João Gabriel","Joao Gabriel"],
  "Guilherme Sutil":    ["GUILHERME SUTIL","Guilherme Sutil"],
  "Guilherme Melo":     ["GUILHERME MELO","GUILHERME","Guilherme","Guilherme Melo"],
  "Gabriel Simão":      ["GABRIEL","Gabriel","Simão","SIMÃO","Gabriel Simao","GABRIEL SIMÃO","GABRIEL SIMAO","Gabriel Costa Simão","Gabriel Costa Simao","GABRIEL COSTA SIMÃO"],
  "Gabriel Manenti":    ["Gabriel Manenti","GABRIEL MANENTI","Manenti"],
  "Lucas Freitas":      ["LUCAS","Lucas","LUCAS FREITAS","Lucas Cardoso De Freitas","Lucas Cardoso de Freitas","LUCAS CARDOSO DE FREITAS","Lucas Cardoso"],
  "Diego":              ["DIEGO","Diego De Luca","DIEGO DE LUCA","diego de luca"],
  "Patrick Bragato Rex":["Patrick","PATRICK","Patrick Bragato","PATRICK BRAGATO REX"],
  "Leandro Fernandes":  ["Leandro","LEANDRO","LEANDRO FERNANDES"],
  "Gustavo Machado Correa": ["Gustavo","GUSTAVO","Gustavo Machado","GUSTAVO MACHADO CORREA","Gustavo Corrêa","GUSTAVO CORRÊA","Gustavo Correa","GUSTAVO CORREA","Gustavo Machado Corrêa","GUSTAVO MACHADO CORRÊA"],
  "Márcio Pereira":     ["Marcio","MARCIO","Márcio","MÁRCIO","Marcio Pereira","MARCIO PEREIRA","MÁRCIO PEREIRA","Marcio De Souza Pereira","Márcio De Souza Pereira","MARCIO DE SOUZA PEREIRA"],
  "Alessandro":         ["ALESSANDRO","Alê","ALÊ","ALE","Alessandro Dos Santos","Alessandro dos Santos","ALESSANDRO DOS SANTOS"],
};
const reverseMap = new Map<string, string>();
for (const [canonical, aliases] of Object.entries(ALIASES)) {
  reverseMap.set(canonical.toLowerCase().trim(), canonical);
  for (const a of aliases) reverseMap.set(a.toLowerCase().trim(), canonical);
}
function normalizeName(raw: string): string {
  if (!raw) return "";
  const key = String(raw).toLowerCase().trim();
  return reverseMap.get(key) || String(raw).trim();
}

/* ── Helpers ── */
function normHeader(s: string): string {
  return String(s ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function parseNumber(v: any): number | null {
  if (v === null || v === undefined || v === "") return null;
  if (typeof v === "number") return v;
  let s = String(v).trim();
  if (!s) return null;
  // Remove R$, %, spaces
  s = s.replace(/[R$\s%]/g, "");
  // BR format: "1.234,56" → "1234.56"
  if (s.includes(",")) {
    s = s.replace(/\./g, "").replace(",", ".");
  }
  const n = parseFloat(s);
  return isNaN(n) ? null : n;
}

function findColumn(headers: string[], candidates: string[]): number {
  const normHeaders = headers.map(normHeader);
  for (const cand of candidates) {
    const c = normHeader(cand);
    const idx = normHeaders.findIndex((h) => h === c || h.includes(c) || c.includes(h));
    if (idx >= 0) return idx;
  }
  return -1;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Não autenticado" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Validate user
    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user }, error: userErr } = await userClient.auth.getUser();
    if (userErr || !user) {
      return new Response(JSON.stringify({ error: "Sessão inválida" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check role
    const { data: roles } = await supabase
      .from("user_roles").select("role").eq("user_id", user.id);
    const allowed = (roles ?? []).some((r: any) => r.role === "admin" || r.role === "gestor");
    if (!allowed) {
      return new Response(JSON.stringify({ error: "Apenas gestores podem fazer upload" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { fileBase64, fileName } = await req.json();
    if (!fileBase64) {
      return new Response(JSON.stringify({ error: "Arquivo não enviado" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Decode and parse
    const binStr = atob(fileBase64);
    const bytes = new Uint8Array(binStr.length);
    for (let i = 0; i < binStr.length; i++) bytes[i] = binStr.charCodeAt(i);
    const wb = XLSX.read(bytes, { type: "array" });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });

    if (rows.length < 2) {
      return new Response(JSON.stringify({ error: "Planilha vazia" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Find header row (first row with > 3 non-empty cells)
    let headerIdx = 0;
    for (let i = 0; i < Math.min(5, rows.length); i++) {
      const nonEmpty = rows[i].filter((c) => c !== null && c !== undefined && String(c).trim() !== "").length;
      if (nonEmpty >= 3) { headerIdx = i; break; }
    }
    const headers = rows[headerIdx].map((h) => String(h ?? ""));

    const colMap = {
      grupo: findColumn(headers, ["grupo"]),
      cota: findColumn(headers, ["cota"]),
      vendedor: findColumn(headers, ["vendedor", "corretor"]),
      cliente: findColumn(headers, ["nome completo do cliente", "cliente", "nome do cliente"]),
      parcelas: findColumn(headers, ["quantidade de parcelas pagas", "parcelas pagas", "qtd parcelas pagas", "parcelas"]),
      credito: findColumn(headers, ["rpc credito gerado new", "rpc credito gerado", "credito gerado", "credito"]),
      pctEstorno: findColumn(headers, ["estorno", "porcentagem estorno", "pct estorno"]),
      pctComissao: findColumn(headers, ["comissao", "porcentagem comissao", "pct comissao"]),
      vlrEstorno: findColumn(headers, ["vlr estorno", "valor estorno", "valor de estorno"]),
      vlrFimCiclo: findColumn(headers, ["vlr ate o fim do ciclo", "valor ate o fim do ciclo", "fim do ciclo", "vlr fim ciclo"]),
      dinheiroMesa: findColumn(headers, ["dinheiro na mesa", "dinheiro mesa"]),
    };

    if (colMap.vendedor < 0) {
      return new Response(JSON.stringify({
        error: "Coluna 'Vendedor' não encontrada na planilha",
        headers,
      }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Build records — pct_estorno and pct_comissao must be positioned correctly
    // % Estorno comes before Vlr Estorno; % Comissao before pct_estorno or after — use header order
    // Find % columns specifically
    const pctColumns: number[] = [];
    headers.forEach((h, i) => {
      const n = normHeader(h);
      if (n.includes("estorno") && (n.startsWith("estorno") || n.includes("estorno"))) {
        // ambiguous — handled below
      }
      if (n === "estorno" || n === "porcentagem estorno") pctColumns.push(i);
    });

    // Better: explicitly find by exact header match for % columns
    let pctEstornoIdx = -1, pctComissaoIdx = -1;
    headers.forEach((h, i) => {
      const raw = String(h).trim();
      const n = normHeader(h);
      if (raw.startsWith("%") || n.startsWith("pct") || n.startsWith("porcentagem")) {
        if (n.includes("estorno")) pctEstornoIdx = i;
        if (n.includes("comissao")) pctComissaoIdx = i;
      }
      // Fallback: bare "Estorno" / "Comissao" as percentage column
      if (n === "estorno" && pctEstornoIdx < 0) pctEstornoIdx = i;
      if (n === "comissao" && pctComissaoIdx < 0) pctComissaoIdx = i;
    });
    if (pctEstornoIdx >= 0) colMap.pctEstorno = pctEstornoIdx;
    if (pctComissaoIdx >= 0) colMap.pctComissao = pctComissaoIdx;

    const records: any[] = [];
    const vendedoresSet = new Set<string>();

    for (let i = headerIdx + 1; i < rows.length; i++) {
      const r = rows[i];
      if (!r || r.every((c) => c === null || c === undefined || String(c).trim() === "")) continue;
      const vendedorRaw = colMap.vendedor >= 0 ? String(r[colMap.vendedor] ?? "").trim() : "";
      if (!vendedorRaw) continue;
      const vendedorNorm = normalizeName(vendedorRaw);
      vendedoresSet.add(vendedorNorm);

      records.push({
        grupo: colMap.grupo >= 0 ? String(r[colMap.grupo] ?? "").trim() : null,
        cota: colMap.cota >= 0 ? String(r[colMap.cota] ?? "").trim() : null,
        vendedor: vendedorRaw,
        vendedor_normalizado: vendedorNorm,
        cliente: colMap.cliente >= 0 ? String(r[colMap.cliente] ?? "").trim() : null,
        parcelas_pagas: colMap.parcelas >= 0 ? parseNumber(r[colMap.parcelas]) : null,
        credito_gerado: colMap.credito >= 0 ? parseNumber(r[colMap.credito]) : null,
        pct_estorno: colMap.pctEstorno >= 0 ? parseNumber(r[colMap.pctEstorno]) : null,
        pct_comissao: colMap.pctComissao >= 0 ? parseNumber(r[colMap.pctComissao]) : null,
        vlr_estorno: colMap.vlrEstorno >= 0 ? parseNumber(r[colMap.vlrEstorno]) : null,
        vlr_fim_ciclo: colMap.vlrFimCiclo >= 0 ? parseNumber(r[colMap.vlrFimCiclo]) : null,
        dinheiro_na_mesa: colMap.dinheiroMesa >= 0 ? parseNumber(r[colMap.dinheiroMesa]) : null,
      });
    }

    if (records.length === 0) {
      return new Response(JSON.stringify({ error: "Nenhuma linha válida encontrada" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Replace previous data
    await supabase.from("broker_results").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    await supabase.from("broker_results_uploads").delete().neq("id", "00000000-0000-0000-0000-000000000000");

    const { data: uploadRow, error: uploadErr } = await supabase
      .from("broker_results_uploads")
      .insert({
        uploaded_by: user.id,
        uploaded_by_name: user.user_metadata?.display_name || user.user_metadata?.full_name || user.email,
        file_name: fileName ?? null,
        total_rows: records.length,
        total_vendedores: vendedoresSet.size,
      })
      .select("id")
      .single();
    if (uploadErr) throw uploadErr;

    const recordsWithUpload = records.map((r) => ({ ...r, upload_id: uploadRow.id }));

    // Insert in batches of 500
    for (let i = 0; i < recordsWithUpload.length; i += 500) {
      const batch = recordsWithUpload.slice(i, i + 500);
      const { error } = await supabase.from("broker_results").insert(batch);
      if (error) throw error;
    }

    return new Response(JSON.stringify({
      success: true,
      rows: records.length,
      vendedores: vendedoresSet.size,
      headers_detected: headers,
      column_mapping: colMap,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (e: any) {
    console.error("upload-broker-results error:", e);
    return new Response(JSON.stringify({ error: e?.message ?? "Erro desconhecido" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});