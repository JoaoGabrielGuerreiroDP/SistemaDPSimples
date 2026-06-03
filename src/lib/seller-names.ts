/**
 * Seller name normalization / reconciliation.
 *
 * Many sellers appear with different name variations across sheets
 * (e.g. "Gabriel Simão", "Simão", "Gabriel Manenti", "Gabriel").
 * This module maps known aliases to a canonical name so they are
 * counted as a single person everywhere.
 *
 * HOW TO MAINTAIN:
 * – Each entry maps  canonical_name → [alias1, alias2, …]
 * – Matching is case-insensitive and trim-safe.
 * – If a name doesn't match any alias it is kept as-is.
 */

const ALIASES: Record<string, string[]> = {
  // ─── Current roster (abril 2026 sheet) ───
  "Vinícius Oliveira":  ["VINICIUS", "Vinicius", "Vinícius", "VINICIUS OLIVEIRA", "Vinicíus Oliveira", "VINICÍUS OLIVEIRA", "Vinicíus", "VINICÍUS", "Vinicius Oliveira"],
  "Luan":               ["LUAN", "Luan Pereira", "LUAN PEREIRA"],
  "Alexander":          ["ALEXANDER", "ALEXANDER ", "Alexander Generoso", "ALEXANDER GENEROSO", "Xandi", "XANDI"],
  "João Gabriel":       ["JOÃO GABRIEL", "JOAO GABRIEL", "João Gabriel", "Joao Gabriel"],
  "Guilherme Sutil":    ["GUILHERME SUTIL", "Guilherme Sutil"],
  "Guilherme Melo":     ["GUILHERME MELO", "GUILHERME", "Guilherme", "Guilherme Melo"],
  "Gabriel Simão":      ["GABRIEL", "Gabriel", "Simão", "SIMÃO", "Gabriel Simao", "GABRIEL SIMÃO", "GABRIEL SIMAO", "Gabriel Costa Simão", "Gabriel Costa Simao", "GABRIEL COSTA SIMÃO"],
  "Gabriel Manenti":    ["Gabriel Manenti", "GABRIEL MANENTI", "Manenti"],
  "Lucas Freitas":      ["LUCAS", "Lucas", "LUCAS FREITAS", "Lucas Cardoso De Freitas", "Lucas Cardoso de Freitas", "LUCAS CARDOSO DE FREITAS", "Lucas Cardoso"],
  "Diego":              ["DIEGO", "Diego De Luca", "DIEGO DE LUCA", "diego de luca"],
  "Patrick Bragato Rex":["Patrick", "PATRICK", "Patrick Bragato", "PATRICK BRAGATO REX"],
  "Leandro Fernandes":  ["Leandro", "LEANDRO", "LEANDRO FERNANDES"],
  "Gustavo Machado Correa": ["Gustavo", "GUSTAVO", "Gustavo Machado", "GUSTAVO MACHADO CORREA", "Gustavo Corrêa", "GUSTAVO CORRÊA", "Gustavo Correa", "GUSTAVO CORREA", "Gustavo Machado Corrêa", "GUSTAVO MACHADO CORRÊA"],
  "Márcio Pereira":     ["Marcio", "MARCIO", "Márcio", "MÁRCIO", "Marcio Pereira", "MARCIO PEREIRA", "MÁRCIO PEREIRA", "Marcio De Souza Pereira", "Márcio De Souza Pereira", "MARCIO DE SOUZA PEREIRA"],

  // ─── Historical (legacy names) ───
  "Alan":               ["ALAN"],
  "Alison":             ["ALISON"],
  "Ramon":              ["RAMON"],
  "Rafael":             ["RAFAEL"],
  "Alessandro":         ["ALESSANDRO", "Alê", "ALÊ", "ALE", "Alessandro Dos Santos", "Alessandro dos Santos", "ALESSANDRO DOS SANTOS"],
  "Juliana":            ["JULIANA"],
  "Daniel":             ["DANIEL"],

  // ─── Liderança (para casar avatar do profile no Hall) ───
  "Daniel Pedro":       ["Daniel Pedro", "DANIEL PEDRO", "Daniel Pedro de Oliveira", "DANIEL PEDRO DE OLIVEIRA", "Daniel Pedro De Oliveira"],
  "Alan Melo":          ["Alan Melo", "ALAN MELO", "Alan Melo De Souza", "Alan Melo de Souza", "ALAN MELO DE SOUZA", "Alan Souza"],
  "André":              ["André", "ANDRE", "Andre", "Andre Oliveira", "André Oliveira", "ANDRE OLIVEIRA", "ANDRÉ OLIVEIRA"],
};

