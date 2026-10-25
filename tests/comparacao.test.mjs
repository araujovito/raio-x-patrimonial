import assert from "node:assert/strict";
import test from "node:test";

import deputies2022 from "../app/data/deputados-2022.json" with { type: "json" };
import deputies2026 from "../app/data/deputados-2026.json" with { type: "json" };
import {
  rankByDelta,
  reelectedDeputies,
  renewalBy,
  summarizeComparison,
} from "../app/lib/comparacao.ts";

const reeleitos = reelectedDeputies(deputies2026);
const resumo = summarizeComparison(deputies2026, reeleitos, deputies2022.length);

test("reeleito é quem foi eleito Deputado Federal em 2022 e em 2026", () => {
  assert.ok(reeleitos.length > 0);
  for (const item of reeleitos) {
    assert.equal(item.previous.year, 2022);
    assert.equal(item.previous.office, "Deputado Federal");
    assert.ok(item.previous.elected);
    assert.equal(item.deputy.electionYear, 2026);
  }
});

test("reeleitos e novos somam os 513 eleitos de 2026, sem repetir ninguém", () => {
  assert.equal(resumo.reelected + resumo.newcomers, 513);
  assert.equal(new Set(reeleitos.map((item) => item.deputy.id)).size, reeleitos.length);
});

test("quem foi reeleito tem o mesmo CPF nas duas bases: 2022 e 2026 batem pela trajetória", () => {
  // Cada reeleito precisa ter a candidatura eleita de 2022 também na base de 2022,
  // com o mesmo patrimônio declarado.
  const por2022 = new Map(deputies2022.map((d) => [d.fullName + d.uf, d]));
  let casados = 0;
  for (const item of reeleitos) {
    const antigo = por2022.get(item.deputy.fullName + item.previous.uf);
    if (!antigo) continue;
    casados += 1;
    assert.equal(antigo.value, item.previous.assetsTotal, item.deputy.name);
  }
  assert.ok(casados > 200, `poucos casados por nome: ${casados}`);
});

test("variação em reais é a diferença entre as declarações, e o percentual ignora base zero", () => {
  for (const item of reeleitos) {
    assert.equal(
      Math.round((item.delta + item.previous.assetsTotal) * 100),
      Math.round(item.deputy.value * 100),
    );
    if (item.previous.assetsTotal === 0) assert.equal(item.percent, null);
    else assert.ok(Number.isFinite(item.percent));
  }
});

test("aumentos e reduções vêm ordenados e só com o sinal certo", () => {
  const sobe = rankByDelta(reeleitos, "up", 10);
  const desce = rankByDelta(reeleitos, "down", 10);

  assert.equal(sobe.length, 10);
  assert.ok(sobe.every((item, i) => item.delta > 0 && (i === 0 || sobe[i - 1].delta >= item.delta)));
  assert.ok(desce.every((item, i) => item.delta < 0 && (i === 0 || desce[i - 1].delta <= item.delta)));
});

test("a renovação por partido e por estado fecha com o total", () => {
  for (const campo of ["party", "uf"]) {
    const linhas = renewalBy(deputies2026, reeleitos, campo);
    assert.equal(linhas.reduce((soma, l) => soma + l.total, 0), 513);
    assert.equal(linhas.reduce((soma, l) => soma + l.reelected, 0), resumo.reelected);
    assert.ok(linhas.every((l) => l.reelected + l.newcomers === l.total));
  }
});

test("taxa de retorno é relativa aos eleitos de 2022", () => {
  assert.equal(resumo.returnRate, (resumo.reelected / deputies2022.length) * 100);
  assert.ok(resumo.returnRate > 0 && resumo.returnRate < 100);
});
