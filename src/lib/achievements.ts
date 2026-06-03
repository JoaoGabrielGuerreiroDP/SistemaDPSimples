/**
 * Cálculo dinâmico de conquistas a partir do histórico de vendas + recordes salvos.
 *
 * Conquistas implementadas:
 *  - annual-champion   → Top 1 do ano (anos completos passados + ano corrente parcial)
 *  - vice-champion     → Top 2 do ano
 *  - month-champion    → Foi #1 em pelo menos um mês
 *  - record-breaker    → Quebrou o próprio recorde mensal alguma vez
 *  - million-club      → Já fez >= R$ 1M em um único mês
 *  - goal-streak       → 3+ meses consecutivos batendo a meta (somente último ano)
 *  - hat-trick         → 3 meses seguidos sendo top 1 do mês
 *  - team-champion     → Está em time que liderou o mês atual
 *  - perfect-year      → Bateu meta em todos os meses de um ano completo
 *  - star-student      → Média de quiz >= 4.5 (calculado fora, opcional)
 */

import type { SaleRow } from "@/hooks/useGoogleSheetsData";
import { ALL_BROKERS, BROKER_TEAMS, normalizeName, isLeadership } from "@/lib/seller-names";

import annualChampion from "@/assets/achievements/annual-champion.png";
import viceChampion from "@/assets/achievements/vice-champion.png";
import monthChampion from "@/assets/achievements/month-champion.png";
import recordBreaker from "@/assets/achievements/record-breaker.png";
import millionClub from "@/assets/achievements/million-club.png";
import goalStreak from "@/assets/achievements/goal-streak.png";
import hatTrick from "@/assets/achievements/hat-trick.png";
import teamChampion from "@/assets/achievements/team-champion.png";
import starStudent from "@/assets/achievements/star-student.png";
import perfectYear from "@/assets/achievements/perfect-year.png";
import firstMillion from "@/assets/achievements/first-million.png";
import fastMillion from "@/assets/achievements/fast-million.png";

export type AchievementKey =
  | "annual-champion"
  | "vice-champion"
  | "month-champion"
  | "record-breaker"
  | "million-club"
  | "first-million"
  | "fast-million"
  | "goal-streak"
  | "hat-trick"
  | "team-champion"
  | "perfect-year"
  | "star-student";

export interface Achievement {
  key: AchievementKey;
  name: string;
  desc: string;
  img: string;
  /** Detalhe contextual (ex.: "2023, 2024, 2025") */
  detail?: string;
  /** Quantas vezes ganhou — exibido como contador */
  count?: number;
}

export const ACHIEVEMENT_META: Record<AchievementKey, { name: string; img: string }> = {
  "annual-champion": { name: "Campeão Anual", img: annualChampion },
  "vice-champion":   { name: "Vice-campeão Anual", img: viceChampion },
  "month-champion":  { name: "Campeão do Mês", img: monthChampion },
  "record-breaker":  { name: "Quebrou Recorde", img: recordBreaker },
  "million-club":    { name: "Million Club", img: millionClub },
  "first-million":   { name: "Primeiro Milhão", img: firstMillion },
  "fast-million":    { name: "1M em 90 dias", img: fastMillion },
  "goal-streak":     { name: "Sequência de Metas", img: goalStreak },
  "hat-trick":       { name: "Hat-Trick", img: hatTrick },
  "team-champion":   { name: "Time Campeão", img: teamChampion },
  "star-student":    { name: "Aluno Estrela", img: starStudent },
  "perfect-year":    { name: "Ano Perfeito", img: perfectYear },
};

function parseBRDate(raw: string): Date | null {
  if (!raw) return null;
  const parts = raw.split("/");
  if (parts.length !== 3) return null;
  const [d, m, y] = parts.map(Number);
  return new Date(y, m - 1, d);
}

interface MonthGoal {
  /** broker canonical name → meta */
  [broker: string]: number;
}

/**
 * Constrói um mapa: broker → mes_ref ("YYYY-MM") → { value, count }
 * Considera apenas brokers ativos (não líderes).
 */
