export type HistoricoMsg = { direcao: "entrada" | "saida"; conteudo: string };

export function promptQualificar(historico: HistoricoMsg[]): string {
  const conversa = historico
    .map((m) => `${m.direcao === "entrada" ? "Lead" : "Assistente"}: ${m.conteudo}`)
    .join("\n");

  return `Você é um assistente de corretor de imóveis. Analise a conversa e extraia os critérios de busca do lead.

Conversa:
${conversa}

Retorne APENAS um JSON com os campos (omita campos desconhecidos):
{
  "transacao": "venda" | "locacao",
  "tipo": "apartamento" | "casa" | "terreno" | "sala" | null,
  "orcamento_min": number | null,
  "orcamento_max": number | null,
  "regiao": string | null,
  "finalidade": "morar" | "investir" | null,
  "prazo_mudanca": string | null
}`;
}

export type RedacaoCtx =
  | { tipo: "saudacao"; nome?: string }
  | { tipo: "sugestao_imovel"; titulos: string[] }
  | { tipo: "agendar_visita"; imovel: string }
  | { tipo: "confirmacao_visita"; local: string; dataHora: string }
  | { tipo: "followup"; toque: number }
  | { tipo: "radar"; imovel: string; preco: number }
  | { tipo: "reativador"; nome?: string }
  | { tipo: "posvenda_followup" }
  | { tipo: "posvenda_indicacao"; googleLink: string };

export function promptRedigir(ctx: RedacaoCtx, nomeCorretor: string): string {
  const base = `Você é o assistente de WhatsApp do corretor ${nomeCorretor}. Escreva mensagem curta e natural (sem emojis excessivos, máximo 3 parágrafos).`;

  switch (ctx.tipo) {
    case "saudacao":
      return `${base}\nSaudação inicial para novo lead imobiliário${ctx.nome ? ` chamado ${ctx.nome}` : ""}. Pergunte o que está buscando.`;
    case "sugestao_imovel":
      return `${base}\nApresente estes imóveis: ${ctx.titulos.join(", ")}. Ofereça agendar visita.`;
    case "agendar_visita":
      return `${base}\nConfirme interesse em visitar "${ctx.imovel}" e pergunte disponibilidade de horário.`;
    case "confirmacao_visita":
      return `${base}\nLembre o lead da visita em "${ctx.local}" para ${ctx.dataHora}. Peça confirmação.`;
    case "followup":
      return `${base}\nFollow-up #${ctx.toque} para lead que não respondeu. Seja persistente mas respeitoso.`;
    case "radar":
      return `${base}\nNovidade no catálogo: "${ctx.imovel}" por R$ ${ctx.preco.toLocaleString("pt-BR")}. Condiz com o perfil deste lead.`;
    case "reativador":
      return `${base}\nReativar contato com lead antigo${ctx.nome ? ` (${ctx.nome})` : ""}. Pergunte se ainda está buscando imóvel.`;
    case "posvenda_followup":
      return `${base}\nAcompanhamento pós-venda. Pergunte como está na nova propriedade.`;
    case "posvenda_indicacao":
      return `${base}\nPeça indicação de amigos ou familiares que busquem imóvel, e avaliação Google: ${ctx.googleLink}`;
  }
}
