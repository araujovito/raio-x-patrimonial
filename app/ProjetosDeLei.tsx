"use client";

import { useEffect, useState } from "react";

import {
  countByStatus,
  countByYear,
  proposicaoLabel,
  statusOf,
  STATUS_LABEL,
  type Proposicao,
  type StatusProposicao,
} from "./lib/leis";

const LEIS_PAGE_SIZE = 8;

// Cada deputado tem seu próprio arquivo em /leis/<id>.json (em vez de um
// único JSON com todo mundo): o conjunto completo passa de 20 MB com as
// ementas, grande demais para embutir no carregamento da página. Buscamos só
// o arquivo do deputado aberto no momento, do mesmo jeito que as fotos em
// /deputados/<id>.jpeg.
type LoadState =
  | { status: "loading" }
  | { status: "empty" }
  | { status: "ready"; proposicoes: Proposicao[] };

function useProposicoes(deputyId: string): LoadState {
  const [state, setState] = useState<LoadState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    setState({ status: "loading" });

    fetch(`/leis/${deputyId}.json`)
      .then((response) => (response.ok ? response.json() : []))
      .then((proposicoes: Proposicao[]) => {
        if (cancelled) return;
        setState(
          proposicoes.length > 0
            ? { status: "ready", proposicoes }
            : { status: "empty" },
        );
      })
      .catch(() => {
        if (!cancelled) setState({ status: "empty" });
      });

    return () => {
      cancelled = true;
    };
  }, [deputyId]);

  return state;
}

export default function ProjetosDeLei({ deputyId }: { deputyId: string }) {
  const state = useProposicoes(deputyId);
  const [visible, setVisible] = useState(LEIS_PAGE_SIZE);
  const [statusFilter, setStatusFilter] = useState<StatusProposicao | null>(null);
  const [yearFilter, setYearFilter] = useState<number | null>(null);

  if (state.status === "loading") {
    return (
      <div className="leis-block">
        <div className="timeline-heading">
          <h4>Projetos de lei</h4>
        </div>
        <p className="leis-empty">Carregando…</p>
      </div>
    );
  }

  if (state.status === "empty") {
    return (
      <div className="leis-block">
        <div className="timeline-heading">
          <h4>Projetos de lei</h4>
        </div>
        <p className="leis-empty">
          Sem dados de projetos de lei para este deputado. Pode ser que o
          mandato tenha mudado de titular desde a eleição, ou que a Câmara
          não tenha nenhum PL, PLP ou PEC de autoria dele registrado.
        </p>
      </div>
    );
  }

  const { proposicoes } = state;
  const byStatus = countByStatus(proposicoes);
  const byYear = countByYear(proposicoes);
  const maxYearCount = Math.max(...byYear.map(([, count]) => count), 1);

  const filtered = proposicoes.filter((proposicao) => {
    const matchesStatus =
      !statusFilter || statusOf(proposicao) === statusFilter;
    const matchesYear = !yearFilter || proposicao.ano === yearFilter;
    return matchesStatus && matchesYear;
  });

  function resetFilters() {
    setStatusFilter(null);
    setYearFilter(null);
    setVisible(LEIS_PAGE_SIZE);
  }

  return (
    <div className="leis-block">
      <div className="timeline-heading">
        <h4>Projetos de lei</h4>
        <span>
          {proposicoes.length}{" "}
          {proposicoes.length === 1 ? "proposição" : "proposições"} (PL, PLP
          ou PEC)
        </span>
      </div>

      <div className="leis-stats">
        {(["aprovada", "tramitando", "arquivada"] as StatusProposicao[]).map(
          (status) => (
            <button
              key={status}
              type="button"
              className={`leis-stat leis-stat-${status} ${
                statusFilter === status ? "is-active" : ""
              }`}
              onClick={() => {
                setStatusFilter((current) =>
                  current === status ? null : status,
                );
                setVisible(LEIS_PAGE_SIZE);
              }}
            >
              <strong>{byStatus[status]}</strong>
              <span>{STATUS_LABEL[status]}</span>
            </button>
          ),
        )}
      </div>

      <div className="leis-years">
        {byYear.map(([year, count]) => (
          <button
            key={year}
            type="button"
            className={`leis-year-row ${yearFilter === year ? "is-active" : ""}`}
            onClick={() => {
              setYearFilter((current) => (current === year ? null : year));
              setVisible(LEIS_PAGE_SIZE);
            }}
          >
            <span className="leis-year-label">{year}</span>
            <span className="bar-track leis-year-track">
              <span
                className="bar bar-2022"
                style={{ width: `${(count / maxYearCount) * 100}%` }}
              />
            </span>
            <span className="leis-year-count">{count}</span>
          </button>
        ))}
      </div>

      {(statusFilter || yearFilter) && (
        <button className="reset-filters leis-reset" type="button" onClick={resetFilters}>
          Limpar filtros
        </button>
      )}

      <div className="leis-list">
        {filtered.slice(0, visible).map((proposicao) => (
          <a
            className="leis-row"
            key={proposicao.id}
            href={proposicao.uri}
            target="_blank"
            rel="noreferrer"
          >
            <div className="leis-row-head">
              <strong>{proposicaoLabel(proposicao)}</strong>
              <span
                className={`leis-status-badge leis-status-${statusOf(proposicao)}`}
              >
                {proposicao.situacao || STATUS_LABEL[statusOf(proposicao)]}
              </span>
            </div>
            <span>{proposicao.ementa}</span>
          </a>
        ))}
        {filtered.length === 0 && (
          <p className="leis-empty">Nenhum projeto com esse filtro.</p>
        )}
      </div>
      {visible < filtered.length && (
        <button
          className="load-more"
          type="button"
          onClick={() => setVisible((current) => current + LEIS_PAGE_SIZE)}
        >
          Mostrar mais projetos
        </button>
      )}
    </div>
  );
}
