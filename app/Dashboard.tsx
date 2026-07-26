"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import {
  ALL_PARTIES,
  ALL_STATES,
  assetEvents,
  candidatePhotoUrl,
  candidateSourceUrl,
  dedupeHistory,
  filterDeputies,
  median,
  percent,
  resultLabel,
  sortDeputies,
  variation,
  type Deputy,
  type ElectionEvent,
  type SortMode,
} from "./lib/deputados";

const money = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  maximumFractionDigits: 0,
});

const compactMoney = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  notation: "compact",
  maximumFractionDigits: 1,
});

const number = new Intl.NumberFormat("pt-BR");

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
            onClick={() => onSelectYear(point.year)}
          >
            <line
              className="chart-guide"
              x1={x(point.year)}
              x2={x(point.year)}
              y1={y(point.value)}
              y2={padding.top + plotHeight}
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

export default function Dashboard({ deputies }: { deputies: Deputy[] }) {
  const [query, setQuery] = useState("");
  const [uf, setUf] = useState(ALL_STATES);
  const [party, setParty] = useState(ALL_PARTIES);
  const [sortMode, setSortMode] = useState<SortMode>("value");
  const [onlyComparable, setOnlyComparable] = useState(false);
  const [visible, setVisible] = useState(12);
  const [photoFailed, setPhotoFailed] = useState(false);
  const [compositionYear, setCompositionYear] = useState(2022);
  const profileRef = useRef<HTMLElement>(null);

  const ranked = useMemo(
    () => [...deputies].sort((a, b) => b.value2022 - a.value2022),
    [deputies],
  );
  const [selectedId, setSelectedId] = useState(ranked[0].id);
  const selected =
    deputies.find((deputy) => deputy.id === selectedId) ?? ranked[0];

  // Ao trocar de deputado, reinicia o estado específico do perfil durante a
  // renderização (padrão recomendado pelo React) em vez de dentro de um efeito,
  // evitando um passo de renderização extra.
  const [prevSelectedId, setPrevSelectedId] = useState(selectedId);
  if (selectedId !== prevSelectedId) {
    setPrevSelectedId(selectedId);
    setPhotoFailed(false);
    setCompositionYear(assetEvents(selected.history)[0]?.year ?? 2022);
  }

  // A rolagem para o topo do perfil é um efeito de DOM real e permanece aqui.
  useEffect(() => {
    profileRef.current?.scrollTo({ top: 0 });
  }, [selectedId]);

  const states = useMemo(
    () => [...new Set(deputies.map((deputy) => deputy.uf))].sort(),
    [deputies],
  );
  const parties = useMemo(
    () => [...new Set(deputies.map((deputy) => deputy.party))].sort(),
    [deputies],
  );

  const comparable = deputies.filter((deputy) => deputy.previousValue !== null);
  const comparableVariations = comparable
    .map(variation)
    .filter((value): value is number => value !== null);

  const filtered = useMemo(
    () =>
      sortDeputies(
        filterDeputies(deputies, { query, uf, party, onlyComparable }),
        sortMode,
      ),
    [deputies, onlyComparable, party, query, sortMode, uf],
  );

  const selectedVariation = variation(selected);
  const maxComparison = Math.max(
    selected.value2022,
    selected.previousValue ?? 0,
    1,
  );
  const selectedAssetEvents = assetEvents(selected.history);
  const selectedComposition =
    selectedAssetEvents.find((event) => event.year === compositionYear) ??
    selectedAssetEvents[0];
  const categoryEntries = Object.entries(
    selectedComposition?.assetCategories ?? {},
  ).sort(
    ([, a], [, b]) => b - a,
  );
  const hasActiveFilters = Boolean(
    query || uf !== ALL_STATES || party !== ALL_PARTIES || onlyComparable || sortMode !== "value",
  );

  function resetFilters() {
    setQuery("");
    setUf(ALL_STATES);
    setParty(ALL_PARTIES);
    setOnlyComparable(false);
    setSortMode("value");
    setVisible(12);
  }

  return (
    <main>
      <header className="topbar">
        <a className="brand" href="#inicio" aria-label="Ir para o início">
          <span className="brand-mark">RX</span>
          <span>Raio-X Patrimonial</span>
        </a>
        <nav aria-label="Navegação principal">
          <a href="#explorar">Explorar</a>
          <a href="#metodologia">Metodologia</a>
          <a
            className="source-link"
            href="https://dadosabertos.tse.jus.br/dataset/candidatos-2022"
            target="_blank"
            rel="noreferrer"
          >
            Fonte TSE ↗
          </a>
        </nav>
      </header>

      <section className="hero" id="inicio">
        <div className="hero-copy">
          <p className="eyebrow">Trajetórias de 2000 → 2022</p>
          <h1>
            O patrimônio
            <br />
            <em>declarado</em> em dados.
          </h1>
          <p className="hero-description">
            Explore a trajetória eleitoral e compare as declarações de bens dos
            513 deputados federais eleitos em 2022, com dados públicos do
            Tribunal Superior Eleitoral.
          </p>
          <a className="primary-action" href="#explorar">
            Começar a explorar <span aria-hidden="true">↓</span>
          </a>
        </div>
        <div className="hero-stats" aria-label="Resumo da base">
          <div className="stat stat-featured">
            <span className="stat-number">513</span>
            <span className="stat-label">eleitos analisados</span>
          </div>
          <div className="stat">
            <span className="stat-number">{comparable.length}</span>
            <span className="stat-label">com histórico anterior</span>
          </div>
          <div className="stat">
            <span className="stat-number">
              {compactMoney.format(median(deputies.map((d) => d.value2022)))}
            </span>
            <span className="stat-label">mediana declarada em 2022</span>
          </div>
          <div className="stat">
            <span className="stat-number">
              {percent(median(comparableVariations))}
            </span>
            <span className="stat-label">variação mediana nominal</span>
          </div>
        </div>
      </section>

      <aside className="context-note">
        <span className="note-icon" aria-hidden="true">
          i
        </span>
        <p>
          <strong>Leia os números com contexto.</strong> Comparamos 2022 com a
          declaração anterior mais recente de cada candidato. Os valores não são
          uma auditoria, e a variação nominal não desconta a inflação.
        </p>
      </aside>

      <section className="explorer" id="explorar">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Base completa</p>
            <h2>Explore os deputados</h2>
          </div>
          <p>
            Busque por nome, filtre por estado ou partido e abra um perfil para
            ver a trajetória política e as declarações disponíveis.
          </p>
        </div>

        <div className="filter-grid">
          <label className="search-field">
            <span>Buscar deputado</span>
            <div className="search-input-wrap">
              <input
                type="search"
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setVisible(12);
                }}
                placeholder="Ex.: Eunício ou Atila Lins"
                aria-describedby="search-help"
              />
              {query && (
                <button
                  className="clear-search"
                  type="button"
                  onClick={() => setQuery("")}
                  aria-label="Limpar busca"
                >
                  ×
                </button>
              )}
            </div>
            <small id="search-help">
              Pesquise pelo nome de urna ou nome completo.
            </small>
          </label>
          <label>
            <span>Estado</span>
            <select value={uf} onChange={(event) => setUf(event.target.value)}>
              <option>Todas</option>
              {states.map((state) => (
                <option key={state}>{state}</option>
              ))}
            </select>
          </label>
          <label>
            <span>Partido</span>
            <select
              value={party}
              onChange={(event) => setParty(event.target.value)}
            >
              <option>Todos</option>
              {parties.map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
          </label>
          <label>
            <span>Ordenar por</span>
            <select
              value={sortMode}
              onChange={(event) => setSortMode(event.target.value as SortMode)}
            >
              <option value="value">Maior valor em 2022</option>
              <option value="growth">Maior variação</option>
              <option value="name">Nome A–Z</option>
            </select>
          </label>
        </div>

        <div className="results-toolbar">
          <div className="filter-actions">
            <button
              className={`comparison-toggle ${onlyComparable ? "active" : ""}`}
              type="button"
              aria-pressed={onlyComparable}
              onClick={() => setOnlyComparable((current) => !current)}
            >
              <span aria-hidden="true">{onlyComparable ? "✓" : ""}</span>
              Apenas com declaração anterior
            </button>
            {hasActiveFilters && (
              <button className="reset-filters" type="button" onClick={resetFilters}>
                Limpar filtros
              </button>
            )}
          </div>
          <p>
            <strong>{number.format(filtered.length)}</strong>{" "}
            {query ? `resultado${filtered.length === 1 ? "" : "s"} para “${query}”` : filtered.length === 1 ? "resultado" : "resultados"}
          </p>
        </div>

        <div className="dashboard-grid">
          <div className="results-card">
            <div className="table-head">
              <span>Deputado</span>
              <span>Declarado em 2022</span>
              <span>Variação anterior</span>
            </div>
            <div className="result-list">
              {filtered.slice(0, visible).map((deputy) => {
                const deputyVariation = variation(deputy);
                const isSelected = deputy.id === selected.id;
                return (
                  <button
                    className={`result-row ${isSelected ? "selected" : ""}`}
                    type="button"
                    key={deputy.id}
                    onClick={() => setSelectedId(deputy.id)}
                    aria-pressed={isSelected}
                  >
                    <span className="person">
                      <span className="avatar" aria-hidden="true">
                        {deputy.name.charAt(0)}
                      </span>
                      <span>
                        <strong>{deputy.name}</strong>
                        <small>
                          {deputy.party} · {deputy.uf}
                        </small>
                      </span>
                    </span>
                    <strong className="row-money">
                      {compactMoney.format(deputy.value2022)}
                    </strong>
                    <span
                      className={`change ${
                        deputyVariation !== null && deputyVariation < 0
                          ? "negative"
                          : ""
                      }`}
                    >
                      {percent(deputyVariation)}
                    </span>
                  </button>
                );
              })}
              {filtered.length === 0 && (
                <div className="empty-state">
                  <strong>Nenhum deputado encontrado.</strong>
                  <p>Tente remover algum filtro ou buscar por outro nome.</p>
                  <button type="button" onClick={resetFilters}>
                    Limpar filtros
                  </button>
                </div>
              )}
            </div>
            {visible < filtered.length && (
              <button
                className="load-more"
                type="button"
                onClick={() => setVisible((current) => current + 12)}
              >
                Mostrar mais resultados
              </button>
            )}
          </div>

          <aside
            className="profile-card"
            aria-live="polite"
            ref={profileRef}
          >
            <div className="profile-header">
              <div className="profile-avatar">
                <span
                  aria-hidden={!photoFailed}
                  aria-label={
                    photoFailed ? `Foto indisponível para ${selected.name}` : undefined
                  }
                >
                  {selected.name.charAt(0)}
                </span>
                {!photoFailed && (
                  <img
                    src={candidatePhotoUrl(selected)}
                    alt={`Foto de ${selected.name}`}
                    onError={() => setPhotoFailed(true)}
                  />
                )}
              </div>
              <div>
                <p>Perfil selecionado</p>
                <h3>{selected.name}</h3>
                <span>
                  {selected.party} · {selected.uf} ·{" "}
                  {selected.priorCandidacies} candidaturas anteriores
                </span>
                <small>Foto oficial da candidatura em 2022.</small>
                <div className="profile-source-links">
                  <a
                    href={candidateSourceUrl(selected)}
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
                  {selected.previousYear ?? "Anterior"}
                  {selected.previousOffice
                    ? ` · ${selected.previousOffice}`
                    : ""}
                </span>
                <strong>
                  {selected.previousValue === null
                    ? "não comparável"
                    : money.format(selected.previousValue)}
                </strong>
              </div>
              <div className="bar-track">
                <span
                  className="bar bar-2018"
                  style={{
                    width: `${((selected.previousValue ?? 0) / maxComparison) * 100}%`,
                  }}
                />
              </div>
              <div className="comparison-label">
                <span>2022</span>
                <strong>{money.format(selected.value2022)}</strong>
              </div>
              <div className="bar-track">
                <span
                  className="bar bar-2022"
                  style={{
                    width: `${(selected.value2022 / maxComparison) * 100}%`,
                  }}
                />
              </div>
            </div>

            <div className="variation-summary">
              <span>Variação nominal</span>
              <strong>{percent(selectedVariation)}</strong>
              <small>
                {selected.previousValue === null
                  ? "Não foi localizada candidatura anterior desde 2000."
                  : `${selected.previousItems} itens em ${selected.previousYear} → ${selected.items2022} em 2022`}
              </small>
            </div>

            <div className="chart-block">
              <div className="chart-heading">
                <h4>Evolução patrimonial declarada</h4>
                <span>valores nominais</span>
              </div>
              <AssetHistoryChart
                history={selected.history}
                name={selected.name}
                selectedYear={selectedComposition?.year ?? 2022}
                onSelectYear={setCompositionYear}
              />
              <p className="chart-note">
                A escala vertical é individual: usa a maior declaração deste
                deputado como referência. Por isso a inclinação da linha não
                deve ser comparada entre perfis diferentes.
              </p>
            </div>

            <div className="category-block">
              <div className="composition-heading">
                <div>
                  <h4>Composição patrimonial</h4>
                  <span>
                    {selectedComposition
                      ? `${selectedComposition.office} · ${selectedComposition.party}`
                      : "dados indisponíveis"}
                  </span>
                </div>
                <label>
                  <span>Eleição</span>
                  <select
                    className="composition-select"
                    value={selectedComposition?.year ?? ""}
                    onChange={(event) => setCompositionYear(Number(event.target.value))}
                  >
                    {selectedAssetEvents.map((event) => (
                      <option key={event.year} value={event.year}>
                        {event.year}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              {selectedComposition && (
                <p className="composition-total">
                  Total declarado: <strong>{money.format(selectedComposition.assetsTotal ?? 0)}</strong>
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
                        width: `${selectedComposition?.assetsTotal ? (value / selectedComposition.assetsTotal) * 100 : 0}%`,
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
                  {selected.priorVictories}{" "}
                  {selected.priorVictories === 1
                    ? "eleição anterior"
                    : "eleições anteriores"}
                </span>
              </div>
              <div className="timeline">
                {dedupeHistory(selected.history).map((event, index) => (
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
          </aside>
        </div>
      </section>

      <section className="methodology" id="metodologia">
        <div>
          <p className="eyebrow">Transparência do projeto</p>
          <h2>Como os dados foram tratados</h2>
        </div>
        <ol>
          <li>
            <span>01</span>
            <div>
              <h3>Recorte</h3>
              <p>
                Foram selecionados os 513 candidatos marcados pelo TSE como
                eleitos em 2022 e suas candidaturas desde o ano 2000.
              </p>
            </div>
          </li>
          <li>
            <span>02</span>
            <div>
              <h3>Correspondência</h3>
              <p>
                As candidaturas de diferentes anos e cargos foram relacionadas
                durante o processamento. O arquivo publicado não contém CPF.
              </p>
            </div>
          </li>
          <li>
            <span>03</span>
            <div>
              <h3>Agregação</h3>
              <p>
                Os bens disponíveis desde 2006 foram somados por candidatura e
                agrupados em categorias. A comparação usa a declaração anterior
                mais recente.
              </p>
            </div>
          </li>
          <li>
            <span>04</span>
            <div>
              <h3>Limitações</h3>
              <p>
                As diferenças são nominais, podem refletir mudanças de avaliação
                e não devem ser interpretadas isoladamente como renda ou indício
                de irregularidade.
              </p>
            </div>
          </li>
        </ol>
        <div className="source-band">
          <div>
            <strong>Fontes oficiais</strong>
            <p>Portal de Dados Abertos do Tribunal Superior Eleitoral.</p>
          </div>
          <div className="source-buttons">
            <a
              href="https://dadosabertos.tse.jus.br/dataset/candidatos-2018"
              target="_blank"
              rel="noreferrer"
            >
              Dados de 2018 ↗
            </a>
            <a
              href="https://dadosabertos.tse.jus.br/dataset/candidatos-2022"
              target="_blank"
              rel="noreferrer"
            >
              Dados de 2022 ↗
            </a>
          </div>
        </div>
      </section>

      <footer>
        <div className="brand">
          <span className="brand-mark">RX</span>
          <span>Raio-X Patrimonial</span>
        </div>
        <div className="footer-copy">
          <p>
            Projeto independente de visualização de dados públicos. Sem vínculo
            com o TSE ou a Câmara dos Deputados.
          </p>
          <p className="author-credit">
            Dados e desenvolvimento por{" "}
            <a
              href="https://github.com/araujovito"
              target="_blank"
              rel="noreferrer"
            >
              Vitor Barbosa
            </a>
            .
          </p>
        </div>
        <a href="#inicio">Voltar ao topo ↑</a>
      </footer>
    </main>
  );
}
