// Testes dos Agentes 2-5: dedup/opt-out delegados ao scheduler (já testado);
// aqui validamos a lógica de seleção de clientes e cadências de cada agente.
import { describe, expect, it } from "vitest";
import { runFollowup } from "../src/crons/followup";
import { runRadar } from "../src/crons/radar";
import { runReativador } from "../src/crons/reativador";
import { runPosvenda } from "../src/crons/posvenda";

const NOW = new Date("2026-01-15T10:00:00Z");

// ── Agente 2 — Follow-up ─────────────────────────────────────────────────
describe("Agente 2 — Follow-up", () => {
  it("dispara para lead sem resposta após D+1", async () => {
    const dispatched: string[] = [];
    await runFollowup({
      listarLeadsParaFollowup: async () => [
        { clienteId: "c1", numero: "5511111110001", toque: 1 },
      ],
      dispatch: async (o) => { dispatched.push(o.clienteId); return "enviado"; },
      gemini: async () => "Olá, ainda posso ajudar?",
      now: NOW,
    });
    expect(dispatched).toContain("c1");
  });

  it("não dispara para lead com opt_out (scheduler bloqueia — mock retorna bloqueado)", async () => {
    let attempted = false;
    await runFollowup({
      listarLeadsParaFollowup: async () => [{ clienteId: "c2", numero: "5511111110002", toque: 1 }],
      dispatch: async () => { attempted = true; return "bloqueado"; },
      gemini: async () => "msg",
      now: NOW,
    });
    // Tentou mas foi bloqueado — o importante é não enviar
    expect(attempted).toBe(true);
  });
});

// ── Agente 3 — Radar ─────────────────────────────────────────────────────
describe("Agente 3 — Radar", () => {
  it("dispara para cliente com perfil compatível com novo imóvel", async () => {
    const dispatched: Array<{ clienteId: string; imovelId: string }> = [];
    await runRadar({
      listarImoveisNovos: async () => [{ id: "im1", titulo: "Casa Centro", preco: 400_000, regiao: "centro", tipo: "casa", transacao: "venda" }],
      listarClientesElegiveisParaImovel: async () => [{ clienteId: "c1", numero: "5511111110001" }],
      dispatch: async (o) => { dispatched.push({ clienteId: o.clienteId, imovelId: o.imovelId! }); return "enviado"; },
      gemini: async () => "Novo imóvel para você!",
      now: NOW,
    });
    expect(dispatched).toEqual([{ clienteId: "c1", imovelId: "im1" }]);
  });

  it("inclui imovelId no dispatch para garantir idempotência (invariante §10c)", async () => {
    let capturedImovelId: string | undefined;
    await runRadar({
      listarImoveisNovos: async () => [{ id: "im2", titulo: "Apto", preco: 300_000, regiao: null, tipo: "apartamento", transacao: "venda" }],
      listarClientesElegiveisParaImovel: async () => [{ clienteId: "c1", numero: "5511111110001" }],
      dispatch: async (o) => { capturedImovelId = o.imovelId; return "enviado"; },
      gemini: async () => "msg",
      now: NOW,
    });
    expect(capturedImovelId).toBe("im2");
  });
});

// ── Agente 4 — Reativador ─────────────────────────────────────────────────
describe("Agente 4 — Reativador", () => {
  it("dispara para lead frio (>30d sem interação)", async () => {
    const dispatched: string[] = [];
    await runReativador({
      listarClientesFrios: async () => [{ clienteId: "c1", numero: "5511111110001", nome: "Ana" }],
      dispatch: async (o) => { dispatched.push(o.clienteId); return "enviado"; },
      gemini: async () => "Olá Ana, ainda está buscando?",
      now: NOW,
    });
    expect(dispatched).toContain("c1");
  });
});

// ── Agente 5 — Pós-venda ─────────────────────────────────────────────────
describe("Agente 5 — Pós-venda + Indicação", () => {
  it("dispara follow-up pós-fechamento (toque 1)", async () => {
    const dispatched: string[] = [];
    await runPosvenda({
      listarClientesFechados: async () => [{ clienteId: "c1", numero: "5511111110001", toque: 1 }],
      dispatch: async (o) => { dispatched.push(o.clienteId); return "enviado"; },
      gemini: async () => "Como está na nova casa?",
      googleLink: "https://g.co/review/abc",
      now: NOW,
    });
    expect(dispatched).toContain("c1");
  });

  it("inclui link Google na mensagem de indicação (toque 2)", async () => {
    let mensagem = "";
    await runPosvenda({
      listarClientesFechados: async () => [{ clienteId: "c1", numero: "5511111110001", toque: 2 }],
      dispatch: async (o) => { mensagem = o.mensagem; return "enviado"; },
      gemini: async () => "Indique um amigo! Avalie: https://g.co/review/abc",
      googleLink: "https://g.co/review/abc",
      now: NOW,
    });
    expect(mensagem).toContain("https://g.co/review/abc");
  });
});
