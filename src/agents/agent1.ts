// Agente 1 — Atendente + Qualificador (reativo, webhook WhatsApp).
// Guardrails CDC/CRECI hardcoded (spec §4):
//   - Não afirma disponibilidade sem checar catálogo.
//   - Não promete aprovação de financiamento.
//   - Sempre encaminha negociação ao corretor humano.
import type { IncomingMessage } from "../adapters/whatsapp/types";
import { buildMatchFilter, rankImoveis } from "../matching/sql";
import type { Imovel, PerfilBusca } from "../matching/sql";

const SAIR_REGEX = /^\s*sair\s*$/i;
const FINANCIAMENTO_REGEX = /financiamento|aprovação|crédito|análise de crédito/i;

export interface ClienteBasico {
  id: string;
  opt_out: boolean;
  nome?: string | null;
}

export interface Agent1Deps {
  parseWebhook(body: unknown): IncomingMessage | null;
  getOrCreateCliente(telefone: string): Promise<ClienteBasico>;
  getHistorico(clienteId: string): Promise<Array<{ direcao: "entrada" | "saida"; conteudo: string }>>;
  gemini(prompt: string): Promise<string>;
  matchImoveis(perfil: PerfilBusca): Promise<Imovel[]>;
  upsertPerfilCliente(clienteId: string, perfil: Partial<PerfilBusca>): Promise<void>;
  saveMsg(clienteId: string, direcao: "entrada" | "saida", conteudo: string): Promise<void>;
  send(numero: string, mensagem: string): Promise<void>;
  setOptOut(clienteId: string): Promise<void>;
  nomeCorretor: string;
}

export async function handleWebhook(body: unknown, deps: Agent1Deps): Promise<void> {
  const msg = deps.parseWebhook(body);
  if (!msg) return;

  const cliente = await deps.getOrCreateCliente(msg.from);
  if (cliente.opt_out) return;

  // Opt-out: lead digita "SAIR"
  if (SAIR_REGEX.test(msg.text)) {
    await deps.setOptOut(cliente.id);
    await deps.saveMsg(cliente.id, "entrada", msg.text);
    await deps.send(msg.from, "Você foi removido das notificações automáticas. Para falar com o corretor, é só enviar uma mensagem.");
    return;
  }

  await deps.saveMsg(cliente.id, "entrada", msg.text);

  const historico = await deps.getHistorico(cliente.id);

  // Guardrail: pergunta sobre financiamento → disclaimer obrigatório
  if (FINANCIAMENTO_REGEX.test(msg.text)) {
    const resposta = await deps.gemini(
      `Corretor: ${deps.nomeCorretor}. Lead perguntou sobre financiamento. ` +
      `Responda que condições de financiamento e aprovação dependem de análise de crédito, ` +
      `e que o corretor vai orientar pessoalmente. Não prometa aprovação.`,
    );
    await deps.saveMsg(cliente.id, "saida", resposta);
    await deps.send(msg.from, resposta);
    return;
  }

  // Extrai perfil de busca via Gemini
  const { promptQualificar } = await import("../gemini/prompts");
  const perfil = await extrairPerfil(deps.gemini, [...historico, { direcao: "entrada", conteudo: msg.text }]);
  if (Object.keys(perfil).length > 0) {
    await deps.upsertPerfilCliente(cliente.id, perfil);
  }

  // Match SQL — nunca Gemini para matching (spec §3.2)
  if (!perfil.transacao) {
    // Perfil insuficiente → pergunta qualificadora
    const resposta = await deps.gemini(promptQualificar([...historico, { direcao: "entrada", conteudo: msg.text }]));
    await deps.saveMsg(cliente.id, "saida", resposta);
    await deps.send(msg.from, resposta);
    return;
  }

  const perfilCompleto = perfil as PerfilBusca;
  const todos = await deps.matchImoveis(perfilCompleto);
  const matches = rankImoveis(todos.filter((i) => buildMatchFilter(i, perfilCompleto)), perfilCompleto);

  let resposta: string;
  if (matches.length === 0) {
    // Guardrail: catálogo vazio → não afirmar disponibilidade
    resposta = await deps.gemini(
      `Corretor: ${deps.nomeCorretor}. Lead buscando imóvel em ${perfil.regiao ?? "qualquer região"}. ` +
      `Nenhum imóvel encontrado no catálogo agora. Informe isso sem prometer e pergunte se quer ser avisado.`,
    );
  } else {
    const { promptRedigir } = await import("../gemini/prompts");
    resposta = await deps.gemini(
      promptRedigir({ tipo: "sugestao_imovel", titulos: matches.map((i) => i.titulo) }, deps.nomeCorretor),
    );
  }

  await deps.saveMsg(cliente.id, "saida", resposta);
  await deps.send(msg.from, resposta);
}

async function extrairPerfil(
  gemini: (p: string) => Promise<string>,
  historico: Array<{ direcao: "entrada" | "saida"; conteudo: string }>,
): Promise<Partial<PerfilBusca>> {
  const { promptQualificar } = await import("../gemini/prompts");
  try {
    const raw = await gemini(promptQualificar(historico));
    // Remove markdown code fences se presentes
    const clean = raw.replace(/```json\s*/i, "").replace(/```\s*$/, "").trim();
    return JSON.parse(clean) as Partial<PerfilBusca>;
  } catch {
    return {};
  }
}
