"use client";

import Link from "next/link";
import { useState } from "react";

import {
  assetEvents,
  candidatePhotoUrl,
  candidateSourceUrl,
  compactMoney,
  dedupeHistory,
  money,
  percent,
  resultLabel,
  variation,
  type Deputy,
  type ElectionEvent,
} from "./lib/deputados";

function AssetHistoryChart({
  history,
  name,
  selectedYear,
  onSelectYear,
}: {
  history: ElectionEvent[];
  name: string;
  selectedYear: number;
  onSelectYear: (year: number) => void;
}) {
  const [hoveredYear, setHoveredYear] = useState<number | null>(null);
  const valuesByYear = new Map<number, number>();

  history.forEach((event) => {
    if (event.assetsTotal === null) return;
    const current = valuesByYear.get(event.year);
    if (current === undefined || event.assetsTotal > current) {
      valuesByYear.set(event.year, event.assetsTotal);
    }
  });

  const points = [...valuesByYear.entries()]
    .map(([year, value]) => ({ year, value }))
    .sort((a, b) => a.year - b.year);

  if (points.length < 2) {
    return (
      <div className="chart-empty">
        Ainda não há declarações suficientes para desenhar a evolução.
      </div>
    );
  }

  const width = 440;
  const height = 190;
  const padding = { top: 28, right: 14, bottom: 34, left: 72 };
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;
  const minYear = points[0].year;
  const maxYear = points[points.length - 1].year;
  const maxValue = Math.max(...points.map((point) => point.value), 1);
  const x = (year: number) =>
    padding.left +
    ((year - minYear) / Math.max(maxYear - minYear, 1)) * plotWidth;
  const y = (value: number) =>
    padding.top + plotHeight - (value / maxValue) * plotHeight;
  const line = points
    .map((point) => `${x(point.year)},${y(point.value)}`)
    .join(" ");
  const hoveredPoint = points.find((point) => point.year === hoveredYear);
  const tooltipWidth = 148;
  const tooltipX = hoveredPoint
    ? Math.min(
        Math.max(x(hoveredPoint.year) - tooltipWidth / 2, padding.left),
        width - padding.right - tooltipWidth,
      )
    : 0;
  const tooltipY = hoveredPoint
    ? Math.max(y(hoveredPoint.value) - 50, 5)
    : 0;

  return (
    <div className="asset-chart">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={`Evolução patrimonial declarada de ${name}. Valores nominais entre ${minYear} e ${maxYear}.`}
      >
        {[0, 0.5, 1].map((ratio) => {
          const gridY = padding.top + plotHeight * ratio;
          const gridValue = maxValue * (1 - ratio);
          return (
            <g key={ratio}>
              <line
                className="chart-grid-line"
                x1={padding.left}
                x2={width - padding.right}
                y1={gridY}
                y2={gridY}
              />
              <text
                className="chart-axis-value"
                x={padding.left - 9}
                y={gridY + 3}
                textAnchor="end"
              >
                {compactMoney.format(gridValue)}
              </text>
            </g>
          );
        })}
        <polyline className="chart-line" points={line} />
        {points.map((point, index) => (
          <g
            className={`chart-point-group ${
              point.year === selectedYear ? "is-selected" : ""
            }`}
            key={point.year}
            onPointerEnter={() => setHoveredYear(point.year)}
            onPointerLeave={() => setHoveredYear(null)}
            onClick={() => {
              // Em telas de toque não existe "hover": o próprio toque precisa
              // revelar o valor e selecionar a eleição.
              setHoveredYear(point.year);
              onSelectYear(point.year);
            }}
          >
            <line
              className="chart-guide"
              x1={x(point.year)}
              x2={x(point.year)}
              y1={y(point.value)}
              y2={padding.top + plotHeight}
            />
            {/* Área de toque generosa: o ponto visível tem 5px de raio, pequeno
                demais para o dedo. Este círculo transparente amplia o alvo para
                ~24px na tela do celular (mínimo recomendado pela WCAG 2.5.8),
                sem chegar a encostar no ponto vizinho. */}
            <circle
              className="chart-hit-area"
              cx={x(point.year)}
              cy={y(point.value)}
              r="20"
            />
            <circle
              className="chart-point"
              cx={x(point.year)}
              cy={y(point.value)}
              r="5"
              aria-label={`${point.year}: ${money.format(point.value)}`}
            />
            <text
              className="chart-year"
              x={x(point.year)}
              y={height - 10}
              textAnchor="middle"
            >
              {point.year}
            </text>
            {index === points.length - 1 && (
              <text
                className="chart-latest-value"
                x={x(point.year)}
                y={Math.max(y(point.value) - 12, 13)}
                textAnchor="end"
              >
                {compactMoney.format(point.value)}
              </text>
            )}
          </g>
        ))}
        {hoveredPoint && (
          <g className="chart-tooltip" pointerEvents="none">
            <rect x={tooltipX} y={tooltipY} width={tooltipWidth} height="38" rx="3" />
            <text x={tooltipX + 10} y={tooltipY + 15}>
              {hoveredPoint.year}
            </text>
            <text x={tooltipX + 10} y={tooltipY + 29}>
              {money.format(hoveredPoint.value)}
            </text>
          </g>
        )}
      </svg>
    </div>
  );
}

