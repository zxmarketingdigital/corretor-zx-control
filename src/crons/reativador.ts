import type { DispatchOptions } from "../scheduler/types";

export interface ClienteFrio {
  clienteId: string;
  numero: string;
  nome?: string | null;
}

export interface ReativadorDeps {
  listarClientesFrios(): Promise<ClienteFrio[]>;
  dispatch(opts: Omit<DispatchOptions, "now"> & { now: Date }): Promise<"enviado" | "bloqueado">;
  gemini(prompt: string): Promise<string>;
  now?: Date;
}

export async function runReativador(deps: ReativadorDeps): Promise<void> {
  const now = deps.now ?? new Date();
  const clientes = await deps.listarClientesFrios();

  for (const cliente of clientes) {
    const mensagem = await deps.gemini(
      `Reative contato com lead de imóveis${cliente.nome ? ` chamado ${cliente.nome}` : ""} ` +
      `que sumiu há mais de 30 dias. Pergunte se ainda está buscando. Seja breve.`,
    );
    await deps.dispatch({
      clienteId: cliente.clienteId,
      numero: cliente.numero,
      agente: "reativador",
      mensagem,
      window: { start: 8, end: 20 },
      now,
    });
  }
}
