// Acesso aos dados de cada eleição. Importa os JSONs em tempo de build, então
// só deve ser usado em componentes de servidor e nas páginas.

import deputies2022 from "../data/deputados-2022.json";
import deputies2026 from "../data/deputados-2026.json";
import diversity2022 from "../data/diversidade-2022.json";
import diversity2026 from "../data/diversidade-2026.json";
import { LATEST_YEAR, type Deputy } from "./deputados";
import type { DiversityData } from "./diversidade";

export type Legislature = {
  year: number;
  deputies: Deputy[];
  diversity: DiversityData;
};

const LEGISLATURES: Record<number, Legislature> = {
  2022: {
    year: 2022,
    deputies: deputies2022 as unknown as Deputy[],
    diversity: diversity2022 as DiversityData,
  },
  2026: {
    year: 2026,
    deputies: deputies2026 as unknown as Deputy[],
    diversity: diversity2026 as DiversityData,
  },
};

export function getLegislature(year: number) {
  return LEGISLATURES[year] ?? null;
}

export const latestLegislature = LEGISLATURES[LATEST_YEAR];

/** Procura um deputado em qualquer eleição (os ids do TSE não se repetem). */
export function findDeputyAnywhere(id: string) {
  for (const legislature of Object.values(LEGISLATURES)) {
    const deputy = legislature.deputies.find((item) => item.id === id);
    if (deputy) return deputy;
  }
  return null;
}

export function allDeputies() {
  return Object.values(LEGISLATURES).flatMap((item) => item.deputies);
}
