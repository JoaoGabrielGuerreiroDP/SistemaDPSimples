import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Sources
const SOURCES = {
  ldcred: {
    id: "ldcred",
    name: "LD Cred",
    url: "https://contempladas.ldcred.com/",
    site: "https://www.ldcred.com/",
    color: "amber",
    whatsapp: "5551997533767",
  },
  dpconsorcios: {
    id: "dpconsorcios",
    name: "DP Consórcios",
    url: "https://www.dpconsorcios.com.br/consorcio-contemplado",
    site: "https://www.dpconsorcios.com.br/",
    color: "emerald",
    whatsapp: "554896464590",
  },
  fragaebitello: {
    id: "fragaebitello",
    name: "Fraga & Bitello",
    url: "https://fragaebitelloconsorcios.com.br/contemplados",
    site: "https://fragaebitelloconsorcios.com.br/",
    color: "violet",
    whatsapp: "5551997669169",
  },
} as const;

const DW_URLS = [
  "https://contemplados.dwconsorcios.com.br/listagem/imoveis",
  "https://contemplados.dwconsorcios.com.br/listagem/automoveis",
];
const DW_SOURCE = {
  id: "dwconsorcios",
  name: "DW Consórcios",
  url: "https://contemplados.dwconsorcios.com.br/",
  site: "https://contemplados.dwconsorcios.com.br/",
  color: "sky",
  whatsapp: "5551995014895",
};

const CRS_API = "https://consorcios-investimentos.themedeploy.com/api/db/contemplados/data";
const CRS_SOURCE = {
  id: "contempladosrs",
  name: "Contemplados RS",
  url: "https://contempladosrs.com.br/cartas-contempladas",
  site: "https://contempladosrs.com.br/",
  color: "rose",
  whatsapp: "5551996989317",
};

// Simple in-memory cache (15 min)
let cache: { ts: number; data: unknown } | null = null;
const CACHE_TTL_MS = 15 * 60 * 1000;

function parseBRLToCents(input: string): number {
  if (!input) return 0;
  const cleaned = input
    .replace(/&nbsp;/g, " ")
    .replace(/[^\d,.-]/g, "")
    .trim();
  if (!cleaned) return 0;
  // pt-BR: thousands "." and decimals ","
  const normalized = cleaned.replace(/\./g, "").replace(",", ".");
  const num = parseFloat(normalized);
  if (Number.isNaN(num)) return 0;
  return Math.round(num * 100);
}

