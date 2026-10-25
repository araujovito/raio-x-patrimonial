import {
  share,
  shareValue,
  type DiversityData,
} from "./lib/diversidade";

export default function Diversidade({
  data,
  year,
}: {
  data: DiversityData;
  year: number;
}) {
  const { national } = data;

  return (
    <section className="diversidade" id="diversidade">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Quem chega, quem concorre</p>
          <h2>Representatividade na Câmara</h2>
        </div>
        <p>
          Recorte de gênero e raça entre quem concorreu e quem se elegeu para
          Deputado Federal em {year}, com dados autodeclarados ao TSE.
        </p>
      </div>

      <div className="diversity-summary">
        <div className="diversity-card">
          <h3>Mulheres</h3>
          <div className="diversity-figure">
            <strong>{national.womenElected}</strong>
            <span>de {national.elected} eleitas ({share(national.womenElected, national.elected)})</span>
          </div>
          <div className="comparison-label">
            <span>Entre as candidaturas</span>
            <strong>
              {national.womenCandidates} de {national.candidates} (
              {share(national.womenCandidates, national.candidates)})
            </strong>
          </div>
          <div className="bar-track" aria-hidden="true">
            <span
              className="bar bar-2018"
              style={{
                width: `${shareValue(national.womenCandidates, national.candidates)}%`,
              }}
            />
          </div>
          <div className="comparison-label">
            <span>Entre as eleitas</span>
            <strong>{share(national.womenElected, national.elected)}</strong>
          </div>
          <div className="bar-track" aria-hidden="true">
            <span
              className="bar bar-2022"
              style={{
                width: `${shareValue(national.womenElected, national.elected)}%`,
              }}
            />
          </div>
        </div>

        <div className="diversity-card">
          <h3>Pessoas negras</h3>
          <p className="diversity-note">
            Soma de candidatos autodeclarados pretos e pardos, categoria usada
            pelo IBGE em análises de representatividade racial.
          </p>
          <div className="diversity-figure">
            <strong>{national.negroElected}</strong>
            <span>de {national.elected} eleitos ({share(national.negroElected, national.elected)})</span>
          </div>
          <div className="comparison-label">
            <span>Entre as candidaturas</span>
            <strong>
              {national.negroCandidates} de {national.candidates} (
              {share(national.negroCandidates, national.candidates)})
            </strong>
          </div>
          <div className="bar-track" aria-hidden="true">
            <span
              className="bar bar-2018"
              style={{
                width: `${shareValue(national.negroCandidates, national.candidates)}%`,
              }}
            />
          </div>
          <div className="comparison-label">
            <span>Entre os eleitos</span>
            <strong>{share(national.negroElected, national.elected)}</strong>
          </div>
          <div className="bar-track" aria-hidden="true">
            <span
              className="bar bar-2022"
              style={{
                width: `${shareValue(national.negroElected, national.elected)}%`,
              }}
            />
          </div>
        </div>
      </div>

      <p className="diversity-source">
        Gênero e raça são autodeclarados no ato da candidatura ao TSE. A
        ausência de uma categoria em algum estado significa que nenhum
        candidato daquele estado se autodeclarou nela — não que o dado esteja
        faltando.
      </p>
    </section>
  );
}
