"use client";

import { useMemo, useState } from "react";

type Categories = Record<string, number>;

type ElectionEvent = {
  year: number;
  office: string;
  party: string;
  uf: string;
  result: string;
  elected: boolean;
  assetsTotal: number | null;
  assetItems: number | null;
  assetCategories: Categories | null;
};

type Deputy = {
  id: string;
  name: string;
  fullName: string;
  uf: string;
  party: string;
  status: string;
  value2022: number;
  value2018: number | null;
  items2022: number;
  items2018: number | null;
  categories2022: Categories;
  categories2018: Categories | null;
  previousYear: number | null;
  previousOffice: string | null;
  previousParty: string | null;
  previousValue: number | null;
  previousItems: number | null;
  previousCategories: Categories | null;
  priorCandidacies: number;
  priorVictories: number;
  history: ElectionEvent[];
};

type SortMode = "value" | "growth" | "name";

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

function variation(deputy: Deputy) {
  if (deputy.previousValue === null || deputy.previousValue <= 0) return null;
  return ((deputy.value2022 / deputy.previousValue) - 1) * 100;
}

function percent(value: number | null) {
  if (value === null || !Number.isFinite(value)) return "sem comparação";
  const signal = value > 0 ? "+" : "";
  return `${signal}${value.toLocaleString("pt-BR", {
    maximumFractionDigits: 1,
  })}%`;
}

function median(values: number[]) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2;
}

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function AssetHistoryChart({
  history,
  name,
}: {
  history: ElectionEvent[];
  name: string;
}) {
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
  const padding = { top: 24, right: 14, bottom: 34, left: 14 };
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

  return (
    <div className="asset-chart">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-labelledby="asset-chart-title asset-chart-description"
      >
        <title id="asset-chart-title">
          Evolução patrimonial declarada de {name}
        </title>
        <desc id="asset-chart-description">
          Valores nominais declarados ao TSE entre {minYear} e {maxYear}.
        </desc>
        {[0, 0.5, 1].map((ratio) => {
          const gridY = padding.top + plotHeight * ratio;
          return (
            <line
              className="chart-grid-line"
              x1={padding.left}
              x2={width - padding.right}
              y1={gridY}
              y2={gridY}
              key={ratio}
            />
          );
        })}
        <polyline className="chart-line" points={line} />
        {points.map((point) => (
          <g key={point.year}>
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
            >
              <title>
                {point.year}: {money.format(point.value)}
              </title>
            </circle>
            <text
              className="chart-year"
              x={x(point.year)}
              y={height - 10}
              textAnchor="middle"
            >
              {point.year}
            </text>
          </g>
        ))}
      </svg>
      <div className="chart-range" aria-hidden="true">
        <span>R$ 0</span>
        <span>máximo: {compactMoney.format(maxValue)}</span>
      </div>
    </div>
  );
}

export default function Dashboard({ deputies }: { deputies: Deputy[] }) {
  const [query, setQuery] = useState("");
  const [uf, setUf] = useState("Todas");
  const [party, setParty] = useState("Todos");
  const [sortMode, setSortMode] = useState<SortMode>("value");
  const [onlyComparable, setOnlyComparable] = useState(false);
  const [visible, setVisible] = useState(12);

  const ranked = useMemo(
    () => [...deputies].sort((a, b) => b.value2022 - a.value2022),
    [deputies],
  );
  const [selectedId, setSelectedId] = useState(ranked[0].id);
  const selected =
    deputies.find((deputy) => deputy.id === selectedId) ?? ranked[0];

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

  const filtered = useMemo(() => {
    const search = normalize(query.trim());
    const result = deputies.filter((deputy) => {
      const matchesSearch =
        !search ||
        normalize(`${deputy.name} ${deputy.fullName}`).includes(search);
      return (
        matchesSearch &&
        (uf === "Todas" || deputy.uf === uf) &&
        (party === "Todos" || deputy.party === party) &&
        (!onlyComparable || deputy.previousValue !== null)
      );
    });

    return result.sort((a, b) => {
      if (sortMode === "name") return a.name.localeCompare(b.name, "pt-BR");
      if (sortMode === "growth")
        return (variation(b) ?? -Infinity) - (variation(a) ?? -Infinity);
      return b.value2022 - a.value2022;
    });
  }, [deputies, onlyComparable, party, query, sortMode, uf]);

  const selectedVariation = variation(selected);
  const maxComparison = Math.max(
    selected.value2022,
    selected.previousValue ?? 0,
    1,
  );
  const categoryEntries = Object.entries(selected.categories2022).sort(
    ([, a], [, b]) => b - a,
  );

  function resetFilters() {
    setQuery("");
    setUf("Todas");
    setParty("Todos");
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
            <input
              type="search"
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setVisible(12);
              }}
              placeholder="Digite um nome…"
            />
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
          <button
            className={`comparison-toggle ${onlyComparable ? "active" : ""}`}
            type="button"
            aria-pressed={onlyComparable}
            onClick={() => setOnlyComparable((current) => !current)}
          >
            <span aria-hidden="true">{onlyComparable ? "✓" : ""}</span>
            Apenas com declaração anterior
          </button>
          <p>
            <strong>{number.format(filtered.length)}</strong>{" "}
            {filtered.length === 1 ? "resultado" : "resultados"}
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

          <aside className="profile-card" aria-live="polite">
            <div className="profile-header">
              <div className="profile-avatar" aria-hidden="true">
                {selected.name.charAt(0)}
              </div>
              <div>
                <p>Perfil selecionado</p>
                <h3>{selected.name}</h3>
                <span>
                  {selected.party} · {selected.uf} ·{" "}
                  {selected.priorCandidacies} candidaturas anteriores
                </span>
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
              />
            </div>

            <div className="category-block">
              <h4>Composição em 2022</h4>
              {categoryEntries.map(([label, value]) => (
                <div className="category-row" key={label}>
                  <div>
                    <span>{label}</span>
                    <strong>{compactMoney.format(value)}</strong>
                  </div>
                  <div className="category-track">
                    <span
                      style={{
                        width: `${selected.value2022 ? (value / selected.value2022) * 100 : 0}%`,
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
                {selected.history.map((event, index) => (
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
                      <span>{event.result}</span>
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
