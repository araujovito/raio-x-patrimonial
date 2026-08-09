"use client";

import { useMemo, useState } from "react";

import ProjetosDeLei from "./ProjetosDeLei";
import {
  ALL_PARTIES,
  ALL_STATES,
  candidatePhotoUrl,
  normalize,
  type Deputy,
} from "./lib/deputados";

export default function BuscaProjetosDeLei({
  deputies,
}: {
  deputies: Deputy[];
}) {
  const [query, setQuery] = useState("");
  const [uf, setUf] = useState(ALL_STATES);
  const [party, setParty] = useState(ALL_PARTIES);
  const [photoFailed, setPhotoFailed] = useState(false);
  const sorted = useMemo(
    () => [...deputies].sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0)),
    [deputies],
  );
  const [selectedId, setSelectedId] = useState(sorted[0].id);
  const selected =
    deputies.find((deputy) => deputy.id === selectedId) ?? sorted[0];

  const states = useMemo(
    () => [...new Set(deputies.map((deputy) => deputy.uf))].sort(),
    [deputies],
  );
  const parties = useMemo(
    () => [...new Set(deputies.map((deputy) => deputy.party))].sort(),
    [deputies],
  );

  const filtered = useMemo(() => {
    const search = normalize(query.trim());
    return sorted.filter((deputy) => {
      const matchesSearch =
        !search || normalize(`${deputy.name} ${deputy.fullName}`).includes(search);
      return (
        matchesSearch &&
        (uf === ALL_STATES || deputy.uf === uf) &&
        (party === ALL_PARTIES || deputy.party === party)
      );
    });
  }, [sorted, query, uf, party]);

  return (
    <div className="diversity-lookup">
      <div className="filter-grid leis-filter-grid">
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
        <label>
          <span>Partido</span>
          <select value={party} onChange={(event) => setParty(event.target.value)}>
            <option>Todos</option>
            {parties.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
        </label>
      </div>

      <div className="dashboard-grid">
        <div className="results-card">
          <div className="table-head diversity-lookup-head">
            <span>Deputado</span>
            <span>Partido</span>
            <span>UF</span>
          </div>
          <div className="result-list">
            {filtered.slice(0, 60).map((deputy) => {
              const isSelected = deputy.id === selected.id;
              return (
                <button
                  className={`result-row diversity-lookup-row ${isSelected ? "selected" : ""}`}
                  type="button"
                  key={deputy.id}
                  onClick={() => {
                    setSelectedId(deputy.id);
                    setPhotoFailed(false);
                  }}
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
                  <span>{deputy.party}</span>
                  <span>{deputy.uf}</span>
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

        <article className="profile-card" key={selected.id}>
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
              <p>Deputado federal eleito em 2022</p>
              <h3>{selected.name}</h3>
              <span>
                {selected.party} · {selected.uf}
              </span>
            </div>
          </div>

          <ProjetosDeLei deputyId={selected.id} />
        </article>
      </div>
    </div>
  );
}
