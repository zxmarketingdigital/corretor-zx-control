import type { DispatchOptions } from "../scheduler/types";

export interface LeadParaFollowup {
  clienteId: string;
  numero: string;
  toque: number; // 1, 2 ou 3
}

export interface FollowupDeps {
  listarLeadsParaFollowup(): Promise<LeadParaFollowup[]>;
  dispatch(opts: Omit<DispatchOptions, "now"> & { now: Date }): Promise<"enviado" | "bloqueado">;
  gemini(prompt: string): Promise<string>;
  now?: Date;
}

export async function runFollowup(deps: FollowupDeps): Promise<void> {
  const now = deps.now ?? new Date();
  const leads = await deps.listarLeadsParaFollowup();

  for (const lead of leads) {
    const mensagem = await deps.gemini(
      `Escreva follow-up #${lead.toque} para lead de imóveis que não respondeu. Seja breve e respeitoso.`,
    );
    await deps.dispatch({
      clienteId: lead.clienteId,
      numero: lead.numero,
      agente: "followup",
      mensagem,
      window: { start: 8, end: 18 },
      now,
    });
  }
}
