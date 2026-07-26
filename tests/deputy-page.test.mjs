import assert from "node:assert/strict";
import test from "node:test";

import deputies from "../app/data/deputados.json" with { type: "json" };
import {
  candidateSourceUrl,
  money,
  sortDeputies,
} from "../app/lib/deputados.ts";

async function fetchPath(path) {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}-${path}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request(`http://localhost${path}`, {
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

const exemplo = sortDeputies(deputies, "value")[0];

test("cada deputado tem uma página própria que responde 200", async () => {
  const response = await fetchPath(`/deputado/${exemplo.id}`);

  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);
});

test("a página traz o nome do deputado no título, para o link compartilhado", async () => {
  const response = await fetchPath(`/deputado/${exemplo.id}`);
  const html = await response.text();

  assert.match(html, new RegExp(`<title>${exemplo.name}[^<]*</title>`, "i"));
  assert.match(html, /Raio-X Patrimonial<\/title>/i);
});

test("a descrição da página resume os dados daquele deputado", async () => {
  const response = await fetchPath(`/deputado/${exemplo.id}`);
  const html = await response.text();

  const description = html.match(
    /<meta name="description" content="([^"]+)"/i,
  )?.[1];

  assert.ok(description, "a página deveria ter meta description");
  assert.ok(
    description.includes(exemplo.party) && description.includes(exemplo.uf),
    "a descrição deveria citar partido e estado",
  );
  assert.ok(
    description.includes(money.format(exemplo.value2022).replace(/ /g, " ")) ||
      description.includes(money.format(exemplo.value2022)),
    "a descrição deveria citar o patrimônio declarado",
  );
});

test("a página mostra o perfil completo e o caminho de volta", async () => {
  const response = await fetchPath(`/deputado/${exemplo.id}`);
  const html = await response.text();

  assert.match(html, /Evolução patrimonial declarada/);
  assert.match(html, /Composição patrimonial/);
  assert.match(html, /Trajetória eleitoral/);
  assert.match(html, /Voltar ao explorador/);
  assert.ok(html.includes(candidateSourceUrl(exemplo)), "link do TSE ausente");
});

test("identificador inexistente devolve 404", async () => {
  const response = await fetchPath("/deputado/000000000000");
  assert.equal(response.status, 404);
});

test("o explorador oferece o link permanente do deputado aberto", async () => {
  const response = await fetchPath("/");
  const html = await response.text();

  assert.ok(
    html.includes(`href="/deputado/${exemplo.id}"`),
    "o perfil do explorador deveria apontar para a página do deputado",
  );
});

test("todo deputado da base tem um identificador utilizável na URL", () => {
  for (const deputy of deputies) {
    assert.match(
      deputy.id,
      /^[0-9]+$/,
      `id inesperado para ${deputy.name}: ${deputy.id}`,
    );
  }
});
