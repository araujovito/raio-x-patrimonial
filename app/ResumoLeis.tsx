import Link from "next/link";

import { STATUS_LABEL, type LeisResumo, type StatusProposicao } from "./lib/leis";

export default function ResumoLeis({ resumo }: { resumo: LeisResumo }) {
  const maxYearCount = Math.max(...resumo.porAno.map(([, count]) => count), 1);
  const maxAutorCount = Math.max(
    ...resumo.topAutores.map((autor) => autor.total),
    1,
  );

  return (
    <section className="diversidade" id="leis-resumo">
      <div className="section-heading">
        <div>
          <p className="eyebrow">O que a Câmara produz</p>
          <h2>Projetos de lei</h2>
        </div>
        <p>
          {resumo.totalProjetos.toLocaleString("pt-BR")} projetos de lei,
          complementares e propostas de emenda à Constituição de autoria dos{" "}
          {resumo.deputadosComDados} deputados com dados disponíveis, desde
          1995.
        </p>
      </div>

      <div className="leis-stats leis-resumo-stats">
        {(["aprovada", "tramitando", "arquivada"] as StatusProposicao[]).map(
          (status) => (
            <div key={status} className={`leis-stat leis-stat-${status}`}>
              <strong>{resumo.porStatus[status].toLocaleString("pt-BR")}</strong>
              <span>{STATUS_LABEL[status]}</span>
            </div>
          ),
        )}
      </div>

      <div className="leis-resumo-grid">
        <div className="leis-resumo-block">
          <h3>Por ano</h3>
          <div className="leis-years leis-resumo-years">
            {resumo.porAno.map(([year, count]) => (
              <div className="leis-year-row" key={year}>
                <span className="leis-year-label">{year}</span>
                <span className="bar-track leis-year-track">
                  <span
                    className="bar bar-2022"
                    style={{ width: `${(count / maxYearCount) * 100}%` }}
                  />
                </span>
                <span className="leis-year-count">{count}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="leis-resumo-block">
          <h3>Quem mais apresenta projetos</h3>
          <div className="leis-years">
            {resumo.topAutores.map((autor) => (
              <Link
                className="leis-autor-row"
                key={autor.id}
                href={`/deputado/${autor.id}`}
              >
                <span className="leis-year-label leis-autor-label">
                  {autor.name}
                  <small>
                    {autor.party} · {autor.uf}
                  </small>
                </span>
                <span className="bar-track leis-year-track">
                  <span
                    className="bar bar-2018"
                    style={{ width: `${(autor.total / maxAutorCount) * 100}%` }}
                  />
                </span>
                <span className="leis-year-count">{autor.total}</span>
              </Link>
            ))}
          </div>
        </div>
      </div>

      <p className="diversity-source">
        A situação de cada projeto (aprovado, em tramitação ou arquivado) é
        simplificada a partir de ~100 códigos oficiais da Câmara — ver
        metodologia. Coautoria conta como autoria para este recorte: um
        projeto com vários signatários aparece para cada um deles.
      </p>
    </section>
  );
}
