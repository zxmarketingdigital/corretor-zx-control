import type { DispatchOptions } from "../scheduler/types";

export interface ClienteFechado {
  clienteId: string;
  numero: string;
  toque: 1 | 2; // 1=D+3 followup, 2=D+30 indicação
}

export interface PosvendaDeps {
  listarClientesFechados(): Promise<ClienteFechado[]>;
  dispatch(opts: Omit<DispatchOptions, "now"> & { now: Date }): Promise<"enviado" | "bloqueado">;
  gemini(prompt: string): Promise<string>;
  googleLink: string;
  now?: Date;
}

export async function runPosvenda(deps: PosvendaDeps): Promise<void> {
  const now = deps.now ?? new Date();
  const clientes = await deps.listarClientesFechados();

  for (const cliente of clientes) {
    const prompt =
      cliente.toque === 1
        ? "Escreva mensagem de acompanhamento pós-venda perguntando como o cliente está na nova propriedade."
        : `Peça indicação de amigos ou familiares que buscam imóvel, e avaliação Google: ${deps.googleLink}. Seja grato e breve.`;

    const mensagem = await deps.gemini(prompt);
    await deps.dispatch({
      clienteId: cliente.clienteId,
      numero: cliente.numero,
      agente: "posvenda",
      mensagem,
      window: { start: 8, end: 20 },
      now,
    });
  }
}
