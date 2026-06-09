import type { DispatchOptions } from "../scheduler/types";

export interface ImovelNovo {
  id: string;
  titulo: string;
  preco: number;
  regiao: string | null;
  tipo: string;
  transacao: string;
}

export interface ClienteElegivel {
  clienteId: string;
  numero: string;
}

export interface RadarDeps {
  listarImoveisNovos(): Promise<ImovelNovo[]>;
  listarClientesElegiveisParaImovel(imovel: ImovelNovo): Promise<ClienteElegivel[]>;
  dispatch(opts: Omit<DispatchOptions, "now"> & { now: Date }): Promise<"enviado" | "bloqueado">;
  gemini(prompt: string): Promise<string>;
  now?: Date;
}

export async function runRadar(deps: RadarDeps): Promise<void> {
  const now = deps.now ?? new Date();
  const imoveis = await deps.listarImoveisNovos();

  for (const imovel of imoveis) {
    const clientes = await deps.listarClientesElegiveisParaImovel(imovel);

    for (const cliente of clientes) {
      const mensagem = await deps.gemini(
        `Novo imóvel no catálogo: "${imovel.titulo}" por R$ ${imovel.preco.toLocaleString("pt-BR")}. ` +
        `Escreva mensagem proativa curta para lead que tem perfil compatível.`,
      );
      await deps.dispatch({
        clienteId: cliente.clienteId,
        numero: cliente.numero,
        agente: "radar",
        imovelId: imovel.id,
        mensagem,
        window: { start: 8, end: 20 },
        now,
      });
    }
  }
}