function stripTags(html: string): string {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

interface Carta {
  codigo: string;
  categoria: string;
  credito_cents: number;
  entrada_cents: number;
  parcelas: number;
  valor_parcela_cents: number;
  saldo_devedor_cents: number;
  fundo_comum_cents: number;
  ref_garantia_cents: number;
  administradora: string;
  status: string;
  fonte: string;
  fonte_nome: string;
  fonte_cor: string;
  whatsapp_link: string;
}

// Map Fraga & Bitello image filenames/URLs to admin names
const FB_LOGO_MAP: Record<string, string> = {
  "hs-table.png": "HS Consórcios",
  "santander.png": "Santander",
  "porto-seguro.png": "Porto Seguro",
  "rodobens.png": "Rodobens",
  "embracon.png": "Embracon",
  "magalu.png": "Magalu",
  "ademicon.png": "Ademicon",
  "ancora.png": "Âncora Consórcios",
  "bb.png": "Banco do Brasil",
  "bradesco.png": "Bradesco",
  "itau.png": "Itaú",
  "sicredi.png": "Sicredi",
  "sicoob.png": "Sicoob",
  "racon.png": "Racon",
  "gazin.png": "Gazin",
  "canopus.png": "Canopus",
  "servopa.png": "Servopa",
  "unicoob.png": "Unicoob (Sicoob)",
  // Storage logos (UUIDs) — let frontend fall back to "Administradora"
  "OZVuLtp5CPKQMTd3MigY37L3URpv3bpfXk62A5zm.png": "Porto Seguro",
  "JPhoL0usnhGMqAfRGPG8ghXAC3QZWcebvS0Q06Q0.png": "Gazin",
  "1fSMgL5vi1Fx7rVI7X6l2nfrneDnnDWcMR3peLY4.png": "Caixa XS5",
  "hJfROuWMsXYAYwJx3gxdIMhFxvtydhWAZWf1WkAp.png": "Unicoob (Sicoob)",
};

function inferCategoria(credito_cents: number): string {
  // Heuristic: > R$ 200k = Imóvel, ≤ R$ 200k = Veículo
  return credito_cents >= 20_000_000 ? "Imóvel" : "Veículo";
}

function buildWhatsappLink(
  whatsapp: string,
  c: Pick<Carta, "codigo" | "categoria" | "credito_cents" | "administradora">,
): string {
  const valor = formatBRLForMsg(c.credito_cents);
  const msg = encodeURIComponent(
    `Olá! Tenho interesse na carta contemplada Nº ${c.codigo} (${c.categoria} - ${valor} - ${c.administradora || "—"}).`,
  );
  return `https://wa.me/${whatsapp}?text=${msg}`;
}

function formatBRLForMsg(cents: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(cents / 100);
}

// ─── Parser: LD Cred ─────────────────────────────────────────────────────────
function parseLdCred(html: string): Carta[] {
  const cartas: Carta[] = [];
  const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  let match: RegExpExecArray | null;
  while ((match = rowRegex.exec(html)) !== null) {
    const rowHtml = match[1];
    const cellRegex = /<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi;
    const cells: string[] = [];
    let c: RegExpExecArray | null;
    while ((c = cellRegex.exec(rowHtml)) !== null) {
      cells.push(stripTags(c[1]));
    }
    if (cells.length < 11) continue;
    const codigo = cells[0];
    if (!/^\d+$/.test(codigo)) continue;
    const carta: Carta = {
      codigo,
      categoria: cells[1] || "",
      credito_cents: parseBRLToCents(cells[2]),
      entrada_cents: parseBRLToCents(cells[3]),
      parcelas: parseInt(cells[4], 10) || 0,
      valor_parcela_cents: parseBRLToCents(cells[5]),
      saldo_devedor_cents: parseBRLToCents(cells[6]),
      fundo_comum_cents: parseBRLToCents(cells[7]),
      ref_garantia_cents: parseBRLToCents(cells[8]),
      administradora: cells[9] || "",
      status: cells[10] || "",
      fonte: SOURCES.ldcred.id,
      fonte_nome: SOURCES.ldcred.name,
      fonte_cor: SOURCES.ldcred.color,
      whatsapp_link: "",
    };
    carta.whatsapp_link = buildWhatsappLink(SOURCES.ldcred.whatsapp, carta);
    cartas.push(carta);
  }
  return cartas;
}

// ─── Parser: DP Consórcios ───────────────────────────────────────────────────
// Cells: [resumo, Nº, Categoria, Crédito, Entrada, Prazo, Parcela, Adm, ações]
function parseDpConsorcios(html: string): Carta[] {
  const cartas: Carta[] = [];
  const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  let match: RegExpExecArray | null;
  while ((match = rowRegex.exec(html)) !== null) {
    const rowHtml = match[1];
    const cellRegex = /<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi;
    const cells: string[] = [];
    let c: RegExpExecArray | null;
    while ((c = cellRegex.exec(rowHtml)) !== null) {
      cells.push(stripTags(c[1]));
    }
    if (cells.length < 8) continue;
    const codigo = cells[1];
    if (!/^\d+$/.test(codigo)) continue;
    const prazoStr = cells[5] || "";
    const parcelas = parseInt(prazoStr.replace(/\D/g, ""), 10) || 0;
    const carta: Carta = {
      codigo,
      categoria: cells[2] || "",
      credito_cents: parseBRLToCents(cells[3]),
      entrada_cents: parseBRLToCents(cells[4]),
      parcelas,
      valor_parcela_cents: parseBRLToCents(cells[6]),
      saldo_devedor_cents: 0,
      fundo_comum_cents: 0,
      ref_garantia_cents: 0,
      administradora: cells[7] || "",
      status: "Disponível",
      fonte: SOURCES.dpconsorcios.id,
      fonte_nome: SOURCES.dpconsorcios.name,
      fonte_cor: SOURCES.dpconsorcios.color,
      whatsapp_link: "",
    };
    carta.whatsapp_link = buildWhatsappLink(
      SOURCES.dpconsorcios.whatsapp,
      carta,
    );
    cartas.push(carta);
  }
  return cartas;
}

// ─── Parser: Fraga & Bitello ─────────────────────────────────────────────────
// Cells: [_, _, Nº, Crédito, Entrada, "227X de R$ 10.696,00", <img>, _, status]
function parseFragaBitello(html: string): Carta[] {
  const cartas: Carta[] = [];
  const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  let match: RegExpExecArray | null;
  while ((match = rowRegex.exec(html)) !== null) {
    const rowHtml = match[1];
    const cellRegex = /<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi;
    const rawCells: string[] = [];
    let c: RegExpExecArray | null;
    while ((c = cellRegex.exec(rowHtml)) !== null) {
      rawCells.push(c[1]);
    }
    if (rawCells.length < 8) continue;
    const codigoCell = stripTags(rawCells[2]);
    if (!/^\d+$/.test(codigoCell)) continue;

    const credito_cents = parseBRLToCents(stripTags(rawCells[3]));
    const entrada_cents = parseBRLToCents(stripTags(rawCells[4]));
    const parcelaStr = stripTags(rawCells[5]); // "227X de R$ 10.696,00"
    const parcelaMatch = parcelaStr.match(/(\d+)\s*X\s*de\s*(.+)/i);
    const parcelas = parcelaMatch ? parseInt(parcelaMatch[1], 10) : 0;
    const valor_parcela_cents = parcelaMatch
      ? parseBRLToCents(parcelaMatch[2])
      : 0;

    // Admin from <img src="...">
    const admCellHtml = rawCells[6] || "";
    const imgMatch = admCellHtml.match(/src=["']([^"']+)["']/i);
    let administradora = "—";
    if (imgMatch) {
      const url = imgMatch[1];
      const filename = url.split("/").pop() || "";
      administradora = FB_LOGO_MAP[filename] || "Administradora";
    }

    // Status: cell with "Reservado" or "Negociar"
    const lastCellTxt = stripTags(rawCells[rawCells.length - 1]).toLowerCase();
    const status = lastCellTxt.includes("reserv")
      ? "Reservada"
      : "Disponível";

    const carta: Carta = {
      codigo: codigoCell,
      categoria: inferCategoria(credito_cents),
      credito_cents,
      entrada_cents,
      parcelas,
      valor_parcela_cents,
      saldo_devedor_cents: 0,
      fundo_comum_cents: 0,
      ref_garantia_cents: 0,
      administradora,
      status,
      fonte: SOURCES.fragaebitello.id,
      fonte_nome: SOURCES.fragaebitello.name,
      fonte_cor: SOURCES.fragaebitello.color,
      whatsapp_link: "",
    };
    carta.whatsapp_link = buildWhatsappLink(
      SOURCES.fragaebitello.whatsapp,
      carta,
    );
    cartas.push(carta);
  }
  return cartas;
}

async function fetchSource(
  url: string,
  parser: (html: string) => Carta[],
): Promise<{ cartas: Carta[]; error?: string }> {
  try {
    const resp = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; HubDPBot/1.0; +https://hubdp.net)",
        Accept: "text/html,application/xhtml+xml",
      },
    });
    if (!resp.ok) {
      return { cartas: [], error: `HTTP ${resp.status}` };
    }
    const html = await resp.text();
    return { cartas: parser(html) };
  } catch (e) {
    return {
      cartas: [],
      error: e instanceof Error ? e.message : "Unknown",
    };
  }
}

