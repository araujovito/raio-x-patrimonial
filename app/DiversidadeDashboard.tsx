"use client";

import { useMemo, useState } from "react";

import HemicicloPartidos from "./HemicicloPartidos";
import MapaEstados from "./MapaEstados";
import {
  ALL_STATES,
  candidatePhotoUrl,
  normalize,
  type Deputy,
} from "./lib/deputados";
import { share, shareValue, type DiversityData } from "./lib/diversidade";

type Tab = "buscar" | "partido" | "estado";

function DeputyDiversityCard({
  deputy,
  diversity,
}: {
  deputy: Deputy;
  diversity: DiversityData;
}) {
  const [photoFailed, setPhotoFailed] = useState(false);
  const stateSummary = diversity.byState[deputy.uf];
  const isWoman = deputy.gender === "Feminino";
  const isNegro = deputy.race === "Preta" || deputy.race === "Parda";

  return (
    <article className="profile-card" key={deputy.id} aria-live="polite">
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
          <p>Deputado federal eleito em 2022</p>
          <h3>{deputy.name}</h3>
          <span>
            {deputy.party} · {deputy.uf}
          </span>
        </div>
      </div>

      <div className="diversity-tags">
        <span className={`diversity-tag ${isWoman ? "is-highlighted" : ""}`}>
          {deputy.gender}
        </span>
        <span className={`diversity-tag ${isNegro ? "is-highlighted" : ""}`}>
          {deputy.race}
        </span>
      </div>

      {stateSummary && (
        <div className="diversity-context">
          <p>
            Entre os {stateSummary.elected} eleitos de {deputy.uf}:{" "}
            <strong>{share(stateSummary.womenElected, stateSummary.elected)}</strong>{" "}
            são mulheres e{" "}
            <strong>{share(stateSummary.negroElected, stateSummary.elected)}</strong>{" "}
            são negros.
          </p>
          <div className="comparison-label">
            <span>Mulheres em {deputy.uf}</span>
          </div>
          <div className="bar-track">
            <span
              className="bar bar-2022"
              style={{
                width: `${shareValue(stateSummary.womenElected, stateSummary.elected)}%`,
              }}
            />
          </div>
          <div className="comparison-label">
            <span>Negros em {deputy.uf}</span>
          </div>
          <div className="bar-track">
            <span
              className="bar bar-2018"
              style={{
                width: `${shareValue(stateSummary.negroElected, stateSummary.elected)}%`,
              }}
            />
          </div>
        </div>
      )}
    </article>
  );
}

function BuscaPorNome({
  deputies,
  diversity,
}: {
  deputies: Deputy[];
  diversity: DiversityData;
}) {
  const [query, setQuery] = useState("");
  const [uf, setUf] = useState(ALL_STATES);
  const sorted = useMemo(
    () => [...deputies].sort((a, b) => a.name.localeCompare(b.name, "pt-BR")),
    [deputies],
  );
  const [selectedId, setSelectedId] = useState(sorted[0].id);
  const selected =
    deputies.find((deputy) => deputy.id === selectedId) ?? sorted[0];

  const states = useMemo(
    () => [...new Set(deputies.map((deputy) => deputy.uf))].sort(),
    [deputies],
  );

  const filtered = useMemo(() => {
    const search = normalize(query.trim());
    return sorted.filter((deputy) => {
      const matchesSearch =
        !search || normalize(`${deputy.name} ${deputy.fullName}`).includes(search);
      return matchesSearch && (uf === ALL_STATES || deputy.uf === uf);
    });
  }, [sorted, query, uf]);

  return (
    <div className="diversity-lookup">
      <div className="filter-grid diversity-filter-grid">
        <label className="search-field">
          <span>Buscar deputado</span>
          <div className="search-input-wrap">
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Ex.: Eunício ou Atila Lins"
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
      </div>

      <div className="dashboard-grid">
        <div className="results-card">
          <div className="table-head diversity-lookup-head">
            <span>Deputado</span>
            <span>Gênero</span>
            <span>Raça</span>
          </div>
          <div className="result-list">
            {filtered.slice(0, 60).map((deputy) => {
              const isSelected = deputy.id === selected.id;
              return (
                <button
                  className={`result-row diversity-lookup-row ${isSelected ? "selected" : ""}`}
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
                  <span>{deputy.gender}</span>
                  <span>{deputy.race}</span>
                </button>
              );
            })}
            {filtered.length === 0 && (
              <div className="empty-state">
                <strong>Nenhum deputado encontrado.</strong>
                <p>Tente remover algum filtro ou buscar por outro nome.</p>
              </div>
            )}
          </div>
        </div>

        <DeputyDiversityCard
          key={selected.id}
          deputy={selected}
          diversity={diversity}
        />
      </div>
    </div>
  );
}

export default function DiversidadeDashboard({
  deputies,
  diversity,
}: {
  deputies: Deputy[];
  diversity: DiversityData;
}) {
  const [tab, setTab] = useState<Tab>("partido");

  return (
    <div>
      <div className="diversity-tabs" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={tab === "partido"}
          className={tab === "partido" ? "is-active" : ""}
          onClick={() => setTab("partido")}
        >
          Por partido
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "estado"}
          className={tab === "estado" ? "is-active" : ""}
          onClick={() => setTab("estado")}
        >
          Por estado
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "buscar"}
          className={tab === "buscar" ? "is-active" : ""}
          onClick={() => setTab("buscar")}
        >
          Buscar por nome
        </button>
      </div>

      {tab === "partido" && (
        <HemicicloPartidos deputies={deputies} diversity={diversity} />
      )}
      {tab === "estado" && <MapaEstados data={diversity} />}
      {tab === "buscar" && (
        <BuscaPorNome deputies={deputies} diversity={diversity} />
      )}
    </div>
  );
}
