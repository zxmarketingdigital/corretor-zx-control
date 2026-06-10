// Testa o roteador da API: autenticação, roteamento, respostas básicas.
import { describe, expect, it } from "vitest";
import { handleApi } from "../src/api/router";
import type { ApiDeps } from "../src/api/router";

function makeReq(method: string, path: string, token = "test-token", body?: unknown): Request {
  return new Request(`https://worker.example.com${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
}

function makeDeps(overrides: Partial<ApiDeps> = {}): ApiDeps {
  return {
    panelToken: "test-token",
    listImoveis: async () => [],
    createImovel: async () => ({ id: "i1" }),
    listClientes: async () => [],
    createCliente: async () => ({ id: "c1" }),
    listConversas: async () => [],
    listVisitas: async () => [],
    createVisita: async () => ({ id: "v1" }),
    updateVisitaStatus: async () => {},
    listDisparos: async () => [],
    adapterStatus: async () => "connected",
    getConfig: async () => ({}),
    setConfig: async () => {},
    ...overrides,
  };
}

describe("API — autenticação", () => {
  it("retorna 401 sem token Authorization", async () => {
    const req = new Request("https://worker.example.com/api/imoveis");
    const res = await handleApi(req, makeDeps());
    expect(res.status).toBe(401);
  });

  it("retorna 401 com token errado", async () => {
    const req = makeReq("GET", "/api/imoveis", "wrong-token");
    const res = await handleApi(req, makeDeps());
    expect(res.status).toBe(401);
  });

  it("retorna 200 com token correto", async () => {
    const res = await handleApi(makeReq("GET", "/api/imoveis"), makeDeps());
    expect(res.status).toBe(200);
  });
});

describe("API — rotas", () => {
  it("GET /api/imoveis retorna array JSON", async () => {
    const deps = makeDeps({ listImoveis: async () => [{ id: "i1", titulo: "Casa" }] as never });
    const res = await handleApi(makeReq("GET", "/api/imoveis"), deps);
    expect(res.status).toBe(200);
    const json = await res.json() as unknown[];
    expect(Array.isArray(json)).toBe(true);
  });

  it("GET /api/status retorna { evolution: string }", async () => {
    const res = await handleApi(makeReq("GET", "/api/status"), makeDeps());
    const json = await res.json() as { evolution: string };
    expect(json).toHaveProperty("evolution");
  });

  it("GET /api/rota-inexistente retorna 404", async () => {
    const res = await handleApi(makeReq("GET", "/api/nao-existe"), makeDeps());
    expect(res.status).toBe(404);
  });

  it("POST /api/clientes cria cliente e retorna 201", async () => {
    let received: unknown;
    const deps = makeDeps({
      createCliente: async (data) => { received = data; return { id: "c1" }; },
    });
    const body = { nome: "Teste", telefone: "5511999999999", elegivel_proativo: true };
    const res = await handleApi(makeReq("POST", "/api/clientes", "test-token", body), deps);
    expect(res.status).toBe(201);
    expect(received).toEqual(body);
    const json = await res.json() as { id: string };
    expect(json.id).toBe("c1");
  });

  it("POST /api/visitas cria visita e retorna 201", async () => {
    let received: unknown;
    const deps = makeDeps({
      createVisita: async (data) => { received = data; return { id: "v1", status: "agendada" }; },
    });
    const body = { cliente_id: "c1", imovel_id: "i1", local: "Plantão Jardins", agendada_para: "2026-06-12T14:00:00Z" };
    const res = await handleApi(makeReq("POST", "/api/visitas", "test-token", body), deps);
    expect(res.status).toBe(201);
    expect(received).toEqual(body);
    const json = await res.json() as { status: string };
    expect(json.status).toBe("agendada");
  });
});
