import { describe, expect, it } from "vitest";
import { runAntiNoshow } from "../src/crons/anti-noshow";
import type { AntiNoshowDeps, VisitaAgendada } from "../src/crons/anti-noshow";

const NOW = new Date("2026-01-10T10:00:00Z");

function visita(horasAFrente: number, id = "v1"): VisitaAgendada {
  const agendada_para = new Date(NOW.getTime() + horasAFrente * 3_600_000);
  return { id, clienteId: "c1", numero: "5511999990001", local: "Rua A, 10", agendada_para };
}

function makeDeps(overrides: Partial<AntiNoshowDeps> = {}): AntiNoshowDeps {
  return {
    listarVisitasProximas: async () => [],
    dispatch: async () => "enviado",
    nomeCorretor: "Carlos",
    now: NOW,
    ...overrides,
  };
}

describe("runAntiNoshow", () => {
  it("dispara confirmação para visita a ≤ 36h no futuro", async () => {
    const dispatched: string[] = [];
    const deps = makeDeps({
      listarVisitasProximas: async () => [visita(24)],
      dispatch: async (opts) => { dispatched.push(opts.clienteId); return "enviado"; },
    });
    await runAntiNoshow(deps);
    expect(dispatched).toContain("c1");
  });

  it("não dispara para visita além de 36h (fora da janela de confirmação)", async () => {
    const dispatched: string[] = [];
    const deps = makeDeps({
      listarVisitasProximas: async () => [visita(37)],
      dispatch: async (opts) => { dispatched.push(opts.clienteId); return "enviado"; },
    });
    await runAntiNoshow(deps);
    expect(dispatched).toHaveLength(0);
  });

  it("respeita resultado 'bloqueado' do scheduler (rate-cap/dedup)", async () => {
    let called = 0;
    const deps = makeDeps({
      listarVisitasProximas: async () => [visita(10), visita(15, "v2")],
      dispatch: async () => { called++; return "bloqueado"; },
    });
    await runAntiNoshow(deps);
    // Tentou disparar ambas, mas foram bloqueadas pelo scheduler
    expect(called).toBe(2);
  });
});
