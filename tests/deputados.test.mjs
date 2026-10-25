import assert from "node:assert/strict";
import test from "node:test";

import deputies from "../app/data/deputados-2022.json" with { type: "json" };
import deputies2026 from "../app/data/deputados-2026.json" with { type: "json" };
import {
  ALL_PARTIES,
  ALL_STATES,
  assetEvents,
  candidatePhotoUrl,
  candidateSourceUrl,
  dedupeHistory,
  filterDeputies,
  median,
  normalize,
  percent,
  resultLabel,
  sortDeputies,
  variation,
} from "../app/lib/deputados.ts";

const semFiltro = {
  query: "",
  uf: ALL_STATES,
  party: ALL_PARTIES,
  onlyComparable: false,
};

function buscar(nome) {
  const encontrado = deputies.find((deputy) => deputy.name === nome);
  assert.ok(encontrado, `deputado "${nome}" não encontrado na base`);
  return encontrado;
}

test("a base tem os 513 deputados eleitos, com identificadores únicos", () => {
  assert.equal(deputies.length, 513);
  assert.equal(new Set(deputies.map((deputy) => deputy.id)).size, 513);
});

test("busca por nome ignora acentos e maiúsculas", () => {
  const semAcento = filterDeputies(deputies, { ...semFiltro, query: "abilio" });
  const comAcento = filterDeputies(deputies, { ...semFiltro, query: "Abílio" });

  assert.ok(semAcento.length > 0, "busca sem acento não deveria vir vazia");
  assert.deepEqual(
    semAcento.map((deputy) => deputy.id),
    comAcento.map((deputy) => deputy.id),
    "com e sem acento devem retornar os mesmos deputados",
  );
  assert.ok(semAcento.some((deputy) => normalize(deputy.name) === "abilio"));
});

test("busca também encontra pelo nome completo", () => {
  const bebeto = buscar("Bebeto");
  // "Bebeto" é nome de urna; o nome civil é outro.
  const porNomeCivil = filterDeputies(deputies, {
    ...semFiltro,
    query: bebeto.fullName.split(" ").slice(0, 2).join(" "),
  });

  assert.ok(
    porNomeCivil.some((deputy) => deputy.id === bebeto.id),
    "deveria encontrar o deputado pelo início do nome completo",
  );
});

test("busca sem resultado devolve lista vazia, sem quebrar", () => {
  const resultado = filterDeputies(deputies, {
    ...semFiltro,
    query: "zzzzzznaoexiste",
  });
  assert.equal(resultado.length, 0);
});

test("filtro por estado devolve apenas deputados daquela UF", () => {
  const doAcre = filterDeputies(deputies, { ...semFiltro, uf: "AC" });

  assert.ok(doAcre.length > 0);
  assert.ok(doAcre.every((deputy) => deputy.uf === "AC"));
  assert.ok(doAcre.length < deputies.length);
});

test("filtro por partido devolve apenas deputados daquele partido", () => {
  const doPl = filterDeputies(deputies, { ...semFiltro, party: "PL" });

  assert.ok(doPl.length > 0);
  assert.ok(doPl.every((deputy) => deputy.party === "PL"));
});

test("filtros de estado e partido se combinam", () => {
  const alvo = deputies[0];
  const combinado = filterDeputies(deputies, {
    ...semFiltro,
    uf: alvo.uf,
    party: alvo.party,
  });

  assert.ok(combinado.some((deputy) => deputy.id === alvo.id));
  assert.ok(
    combinado.every(
      (deputy) => deputy.uf === alvo.uf && deputy.party === alvo.party,
    ),
  );
});

test("sem filtros aplicados, a lista completa é preservada", () => {
  assert.equal(filterDeputies(deputies, semFiltro).length, deputies.length);
});

test("filtro de comparáveis remove quem não tem declaração anterior", () => {
  const comparaveis = filterDeputies(deputies, {
    ...semFiltro,
    onlyComparable: true,
  });

  assert.ok(comparaveis.length > 0);
  assert.ok(comparaveis.every((deputy) => deputy.previousValue !== null));
  assert.ok(
    comparaveis.length < deputies.length,
    "há deputados sem declaração anterior na base",
  );
});

