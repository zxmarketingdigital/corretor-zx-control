export type AgenteName =
  | "antinoshow"
  | "followup"
  | "radar"
  | "reativador"
  | "posvenda";

export interface DispatchOptions {
  clienteId: string;
  numero: string;
  agente: AgenteName;
  imovelId?: string;
  toque?: number; // discrimina toques do mesmo agente na dedup (ex: pós-venda D+3 vs D+30)
  mensagem: string;
  window: { start: number; end: number }; // horas em America/Sao_Paulo (BRT) 0-23
  now?: Date; // injetável para testes
  delayMs?: number; // anti-ban: espera após envio (jitter); 0/omisso = sem espera
  sleep?: (ms: number) => Promise<void>; // injetável para testes
}

// Interface mínima do banco que o scheduler precisa (mockável em testes).
export interface DbLike {
  existeDisparo(clienteId: string, agente: AgenteName, chave: string): Promise<boolean>;
  // Rate-cap GLOBAL da instância (1 corretor = 1 linha emissora), não por destinatário.
  contarEnviosHora(desde: Date): Promise<number>;
  contarEnviosDia(desde: Date): Promise<number>;
  clienteOptOut(clienteId: string): Promise<boolean>;
  registrarDisparo(params: {
    clienteId: string;
    numero: string;
    agente: AgenteName;
    imovelId?: string;
    chave: string;
    status: "enviado" | "bloqueado";
  }): Promise<void>;
}

// Interface mínima do adapter de WhatsApp (mockável em testes).
export interface AdapterLike {
  send(numero: string, mensagem: string): Promise<void>;
}