// ─── Parser: DW Consórcios ───────────────────────────────────────────────────
// Each carta is an <input type="checkbox" ... data-*> with all fields as attrs.
function parseDwConsorcios(html: string): Carta[] {
  const cartas: Carta[] = [];
  const inputRegex = /<input[^>]*class="[^"]*check-soma[^"]*"[^>]*>/gi;
  let m: RegExpExecArray | null;
  while ((m = inputRegex.exec(html)) !== null) {
    const tag = m[0];
    const attr = (name: string) => {
      const r = new RegExp(`data-${name}=["']([^"']*)["']`, "i").exec(tag);
      return r ? r[1] : "";
    };
    const idRaw = attr("id"); // e.g. "#3406"
    const codigo = idRaw.replace(/[^\d]/g, "");
    if (!codigo) continue;
    const credito = parseFloat(attr("credito") || "0");
    const entrada = parseFloat(attr("entrada") || "0");
    const parcela = parseFloat(attr("valor-parcela") || "0");
    const fundo = parseFloat(attr("fundo") || "0");
    const garantia = parseFloat(attr("garantia") || "0");
    const prazo = parseInt(attr("prazo") || "0", 10) || 0;
    const cat = (attr("categoria") || "").toLowerCase();
    const categoria = cat.includes("imov") || cat.includes("imóv")
      ? "Imóvel"
      : cat.includes("auto") || cat.includes("veic") || cat.includes("veíc")
        ? "Veículo"
        : (attr("categoria") || inferCategoria(Math.round(credito * 100)));
    const statusRaw = (attr("status") || "").toLowerCase();
    const status = statusRaw.includes("reserv") ? "Reservada" : "Disponível";
    const carta: Carta = {
      codigo,
      categoria,
      credito_cents: Math.round(credito * 100),
      entrada_cents: Math.round(entrada * 100),
      parcelas: prazo,
      valor_parcela_cents: Math.round(parcela * 100),
      saldo_devedor_cents: 0,
      fundo_comum_cents: Math.round(fundo * 100),
      ref_garantia_cents: Math.round(garantia * 100),
      administradora: attr("administradora") || "—",
      status,
      fonte: DW_SOURCE.id,
      fonte_nome: DW_SOURCE.name,
      fonte_cor: DW_SOURCE.color,
      whatsapp_link: "",
    };
    carta.whatsapp_link = buildWhatsappLink(DW_SOURCE.whatsapp, carta);
    cartas.push(carta);
  }
  return cartas;
}