test("ordenação por patrimônio, nome e variação", () => {
  const porValor = sortDeputies(deputies, "value");
  assert.ok(porValor[0].value >= porValor[porValor.length - 1].value);

  const porNome = sortDeputies(deputies, "name");
  assert.equal(
    porNome[0].name,
    [...deputies].sort((a, b) => a.name.localeCompare(b.name, "pt-BR"))[0].name,
  );

  const porVariacao = sortDeputies(deputies, "growth");
  assert.equal(porVariacao.length, deputies.length);
});

test("ordenação não altera a lista original", () => {
  const antes = deputies.map((deputy) => deputy.id);
  sortDeputies(deputies, "name");
  assert.deepEqual(deputies.map((deputy) => deputy.id), antes);
});

test("deputado sem declaração anterior não gera variação", () => {
  const semAnterior = deputies.find((deputy) => deputy.previousValue === null);
  assert.ok(semAnterior, "esperado ao menos um deputado sem declaração anterior");

  assert.equal(variation(semAnterior), null);
  assert.equal(percent(variation(semAnterior)), "sem comparação");
});

test("variação nominal é calculada corretamente", () => {
  const dobrou = { value: 200, previousValue: 100 };
  assert.equal(variation(dobrou), 100);
  assert.equal(percent(variation(dobrou)), "+100%");

  // Patrimônio anterior zerado não permite comparação percentual.
  assert.equal(variation({ value: 50, previousValue: 0 }), null);
});

test("link do TSE aponta para a ficha do candidato, com região e UF corretas", () => {
  const abilio = deputies.find((deputy) => deputy.id === "110001612761");
  assert.ok(abilio, "Abílio (MT) deveria existir na base");

  assert.equal(
    candidateSourceUrl(abilio),
    "https://divulgacandcontas.tse.jus.br/divulga/#/candidato/CENTROOESTE/MT/2040602022/110001612761/2022/MT",
  );
});

test("todo deputado gera um link do TSE válido e com sua própria identificação", () => {
  for (const deputy of deputies) {
    const url = candidateSourceUrl(deputy);
    assert.ok(
      url.startsWith("https://divulgacandcontas.tse.jus.br/divulga/#/candidato/"),
      `URL inesperada para ${deputy.name}`,
    );
    assert.ok(url.includes(`/${deputy.id}/${deputy.electionYear}/${deputy.uf}`));
    assert.doesNotMatch(url, /BRASIL/, `UF sem região mapeada: ${deputy.uf}`);
  }
});

// Cadeiras por UF fixadas em lei (LC 78/1993, atualizada pela LC 161/2018),
// iguais em 2022 e 2026. É a conferência independente do resultado do TSE:
// um estado sem resultado apurado no arquivo (como o MA em 2022) não fecharia.
const CADEIRAS = {
  AC: 8, AL: 9, AM: 8, AP: 8, BA: 39, CE: 22, DF: 8, ES: 10, GO: 17, MA: 18,
  MG: 53, MS: 8, MT: 8, PA: 17, PB: 12, PE: 25, PI: 10, PR: 30, RJ: 46, RN: 8,
  RO: 8, RR: 8, RS: 31, SC: 16, SE: 8, SP: 70, TO: 8,
};

function contarPorUf(lista) {
  const contagem = {};
  for (const deputy of lista) contagem[deputy.uf] = (contagem[deputy.uf] ?? 0) + 1;
  return contagem;
}

for (const [ano, lista] of [[2022, deputies], [2026, deputies2026]]) {
  test(`${ano}: 513 eleitos, ids únicos e cadeiras de cada estado conferem com a lei`, () => {
    assert.equal(lista.length, 513);
    assert.equal(new Set(lista.map((deputy) => deputy.id)).size, 513);
    assert.ok(lista.every((deputy) => deputy.electionYear === ano));
    assert.deepEqual(contarPorUf(lista), CADEIRAS);
  });
}

test("ids do TSE não se repetem entre as duas eleições (a página do deputado depende disso)", () => {
  const de2022 = new Set(deputies.map((deputy) => deputy.id));
  assert.ok(deputies2026.every((deputy) => !de2022.has(deputy.id)));
});

