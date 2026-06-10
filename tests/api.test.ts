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
    listConversas: async () => [],
    listVisitas: async () => [],
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
});