/**
 * Perfil completo de um deputado. É usado tanto no painel do explorador quanto
 * na página dedicada (`/deputado/[id]`).
 *
 * O estado interno (eleição escolhida na composição, falha ao carregar a foto)
 * é reiniciado automaticamente quando o componente recebe `key={deputy.id}`.
 */
export default function DeputyProfile({
  deputy,
  eyebrow = "Perfil selecionado",
  live = false,
  permalink = false,
}: {
  deputy: Deputy;
  eyebrow?: string;
  live?: boolean;
  permalink?: boolean;
}) {
  const [photoFailed, setPhotoFailed] = useState(false);
  const [compositionYear, setCompositionYear] = useState<number | null>(null);

  const deputyVariation = variation(deputy);
  const maxComparison = Math.max(
    deputy.value2022,
    deputy.previousValue ?? 0,
    1,
  );
  const events = assetEvents(deputy.history);
  const composition =
    events.find((event) => event.year === compositionYear) ?? events[0];
  // Da maior para a menor categoria, como no explorador.
  const categoryEntries = Object.entries(composition?.assetCategories ?? {}).sort(
    ([, a], [, b]) => b - a,
  );

  return (
    <article
      className="profile-card"
      id="perfil"
      aria-live={live ? "polite" : undefined}
    >
      <div className="profile-header">
        <div className="profile-avatar">
          <span
            aria-hidden={!photoFailed}
            aria-label={
              photoFailed ? `Foto indisponível para ${deputy.name}` : undefined
            }
          >
            {deputy.name.charAt(0)}
          </span>
          {!photoFailed && (
            <img
              src={candidatePhotoUrl(deputy)}
              alt={`Foto de ${deputy.name}`}
              onError={() => setPhotoFailed(true)}
            />
          )}
        </div>
        <div>
          <p>{eyebrow}</p>
          <h3>{deputy.name}</h3>
          <span>
            {deputy.party} · {deputy.uf} · {deputy.priorCandidacies} candidaturas
            anteriores
          </span>
          <small>Foto oficial da candidatura em 2022.</small>
          <div className="profile-source-links">
            {permalink && (
              <Link
                className="profile-permalink"
                href={`/deputado/${deputy.id}`}
              >
                Página deste deputado →
              </Link>
            )}
            <a
              href={candidateSourceUrl(deputy)}
              target="_blank"
              rel="noreferrer"
            >
              Ficha no TSE ↗
            </a>
            <small className="source-hint">
              Inclui bens declarados, eleições e prestação de contas.
            </small>
          </div>
        </div>
      </div>

      <div className="comparison">
        <div className="comparison-label">
          <span>
            {deputy.previousYear ?? "Anterior"}
            {deputy.previousOffice ? ` · ${deputy.previousOffice}` : ""}
          </span>
          <strong>
            {deputy.previousValue === null
              ? "não comparável"
              : money.format(deputy.previousValue)}
          </strong>
        </div>
        <div className="bar-track">
          <span
            className="bar bar-2018"
            style={{
              width: `${((deputy.previousValue ?? 0) / maxComparison) * 100}%`,
            }}
          />
        </div>
        <div className="comparison-label">
          <span>2022</span>
          <strong>{money.format(deputy.value2022)}</strong>
        </div>
        <div className="bar-track">
          <span
            className="bar bar-2022"
            style={{ width: `${(deputy.value2022 / maxComparison) * 100}%` }}
          />
        </div>
      </div>

      <div className="variation-summary">
        <span>Variação nominal</span>
        <strong>{percent(deputyVariation)}</strong>
        <small>
          {deputy.previousValue === null
            ? "Não foi localizada candidatura anterior desde 2000."
            : `${deputy.previousItems} itens em ${deputy.previousYear} → ${deputy.items2022} em 2022`}
        </small>
      </div>

      <div className="chart-block">
        <div className="chart-heading">
          <h4>Evolução patrimonial declarada</h4>
          <span>valores nominais</span>
        </div>
        <AssetHistoryChart
          history={deputy.history}
          name={deputy.name}
          selectedYear={composition?.year ?? 2022}
          onSelectYear={setCompositionYear}
        />
        <p className="chart-note">
          A escala vertical é individual: usa a maior declaração deste deputado
          como referência. Por isso a inclinação da linha não deve ser comparada
          entre perfis diferentes.
        </p>
      </div>

      <div className="category-block">
        <div className="composition-heading">
          <div>
            <h4>Composição patrimonial</h4>
            <span>
              {composition
                ? `${composition.office} · ${composition.party}`
                : "dados indisponíveis"}
            </span>
          </div>
          <label>
            <span>Eleição</span>
            <select
              className="composition-select"
              value={composition?.year ?? ""}
              onChange={(event) => setCompositionYear(Number(event.target.value))}
            >
              {events.map((event) => (
                <option key={event.year} value={event.year}>
                  {event.year}
                </option>
              ))}
            </select>
          </label>
        </div>
        {composition && (
          <p className="composition-total">
            Total declarado:{" "}
            <strong>{money.format(composition.assetsTotal ?? 0)}</strong>
          </p>
        )}
        {categoryEntries.map(([label, value]) => (
          <div className="category-row" key={label}>
            <div>
              <span>{label}</span>
              <strong>{compactMoney.format(value)}</strong>
            </div>
            <div className="category-track">
              <span
                style={{
                  width: `${composition?.assetsTotal ? (value / composition.assetsTotal) * 100 : 0}%`,
                }}
              />
            </div>
          </div>
        ))}
      </div>

      <div className="timeline-block">
        <div className="timeline-heading">
          <h4>Trajetória eleitoral</h4>
          <span>
            {deputy.priorVictories}{" "}
            {deputy.priorVictories === 1
              ? "eleição anterior"
              : "eleições anteriores"}
          </span>
        </div>
        <div className="timeline">
          {dedupeHistory(deputy.history).map((event, index) => (
            <div
              className={`timeline-event ${
                event.elected ? "timeline-elected" : ""
              }`}
              key={`${event.year}-${event.office}-${event.party}-${index}`}
            >
              <span className="timeline-year">{event.year}</span>
              <div>
                <strong>{event.office}</strong>
                <small>
                  {event.party} · {event.uf}
                </small>
                <span>{resultLabel(event.result)}</span>
              </div>
              <div className="timeline-assets">
                {event.assetsTotal === null
                  ? "bens indisponíveis"
                  : compactMoney.format(event.assetsTotal)}
              </div>
            </div>
          ))}
        </div>
      </div>
    </article>
  );
}