test("2026: patrimônio declarado é lido do ano da eleição e histórico inclui 2022", () => {
  const comAnterior = deputies2026.filter((deputy) => deputy.previousValue !== null);
  assert.ok(comAnterior.length > 400, "a maioria tem declaração anterior");
  assert.ok(
    comAnterior.every((deputy) => deputy.previousYear < 2026),
    "a declaração anterior precisa ser de antes de 2026",
  );
  assert.ok(
    deputies2026.every((deputy) => deputy.history.every((event) => event.year <= 2026)),
  );
});

test("2026: sem código de eleição confirmado, não inventa link para a ficha do TSE", () => {
  assert.equal(candidateSourceUrl(deputies2026[0]), null);
});

test("caminho da foto usa o identificador do candidato", () => {
  const alvo = deputies[0];
  assert.equal(candidatePhotoUrl(alvo), `/deputados/${alvo.id}.jpeg`);
});

test("composição patrimonial oferece uma declaração por eleição, da mais recente para a mais antiga", () => {
  const comHistorico = deputies.find(
    (deputy) => assetEvents(deputy.history).length > 1,
  );
  assert.ok(comHistorico);

  const eventos = assetEvents(comHistorico.history);
  const anos = eventos.map((evento) => evento.year);

  assert.deepEqual(anos, [...anos].sort((a, b) => b - a), "deve vir decrescente");
  assert.equal(new Set(anos).size, anos.length, "não deve repetir ano");
  assert.ok(eventos.every((evento) => evento.assetsTotal !== null));
});

test("trocar a eleição selecionada muda o total e as categorias exibidas", () => {
  const comHistorico = deputies.find(
    (deputy) => assetEvents(deputy.history).length > 1,
  );
  const eventos = assetEvents(comHistorico.history);

  const recente = eventos[0];
  const anterior = eventos[1];

  // É assim que o Dashboard escolhe a declaração ao trocar o ano no seletor.
  const selecionar = (ano) => eventos.find((evento) => evento.year === ano);

  assert.equal(selecionar(recente.year).assetsTotal, recente.assetsTotal);
  assert.equal(selecionar(anterior.year).assetsTotal, anterior.assetsTotal);
  assert.notEqual(recente.year, anterior.year);
  assert.ok(selecionar(anterior.year).assetCategories);
});

test("declarações de bens só aparecem a partir de 2006", () => {
  for (const deputy of deputies) {
    for (const evento of assetEvents(deputy.history)) {
      assert.ok(
        evento.year >= 2006,
        `${deputy.name} tem bens declarados em ${evento.year}`,
      );
    }
  }
});

test("marcadores técnicos do TSE viram rótulo legível", () => {
  assert.equal(resultLabel("#Nulo#"), "Sem resultado apurado");
  assert.equal(resultLabel("#NULO"), "Sem resultado apurado");
  assert.equal(resultLabel("  "), "Sem resultado apurado");
  assert.equal(resultLabel("Eleito Por Qp"), "Eleito Por Qp");
});

test("nenhum marcador técnico sobra na trajetória exibida", () => {
  for (const deputy of deputies) {
    for (const evento of dedupeHistory(deputy.history)) {
      assert.doesNotMatch(
        resultLabel(evento.result),
        /#/,
        `${deputy.name} exibiria um marcador técnico`,
      );
    }
  }
});

test("trajetória consolida candidaturas repetidas de segundo turno", () => {
  const comRepeticao = deputies.find((deputy) => {
    const chaves = deputy.history.map(
      (evento) => `${evento.year}-${evento.office}-${evento.party}`,
    );
    return new Set(chaves).size < chaves.length;
  });
  assert.ok(comRepeticao, "esperado ao menos um caso de candidatura repetida");

  const consolidada = dedupeHistory(comRepeticao.history);
  const chaves = consolidada.map(
    (evento) => `${evento.year}-${evento.office}-${evento.party}`,
  );

  assert.equal(new Set(chaves).size, chaves.length, "não deve haver repetição");
  assert.ok(consolidada.length < comRepeticao.history.length);
});

test("mediana funciona com listas pares e ímpares", () => {
  assert.equal(median([1, 3, 2]), 2);
  assert.equal(median([1, 2, 3, 4]), 2.5);
  assert.equal(median([]), 0);
});
