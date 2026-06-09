// Camada de dados Supabase — implementação real dos deps injetados no Worker.
// O Worker acessa via service key (bypassa RLS). Cada grupo de métodos abaixo
// corresponde a um contrato já definido e testado no núcleo (agent1, scheduler,
// api/router, api/import, crons). Esta camada só faz o mapeamento SQL — a lógica
// vive nos módulos do núcleo, validada pela suíte.
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { ClienteBasico } from "../agents/agent1";
import type { Imovel, PerfilBusca } from "../matching/sql";
import type { AgenteName, DbLike } from "../scheduler/types";
import type { ImovelInput, ClienteInput } from "../adapters/catalog/csv";

export interface DbEnv {
  SUPABASE_URL: string;
  SUPABASE_SERVICE_KEY: string;
}

export function createSupabaseClient(env: DbEnv): SupabaseClient {
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

// Colunas do match (spec §3.2 — matching é SQL, nunca catálogo no prompt).
const IMOVEL_COLS = "id,titulo,tipo,transacao,preco,regiao,quartos,area_m2,status";

export function createDb(env: DbEnv) {
  const sb = createSupabaseClient(env);

  // ── conversa: cada cliente tem uma conversa "corrente" para anexar mensagens ──
  async function getOrCreateConversaId(clienteId: string): Promise<string> {
    const { data: existente } = await sb
      .from("conversas")
      .select("id")
      .eq("cliente_id", clienteId)
      .order("ultima_interacao", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (existente?.id) return existente.id as string;

    const { data: nova, error } = await sb
      .from("conversas")
      .insert({ cliente_id: clienteId })
      .select("id")
      .single();
    if (error) throw new Error(`Falha ao criar conversa: ${error.message}`);
    return nova!.id as string;
  }

  return {
    // ════════════════════════════ Agente 1 (reativo) ════════════════════════
    async getOrCreateCliente(telefone: string): Promise<ClienteBasico> {
      const { data: existente } = await sb
        .from("clientes")
        .select("id,nome,opt_out")
        .eq("telefone", telefone)
        .maybeSingle();
      if (existente) {
        return { id: existente.id as string, nome: existente.nome as string | null, opt_out: !!existente.opt_out };
      }
      const { data: novo, error } = await sb
        .from("clientes")
        .insert({ telefone, origem: "whatsapp" })
        .select("id,nome,opt_out")
        .single();
      if (error) throw new Error(`Falha ao criar cliente: ${error.message}`);
      return { id: novo!.id as string, nome: novo!.nome as string | null, opt_out: !!novo!.opt_out };
    },

    async getHistorico(clienteId: string): Promise<Array<{ direcao: "entrada" | "saida"; conteudo: string }>> {
      const conversaId = await getOrCreateConversaId(clienteId);
      const { data } = await sb
        .from("mensagens")
        .select("direcao,conteudo,criado_em")
        .eq("conversa_id", conversaId)
        .order("criado_em", { ascending: true })
        .limit(20);
      return (data ?? []).map((m) => ({
        direcao: m.direcao as "entrada" | "saida",
        conteudo: m.conteudo as string,
      }));
    },

    async saveMsg(clienteId: string, direcao: "entrada" | "saida", conteudo: string): Promise<void> {
      const conversaId = await getOrCreateConversaId(clienteId);
      const { error } = await sb.from("mensagens").insert({ conversa_id: conversaId, direcao, conteudo });
      if (error) throw new Error(`Falha ao salvar mensagem: ${error.message}`);
      await sb.from("conversas").update({ ultima_interacao: new Date().toISOString() }).eq("id", conversaId);
    },

    async upsertPerfilCliente(clienteId: string, perfil: Partial<PerfilBusca>): Promise<void> {
      const patch: Record<string, unknown> = {};
      if (perfil.tipo != null) patch.tipo = perfil.tipo;
      if (perfil.regiao != null) patch.regiao = perfil.regiao;
      if (perfil.orcamento_min != null) patch.orcamento_min = perfil.orcamento_min;
      if (perfil.orcamento_max != null) patch.orcamento_max = perfil.orcamento_max;
      if (perfil.finalidade != null) patch.finalidade = perfil.finalidade;
      if (Object.keys(patch).length === 0) return;
      const { error } = await sb.from("clientes").update(patch).eq("id", clienteId);
      if (error) throw new Error(`Falha ao atualizar perfil: ${error.message}`);
    },

    async setOptOut(clienteId: string): Promise<void> {
      await sb
        .from("clientes")
        .update({ opt_out: true, opt_out_em: new Date().toISOString() })
        .eq("id", clienteId);
    },

    // Matching = SQL no Supabase (spec §3.2). Filtra os critérios principais;
    // o núcleo (buildMatchFilter/rankImoveis) refina e ordena em cima.
    async matchImoveis(perfil: PerfilBusca): Promise<Imovel[]> {
      let q = sb.from("imoveis").select(IMOVEL_COLS).eq("status", "ativo").eq("transacao", perfil.transacao);
      if (perfil.tipo) q = q.eq("tipo", perfil.tipo);
      if (perfil.regiao) q = q.eq("regiao", perfil.regiao);
      if (perfil.orcamento_min != null) q = q.gte("preco", perfil.orcamento_min);
      if (perfil.orcamento_max != null) q = q.lte("preco", perfil.orcamento_max);
      const { data } = await q.limit(50);
      return (data ?? []) as unknown as Imovel[];
    },

    // ════════════════════════════ API do painel ═════════════════════════════
    async listImoveis(): Promise<unknown[]> {
      const { data } = await sb.from("imoveis").select("*").order("criado_em", { ascending: false }).limit(500);
      return data ?? [];
    },
    async createImovel(input: unknown): Promise<unknown> {
      const { data, error } = await sb.from("imoveis").insert(input as Record<string, unknown>).select("*").single();
      if (error) throw new Error(`Falha ao criar imóvel: ${error.message}`);
      return data;
    },
    async listClientes(): Promise<unknown[]> {
      const { data } = await sb.from("clientes").select("*").order("criado_em", { ascending: false }).limit(500);
      return data ?? [];
    },
    async listConversas(clienteId?: string): Promise<unknown[]> {
      let q = sb.from("conversas").select("*").order("ultima_interacao", { ascending: false }).limit(500);
      if (clienteId) q = q.eq("cliente_id", clienteId);
      const { data } = await q;
      return data ?? [];
    },
    async listVisitas(): Promise<unknown[]> {
      const { data } = await sb.from("visitas").select("*").order("agendada_para", { ascending: true }).limit(500);
      return data ?? [];
    },
    async updateVisitaStatus(id: string, status: string): Promise<void> {
      const { error } = await sb.from("visitas").update({ status }).eq("id", id);
      if (error) throw new Error(`Falha ao atualizar visita: ${error.message}`);
    },
    async listDisparos(): Promise<unknown[]> {
      const { data } = await sb.from("disparos").select("*").order("criado_em", { ascending: false }).limit(500);
      return data ?? [];
    },
    async getConfig(): Promise<Record<string, unknown>> {
      const { data } = await sb.from("config").select("chave,valor");
      const out: Record<string, unknown> = {};
      for (const row of data ?? []) out[row.chave as string] = row.valor;
      return out;
    },
    async setConfig(data: Record<string, unknown>): Promise<void> {
      const rows = Object.entries(data).map(([chave, valor]) => ({
        chave,
        valor,
        atualizado_em: new Date().toISOString(),
      }));
      if (rows.length === 0) return;
      const { error } = await sb.from("config").upsert(rows, { onConflict: "chave" });
      if (error) throw new Error(`Falha ao salvar config: ${error.message}`);
    },

    // Config por chave (usado pelo cron sync-catalog).
    async getConfigKey(chave: string): Promise<string | null> {
      const { data } = await sb.from("config").select("valor").eq("chave", chave).maybeSingle();
      if (!data) return null;
      return typeof data.valor === "string" ? data.valor : null;
    },
    async setConfigKey(chave: string, valor: unknown): Promise<void> {
      await sb.from("config").upsert({ chave, valor, atualizado_em: new Date().toISOString() }, { onConflict: "chave" });
    },

    // ════════════════════════════ Import (CSV) ══════════════════════════════
    async upsertImoveis(imoveis: ImovelInput[]): Promise<{ inseridos: number; atualizados: number }> {
      if (imoveis.length === 0) return { inseridos: 0, atualizados: 0 };
      // Dedup por `ref` quando presente (schema não tem unique em ref — fazemos manual).
      const comRef = imoveis.filter((i) => i.ref);
      const semRef = imoveis.filter((i) => !i.ref);
      let atualizados = 0;
      let inseridos = 0;

      if (comRef.length > 0) {
        const refs = comRef.map((i) => i.ref!) as string[];
        const { data: existentes } = await sb.from("imoveis").select("ref").in("ref", refs);
        const existentesSet = new Set((existentes ?? []).map((r) => r.ref as string));
        for (const im of comRef) {
          if (existentesSet.has(im.ref!)) {
            await sb.from("imoveis").update({ ...im, atualizado_em: new Date().toISOString() }).eq("ref", im.ref!);
            atualizados++;
          } else {
            await sb.from("imoveis").insert(im);
            inseridos++;
          }
        }
      }
      if (semRef.length > 0) {
        const { error } = await sb.from("imoveis").insert(semRef);
        if (error) throw new Error(`Falha ao inserir imóveis: ${error.message}`);
        inseridos += semRef.length;
      }
      return { inseridos, atualizados };
    },

    async upsertClientes(clientes: ClienteInput[]): Promise<{ inseridos: number; atualizados: number }> {
      if (clientes.length === 0) return { inseridos: 0, atualizados: 0 };
      const tels = clientes.map((c) => c.telefone);
      const { data: existentes } = await sb.from("clientes").select("telefone").in("telefone", tels);
      const existentesSet = new Set((existentes ?? []).map((r) => r.telefone as string));
      const atualizados = clientes.filter((c) => existentesSet.has(c.telefone)).length;
      const inseridos = clientes.length - atualizados;
      const rows = clientes.map((c) => ({ ...c, origem: "csv" }));
      const { error } = await sb.from("clientes").upsert(rows, { onConflict: "telefone" });
      if (error) throw new Error(`Falha ao importar clientes: ${error.message}`);
      return { inseridos, atualizados };
    },
  };
}

// ── Scheduler DbLike (anti-ban): consulta/escreve a tabela `disparos` ──
export function createSchedulerDb(env: DbEnv): DbLike {
  const sb = createSupabaseClient(env);
  return {
    async existeDisparo(_clienteId: string, _agente: AgenteName, chave: string): Promise<boolean> {
      const { data } = await sb.from("disparos").select("id").eq("chave_idempotencia", chave).maybeSingle();
      return !!data;
    },
    async contarEnviosHora(numero: string, desde: Date): Promise<number> {
      const { count } = await sb
        .from("disparos")
        .select("id", { count: "exact", head: true })
        .eq("numero", numero)
        .eq("status", "enviado")
        .gte("criado_em", desde.toISOString());
      return count ?? 0;
    },
    async contarEnviosDia(numero: string, desde: Date): Promise<number> {
      const { count } = await sb
        .from("disparos")
        .select("id", { count: "exact", head: true })
        .eq("numero", numero)
        .eq("status", "enviado")
        .gte("criado_em", desde.toISOString());
      return count ?? 0;
    },
    async clienteOptOut(clienteId: string): Promise<boolean> {
      const { data } = await sb.from("clientes").select("opt_out").eq("id", clienteId).maybeSingle();
      return !!data?.opt_out;
    },
    async registrarDisparo(params): Promise<void> {
      const { error } = await sb.from("disparos").insert({
        cliente_id: params.clienteId,
        numero: params.numero,
        agente: params.agente,
        imovel_id: params.imovelId ?? null,
        chave_idempotencia: params.chave,
        status: params.status,
      });
      if (error) throw new Error(`Falha ao registrar disparo: ${error.message}`);
    },
  };
}
