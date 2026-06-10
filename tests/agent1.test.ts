// Guardrails CDC/CRECI e fluxo do Agente 1.
import { describe, expect, it } from "vitest";
import { handleWebhook } from "../src/agents/agent1";
import type { Agent1Deps } from "../src/agents/agent1";

function makeDeps(overrides: Partial<Agent1Deps> = {}): Agent1Deps {
  return {
    parseWebhook: () => ({ from: "5511999990001", text: "quero comprar", messageId: "m1" }),
    getOrCreateCliente: async () => ({ id: "c1", opt_out: false, nome: "João" }),
    getHistorico: async () => [],
    gemini: async () => '{"transacao":"venda","regiao":"centro","orcamento_max":500000}',
    matchImoveis: async () => [],
    upsertPerfilCliente: async () => {},
    saveMsg: async () => {},
    send: async () => {},
    setOptOut: async () => {},
    nomeCorretor: "Carlos",
    ...overrides,
  };
}

describe("Agente 1 — guardrails CDC/CRECI", () => {
  it("ignora webhook inválido (parseWebhook → null)", async () => {
    const sent: string[] = [];
    const deps = makeDeps({
      parseWebhook: () => null,
      send: async (_, msg) => void sent.push(msg),
    });
    await handleWebhook({} as unknown, deps);
    expect(sent).toHaveLength(0);
  });

  it("não responde quando cliente tem opt_out=true", async () => {
    const sent: string[] = [];
    const deps = makeDeps({
      getOrCreateCliente: async () => ({ id: "c1", opt_out: true, nome: "Ana" }),
      send: async (_, msg) => void sent.push(msg),
    });
    await handleWebhook({} as unknown, deps);
    expect(sent).toHaveLength(0);
  });

  it("seta opt_out quando lead digita SAIR (case insensitive)", async () => {
    let optOutSet = false;
    const deps = makeDeps({
      parseWebhook: () => ({ from: "5511999990001", text: "SAIR", messageId: "m2" }),
      setOptOut: async () => void (optOutSet = true),
    });
    await handleWebhook({} as unknown, deps);
    expect(optOutSet).toBe(true);
  });

  it("guardrail: catálogo vazio → mensagem sem afirmar disponibilidade", async () => {
    const sent: string[] = [];
    const deps = makeDeps({
      matchImoveis: async () => [],
      gemini: async (prompt) => {
        // resposta de redação — não deve conter "disponível" se catálogo vazio
        if (prompt.includes("nenhum imóvel")) return "No momento não temos imóveis cadastrados para o seu perfil.";
        return '{"transacao":"venda"}';
      },
      send: async (_, msg) => void sent.push(msg),
    });
    await handleWebhook({} as unknown, deps);
    const resposta = sent.join(" ");
    // Não deve afirmar "temos disponível" quando catálogo está vazio
    expect(resposta).not.toMatch(/temos.*disponível/i);
  });

  it("guardrail: pergunta sobre financiamento → inclui disclaimer", async () => {
    const sent: string[] = [];
    const deps = makeDeps({
      parseWebhook: () => ({ from: "5511999990001", text: "vocês aprovam financiamento?", messageId: "m3" }),
      gemini: async () => "Financiamento depende de análise de crédito — o corretor vai te orientar.",
      send: async (_, msg) => void sent.push(msg),
    });
    await handleWebhook({} as unknown, deps);
    const resposta = sent.join(" ");
    expect(resposta.toLowerCase()).toMatch(/corretor|análise|crédito/);
  });
});
