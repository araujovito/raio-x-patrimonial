"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import DeputyProfile from "./DeputyProfile";
import {
  ALL_PARTIES,
  ALL_STATES,
  compactMoney,
  filterDeputies,
  median,
  number,
  percent,
  sortDeputies,
  variation,
  type Deputy,
  type SortMode,
} from "./lib/deputados";

export default function Dashboard({ deputies }: { deputies: Deputy[] }) {
  const [query, setQuery] = useState("");
  const [uf, setUf] = useState(ALL_STATES);
  const [party, setParty] = useState(ALL_PARTIES);
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

  // Abaixo de 1040px o perfil deixa de ficar ao lado e passa a aparecer depois
  // da lista. Sem esta rolagem, escolher um deputado no celular atualizaria um
  // painel fora da tela, sem nenhum retorno visual. Não rola na primeira
  // renderização, apenas quando a seleção muda.
  const firstRender = useRef(true);
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    if (!window.matchMedia("(max-width: 1040px)").matches) return;
    document
      .getElementById("perfil")
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
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

  const filters = useMemo(
    () => ({ query, uf, party, onlyComparable }),
    [onlyComparable, party, query, uf],
  );
  const filtered = useMemo(
    () => sortDeputies(filterDeputies(deputies, filters), sortMode),
    [deputies, filters, sortMode],
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

          <DeputyProfile
            key={selected.id}
            deputy={selected}
            live
            permalink
          />
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
