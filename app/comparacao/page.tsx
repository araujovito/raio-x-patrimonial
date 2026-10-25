import type { Metadata } from "next";
import Link from "next/link";

import {
  rankByDelta,
  reelectedDeputies,
  renewalBy,
  summarizeComparison,
  type Reelected,
  type RenewalRow,
} from "../lib/comparacao";
import { compactMoney, number, percent } from "../lib/deputados";
import { getLegislature } from "../lib/legislaturas";

export const metadata: Metadata = {
  title: "Comparação 2022 → 2026",
  description:
    "Quantos dos eleitos de 2022 voltaram em 2026, como mudou o patrimônio declarado de quem foi reeleito e onde a renovação foi maior.",
};

const legislature2026 = getLegislature(2026)!;
const legislature2022 = getLegislature(2022)!;
const reelected = reelectedDeputies(legislature2026.deputies);
const summary = summarizeComparison(
  legislature2026.deputies,
  reelected,
  legislature2022.deputies.length,
);
const byParty = renewalBy(legislature2026.deputies, reelected, "party");
const byState = renewalBy(legislature2026.deputies, reelected, "uf");

function oneDecimal(value: number) {
  return value.toLocaleString("pt-BR", { maximumFractionDigits: 1 });
}

function DeltaTable({ title, rows }: { title: string; rows: Reelected[] }) {
  return (
    <div className="compare-block">
      <h3>{title}</h3>
      <table className="compare-table">
        <thead>
          <tr>
            <th>Deputado</th>
            <th>2022</th>
            <th>2026</th>
            <th>Diferença</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ deputy, previous, delta, percent: change }) => (
            <tr key={deputy.id}>
              <td>
                <Link href={`/deputado/${deputy.id}`}>{deputy.name}</Link>
                <small>
                  {deputy.party} · {deputy.uf}
                </small>
              </td>
              <td>{compactMoney.format(previous.assetsTotal ?? 0)}</td>
              <td>{compactMoney.format(deputy.value)}</td>
              <td>
                {delta > 0 ? "+" : ""}
                {compactMoney.format(delta)}
                <small>{change === null ? "base zero em 2022" : percent(change)}</small>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function RenewalTable({ title, rows }: { title: string; rows: RenewalRow[] }) {
  return (
    <div className="compare-block">
      <h3>{title}</h3>
      <table className="compare-table">
        <thead>
          <tr>
            <th>{title.includes("partido") ? "Partido" : "Estado"}</th>
            <th>Eleitos</th>
            <th>Reeleitos</th>
            <th>Novos</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.key}>
              <td>{row.key}</td>
              <td>{row.total}</td>
              <td>{row.reelected}</td>
              <td>
                {row.newcomers}
                <small>{oneDecimal((row.newcomers / row.total) * 100)}%</small>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function ComparacaoPage() {
  return (
    <main className="diversity-page">
      <nav className="deputy-page-nav">
        <Link href="/#explorar">← Voltar ao explorador</Link>
        <span>Raio-X Patrimonial</span>
      </nav>

      <div className="section-heading diversity-page-heading">
        <div>
          <p className="eyebrow">2022 → 2026</p>
          <h1>Quem voltou e quanto mudou</h1>
        </div>
        <p>
          Dos {number.format(legislature2022.deputies.length)} eleitos em 2022,{" "}
          {number.format(summary.reelected)} foram eleitos de novo em 2026 (
          {oneDecimal(summary.returnRate)}%). Os outros{" "}
          {number.format(summary.newcomers)} eleitos de 2026 não tinham sido eleitos
          Deputado Federal em 2022.
        </p>
      </div>

      <div className="diversity-summary">
        <div className="diversity-card">
          <h3>Renovação</h3>
          <div className="diversity-figure">
            <strong>{number.format(summary.newcomers)}</strong>
            <span>
              de {number.format(summary.total)} eleitos de 2026 são novos (
              {oneDecimal((summary.newcomers / summary.total) * 100)}%)
            </span>
          </div>
          <p className="diversity-note">
            {number.format(summary.changedParty)} dos {number.format(summary.reelected)}{" "}
            reeleitos concorreram por um partido diferente do de 2022.
          </p>
        </div>
        <div className="diversity-card">
          <h3>Patrimônio de quem foi reeleito</h3>
          <div className="diversity-figure">
            <strong>{compactMoney.format(summary.medianValue2026)}</strong>
            <span>
              mediana declarada em 2026, contra{" "}
              {compactMoney.format(summary.medianValue2022)} em 2022
            </span>
          </div>
          <p className="diversity-note">
            Variação mediana nominal de{" "}
            {summary.medianPercent === null ? "—" : percent(summary.medianPercent)} (
            {number.format(summary.withPercent)} reeleitos com declaração positiva em
            2022). {number.format(summary.increased)} declararam mais em 2026 e{" "}
            {number.format(summary.decreased)} declararam menos.
          </p>
        </div>
      </div>

      <aside className="context-note">
        <span className="note-icon" aria-hidden="true">
          i
        </span>
        <p>
          <strong>Leia os números com contexto.</strong> Os valores são nominais e
          não descontam a inflação do período, que sozinha eleva o patrimônio
          declarado. Bens são declarados pelo próprio candidato, por valor de
          aquisição ou estimado, e uma variação não indica renda nem irregularidade.
          Reeleito, aqui, é quem foi eleito Deputado Federal em 2022 e em 2026.
        </p>
      </aside>

      <section className="compare-grid">
        <DeltaTable
          title="Maiores aumentos declarados"
          rows={rankByDelta(reelected, "up", 10)}
        />
        <DeltaTable
          title="Maiores reduções declaradas"
          rows={rankByDelta(reelected, "down", 10)}
        />
      </section>

      <section className="compare-grid">
        <RenewalTable title="Renovação por partido" rows={byParty} />
        <RenewalTable title="Renovação por estado" rows={byState} />
      </section>

      <p className="deputy-page-note">
        Dados públicos declarados ao Tribunal Superior Eleitoral. Valores em
        reais correntes de cada eleição.{" "}
        <Link href="/#metodologia">Ver metodologia</Link>.
      </p>

      <footer className="deputy-page-footer">
        Dados e desenvolvimento por Vitor Barbosa.
      </footer>
    </main>
  );
}