async function fetchDwAll(): Promise<{ cartas: Carta[]; error?: string }> {
  try {
    const results = await Promise.all(
      DW_URLS.map((u) => fetchSource(u, parseDwConsorcios)),
    );
    const cartas = results.flatMap((r) => r.cartas);
    const errors = results.map((r) => r.error).filter(Boolean);
    // Dedup by codigo (just in case)
    const seen = new Set<string>();
    const unique = cartas.filter((c) => {
      if (seen.has(c.codigo)) return false;
      seen.add(c.codigo);
      return true;
    });
    return {
      cartas: unique,
      error: errors.length ? errors.join("; ") : undefined,
    };
  } catch (e) {
    return {
      cartas: [],
      error: e instanceof Error ? e.message : "Unknown",
    };
  }
}

// ─── Parser: Contemplados RS (JSON API) ──────────────────────────────────────
// Entrada exibida = entrada da fonte + 1,5% do crédito (regra interna do Hub).
interface CrsRow {
  id: number;
  categoria?: string;
  "valor-do-credito"?: string;
  entrada?: string;
  parcelas?: string;
  "situacao-da-carta"?: string;
  observacoes?: string;
}

async function fetchContempladosRs(): Promise<{ cartas: Carta[]; error?: string }> {
  try {
    const resp = await fetch(CRS_API, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; HubDPBot/1.0; +https://hubdp.net)",
        Accept: "application/json",
      },
    });
    if (!resp.ok) return { cartas: [], error: `HTTP ${resp.status}` };
    const rows = (await resp.json()) as CrsRow[];
    if (!Array.isArray(rows)) return { cartas: [], error: "Invalid JSON" };

    const cartas: Carta[] = rows.map((r) => {
      const credito_cents = parseBRLToCents(r["valor-do-credito"] || "");
      const entradaBaseCents = parseBRLToCents(r.entrada || "");
      // Regra: somar 1,5% do crédito sobre a entrada exibida
      const entrada_cents = entradaBaseCents + Math.round(credito_cents * 0.015);

      // Parcelas no formato "195x7515,00" ou "195x 7.515,00"
      const parcelaStr = (r.parcelas || "").trim();
      const m = parcelaStr.match(/(\d+)\s*x\s*(.+)/i);
      const parcelas = m ? parseInt(m[1], 10) : 0;
      const valor_parcela_cents = m ? parseBRLToCents(m[2]) : 0;

      const catRaw = (r.categoria || "").toLowerCase();
      const categoria = catRaw.includes("imov") || catRaw.includes("imóv")
        ? "Imóvel"
        : catRaw.includes("auto") || catRaw.includes("veic") || catRaw.includes("veíc")
          ? "Veículo"
          : (r.categoria || inferCategoria(credito_cents));

      const statusRaw = (r["situacao-da-carta"] || "").toLowerCase();
      const status = statusRaw.includes("reserv") ? "Reservada" : "Disponível";

      const administradora = (r.observacoes || "").trim() || "—";

      const carta: Carta = {
        codigo: String(r.id),
        categoria,
        credito_cents,
        entrada_cents,
        parcelas,
        valor_parcela_cents,
        saldo_devedor_cents: 0,
        fundo_comum_cents: 0,
        ref_garantia_cents: 0,
        administradora,
        status,
        fonte: CRS_SOURCE.id,
        fonte_nome: CRS_SOURCE.name,
        fonte_cor: CRS_SOURCE.color,
        whatsapp_link: "",
      };
      carta.whatsapp_link = buildWhatsappLink(CRS_SOURCE.whatsapp, carta);
      return carta;
    });

    return { cartas };
  } catch (e) {
    return { cartas: [], error: e instanceof Error ? e.message : "Unknown" };
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const force = url.searchParams.get("refresh") === "1";

    if (!force && cache && Date.now() - cache.ts < CACHE_TTL_MS) {
      return new Response(
        JSON.stringify({ ...(cache.data as object), cached: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const [ldRes, dpRes, fbRes, dwRes, crsRes] = await Promise.all([
      fetchSource(SOURCES.ldcred.url, parseLdCred),
      fetchSource(SOURCES.dpconsorcios.url, parseDpConsorcios),
      fetchSource(SOURCES.fragaebitello.url, parseFragaBitello),
      fetchDwAll(),
      fetchContempladosRs(),
    ]);

    const cartas: Carta[] = [
      ...ldRes.cartas,
      ...dpRes.cartas,
      ...fbRes.cartas,
      ...dwRes.cartas,
      ...crsRes.cartas,
    ];

    const sources = [
      {
        ...SOURCES.ldcred,
        total: ldRes.cartas.length,
        error: ldRes.error,
      },
      {
        ...SOURCES.dpconsorcios,
        total: dpRes.cartas.length,
        error: dpRes.error,
      },
      {
        ...SOURCES.fragaebitello,
        total: fbRes.cartas.length,
        error: fbRes.error,
      },
      {
        ...DW_SOURCE,
        total: dwRes.cartas.length,
        error: dwRes.error,
      },
      {
        ...CRS_SOURCE,
        total: crsRes.cartas.length,
        error: crsRes.error,
      },
    ];

    const payload = {
      sources,
      fetched_at: new Date().toISOString(),
      total: cartas.length,
      cartas,
    };

    cache = { ts: Date.now(), data: payload };

    return new Response(JSON.stringify(payload), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("ldcred-contempladas error:", e);
    const msg = e instanceof Error ? e.message : "Unknown error";
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
