// Lógica de dados da seção de diversidade, separada da interface.

export type DiversitySummary = {
  candidates: number;
  elected: number;
  womenCandidates: number;
  womenElected: number;
  negroCandidates: number;
  negroElected: number;
  genderCandidates: Record<string, number>;
  genderElected: Record<string, number>;
  raceCandidates: Record<string, number>;
  raceElected: Record<string, number>;
};

export type DiversityData = {
  national: DiversitySummary;
  byState: Record<string, DiversitySummary>;
  byParty: Record<string, DiversitySummary>;
};

/** Participação de `part` em `total`, formatada como porcentagem em pt-BR. */
export function share(part: number, total: number) {
  if (total === 0) return "—";
  return `${((part / total) * 100).toLocaleString("pt-BR", {
    maximumFractionDigits: 1,
  })}%`;
}

export function shareValue(part: number, total: number) {
  return total === 0 ? 0 : (part / total) * 100;
}

