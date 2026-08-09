import type { Metadata } from "next";
import Link from "next/link";

import Diversidade from "../Diversidade";
import DiversidadeDashboard from "../DiversidadeDashboard";
import deputiesData from "../data/deputados.json";
import diversity from "../data/diversidade.json";
import type { Deputy } from "../lib/deputados";
import type { DiversityData } from "../lib/diversidade";

const deputies = deputiesData as unknown as Deputy[];

export const metadata: Metadata = {
  title: "Diversidade",
  description:
    "Busque um deputado federal eleito em 2022 e veja gênero, raça e como o estado dele se compara na representatividade da Câmara.",
};

export default function DiversidadePage() {
  return (
    <main className="diversity-page">
      <nav className="deputy-page-nav">
        <Link href="/#explorar">← Voltar ao explorador</Link>
        <span>Raio-X Patrimonial</span>
      </nav>

      <div className="section-heading diversity-page-heading">
        <div>
          <p className="eyebrow">Busque um deputado</p>
          <h1>Quem representa o seu estado?</h1>
        </div>
        <p>
          Busque pelo nome para ver gênero e raça autodeclarados ao TSE, e
          como isso se compara ao restante do estado.
        </p>
      </div>

      <DiversidadeDashboard deputies={deputies} diversity={diversity as DiversityData} />

      <Diversidade data={diversity as DiversityData} />

      <p className="deputy-page-note">
        Dados públicos declarados ao Tribunal Superior Eleitoral. Gênero e
        raça são autodeclarados pelo candidato no ato da candidatura.{" "}
        <Link href="/#metodologia">Ver metodologia</Link>.
      </p>

      <footer className="deputy-page-footer">
        Dados e desenvolvimento por Vitor Barbosa.
      </footer>
    </main>
  );
}
