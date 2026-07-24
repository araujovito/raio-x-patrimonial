"use client";

import { useMemo, useState } from "react";

type Categories = Record<string, number>;

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
  if (deputy.value2018 === null || deputy.value2018 <= 0) return null;
  return ((deputy.value2022 / deputy.value2018) - 1) * 100;
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

  const comparable = deputies.filter((deputy) => deputy.value2018 !== null);
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
        (!onlyComparable || deputy.value2018 !== null)
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
  const maxComparison = Math.max(selected.value2022, selected.value2018 ?? 0, 1);
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
          <p className="eyebrow">Eleições 2018 → 2022</p>
          <h1>
            O patrimônio
            <br />
            <em>declarado</em> em dados.
          </h1>
          <p className="hero-description">
            Explore e compare as declarações de bens dos 513 deputados federais
            eleitos em 2022, com dados públicos do Tribunal Superior Eleitoral.
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
            <span className="stat-label">comparáveis com 2018</span>
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
          <strong>Leia os números com contexto.</strong> São valores declarados
          pelos candidatos ao TSE, não uma auditoria ou estimativa do patrimônio
          atual. A comparação é nominal e não desconta a inflação.
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
            comparar as duas declarações.
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
            Apenas com comparação em 2018
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
              <span>Variação</span>
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
                  {selected.party} · {selected.uf}
                </span>
              </div>
            </div>

            <div className="comparison">
              <div className="comparison-label">
                <span>2018</span>
                <strong>
                  {selected.value2018 === null
                    ? "não comparável"
                    : money.format(selected.value2018)}
                </strong>
              </div>
              <div className="bar-track">
                <span
                  className="bar bar-2018"
                  style={{
                    width: `${((selected.value2018 ?? 0) / maxComparison) * 100}%`,
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
                {selected.value2018 === null
                  ? "Não foi localizada candidatura equivalente em 2018."
                  : `${selected.items2018} itens em 2018 → ${selected.items2022} em 2022`}
              </small>
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
                eleitos por quociente partidário ou média em 2022.
              </p>
            </div>
          </li>
          <li>
            <span>02</span>
            <div>
              <h3>Correspondência</h3>
              <p>
                As candidaturas de 2018 e 2022 foram relacionadas durante o
                processamento. O arquivo publicado não contém CPF.
              </p>
            </div>
          </li>
          <li>
            <span>03</span>
            <div>
              <h3>Agregação</h3>
              <p>
                Os valores de cada item declarado foram somados por candidato e
                agrupados em categorias para facilitar a leitura.
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
        <p>
          Projeto independente de visualização de dados públicos. Sem vínculo
          com o TSE ou a Câmara dos Deputados.
        </p>
        <a href="#inicio">Voltar ao topo ↑</a>
      </footer>
    </main>
  );
}
