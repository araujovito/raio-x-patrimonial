"use client";

import { useMemo, useState } from "react";
// @svg-maps/brazil traz o contorno real de cada estado (CC-BY-4.0), sem
// depender de um serviço externo de mapas. O pacote de tipos que ele
// referencia (svg-maps__common) não é publicado, então tipamos aqui mesmo.
import brazilMap from "@svg-maps/brazil";

import { share, shareValue, type DiversityData } from "./lib/diversidade";

type MapLocation = { id: string; name: string; path: string };
const { viewBox, locations } = brazilMap as unknown as {
  viewBox: string;
  locations: MapLocation[];
};

type Metric = "women" | "negro";

function metricValue(
  summary: { elected: number; womenElected: number; negroElected: number },
  metric: Metric,
) {
  return metric === "women"
    ? shareValue(summary.womenElected, summary.elected)
    : shareValue(summary.negroElected, summary.elected);
}

export default function MapaEstados({ data }: { data: DiversityData }) {
  const [metric, setMetric] = useState<Metric>("women");
  const [activeUf, setActiveUf] = useState<string | null>(null);

  const maxValue = useMemo(
    () =>
      Math.max(
        ...locations.map((loc) =>
          metricValue(data.byState[loc.id.toUpperCase()], metric),
        ),
        1,
      ),
    [metric],
  );

  const shown = activeUf ? data.byState[activeUf] : data.national;
  const shownLabel = activeUf ?? "Brasil";

  return (
    <div className="mapa-estados">
      <div className="mapa-controls">
        <button
          type="button"
          className={metric === "women" ? "is-active" : ""}
          onClick={() => setMetric("women")}
        >
          Mulheres
        </button>
        <button
          type="button"
          className={metric === "negro" ? "is-active" : ""}
          onClick={() => setMetric("negro")}
        >
          Negros
        </button>
      </div>

      <div className="mapa-body">
        <svg
          className="mapa-svg"
          viewBox={viewBox}
          role="img"
          aria-label="Mapa do Brasil por estado"
          onMouseLeave={() => setActiveUf(null)}
        >
          {locations.map((loc) => {
            const uf = loc.id.toUpperCase();
            const summary = data.byState[uf];
            const value = metricValue(summary, metric);
            const intensity = maxValue === 0 ? 0 : value / maxValue;
            return (
              <path
                key={loc.id}
                d={loc.path}
                className={`mapa-state ${activeUf === uf ? "is-active" : ""}`}
                style={{
                  fill: `color-mix(in srgb, var(--green) ${Math.round(
                    12 + intensity * 78,
                  )}%, var(--paper-bright))`,
                }}
                onMouseEnter={() => setActiveUf(uf)}
                onFocus={() => setActiveUf(uf)}
                onClick={() =>
                  setActiveUf((current) => (current === uf ? null : uf))
                }
                tabIndex={0}
                role="button"
                aria-label={`${loc.name}: ${share(summary.womenElected, summary.elected)} mulheres, ${share(summary.negroElected, summary.elected)} negros entre os eleitos`}
              >
                <title>{`${loc.name} · ${summary.elected} eleitos`}</title>
              </path>
            );
          })}
        </svg>

        <div className="mapa-detail">
          <p className="eyebrow">{shownLabel}</p>
          <div className="mapa-detail-figure">
            <strong>{shown.elected}</strong>
            <span>eleitos</span>
          </div>
          <div className="comparison-label">
            <span>Mulheres</span>
            <strong>{share(shown.womenElected, shown.elected)}</strong>
          </div>
          <div className="bar-track">
            <span
              className="bar bar-2022"
              style={{ width: `${shareValue(shown.womenElected, shown.elected)}%` }}
            />
          </div>
          <div className="comparison-label">
            <span>Negros</span>
            <strong>{share(shown.negroElected, shown.elected)}</strong>
          </div>
          <div className="bar-track">
            <span
              className="bar bar-2018"
              style={{ width: `${shareValue(shown.negroElected, shown.elected)}%` }}
            />
          </div>
        </div>
      </div>

      <p className="mapa-note">
        Passe o mouse ou toque em um estado para ver o recorte dele. Mapa:{" "}
        <a
          href="https://github.com/VictorCazanave/svg-maps"
          target="_blank"
          rel="noreferrer"
        >
          @svg-maps/brazil
        </a>
        .
      </p>
    </div>
  );
}
