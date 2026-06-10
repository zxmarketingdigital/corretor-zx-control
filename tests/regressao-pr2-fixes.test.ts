// Testes de regressão dos fixes do review do PR #2.
// Cada bloco FALHA na versão anterior do código — trava o invariante que estava quebrado.
import { describe, expect, it, vi } from "vitest";
import worker from "../src/index";
import { dispatch } from "../src/scheduler/scheduler";
import { gerarChave } from "../src/scheduler/dedup";
import type { DbLike, AdapterLike, DispatchOptions } from "../src/scheduler/types";
import { parseXmlFeedImoveis } from "../src/adapters/catalog/xml";
import { parseCsvImoveis } from "../src/adapters/catalog/csv";

const NOW = new Date("2026-01-15T15:00:00Z"); // 12:00 BRT — dentro da janela 8–18

function baseOpts(overrides: Partial<DispatchOptions> = {}): DispatchOptions {
  return {
    clienteId: "c1",
    numero: "5511999990001",
    agente: "followup",
    mensagem: "Olá!",
    window: { start: 8, end: 18 },
    now: NOW,
    ...overrides,
  };
}

function makeAdapter(): AdapterLike & { sent: string[] } {
  const sent: string[] = [];
  return { sent, send: async (num, msg) => void sent.push(`${num}:${msg}`) };
}

// ── B1 — endpoints de import exigem Bearer (antes: auth bypass / escrita de PII) ──
describe("B1 — auth obrigatória nos endpoints de import", () => {
  const env = { PANEL_TOKEN: "segredo" } as Parameters<typeof worker.fetch>[1];

  it("rejeita POST /api/import/imoveis sem Authorization", async () => {
    const req = new Request("https://x/api/import/imoveis", { method: "POST", body: "x" });
    const res = await worker.fetch(req, env);
    expect(res.status).toBe(401);
  });

  it("rejeita POST /api/import/clientes com Bearer errado", async () => {
    const req = new Request("https://x/api/import/clientes", {
      method: "POST",
      headers: { Authorization: "Bearer errado" },
      body: "x",
    });
    const res = await worker.fetch(req, env);
    expect(res.status).toBe(401);
  });

  it("H2 — fail-closed: PANEL_TOKEN vazio nega 'Bearer ' vazio", async () => {
    const req = new Request("https://x/api/import/imoveis", {
      method: "POST",
      headers: { Authorization: "Bearer " },
      body: "x",
    });
    const res = await worker.fetch(req, { PANEL_TOKEN: "" } as Parameters<typeof worker.fetch>[1]);
    expect(res.status).toBe(401);
  });
});

// ── B2 — rate-cap é GLOBAL da instância, não por destinatário ──
describe("B2 — rate-cap global da linha emissora", () => {
  function statefulDb() {
    let enviados = 0;
    const chaves = new Set<string>();
    const db: DbLike = {
      existeDisparo: async (_c, _a, chave) => chaves.has(chave),
      contarEnviosHora: async () => enviados,
      contarEnviosDia: async () => enviados,
      clienteOptOut: async () => false,
      registrarDisparo: async (p) => {
        enviados++;
        chaves.add(p.chave);
      },
    };
    return { db, total: () => enviados };
  }

  it("bloqueia o 21º envio mesmo sendo destinatários diferentes", async () => {
    const { db, total } = statefulDb();
    const adapter = makeAdapter();
    let bloqueados = 0;
    for (let i = 0; i < 25; i++) {
      // cada disparo é para um cliente/número distinto — no bug antigo (cap por número)
      // o cap NUNCA dispararia e os 25 sairiam.
      const r = await dispatch(db, adapter, baseOpts({ clienteId: `c${i}`, numero: `55${i}` }));
      if (r === "bloqueado") bloqueados++;
    }
    expect(total()).toBe(20); // cap global 20/h respeitado
    expect(bloqueados).toBe(5);
  });

  it("contarEnviosHora é chamado só com a data (sem número)", async () => {
    const spy = vi.fn(async (_desde: Date) => 0);
    const db: DbLike = {
      existeDisparo: async () => false,
      contarEnviosHora: spy,
      contarEnviosDia: async () => 0,
      clienteOptOut: async () => false,
      registrarDisparo: async () => {},
    };
    await dispatch(db, makeAdapter(), baseOpts());
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy.mock.calls[0]).toHaveLength(1);
    expect(spy.mock.calls[0]![0]).toBeInstanceOf(Date);
  });
});

// ── B3 — anti-ban: espaçamento (delay) após cada envio ──
describe("B3 — delay/jitter após envio", () => {
  function makeDb(overrides: Partial<DbLike> = {}): DbLike {
    return {
      existeDisparo: async () => false,
      contarEnviosHora: async () => 0,
      contarEnviosDia: async () => 0,
      clienteOptOut: async () => false,
      registrarDisparo: async () => {},
      ...overrides,
    };
  }

  it("chama sleep com delayMs após enviar", async () => {
    const sleep = vi.fn(async () => {});
    const r = await dispatch(makeDb(), makeAdapter(), baseOpts({ delayMs: 5000, sleep }));
    expect(r).toBe("enviado");
    expect(sleep).toHaveBeenCalledWith(5000);
  });

  it("NÃO chama sleep quando o envio é bloqueado", async () => {
    const sleep = vi.fn(async () => {});
    const db = makeDb({ clienteOptOut: async () => true });
    const r = await dispatch(db, makeAdapter(), baseOpts({ delayMs: 5000, sleep }));
    expect(r).toBe("bloqueado");
    expect(sleep).not.toHaveBeenCalled();
  });
});

// ── H3 — dedup pós-venda distingue toque 1 (D+3) de toque 2 (D+30) ──
describe("H3 — chave de dedup do pós-venda inclui o toque", () => {
  it("toque 1 e toque 2 no mesmo mês geram chaves diferentes", () => {
    const k1 = gerarChave("c1", "posvenda", NOW, undefined, 1);
    const k2 = gerarChave("c1", "posvenda", NOW, undefined, 2);
    expect(k1).not.toBe(k2);
  });
});

// ── B4 — import sempre popula `regiao` (coluna que o match consulta) ──
describe("B4 — região preenchida no import (match não fica órfão)", () => {
  it("XML deriva regiao de Bairro quando não há tag de região", () => {
    const xml =
      "<Imoveis><Imovel><CodigoImovel>A1</CodigoImovel><TituloImovel>Apto</TituloImovel>" +
      "<TipoImovel>Apartamento</TipoImovel><Categoria>Venda</Categoria>" +
      "<PrecoVenda>500000</PrecoVenda><Bairro>Centro</Bairro><Cidade>SP</Cidade></Imovel></Imoveis>";
    const { imoveis, erros } = parseXmlFeedImoveis(xml);
    expect(erros).toHaveLength(0);
    expect(imoveis[0]!.regiao).toBe("Centro");
  });

  it("CSV usa bairro como fallback de regiao", () => {
    const csv = "titulo,tipo,transacao,preco,bairro\nApto,apartamento,venda,500000,Centro";
    const { imoveis } = parseCsvImoveis(csv);
    expect(imoveis[0]!.regiao).toBe("Centro");
  });
});
