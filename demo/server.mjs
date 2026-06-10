// Mock server da DEMO local do Corretor ZX Control.
// Espelha o contrato de src/api/router.ts (rotas /api/* + Bearer auth) servindo
// dados fictícios em memória, e serve os arquivos estáticos do painel/.
// NÃO toca em src/ — é só andaime de demonstração.

import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { join, extname, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import * as DB from "./data.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PAINEL = join(__dirname, "..", "painel");
const PORT = Number(process.env.PORT ?? 8910);
const TOKEN = "demo-corretor-2026"; // mesmo valor em painel/config.js

// estado mutável em memória (PUTs/POSTs da demo persistem enquanto o server vive)
const imoveis = DB.imoveis.map((i) => ({ ...i }));
const clientes = DB.clientes.map((c) => ({ ...c }));
const visitas = DB.visitas.map((v) => ({ ...v }));
let config = { ...DB.config };
let imovelSeq = imoveis.length, clienteSeq = clientes.length, visitaSeq = visitas.length; // ids novos não colidem com os seed

const MIME = { ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "application/javascript; charset=utf-8", ".json": "application/json; charset=utf-8", ".svg": "image/svg+xml", ".ico": "image/x-icon" };

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Authorization, Content-Type",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
};

function json(res, data, status = 200) {
  res.writeHead(status, { "Content-Type": "application/json", ...CORS });
  res.end(JSON.stringify(data));
}

function readBody(req) {
  return new Promise((resolve) => {
    let b = ""; req.on("data", (c) => (b += c)); req.on("end", () => { try { resolve(b ? JSON.parse(b) : {}); } catch { resolve({}); } });
  });
}

async function serveStatic(req, res) {
  let p = req.url === "/" ? "/index.html" : req.url.split("?")[0];
  try {
    const buf = await readFile(join(PAINEL, p));
    res.writeHead(200, { "Content-Type": MIME[extname(p)] ?? "application/octet-stream" });
    res.end(buf);
  } catch {
    res.writeHead(404); res.end("Not found");
  }
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);

  if (!url.pathname.startsWith("/api")) return serveStatic(req, res);

  if (req.method === "OPTIONS") { res.writeHead(204, CORS); return res.end(); }

  // Bearer auth (fail-closed, igual ao router.ts)
  if ((req.headers.authorization ?? "") !== `Bearer ${TOKEN}`) return json(res, { error: "Unauthorized" }, 401);

  const path = url.pathname.replace(/^\/api/, "");
  const m = req.method;

  if (m === "GET" && path === "/imoveis")  return json(res, imoveis);
  if (m === "POST" && path === "/imoveis") { const d = await readBody(req); const novo = { status: "ativo", origem: "manual", ...d, id: "i" + (++imovelSeq), atualizado_em: new Date().toISOString(), preco: Number(d.preco ?? 0) }; imoveis.push(novo); return json(res, novo, 201); }
  if (m === "GET" && path === "/clientes") return json(res, clientes);
  if (m === "POST" && path === "/clientes") { const d = await readBody(req); const novo = { estado: "novo", opt_out: false, origem: "manual", ...d, id: "c" + (++clienteSeq), consentimento: !!d.elegivel_proativo }; clientes.push(novo); return json(res, novo, 201); }

  if (m === "GET" && path === "/conversas") {
    const cid = url.searchParams.get("clienteId");
    if (cid) return json(res, DB.mensagens[cid] ?? []); // o painel passa o id da conversa aqui
    return json(res, DB.conversas);
  }

  if (m === "GET" && path === "/visitas") return json(res, visitas);
  if (m === "POST" && path === "/visitas") { const d = await readBody(req); const novo = { status: "agendada", ...d, id: "v" + (++visitaSeq), cliente_nome: clientes.find((c) => c.id === d.cliente_id)?.nome ?? d.cliente_id }; visitas.push(novo); return json(res, novo, 201); }
  const vm = path.match(/^\/visitas\/([^/]+)\/status$/);
  if (m === "PUT" && vm) { const { status } = await readBody(req); const v = visitas.find((x) => x.id === vm[1]); if (v) v.status = status; return json(res, { ok: true }); }

  if (m === "GET" && path === "/disparos") return json(res, [...DB.disparos].sort((a, b) => new Date(b.criado_em) - new Date(a.criado_em)));
  if (m === "GET" && path === "/status")   return json(res, { evolution: DB.adapterStatus });
  if (m === "GET" && path === "/config")   return json(res, config);
  if (m === "PUT" && path === "/config")   { config = { ...config, ...(await readBody(req)) }; return json(res, { ok: true }); }

  return json(res, { error: "Not Found" }, 404);
});

server.listen(PORT, () => {
  console.log(`\n  🏠 Corretor ZX Control — DEMO local`);
  console.log(`  Painel:  http://localhost:${PORT}/`);
  console.log(`  API:     http://localhost:${PORT}/api/*  (Bearer ${TOKEN})`);
  console.log(`  ${imoveis.length} imóveis · ${clientes.length} clientes · ${DB.conversas.length} conversas · ${visitas.length} visitas · ${DB.disparos.length} disparos\n`);
});
