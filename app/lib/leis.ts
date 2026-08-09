// Lógica de dados dos projetos de lei, separada da interface.

export type StatusProposicao = "aprovada" | "arquivada" | "tramitando";

export type Proposicao = {
  id: number;
  tipo: string;
  numero: number;
  ano: number;
  ementa: string;
  uri: string;
  // Ausentes quando a situação ainda não foi buscada (ver
  // scripts/enrich_status.py) -- tratar como "tramitando" na prática.
  status?: StatusProposicao;
  situacao?: string | null;
};

export type LeisData = Record<string, Proposicao[]>;

/** "PL 4822/2025" */
export function proposicaoLabel(proposicao: Proposicao) {
  return `${proposicao.tipo} ${proposicao.numero}/${proposicao.ano}`;
}

export const STATUS_LABEL: Record<StatusProposicao, string> = {
  aprovada: "Aprovado",
  tramitando: "Em tramitação",
  arquivada: "Arquivado",
};

export function statusOf(proposicao: Proposicao): StatusProposicao {
  return proposicao.status ?? "tramitando";
}

/** Quantidade de proposições por ano, do mais recente para o mais antigo. */
export function countByYear(proposicoes: Proposicao[]) {
  const counts = new Map<number, number>();
  proposicoes.forEach((proposicao) => {
    counts.set(proposicao.ano, (counts.get(proposicao.ano) ?? 0) + 1);
  });
  return [...counts.entries()].sort((a, b) => b[0] - a[0]);
}

export function countByStatus(proposicoes: Proposicao[]) {
  const counts: Record<StatusProposicao, number> = {
    aprovada: 0,
    tramitando: 0,
    arquivada: 0,
  };
  proposicoes.forEach((proposicao) => {
    counts[statusOf(proposicao)] += 1;
  });
  return counts;
}

/** app/data/leis-resumo.json (ver scripts/resumir_leis.py) -- sem ementas,
 * pequeno o bastante para carregar de uma vez na página /leis. */
export type LeisResumo = {
  totalProjetos: number;
  deputadosComDados: number;
  porStatus: Record<StatusProposicao, number>;
  porAno: [number, number][];
  topAutores: {
    id: string;
    name: string;
    uf: string;
    party: string;
    total: number;
  }[];
};