function buildBrokerMonthMap(allRows: SaleRow[]) {
  const map: Record<string, Record<string, { value: number; count: number }>> = {};
  for (const row of allRows) {
    const raw = (row.corretor || "").trim();
    if (!raw || isLeadership(raw)) continue;
    const name = normalizeName(raw);
    if (!ALL_BROKERS.includes(name)) continue;
    const d = parseBRDate(row.dataVenda);
    if (!d) continue;
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    if (!map[name]) map[name] = {};
    if (!map[name][key]) map[name][key] = { value: 0, count: 0 };
    map[name][key].value += row.valor;
    map[name][key].count += 1;
  }
  return map;
}

/** Apura o ranking anual de cada ano e retorna { year → [name ordenado] } */
function rankByYear(brokerMonthMap: ReturnType<typeof buildBrokerMonthMap>) {
  const yearTotals: Record<number, Record<string, number>> = {};
  for (const [name, months] of Object.entries(brokerMonthMap)) {
    for (const [k, v] of Object.entries(months)) {
      const year = parseInt(k.slice(0, 4));
      if (!yearTotals[year]) yearTotals[year] = {};
      yearTotals[year][name] = (yearTotals[year][name] || 0) + v.value;
    }
  }
  const ranking: Record<number, string[]> = {};
  for (const [yearStr, totals] of Object.entries(yearTotals)) {
    const year = parseInt(yearStr);
    ranking[year] = Object.entries(totals)
      .sort((a, b) => b[1] - a[1])
      .map(([name]) => name);
  }
  return ranking;
}

/** Mes a mes: quem foi top 1 em cada mês */
function monthChampions(brokerMonthMap: ReturnType<typeof buildBrokerMonthMap>) {
  const monthTotals: Record<string, Record<string, number>> = {};
  for (const [name, months] of Object.entries(brokerMonthMap)) {
    for (const [k, v] of Object.entries(months)) {
      if (!monthTotals[k]) monthTotals[k] = {};
      monthTotals[k][name] = v.value;
    }
  }
  const champs: Record<string, string> = {};
  for (const [k, totals] of Object.entries(monthTotals)) {
    const sorted = Object.entries(totals).sort((a, b) => b[1] - a[1]);
    if (sorted.length > 0 && sorted[0][1] > 0) champs[k] = sorted[0][0];
  }
  return champs;
}

interface CalcOptions {
  allRows: SaleRow[];
  /** Brokers que têm registro de quebra de recorde (sales_record_breaks) */
  recordBreakersByBroker?: Record<string, number>;
  /** Metas por mês: mes_ref → broker → meta */
  goalsByMonth?: Record<string, MonthGoal>;
  /** Time campeão do mês corrente */
  currentMonthTopTeam?: string;
}

/**
 * Devolve mapa: broker canonical → lista de Achievements
 */
