import type { DispatchOptions } from "../scheduler/types";

const JANELA_CONFIRMACAO_H = 36; // confirma visitas nas próximas 36h

export interface VisitaAgendada {
  id: string;
  clienteId: string;
  numero: string;
  local: string;
  agendada_para: Date;
}

export interface AntiNoshowDeps {
  listarVisitasProximas(): Promise<VisitaAgendada[]>;
  dispatch(opts: Omit<DispatchOptions, "now"> & { now: Date }): Promise<"enviado" | "bloqueado">;
  nomeCorretor: string;
  now?: Date;
}

export async function runAntiNoshow(deps: AntiNoshowDeps): Promise<void> {
  const now = deps.now ?? new Date();
  const limite = new Date(now.getTime() + JANELA_CONFIRMACAO_H * 3_600_000);

  const visitas = await deps.listarVisitasProximas();

  for (const visita of visitas) {
    if (visita.agendada_para > limite) continue;

    const dataHora = visita.agendada_para.toLocaleString("pt-BR", {
      timeZone: "America/Sao_Paulo",
      dateStyle: "short",
      timeStyle: "short",
    });

    await deps.dispatch({
      clienteId: visita.clienteId,
      numero: visita.numero,
      agente: "antinoshow",
      imovelId: undefined,
      mensagem: `Olá! Passando para confirmar sua visita em "${visita.local}" amanhã às ${dataHora}. Você confirma presença?`,
      window: { start: 8, end: 20 },
      now,
    });
  }
}
