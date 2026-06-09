// 5 invariantes anti-ban/anti-spam (spec §3.1/§10).
// Mock do Supabase e adapter via funções injetáveis — sem banco real.
import { describe, expect, it } from "vitest";
import { dispatch } from "../src/scheduler/scheduler";
import type { DbLike, AdapterLike, DispatchOptions } from "../src/scheduler/types";

// ── helpers ────────────────────────────────────────────────────────────────
const NOW_9H = new Date("2026-01-01T09:00:00Z"); // dentro da janela 8–20

function baseOpts(overrides: Partial<DispatchOptions> = {}): DispatchOptions {
  return {
    clienteId: "c1",
    numero: "5511999990001",
    agente: "followup",
    mensagem: "Olá!",
    window: { start: 8, end: 20 },
    now: NOW_9H,
    ...overrides,
  };
}

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

function makeAdapter(): AdapterLike & { sent: string[] } {
  const sent: string[] = [];
  return { sent, send: async (num, msg) => void sent.push(`${num}:${msg}`) };
}

// ── (a) dedup em janela ────────────────────────────────────────────────────
describe("(a) dedup em janela", () => {
  it("bloqueia quando disparo já existe na janela", async () => {
    const db = makeDb({ existeDisparo: async () => true });
    const adapter = makeAdapter();
    const result = await dispatch(db, adapter, baseOpts());
    expect(result).toBe("bloqueado");
    expect(adapter.sent).toHaveLength(0);
  });

  it("envia quando não há disparo anterior", async () => {
    const db = makeDb();
    const adapter = makeAdapter();
    const result = await dispatch(db, adapter, baseOpts());
    expect(result).toBe("enviado");
    expect(adapter.sent).toHaveLength(1);
  });
});

// ── (b) janela inferior+superior ──────────────────────────────────────────
describe("(b) janela inferior+superior", () => {
  it("bloqueia antes da janela (hora < start)", async () => {
    const result = await dispatch(
      makeDb(),
      makeAdapter(),
      baseOpts({ now: new Date("2026-01-01T07:30:00Z") }),
    );
    expect(result).toBe("bloqueado");
  });

  it("bloqueia após a janela (hora >= end)", async () => {
    const result = await dispatch(
      makeDb(),
      makeAdapter(),
      baseOpts({ now: new Date("2026-01-01T20:00:00Z") }),
    );
    expect(result).toBe("bloqueado");
  });

  it("permite exatamente no início da janela (hora === start)", async () => {
    const result = await dispatch(
      makeDb(),
      makeAdapter(),
      baseOpts({ now: new Date("2026-01-01T08:00:00Z") }),
    );
    expect(result).toBe("enviado");
  });
});

// ── (c) idempotência radar (cliente × imóvel) ─────────────────────────────
describe("(c) idempotência radar — não reavisa cliente×imóvel", () => {
  it("bloqueia se (clienteId, imovelId) já foi notificado", async () => {
    const db = makeDb({ existeDisparo: async () => true });
    const result = await dispatch(
      db,
      makeAdapter(),
      baseOpts({ agente: "radar", imovelId: "im1" }),
    );
    expect(result).toBe("bloqueado");
  });

  it("envia se (clienteId, imovelId) ainda não foi notificado", async () => {
    const result = await dispatch(
      makeDb(),
      makeAdapter(),
      baseOpts({ agente: "radar", imovelId: "im1" }),
    );
    expect(result).toBe("enviado");
  });
});

// ── (d) rate-cap por número ───────────────────────────────────────────────
describe("(d) rate-cap por número (20/h · 80/dia)", () => {
  it("bloqueia quando envios/hora atingem 20", async () => {
    const db = makeDb({ contarEnviosHora: async () => 20 });
    expect(await dispatch(db, makeAdapter(), baseOpts())).toBe("bloqueado");
  });

  it("bloqueia quando envios/dia atingem 80", async () => {
    const db = makeDb({ contarEnviosDia: async () => 80 });
    expect(await dispatch(db, makeAdapter(), baseOpts())).toBe("bloqueado");
  });

  it("envia quando abaixo dos limites", async () => {
    const db = makeDb({ contarEnviosHora: async () => 19, contarEnviosDia: async () => 79 });
    expect(await dispatch(db, makeAdapter(), baseOpts())).toBe("enviado");
  });
});

// ── (e) opt-out "SAIR" ────────────────────────────────────────────────────
describe("(e) opt-out SAIR bloqueia todo proativo", () => {
  it("bloqueia quando cliente tem opt_out=true", async () => {
    const db = makeDb({ clienteOptOut: async () => true });
    expect(await dispatch(db, makeAdapter(), baseOpts())).toBe("bloqueado");
  });

  it("envia quando opt_out=false", async () => {
    expect(await dispatch(makeDb(), makeAdapter(), baseOpts())).toBe("enviado");
  });
});
