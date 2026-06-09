// Único ponto de saída proativa do sistema.
// Toda mensagem proativa (Agentes 2/3/4/5 + anti-no-show) passa por aqui.
// Invariantes anti-ban/anti-spam testadas (spec §3.1/§10):
//   (a) dedup em janela, (b) janela inf+sup, (c) idempotência radar,
//   (d) rate-cap 20/h · 80/dia por número, (e) opt-out "SAIR".
import { gerarChave } from "./dedup";
import type { AdapterLike, AgenteName, DbLike, DispatchOptions } from "./types";

const RATE_CAP_HORA = 20;
const RATE_CAP_DIA = 80;

// Janela de disparo é em horário do Brasil (America/Sao_Paulo). Usamos Intl pra
// ser robusto a fuso/DST, em vez de assumir UTC.
function horaSaoPaulo(now: Date): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Sao_Paulo",
    hour: "2-digit",
    hour12: false,
  }).formatToParts(now);
  return parseInt(parts.find((p) => p.type === "hour")?.value ?? "0", 10) % 24;
}

export async function dispatch(
  db: DbLike,
  adapter: AdapterLike,
  opts: DispatchOptions,
): Promise<"enviado" | "bloqueado"> {
  const now = opts.now ?? new Date();
  const hora = horaSaoPaulo(now);

  // (e) opt-out
  if (await db.clienteOptOut(opts.clienteId)) return "bloqueado";

  // (b) janela inferior+superior
  if (hora < opts.window.start || hora >= opts.window.end) return "bloqueado";

  // (d) rate-cap por número
  const h1ago = new Date(now.getTime() - 3_600_000);
  const d1ago = new Date(now.getTime() - 86_400_000);
  const [enviosHora, enviosDia] = await Promise.all([
    db.contarEnviosHora(opts.numero, h1ago),
    db.contarEnviosDia(opts.numero, d1ago),
  ]);
  if (enviosHora >= RATE_CAP_HORA || enviosDia >= RATE_CAP_DIA) return "bloqueado";

  // (a) dedup + (c) idempotência radar
  const chave = gerarChave(opts.clienteId, opts.agente as AgenteName, now, opts.imovelId);
  if (await db.existeDisparo(opts.clienteId, opts.agente as AgenteName, chave)) return "bloqueado";

  // Passa todos os checks → envia
  await adapter.send(opts.numero, opts.mensagem);
  await db.registrarDisparo({
    clienteId: opts.clienteId,
    numero: opts.numero,
    agente: opts.agente as AgenteName,
    imovelId: opts.imovelId,
    chave,
    status: "enviado",
  });
  return "enviado";
}
