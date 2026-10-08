// Testa setup/evolution-check.mjs sem rede. Rodar: node --test setup/evolution-check.selftest.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { verificarEvolution } from "./evolution-check.mjs";

const resp = (corpo, { status = 200, json = true } = {}) => async () => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => { if (!json) throw new SyntaxError("x"); return corpo; },
});
const v = (fetchFn, inst = "corretor-teste") => verificarEvolution("https://evo.exemplo.test/", inst, "k", fetchFn);

test("v2 plano com estado open passa", async () => {
  assert.deepEqual(await v(resp([{ name: "corretor-teste", connectionStatus: "open" }])), { ok: true, estado: "open" });
});
test("v1 aninhado com estado close passa (QR ainda não escaneado)", async () => {
  assert.equal((await v(resp([{ instance: { instanceName: "corretor-teste", status: "close" } }]))).ok, true);
});
test("lista vazia NÃO é sucesso", async () => {
  const r = await v(resp([]));
  assert.equal(r.ok, false);
  assert.match(r.motivo, /vazia/);
});
test("corpo não-JSON NÃO é sucesso (antes virava [] e passava)", async () => {
  const r = await v(resp(null, { json: false }));
  assert.equal(r.ok, false);
  assert.match(r.motivo, /JSON/);
});
test("objeto em vez de lista NÃO é sucesso", async () => {
  assert.equal((await v(resp({ message: "ok" }))).ok, false);
});
test("instância ausente da lista NÃO é sucesso", async () => {
  const r = await v(resp([{ name: "outra", connectionStatus: "open" }]));
  assert.equal(r.ok, false);
  assert.match(r.motivo, /corretor-teste/);
});
test("instância sem estado ou com estado desconhecido NÃO é sucesso", async () => {
  assert.equal((await v(resp([{ name: "corretor-teste" }]))).ok, false);
  assert.equal((await v(resp([{ name: "corretor-teste", connectionStatus: "banana" }]))).ok, false);
});
test("HTTP erro e nome/URL vazios NÃO são sucesso", async () => {
  assert.equal((await v(resp([], { status: 401 }))).ok, false);
  assert.equal((await v(resp([{ name: "", connectionStatus: "open" }]), "")).ok, false);
  assert.equal((await verificarEvolution("", "x", "k", resp([]))).ok, false);
});
test("monta a URL sem barra dupla e envia a apikey", async () => {
  let visto;
  await verificarEvolution("https://evo.exemplo.test//", "i", "seg", async (u, o) => { visto = [u, o.headers.apikey]; return resp([])(); });
  assert.deepEqual(visto, ["https://evo.exemplo.test/instance/fetchInstances", "seg"]);
});
