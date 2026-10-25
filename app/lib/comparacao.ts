// Comparação entre os eleitos de 2022 e os de 2026, calculada a partir do
// histórico de cada eleito de 2026 (a trajetória é ligada por CPF no pipeline).
//
// Funções puras, como em deputados.ts, para poderem ser testadas sem a interface.

import { median, type Deputy, type ElectionEvent } from "./deputados.ts";

export type Reelected = {
  deputy: Deputy;
  /** Candidatura de 2022 a Deputado Federal que resultou em eleição. */
  previous: ElectionEvent;
  /** Variação em reais entre a declaração de 2022 e a de 2026 (nominal). */
  delta: number;
  /** Variação percentual; null quando a declaração de 2022 foi zero. */
  percent: number | null;
  changedParty: boolean;
};

function federalEvent(deputy: Deputy, year: number) {
  return deputy.history
    .filter((event) => event.year === year && event.office === "Deputado Federal")
    .sort((a, b) => (b.assetsTotal ?? 0) - (a.assetsTotal ?? 0))[0];
}

/** Eleitos de 2026 que também foram eleitos Deputado Federal em 2022. */
export function reelectedDeputies(deputies: Deputy[]): Reelected[] {
  const result: Reelected[] = [];

  for (const deputy of deputies) {
    const previous = federalEvent(deputy, 2022);
    if (!previous?.elected || previous.assetsTotal === null) continue;

    result.push({
      deputy,
      previous,
      delta: deputy.value - previous.assetsTotal,
      percent:
        previous.assetsTotal > 0
          ? (deputy.value / previous.assetsTotal - 1) * 100
          : null,
      changedParty: previous.party !== deputy.party,
    });
  }

  return result;
}

export type ComparisonSummary = {
  total: number;
  reelected: number;
  newcomers: number;
  /** Quantos dos eleitos de 2022 voltaram, em relação ao total de 2022. */
  returnRate: number;
  medianValue2022: number;
  medianValue2026: number;
  /** Mediana da variação percentual, só com base positiva em 2022. */
  medianPercent: number | null;
  withPercent: number;
  increased: number;
  decreased: number;
  changedParty: number;
};

export function summarizeComparison(
  deputies: Deputy[],
  reelected: Reelected[],
  total2022: number,
): ComparisonSummary {
  const percents = reelected
    .map((item) => item.percent)
    .filter((value): value is number => value !== null);

  return {
    total: deputies.length,
    reelected: reelected.length,
    newcomers: deputies.length - reelected.length,
    returnRate: total2022 === 0 ? 0 : (reelected.length / total2022) * 100,
    medianValue2022: median(reelected.map((item) => item.previous.assetsTotal ?? 0)),
    medianValue2026: median(reelected.map((item) => item.deputy.value)),
    medianPercent: percents.length ? median(percents) : null,
    withPercent: percents.length,
    increased: reelected.filter((item) => item.delta > 0).length,
    decreased: reelected.filter((item) => item.delta < 0).length,
    changedParty: reelected.filter((item) => item.changedParty).length,
  };
}

/** Maiores aumentos (ou quedas, com `direction = "down"`) em reais. */
export function rankByDelta(
  reelected: Reelected[],
  direction: "up" | "down",
  limit: number,
) {
  const sorted = [...reelected].sort((a, b) =>
    direction === "up" ? b.delta - a.delta : a.delta - b.delta,
  );
  return sorted.filter((item) => (direction === "up" ? item.delta > 0 : item.delta < 0)).slice(0, limit);
}

export type RenewalRow = {
  key: string;
  total: number;
  reelected: number;
  newcomers: number;
};

/** Renovação por partido ou UF de 2026: quantos eleitos são reeleitos e quantos novos. */
export function renewalBy(
  deputies: Deputy[],
  reelected: Reelected[],
  field: "party" | "uf",
): RenewalRow[] {
  const returning = new Set(reelected.map((item) => item.deputy.id));
  const rows = new Map<string, RenewalRow>();

  for (const deputy of deputies) {
    const key = deputy[field];
    const row = rows.get(key) ?? { key, total: 0, reelected: 0, newcomers: 0 };
    row.total += 1;
    if (returning.has(deputy.id)) row.reelected += 1;
    else row.newcomers += 1;
    rows.set(key, row);
  }

  return [...rows.values()].sort(
    (a, b) => b.total - a.total || a.key.localeCompare(b.key, "pt-BR"),
  );
}
