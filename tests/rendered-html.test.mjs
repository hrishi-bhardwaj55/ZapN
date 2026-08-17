import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

async function render(path = "/") {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}-${path}`);
  const { default: worker } = await import(workerUrl.href);
  return worker.fetch(
    new Request(`http://localhost${path}`, { headers: { accept: "text/html" } }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

test("server-renders the complete Cortex practice library", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /<title>Cortex Practice Lab<\/title>/i);
  assert.match(html, /Train the decisions/);
  assert.match(html, /TRAINING LEVEL/);
  assert.match(html, /L1/);
  assert.match(html, /L(?:<!-- -->)?10/);
  for (const game of ["Balloon", "Skyscraper", "Shapeshift", "Code Compare", "Digit", "Number Box", "Figure It Out", "The Switch", "Stock Master"]) {
    assert.match(html, new RegExp(game));
  }
  assert.doesNotMatch(html, /Grill Master|Barbecue|codex-preview|react-loading-skeleton/i);
});

test("exposes simulation and developer configuration routes", async () => {
  for (const path of ["/simulation", "/admin/game-config"]) {
    const response = await render(path);
    assert.equal(response.status, 200);
    assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);
  }
});

test("keeps every game modular and precision timing out of React renders", async () => {
  const [catalog, engine, stock] = await Promise.all([
    readFile(new URL("lib/catalog.ts", root), "utf8"),
    readFile(new URL("lib/engine.ts", root), "utf8"),
    readFile(new URL("games/stock-master/StockMasterGame.tsx", root), "utf8"),
  ]);
  assert.equal((catalog.match(/id: "/g) ?? []).length, 9);
  assert.match(engine, /performance\.now\(\)/);
  assert.match(engine, /mulberry32/);
  assert.match(stock, /requestAnimationFrame/);
  assert.doesNotMatch(stock, /setInterval/);
});
