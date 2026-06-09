import type { AgenteName } from "./types";

// Semana ISO para dedup semanal de follow-up / reativador.
// Radar usa (clienteId + agente + imovelId) — sem semana.
function isoWeek(d: Date): string {
  const thu = new Date(d);
  thu.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7) + 3);
  const jan4 = new Date(Date.UTC(thu.getUTCFullYear(), 0, 4));
  const week = Math.ceil(((thu.getTime() - jan4.getTime()) / 86_400_000 + (jan4.getUTCDay() + 6) % 7 + 1) / 7);
  return `${thu.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

export function gerarChave(
  clienteId: string,
  agente: AgenteName,
  now: Date,
  imovelId?: string,
): string {
  if (agente === "radar" && imovelId) {
    return `${clienteId}:radar:${imovelId}`;
  }
  if (agente === "posvenda") {
    const month = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
    return `${clienteId}:posvenda:${month}`;
  }
  return `${clienteId}:${agente}:${isoWeek(now)}`;
}
