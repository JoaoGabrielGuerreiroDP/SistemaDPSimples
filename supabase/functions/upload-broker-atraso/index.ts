import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import * as XLSX from "https://esm.sh/xlsx@0.18.5";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

/* ── Seller normalization (mirror of upload-broker-results) ── */
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
  s = s.replace(/[R$\s%]/g, "");
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

    let headerIdx = 0;
    for (let i = 0; i < Math.min(5, rows.length); i++) {
      const nonEmpty = rows[i].filter((c) => c !== null && c !== undefined && String(c).trim() !== "").length;
      if (nonEmpty >= 3) { headerIdx = i; break; }
    }
    const headers = rows[headerIdx].map((h) => String(h ?? ""));

    const colMap = {
      vendedor: findColumn(headers, ["vendedor", "corretor"]),
      cliente: findColumn(headers, ["nome completo do cliente", "cliente", "nome do cliente"]),
      grupo: findColumn(headers, ["grupo"]),
      cota: findColumn(headers, ["cota"]),
      parcelasPagas: findColumn(headers, ["quantidade de parcelas pagas", "parcelas pagas", "qtd parcelas pagas"]),
      parcelasAtraso: findColumn(headers, ["quantidade de parcelas em atraso", "parcelas em atraso", "qtd parcelas atraso", "parcelas atraso"]),
      creditoVenda: findColumn(headers, ["venda credito da venda", "credito da venda", "credito venda", "venda credito"]),
      situacao: findColumn(headers, ["situacao", "status"]),
      comissaoCorretor: findColumn(headers, ["comissao corretor", "comissao do corretor", "comissao"]),
    };

    if (colMap.vendedor < 0) {
      return new Response(JSON.stringify({
        error: "Coluna 'Vendedor' não encontrada na planilha",
        headers,
      }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

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
        vendedor: vendedorRaw,
        vendedor_normalizado: vendedorNorm,
        cliente: colMap.cliente >= 0 ? String(r[colMap.cliente] ?? "").trim() : null,
        grupo: colMap.grupo >= 0 ? String(r[colMap.grupo] ?? "").trim() : null,
        cota: colMap.cota >= 0 ? String(r[colMap.cota] ?? "").trim() : null,
        parcelas_pagas: colMap.parcelasPagas >= 0 ? parseNumber(r[colMap.parcelasPagas]) : null,
        parcelas_atraso: colMap.parcelasAtraso >= 0 ? parseNumber(r[colMap.parcelasAtraso]) : null,
        credito_venda: colMap.creditoVenda >= 0 ? parseNumber(r[colMap.creditoVenda]) : null,
        situacao: colMap.situacao >= 0 ? String(r[colMap.situacao] ?? "").trim() : null,
        comissao_corretor: colMap.comissaoCorretor >= 0 ? parseNumber(r[colMap.comissaoCorretor]) : null,
      });
    }

    if (records.length === 0) {
      return new Response(JSON.stringify({ error: "Nenhuma linha válida encontrada" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Replace snapshot
    await supabase.from("broker_atraso").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    await supabase.from("broker_atraso_uploads").delete().neq("id", "00000000-0000-0000-0000-000000000000");

    const { data: uploadRow, error: uploadErr } = await supabase
      .from("broker_atraso_uploads")
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

    for (let i = 0; i < recordsWithUpload.length; i += 500) {
      const batch = recordsWithUpload.slice(i, i + 500);
      const { error } = await supabase.from("broker_atraso").insert(batch);
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
    console.error("upload-broker-atraso error:", e);
    return new Response(JSON.stringify({ error: e?.message ?? "Erro desconhecido" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});