export function calculateAchievements({
  allRows,
  recordBreakersByBroker = {},
  goalsByMonth = {},
  currentMonthTopTeam,
}: CalcOptions): Record<string, Achievement[]> {
  const brokerMonthMap = buildBrokerMonthMap(allRows);
  const annualRanking = rankByYear(brokerMonthMap);
  const monthChamps = monthChampions(brokerMonthMap);
  const result: Record<string, Achievement[]> = {};

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();

  for (const broker of ALL_BROKERS) {
    const list: Achievement[] = [];
    const months = brokerMonthMap[broker] || {};

    // ── Annual / Vice champion ─────────────────────────────────────────
    const annualWins: number[] = [];
    const viceWins: number[] = [];
    for (const [yearStr, ranking] of Object.entries(annualRanking)) {
      const year = parseInt(yearStr);
      // ano atual conta apenas se já passou da metade (>= junho)
      if (year === currentYear && currentMonth < 6) continue;
      if (ranking[0] === broker) annualWins.push(year);
      else if (ranking[1] === broker) viceWins.push(year);
    }
    if (annualWins.length > 0) {
      list.push({
        key: "annual-champion",
        name: ACHIEVEMENT_META["annual-champion"].name,
        img: ACHIEVEMENT_META["annual-champion"].img,
        desc: `Campeão de vendas em ${annualWins.length} ${annualWins.length > 1 ? "anos" : "ano"}`,
        detail: annualWins.sort((a, b) => b - a).join(", "),
        count: annualWins.length,
      });
    }
    if (viceWins.length > 0) {
      list.push({
        key: "vice-champion",
        name: ACHIEVEMENT_META["vice-champion"].name,
        img: ACHIEVEMENT_META["vice-champion"].img,
        desc: `Vice em ${viceWins.length} ${viceWins.length > 1 ? "anos" : "ano"}`,
        detail: viceWins.sort((a, b) => b - a).join(", "),
        count: viceWins.length,
      });
    }

    // ── Month champion (#1 em algum mês) ───────────────────────────────
    const monthWinKeys = Object.entries(monthChamps)
      .filter(([, name]) => name === broker)
      .map(([k]) => k)
      .sort();
    if (monthWinKeys.length > 0) {
      list.push({
        key: "month-champion",
        name: ACHIEVEMENT_META["month-champion"].name,
        img: ACHIEVEMENT_META["month-champion"].img,
        desc: `Foi #1 em ${monthWinKeys.length} ${monthWinKeys.length > 1 ? "meses" : "mês"}`,
        count: monthWinKeys.length,
      });
    }

    // ── Hat-trick (3 meses consecutivos como #1) ───────────────────────
    if (monthWinKeys.length >= 3) {
      const sortedKeys = [...monthWinKeys].sort();
      let consec = 1, maxConsec = 1;
      for (let i = 1; i < sortedKeys.length; i++) {
        const [py, pm] = sortedKeys[i - 1].split("-").map(Number);
        const [cy, cm] = sortedKeys[i].split("-").map(Number);
        const diff = (cy - py) * 12 + (cm - pm);
        if (diff === 1) consec++;
        else consec = 1;
        if (consec > maxConsec) maxConsec = consec;
      }
      if (maxConsec >= 3) {
        list.push({
          key: "hat-trick",
          name: ACHIEVEMENT_META["hat-trick"].name,
          img: ACHIEVEMENT_META["hat-trick"].img,
          desc: `${maxConsec} meses seguidos no topo`,
          count: maxConsec,
        });
      }
    }

    // ── Million club (>= R$ 1M em um único mês) ────────────────────────
    const milMonths = Object.entries(months).filter(([, v]) => v.value >= 1_000_000);
    if (milMonths.length > 0) {
      list.push({
        key: "million-club",
        name: ACHIEVEMENT_META["million-club"].name,
        img: ACHIEVEMENT_META["million-club"].img,
        desc: `Estourou R$ 1M em ${milMonths.length} ${milMonths.length > 1 ? "meses" : "mês"}`,
        count: milMonths.length,
      });
    }

    // ── First Million (acumulado histórico >= R$ 1M) ───────────────────
    const totalAcumulado = Object.values(months).reduce((sum, v) => sum + v.value, 0);
    if (totalAcumulado >= 1_000_000) {
      list.push({
        key: "first-million",
        name: ACHIEVEMENT_META["first-million"].name,
        img: ACHIEVEMENT_META["first-million"].img,
        desc: `Atingiu R$ ${(totalAcumulado / 1_000_000).toFixed(1)}M acumulados em vendas`,
      });

      // ── Fast Million (1M acumulado em <= 90 dias desde a 1ª venda) ───
      const brokerSales = allRows
        .filter((r) => normalizeName((r.corretor || "").trim()) === broker)
        .map((r) => ({ date: parseBRDate(r.dataVenda), valor: r.valor }))
        .filter((r): r is { date: Date; valor: number } => r.date !== null)
        .sort((a, b) => a.date.getTime() - b.date.getTime());

      if (brokerSales.length > 0) {
        const firstDate = brokerSales[0].date;
        let cumulative = 0;
        let millionDate: Date | null = null;
        for (const s of brokerSales) {
          cumulative += s.valor;
          if (cumulative >= 1_000_000) { millionDate = s.date; break; }
        }
        if (millionDate) {
          const days = Math.floor((millionDate.getTime() - firstDate.getTime()) / 86_400_000);
          if (days <= 90) {
            list.push({
              key: "fast-million",
              name: ACHIEVEMENT_META["fast-million"].name,
              img: ACHIEVEMENT_META["fast-million"].img,
              desc: `Atingiu R$ 1M acumulado em apenas ${days} dia${days === 1 ? "" : "s"}`,
              detail: `${days} dias`,
            });
          }
        }
      }
    }

    // ── Record breaker (registrado em sales_record_breaks) ─────────────
    const breakCount = recordBreakersByBroker[broker] || 0;
    if (breakCount > 0) {
      list.push({
        key: "record-breaker",
        name: ACHIEVEMENT_META["record-breaker"].name,
        img: ACHIEVEMENT_META["record-breaker"].img,
        desc: `Quebrou o próprio recorde ${breakCount} ${breakCount > 1 ? "vezes" : "vez"}`,
        count: breakCount,
      });
    }

    // ── Goal streak / Perfect year (precisa de metas históricas) ───────
    const monthsWithGoalsBeaten = new Set<string>();
    for (const [k, v] of Object.entries(months)) {
      const goal = goalsByMonth[k]?.[broker];
      if (goal && goal > 0 && v.value >= goal) monthsWithGoalsBeaten.add(k);
    }
    if (monthsWithGoalsBeaten.size >= 3) {
      const sortedKeys = [...monthsWithGoalsBeaten].sort();
      let consec = 1, maxConsec = 1;
      for (let i = 1; i < sortedKeys.length; i++) {
        const [py, pm] = sortedKeys[i - 1].split("-").map(Number);
        const [cy, cm] = sortedKeys[i].split("-").map(Number);
        if ((cy - py) * 12 + (cm - pm) === 1) consec++;
        else consec = 1;
        if (consec > maxConsec) maxConsec = consec;
      }
      if (maxConsec >= 3) {
        list.push({
          key: "goal-streak",
          name: ACHIEVEMENT_META["goal-streak"].name,
          img: ACHIEVEMENT_META["goal-streak"].img,
          desc: `${maxConsec} meses seguidos batendo a meta`,
          count: maxConsec,
        });
      }
    }
    // Perfect year — bateu meta em 12 meses de algum ano completo (passado)
    const yearMonthsHit: Record<number, Set<number>> = {};
    for (const k of monthsWithGoalsBeaten) {
      const [y, m] = k.split("-").map(Number);
      if (!yearMonthsHit[y]) yearMonthsHit[y] = new Set();
      yearMonthsHit[y].add(m);
    }
    const perfectYears: number[] = [];
    for (const [y, mset] of Object.entries(yearMonthsHit)) {
      if (parseInt(y) >= currentYear) continue;
      if (mset.size >= 12) perfectYears.push(parseInt(y));
    }
    if (perfectYears.length > 0) {
      list.push({
        key: "perfect-year",
        name: ACHIEVEMENT_META["perfect-year"].name,
        img: ACHIEVEMENT_META["perfect-year"].img,
        desc: `Bateu meta TODOS os meses em ${perfectYears.length} ${perfectYears.length > 1 ? "anos" : "ano"}`,
        detail: perfectYears.sort((a, b) => b - a).join(", "),
        count: perfectYears.length,
      });
    }

    // ── Team champion (mês corrente) ───────────────────────────────────
    if (currentMonthTopTeam && BROKER_TEAMS[broker] === currentMonthTopTeam) {
      list.push({
        key: "team-champion",
        name: ACHIEVEMENT_META["team-champion"].name,
        img: ACHIEVEMENT_META["team-champion"].img,
        desc: `Time #1 do mês: ${currentMonthTopTeam}`,
      });
    }

    if (list.length > 0) result[broker] = list;
  }

  return result;
}

/** Calcula o time #1 do mês corrente */
export function calcCurrentMonthTopTeam(allRows: SaleRow[]): string | undefined {
  const now = new Date();
  const totals: Record<string, number> = {};
  for (const row of allRows) {
    const d = parseBRDate(row.dataVenda);
    if (!d || d.getFullYear() !== now.getFullYear() || d.getMonth() !== now.getMonth()) continue;
    if (isLeadership(row.corretor || "")) continue;
    const team = (row.time || "").trim();
    if (!team) continue;
    totals[team] = (totals[team] || 0) + row.valor;
  }
  const sorted = Object.entries(totals).sort((a, b) => b[1] - a[1]);
  return sorted[0]?.[0];
}
