import Link from "next/link";

import Diversidade from "./Diversidade";
import DiversidadeDashboard from "./DiversidadeDashboard";
import { LEGISLATURE_YEARS } from "./lib/deputados";
import type { Legislature } from "./lib/legislaturas";

export default function DiversidadePagina({
  legislature,
}: {
  legislature: Legislature;
}) {
  const { deputies, diversity, year } = legislature;

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

      <nav className="legislature-switch" aria-label="Eleição exibida">
        {LEGISLATURE_YEARS.map((option) => (
          <Link
            key={option}
            href={option === LEGISLATURE_YEARS[0] ? "/diversidade" : `/diversidade/${option}`}
            aria-current={option === year ? "page" : undefined}
          >
            Eleitos em {option}
          </Link>
        ))}
      </nav>

      <DiversidadeDashboard deputies={deputies} diversity={diversity} />

      <Diversidade data={diversity} year={year} />

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
