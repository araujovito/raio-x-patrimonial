// Lógica de dados dos projetos de lei, separada da interface.

export type Proposicao = {
  id: number;
  tipo: string;
  numero: number;
  ano: number;
  ementa: string;
  uri: string;
};

export type LeisData = Record<string, Proposicao[]>;

/** "PL 4822/2025" */
export function proposicaoLabel(proposicao: Proposicao) {
  return `${proposicao.tipo} ${proposicao.numero}/${proposicao.ano}`;
}
