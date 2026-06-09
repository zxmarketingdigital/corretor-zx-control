#!/usr/bin/env node
// Valida instalação do Corretor ZX Control.
// Uso: WORKER_URL=https://... PANEL_TOKEN=... WEBHOOK_SECRET=... node setup/smoke.mjs

const WORKER_URL = (process.env.WORKER_URL ?? "").replace(/\/$/, "");
const PANEL_TOKEN = process.env.PANEL_TOKEN ?? "";
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET ?? "";

if (!WORKER_URL) {
  console.error("Erro: WORKER_URL não definido.");
  process.exit(1);
}

let passed = 0;
let failed = 0;

async function check(name, fn) {
  try {
    await fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ✗ ${name}: ${err.message}`);
    failed++;
  }
}

function assert(condition, msg) {
  if (!condition) throw new Error(msg);
}

console.log("\n── Corretor ZX Control — Smoke Test ──\n");

await check("Worker acessível (GET /)", async () => {
  const res = await fetch(`${WORKER_URL}/`);
  assert(res.status === 200, `HTTP ${res.status}`);
});

await check("Webhook responde 200 (POST /webhook)", async () => {
  const res = await fetch(`${WORKER_URL}/webhook`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-webhook-secret": WEBHOOK_SECRET,
    },
    body: JSON.stringify({ event: "smoke-test" }),
  });
  assert(res.status === 200, `HTTP ${res.status}`);
});

await check("API autenticada responde (GET /api/status)", async () => {
  const res = await fetch(`${WORKER_URL}/api/status`, {
    headers: { Authorization: `Bearer ${PANEL_TOKEN}` },
  });
  assert(res.status === 200, `HTTP ${res.status}`);
  const json = await res.json();
  assert("evolution" in json, "Campo 'evolution' ausente na resposta");
});

await check("API rejeita request sem token (401)", async () => {
  const res = await fetch(`${WORKER_URL}/api/status`);
  assert(res.status === 401, `Esperava 401, recebeu ${res.status}`);
});

await check("GET /api/imoveis retorna array", async () => {
  const res = await fetch(`${WORKER_URL}/api/imoveis`, {
    headers: { Authorization: `Bearer ${PANEL_TOKEN}` },
  });
  assert(res.status === 200, `HTTP ${res.status}`);
  const json = await res.json();
  assert(Array.isArray(json), "Resposta não é array");
});

console.log(`\n── Resultado: ${passed} passou, ${failed} falhou ──\n`);
if (failed > 0) process.exit(1);
