import assert from "node:assert/strict";
import test from "node:test";

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

test("renderiza a página principal com conteúdo e metadados próprios", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>Raio-X Patrimonial<\/title>/i);
  assert.match(html, /O patrimônio/);
  assert.match(html, /513/);
  assert.match(html, /Explore os deputados/);
  assert.match(html, /Trajetória eleitoral/);
  assert.match(html, /Como os dados foram tratados/);
  assert.match(html, /dadosabertos\.tse\.jus\.br/);
  assert.doesNotMatch(html, /codex-preview|react-loading-skeleton/i);
});
