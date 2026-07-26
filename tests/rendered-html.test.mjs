import assert from "node:assert/strict";
import test from "node:test";

import deputies from "../app/data/deputados.json" with { type: "json" };
import {
  candidatePhotoUrl,
  candidateSourceUrl,
  sortDeputies,
} from "../app/lib/deputados.ts";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("http://localhost/", {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

// O perfil aberto por padrão é o de maior patrimônio declarado. Calculamos a
// partir dos dados para o teste não quebrar quando a base for atualizada.
const perfilInicial = sortDeputies(deputies, "value")[0];

let html;

test("renderiza a página principal com conteúdo e metadados próprios", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  html = await response.text();
  assert.match(html, /<title>Raio-X Patrimonial<\/title>/i);
  assert.match(html, /O patrimônio/);
  assert.match(html, /513/);
  assert.match(html, /Explore os deputados/);
  assert.match(html, /Evolução patrimonial declarada/);
  assert.match(html, /Trajetória eleitoral/);
  assert.match(html, /Como os dados foram tratados/);
  assert.match(html, /Dados e desenvolvimento por/);
  assert.match(html, /Vitor Barbosa/);
  assert.match(html, /dadosabertos\.tse\.jus\.br/);
  assert.doesNotMatch(html, /codex-preview|react-loading-skeleton/i);
});

test("o perfil aberto traz o link individual da ficha do candidato no TSE", async () => {
  html ??= await (await render()).text();

  assert.match(html, /Ficha no TSE/);
  assert.ok(
    html.includes(candidateSourceUrl(perfilInicial)),
    `esperado o link do TSE de ${perfilInicial.name}`,
  );
});

test("não sobraram links do formato antigo do TSE, que estava quebrado", async () => {
  html ??= await (await render()).text();

  // O sistema do TSE mudou de rota; estes formatos levavam a "erro ao carregar".
  assert.doesNotMatch(html, /#\/candidato\/2022\/2040602022\//);
  assert.doesNotMatch(html, /divulgacandcontas[^"']*\/(bens|prestacao)\b/);
});

test("a foto do deputado tem caminho e texto alternativo", async () => {
  html ??= await (await render()).text();

  assert.ok(html.includes(candidatePhotoUrl(perfilInicial)));
  assert.match(html, new RegExp(`alt="Foto de ${perfilInicial.name}"`));
});

test("a composição patrimonial é exibida com seletor de eleição", async () => {
  html ??= await (await render()).text();

  assert.match(html, /Composição patrimonial/);
  assert.match(html, /Total declarado/);
  assert.match(html, /<select/);
});

test("o gráfico informa que a escala é individual", async () => {
  html ??= await (await render()).text();

  assert.match(html, /escala vertical é individual/);
});

test("nenhum marcador técnico do TSE é exibido ao usuário", async () => {
  html ??= await (await render()).text();

  // O marcador ainda existe nos dados embutidos para a hidratação do React
  // (`"result":"#Nulo#"`), o que é esperado. O que não pode acontecer é ele
  // chegar à tela como texto renderizado.
  assert.doesNotMatch(html, />\s*#Nulo/i);
  assert.match(html, /#Nulo#/i, "os dados crus seguem preservados");
});

test("deputado sem declaração anterior é mostrado como não comparável", async () => {
  html ??= await (await render()).text();

  const semAnterior = deputies.some((deputy) => deputy.previousValue === null);
  assert.ok(semAnterior, "a base deveria ter deputados sem declaração anterior");

  // A lista inicial exibe esse rótulo em vez de inventar uma variação.
  assert.match(html, /sem comparação/);
});
