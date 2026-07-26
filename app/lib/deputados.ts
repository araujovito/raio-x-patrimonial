// Lógica de dados do explorador, separada da interface.
//
// Estas funções são puras: recebem dados e devolvem dados, sem depender do
// React nem do navegador. Isso mantém o componente enxuto e permite testar as
// regras (busca, filtros, trajetória, links) sem renderizar a página.

export type Categories = Record<string, number>;

export type ElectionEvent = {
  year: number;
  office: string;
  party: string;
  uf: string;
  result: string;
  elected: boolean;
  assetsTotal: number | null;
  assetItems: number | null;
  assetCategories: Categories | null;
};

export type Deputy = {
  id: string;
  name: string;
  fullName: string;
  uf: string;
  party: string;
  status: string;
  value2022: number;
  value2018: number | null;
  items2022: number;
  items2018: number | null;
  categories2022: Categories;
  categories2018: Categories | null;
  previousYear: number | null;
  previousOffice: string | null;
  previousParty: string | null;
  previousValue: number | null;
  previousItems: number | null;
  previousCategories: Categories | null;
  priorCandidacies: number;
  priorVictories: number;
  history: ElectionEvent[];
};

export type SortMode = "value" | "growth" | "name";

// Valores usados pelos seletores quando nenhum filtro está aplicado.
export const ALL_STATES = "Todas";
export const ALL_PARTIES = "Todos";

/** Variação nominal entre a declaração anterior e a de 2022, em porcentagem. */
export function variation(deputy: Deputy) {
  if (deputy.previousValue === null || deputy.previousValue <= 0) return null;
  return (deputy.value2022 / deputy.previousValue - 1) * 100;
}

export function percent(value: number | null) {
  if (value === null || !Number.isFinite(value)) return "sem comparação";
  const signal = value > 0 ? "+" : "";
  return `${signal}${value.toLocaleString("pt-BR", {
    maximumFractionDigits: 1,
  })}%`;
}

export function median(values: number[]) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2;
}

/**
 * Remove acentos e coloca em minúsculas, para que a busca funcione mesmo
 * quando o usuário digita sem acento (ex.: "abilio" encontra "Abílio").
 */
export function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

// O TSE usa marcadores técnicos (#Nulo#, #NULO, etc.) quando não há resultado
// apurado para aquela candidatura. Exibimos um rótulo neutro no lugar do código.
export function resultLabel(result: string) {
  const cleaned = result.replace(/#/g, "").trim();
  if (cleaned === "" || normalize(cleaned) === "nulo") {
    return "Sem resultado apurado";
  }
  return result;
}

// Algumas candidaturas aparecem duas vezes no mesmo ano/cargo por causa do 2º
// turno (ex.: "2º Turno" e "Não Eleito"), com o mesmo patrimônio declarado.
// Consolidamos por ano+cargo+partido, mantendo a entrada mais informativa:
// preferimos a que resultou em eleição e, na falta dela, a que tem resultado
// apurado (não técnico).
export function dedupeHistory(history: ElectionEvent[]) {
  const byKey = new Map<string, ElectionEvent>();

  history.forEach((event) => {
    const key = `${event.year}-${event.office}-${event.party}`;
    const current = byKey.get(key);
    if (current === undefined) {
      byKey.set(key, event);
      return;
    }
    const currentIsTechnical =
      resultLabel(current.result) === "Sem resultado apurado";
    const eventIsTechnical =
      resultLabel(event.result) === "Sem resultado apurado";
    // Prioridade: eleito > resultado apurado > mantém o atual.
    if (
      (event.elected && !current.elected) ||
      (event.elected === current.elected &&
        currentIsTechnical &&
        !eventIsTechnical)
    ) {
      byKey.set(key, event);
    }
  });

  return [...byKey.values()];
}

/**
 * Declarações de bens disponíveis, uma por ano (a de maior valor quando há
 * mais de uma), da mais recente para a mais antiga. Alimenta o gráfico e o
 * seletor de eleição da composição patrimonial.
 */
export function assetEvents(history: ElectionEvent[]) {
  const byYear = new Map<number, ElectionEvent>();

  history.forEach((event) => {
    if (event.assetsTotal === null || event.assetCategories === null) return;
    const current = byYear.get(event.year);
    if (current === undefined || event.assetsTotal > (current.assetsTotal ?? 0)) {
      byYear.set(event.year, event);
    }
  });

  return [...byYear.values()].sort((a, b) => b.year - a.year);
}

export function candidatePhotoUrl(deputy: Deputy) {
  return `/deputados/${deputy.id}.jpeg`;
}

// Código da Eleição Geral Federal de 2022 no sistema de Divulgação do TSE.
const TSE_ID_ELEICAO_2022 = "2040602022";

// Região de cada UF. O TSE ignora esse trecho da rota ao carregar o candidato,
// mas informá-lo corretamente deixa a trilha de navegação (breadcrumb) coerente.
const TSE_REGIAO_POR_UF: Record<string, string> = {
  AC: "NORTE", AP: "NORTE", AM: "NORTE", PA: "NORTE", RO: "NORTE", RR: "NORTE", TO: "NORTE",
  AL: "NORDESTE", BA: "NORDESTE", CE: "NORDESTE", MA: "NORDESTE", PB: "NORDESTE",
  PE: "NORDESTE", PI: "NORDESTE", RN: "NORDESTE", SE: "NORDESTE",
  DF: "CENTROOESTE", GO: "CENTROOESTE", MT: "CENTROOESTE", MS: "CENTROOESTE",
  ES: "SUDESTE", MG: "SUDESTE", RJ: "SUDESTE", SP: "SUDESTE",
  PR: "SUL", RS: "SUL", SC: "SUL",
};

// Ficha do candidato no TSE (contém abas de Bens, Eleições e Prestação de Contas).
// Formato validado no sistema atual (v2.8.9):
// #/candidato/{REGIAO}/{UF}/{idEleicao}/{sqCandidato}/{ano}/{UF}
export function candidateSourceUrl(deputy: Deputy) {
  const regiao = TSE_REGIAO_POR_UF[deputy.uf] ?? "BRASIL";
  return `https://divulgacandcontas.tse.jus.br/divulga/#/candidato/${regiao}/${deputy.uf}/${TSE_ID_ELEICAO_2022}/${deputy.id}/2022/${deputy.uf}`;
}

export type DeputyFilters = {
  query: string;
  uf: string;
  party: string;
  onlyComparable: boolean;
};

/**
 * Aplica busca por nome (de urna ou completo, sem acentos) e os filtros de
 * estado, partido e "apenas comparáveis".
 */
export function filterDeputies(deputies: Deputy[], filters: DeputyFilters) {
  const search = normalize(filters.query.trim());

  return deputies.filter((deputy) => {
    const matchesSearch =
      !search ||
      normalize(`${deputy.name} ${deputy.fullName}`).includes(search);

    return (
      matchesSearch &&
      (filters.uf === ALL_STATES || deputy.uf === filters.uf) &&
      (filters.party === ALL_PARTIES || deputy.party === filters.party) &&
      (!filters.onlyComparable || deputy.previousValue !== null)
    );
  });
}

/** Ordena por patrimônio, variação nominal ou nome. Não altera a lista original. */
export function sortDeputies(deputies: Deputy[], mode: SortMode) {
  return [...deputies].sort((a, b) => {
    if (mode === "name") return a.name.localeCompare(b.name, "pt-BR");
    if (mode === "growth")
      return (variation(b) ?? -Infinity) - (variation(a) ?? -Infinity);
    return b.value2022 - a.value2022;
  });
}
