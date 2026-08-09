"use client";

import { useMemo, useState } from "react";

import {
  PARTY_COLOR_OVERRIDES,
  PARTY_SPECTRUM_SIZE,
  layoutHemicycle,
  partyLeftRightRank,
  politicalColor,
} from "./lib/hemiciclo";
import { candidatePhotoUrl, type Deputy } from "./lib/deputados";
import { share, type DiversityData } from "./lib/diversidade";

const WIDTH = 640;
const HEIGHT = 340;

export default function HemicicloPartidos({
  deputies,
  diversity,
}: {
  deputies: Deputy[];
  diversity: DiversityData;
}) {
  const [selectedParty, setSelectedParty] = useState<string | null>(null);
  const [selectedDeputyId, setSelectedDeputyId] = useState<string | null>(null);

  const parties = useMemo(() => {
    const counts = new Map<string, number>();
    deputies.forEach((deputy) => {
      counts.set(deputy.party, (counts.get(deputy.party) ?? 0) + 1);
    });
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [deputies]);

  const partyColor = useMemo(() => {
    const colors = new Map<string, string>();
    parties.forEach(([party]) => {
      colors.set(
        party,
        politicalColor(partyLeftRightRank(party), PARTY_SPECTRUM_SIZE),
      );
    });
    Object.entries(PARTY_COLOR_OVERRIDES).forEach(([party, color]) => {
      if (colors.has(party)) colors.set(party, color);
    });
    return colors;
  }, [parties]);

  // Da esquerda para a direita no desenho (posição aproximada, ver
  // lib/hemiciclo.ts), não pelo tamanho da bancada.
  const partiesByIdeology = useMemo(
    () =>
      [...parties].sort(
        (a, b) => partyLeftRightRank(a[0]) - partyLeftRightRank(b[0]),
      ),
    [parties],
  );

  const ordered = useMemo(() => {
    // Evita localeCompare: a ordenação por locale pode variar entre o ICU
    // do Node (servidor) e o do navegador, fazendo o SSR e o cliente
    // desenharem os assentos em ordens diferentes (erro de hidratação).
    const byParty = new Map<string, Deputy[]>();
    partiesByIdeology.forEach(([party]) => byParty.set(party, []));
    [...deputies]
      .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))
      .forEach((deputy) => byParty.get(deputy.party)?.push(deputy));
    return partiesByIdeology.flatMap(([party]) => byParty.get(party) ?? []);
  }, [deputies, partiesByIdeology]);

  const seats = useMemo(
    () => layoutHemicycle(ordered.length, { width: WIDTH, height: HEIGHT }),
    [ordered.length],
  );

  const selectedDeputy = selectedDeputyId
    ? deputies.find((deputy) => deputy.id === selectedDeputyId)
    : undefined;
  const partyStats = selectedParty ? diversity.byParty[selectedParty] : undefined;

  return (
    <div className="hemiciclo">
      <div className="hemiciclo-chart">
        <svg
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          role="img"
          aria-label={`Composição da Câmara por partido, ${ordered.length} cadeiras`}
        >
          {seats.map((seat, index) => {
            const deputy = ordered[index];
            if (!deputy) return null;
            const isDimmed =
              selectedParty !== null && deputy.party !== selectedParty;
            const isSelected = deputy.id === selectedDeputyId;
            return (
              <circle
                key={deputy.id}
                cx={seat.x}
                cy={seat.y}
                r={isSelected ? 6.4 : 5}
                fill={partyColor.get(deputy.party)}
                opacity={isDimmed ? 0.15 : 1}
                stroke={isSelected ? "var(--ink)" : "none"}
                strokeWidth={isSelected ? 1.6 : 0}
                className="hemiciclo-seat"
                tabIndex={0}
                role="button"
                aria-label={`${deputy.name}, ${deputy.party}, ${deputy.uf}`}
                onClick={() => {
                  setSelectedDeputyId(deputy.id);
                  setSelectedParty(deputy.party);
                }}
                onKeyDown={(event) => {
                  if (event.key !== "Enter" && event.key !== " ") return;
                  event.preventDefault();
                  setSelectedDeputyId(deputy.id);
                  setSelectedParty(deputy.party);
                }}
              >
                <title>{`${deputy.name} · ${deputy.party} · ${deputy.uf} · ${deputy.gender} · ${deputy.race}`}</title>
              </circle>
            );
          })}
        </svg>
        <p className="hemiciclo-note">
          Cada ponto é um deputado, com os partidos dispostos aproximadamente
          da esquerda para a direita do espectro político — uma simplificação
          usual da imprensa, não uma medição exata (bancadas têm alas
          internas). Passe o mouse para ver quem é; clique para fixar o
          partido.
        </p>
      </div>

      <div className="hemiciclo-side">
        <div className="hemiciclo-legend">
          {parties.map(([party, count]) => (
            <button
              key={party}
              type="button"
              className={`hemiciclo-legend-item ${
                selectedParty === party ? "is-active" : ""
              }`}
              onClick={() => {
                setSelectedParty((current) =>
                  current === party ? null : party,
                );
                setSelectedDeputyId(null);
              }}
            >
              <span
                className="hemiciclo-swatch"
                style={{ background: partyColor.get(party) }}
                aria-hidden="true"
              />
              <span className="hemiciclo-legend-name">{party}</span>
              <span className="hemiciclo-legend-count">{count}</span>
            </button>
          ))}
        </div>

        {selectedDeputy ? (
          <div className="hemiciclo-detail">
            <div className="hemiciclo-detail-photo">
              <img
                src={candidatePhotoUrl(selectedDeputy)}
                alt={`Foto de ${selectedDeputy.name}`}
                onError={(event) => {
                  event.currentTarget.style.display = "none";
                }}
              />
            </div>
            <div>
              <strong>{selectedDeputy.name}</strong>
              <span>
                {selectedDeputy.party} · {selectedDeputy.uf}
              </span>
              <span>
                {selectedDeputy.gender} · {selectedDeputy.race}
              </span>
            </div>
          </div>
        ) : partyStats ? (
          <div className="hemiciclo-detail hemiciclo-detail-party">
            <strong>{selectedParty}</strong>
            <span>{partyStats.elected} cadeiras</span>
            <span>
              {share(partyStats.womenElected, partyStats.elected)} mulheres ·{" "}
              {share(partyStats.negroElected, partyStats.elected)} negros
            </span>
          </div>
        ) : (
          <p className="hemiciclo-hint">
            Clique em um partido na legenda ou em um ponto do gráfico.
          </p>
        )}
      </div>
    </div>
  );
}
