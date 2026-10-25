import type { Metadata } from "next";
import Link from "next/link";

import BuscaProjetosDeLei from "../BuscaProjetosDeLei";
import ResumoLeis from "../ResumoLeis";
import deputiesData from "../data/deputados-2022.json";
import leisResumoData from "../data/leis-resumo.json";
import type { Deputy } from "../lib/deputados";
import type { LeisResumo } from "../lib/leis";

const deputies = deputiesData as unknown as Deputy[];
const resumo = leisResumoData as LeisResumo;

export const metadata: Metadata = {
  title: "Projetos de lei",
  description:
    "Quantos projetos de lei cada deputado federal apresentou, quais foram aprovados e quais ainda estão em tramitação na Câmara.",
};

export default function LeisPage() {
  return (
    <main className="diversity-page">
      <nav className="deputy-page-nav">
        <Link href="/#explorar">← Voltar ao explorador</Link>
        <span>Raio-X Patrimonial</span>
      </nav>

      <div className="section-heading diversity-page-heading">
        <div>
          <p className="eyebrow">Busque um deputado</p>
          <h1>O que ele fez na Câmara?</h1>
        </div>
        <p>
          Busque pelo nome para ver os projetos de lei que apresentou, quantos
          por ano, e quantos foram aprovados, arquivados ou seguem em
          tramitação.
        </p>
      </div>

      <BuscaProjetosDeLei deputies={deputies} />

      <ResumoLeis resumo={resumo} />

      <p className="deputy-page-note">
        Dados públicos da API de Dados Abertos da Câmara dos Deputados,
        cruzados com o TSE pelo CPF (nunca exposto).{" "}
        <Link href="/#metodologia">Ver metodologia</Link>.
      </p>

      <footer className="deputy-page-footer">
        Dados e desenvolvimento por Vitor Barbosa.
      </footer>
    </main>
  );
}