// Build reverse lookup: lowered alias → canonical
const _reverseMap = new Map<string, string>();
const _reverseMapNoAccent = new Map<string, string>();
function stripAccents(s: string): string {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}
for (const [canonical, aliases] of Object.entries(ALIASES)) {
  const add = (s: string) => {
    const k = s.toLowerCase().trim();
    _reverseMap.set(k, canonical);
    _reverseMapNoAccent.set(stripAccents(k), canonical);
  };
  add(canonical);
  for (const a of aliases) add(a);
}

/**
 * Return the canonical name for a given raw corretor name.
 * If no alias matches, returns the trimmed input as-is.
 */
export function normalizeName(raw: string): string {
  const cleaned = raw.replace(/\s*\([^)]*\)\s*/g, " ").replace(/\s+/g, " ").trim();
  const key = cleaned.toLowerCase();
  if (_reverseMap.has(key)) return _reverseMap.get(key)!;
  const keyNoAcc = stripAccents(key);
  if (_reverseMapNoAccent.has(keyNoAcc)) return _reverseMapNoAccent.get(keyNoAcc)!;
  // Fallback: try matching by tokens (first + last name)
  const tokens = key.split(" ");
  if (tokens.length >= 2) {
    const firstLast = `${tokens[0]} ${tokens[tokens.length - 1]}`;
    if (_reverseMap.has(firstLast)) return _reverseMap.get(firstLast)!;
    const firstLastNoAcc = stripAccents(firstLast);
    if (_reverseMapNoAccent.has(firstLastNoAcc)) return _reverseMapNoAccent.get(firstLastNoAcc)!;
  }
  return cleaned;
}

/* ─── Single source of truth: active brokers & teams ─── */

export const BROKER_TEAMS: Record<string, string> = {
  "Patrick Bragato Rex": "Swat",
  "Gabriel Manenti":     "Swat",
  "Gustavo Machado Correa": "Swat",
  "Luan":                "Swat",
  "Alexander":           "The Closers",
  "Guilherme Melo":      "The Closers",
  "Alessandro":          "The Closers",
  "Gabriel Simão":       "The Closers",
  "Lucas Freitas":       "Efraim",
  "Márcio Pereira":      "Efraim",
  "Vinícius Oliveira":   "Efraim",
  "Guilherme Sutil":     "Efraim",
};

/** All active canonical broker names */
export const ALL_BROKERS = Object.keys(BROKER_TEAMS);

/** Leadership names — excluded from rankings */
export const LEADERSHIP_NAMES = [
  "daniel", "daniel pedro", "alan", "alan melo", "andré", "andre", "diego",
  "sara cristina", "sara", "kézia cristina", "kézia", "kezia",
  "davi gonçalves", "davi", "administrativo",
  "alan souza", "renan",
  // Removidos dos relatórios/análises de venda
  "joão gabriel", "joao gabriel",
  "leandro fernandes", "leandro",
];

export function isLeadership(n: string): boolean {
  const l = stripAccents(n.toLowerCase().trim());
  return LEADERSHIP_NAMES.some((x) => {
    const leader = stripAccents(x.toLowerCase().trim());
    return l === leader || l.includes(leader);
  });
}
