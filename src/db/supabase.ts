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
import type { VisitaAgendada } from "../crons/anti-noshow";
import type { LeadParaFollowup } from "../crons/followup";
import type { ImovelNovo, ClienteElegivel } from "../crons/radar";
import type { ClienteFrio } from "../crons/reativador";
import type { ClienteFechado } from "../crons/posvenda";

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
      // região tolerante: case-insensitive e parcial (lead diz "centro" → casa "Centro").
      // O import sempre popula `regiao` (fallback bairro/cidade), então imóvel nunca fica órfão.
      if (perfil.regiao) {
        const termo = perfil.regiao.replace(/[%,()*]/g, "").trim();
        if (termo) q = q.ilike("regiao", `%${termo}%`);
      }
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
    async createCliente(input: unknown): Promise<unknown> {
      // Cadastro manual pelo painel: origem 'manual' e, se o corretor marcou o
      // cliente como elegível a proativo, registra o consentimento (LGPD §12).
      const d = input as Record<string, unknown>;
      const row = {
        ...d,
        origem: (d.origem as string) ?? "manual",
        consentimento: !!d.elegivel_proativo,
        consentimento_em: d.elegivel_proativo ? new Date().toISOString() : null,
      };
      const { data, error } = await sb.from("clientes").insert(row).select("*").single();
      if (error) throw new Error(`Falha ao criar cliente: ${error.message}`);
      return data;
    },
    async listConversas(clienteId?: string): Promise<unknown[]> {
      let q = sb.from("conversas").select("*").order("ultima_interacao", { ascending: false }).limit(500);
      if (clienteId) q = q.eq("cliente_id", clienteId);
      const { data } = await q;
      return data ?? [];
    },
    async listVisitas(): Promise<unknown[]> {
      const { data } = await sb.from("visitas").select("*, clientes(nome)").order("agendada_para", { ascending: true }).limit(500);
      return (data ?? []).map((v) => {
        const row = v as Record<string, unknown> & { clientes?: { nome?: string } | null };
        return { ...row, cliente_nome: row.clientes?.nome ?? null };
      });
    },
    async createVisita(input: unknown): Promise<unknown> {
      const { data, error } = await sb.from("visitas").insert(input as Record<string, unknown>).select("*, clientes(nome)").single();
      if (error) throw new Error(`Falha ao criar visita: ${error.message}`);
      const row = data as Record<string, unknown> & { clientes?: { nome?: string } | null };
      return { ...row, cliente_nome: row.clientes?.nome ?? null };
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

    // ═══════════════ Seleção dos crons proativos (fatia 2) ═══════════════════
    // A FREQUÊNCIA já é garantida pela idempotência do scheduler (dedup.ts):
    // follow-up/reativador = semanal, pós-venda = mensal, radar = permanente
    // cliente×imóvel. Estas consultas só escolhem ALVOS elegíveis; as janelas
    // abaixo são defaults do plano (spec §4) — confirmar com o ZX LAB.

    async listarVisitasProximas(): Promise<VisitaAgendada[]> {
      const now = new Date();
      const limite = new Date(now.getTime() + 36 * 3_600_000); // 36h (default anti-no-show, já no cron)
      const { data } = await sb
        .from("visitas")
        .select("id, agendada_para, cliente_id, clientes(telefone), imoveis(titulo)")
        .in("status", ["agendada", "confirmada"])
        .gte("agendada_para", now.toISOString())
        .lte("agendada_para", limite.toISOString());
      // supabase-js tipa embed como array; em runtime relação to-one vem como objeto.
      const rows = (data ?? []) as unknown as Array<{
        id: string; agendada_para: string; cliente_id: string;
        clientes: { telefone: string } | null; imoveis: { titulo: string } | null;
      }>;
      return rows
        .filter((v) => v.clientes?.telefone)
        .map((v) => ({
          id: v.id,
          clienteId: v.cliente_id,
          numero: v.clientes!.telefone,
          local: v.imoveis?.titulo ?? "o imóvel",
          agendada_para: new Date(v.agendada_para),
        }));
    },

    async listarLeadsParaFollowup(): Promise<LeadParaFollowup[]> {
      const corte = new Date(Date.now() - 3 * 86_400_000); // lead quieto há 3d (default plano)
      const { data } = await sb
        .from("conversas")
        .select("id, cliente_id, clientes(telefone, opt_out)")
        .in("estado", ["novo", "qualificado"])
        .lt("ultima_interacao", corte.toISOString())
        .limit(500);
      const convs = (data ?? []) as unknown as Array<{
        id: string; cliente_id: string; clientes: { telefone: string; opt_out: boolean } | null;
      }>;
      const out: LeadParaFollowup[] = [];
      for (const c of convs) {
        if (!c.clientes?.telefone || c.clientes.opt_out) continue;
        // a última mensagem precisa ser nossa (saída) — lead não respondeu
        const { data: ultima } = await sb
          .from("mensagens").select("direcao").eq("conversa_id", c.id)
          .order("criado_em", { ascending: false }).limit(1).maybeSingle();
        if ((ultima as { direcao?: string } | null)?.direcao !== "saida") continue;
        // toque = nº de follow-ups já enviados + 1; para após 3 (default plano)
        const { count } = await sb
          .from("disparos").select("id", { count: "exact", head: true })
          .eq("cliente_id", c.cliente_id).eq("agente", "followup");
        const toque = (count ?? 0) + 1;
        if (toque > 3) continue;
        out.push({ clienteId: c.cliente_id, numero: c.clientes.telefone, toque });
      }
      return out;
    },

    async listarImoveisNovos(): Promise<ImovelNovo[]> {
      const corte = new Date(Date.now() - 7 * 86_400_000); // "novo" = últimos 7d (dedup radar é permanente)
      const { data } = await sb
        .from("imoveis")
        .select("id, titulo, preco, regiao, tipo, transacao")
        .eq("status", "ativo")
        .gte("criado_em", corte.toISOString())
        .limit(200);
      const rows = (data ?? []) as Array<{
        id: string; titulo: string; preco: number | string; regiao: string | null; tipo: string; transacao: string;
      }>;
      return rows.map((i) => ({
        id: i.id, titulo: i.titulo, preco: Number(i.preco),
        regiao: i.regiao, tipo: i.tipo, transacao: i.transacao,
      }));
    },

    async listarClientesElegiveisParaImovel(imovel: ImovelNovo): Promise<ClienteElegivel[]> {
      // Match cliente×imóvel: orçamento em SQL (numérico, seguro); tipo/região no código.
      const preco = Number(imovel.preco);
      const { data } = await sb
        .from("clientes")
        .select("id, telefone, tipo, regiao, orcamento_min, orcamento_max")
        .eq("elegivel_proativo", true)
        .eq("opt_out", false)
        .or(`orcamento_max.is.null,orcamento_max.gte.${preco}`)
        .or(`orcamento_min.is.null,orcamento_min.lte.${preco}`)
        .limit(1000);
      const rows = (data ?? []) as Array<{
        id: string; telefone: string; tipo: string | null; regiao: string | null;
      }>;
      return rows
        .filter((c) => c.tipo == null || c.tipo === imovel.tipo)
        .filter((c) => imovel.regiao == null || c.regiao == null || c.regiao === imovel.regiao)
        .filter((c) => !!c.telefone)
        .map((c) => ({ clienteId: c.id, numero: c.telefone }));
    },

    async listarClientesFrios(): Promise<ClienteFrio[]> {
      const corte = new Date(Date.now() - 30 * 86_400_000); // >30d sem interação (default já no cron)
      const { data } = await sb
        .from("conversas")
        .select("cliente_id, clientes(telefone, nome, elegivel_proativo, opt_out)")
        .not("estado", "in", "(fechado,perdido)")
        .lt("ultima_interacao", corte.toISOString())
        .limit(1000);
      const convs = (data ?? []) as unknown as Array<{
        cliente_id: string;
        clientes: { telefone: string; nome: string | null; elegivel_proativo: boolean; opt_out: boolean } | null;
      }>;
      const out: ClienteFrio[] = [];
      const vistos = new Set<string>();
      for (const c of convs) {
        const cl = c.clientes;
        if (!cl?.telefone || !cl.elegivel_proativo || cl.opt_out) continue;
        if (vistos.has(c.cliente_id)) continue;
        vistos.add(c.cliente_id);
        out.push({ clienteId: c.cliente_id, numero: cl.telefone, nome: cl.nome });
      }
      return out;
    },

    async listarClientesFechados(): Promise<ClienteFechado[]> {
      // Usa `fechado_em` (preenchido pelo trigger da migration 0003); fallback p/
      // ultima_interacao em linhas legadas. Idempotência mensal (dedup) evita repetição.
      // Janelas (default plano): toque 1 ≈ D+3, toque 2 ≈ D+30.
      const now = Date.now();
      const { data } = await sb
        .from("conversas")
        .select("cliente_id, fechado_em, ultima_interacao, clientes(telefone)")
        .eq("estado", "fechado")
        .limit(1000);
      const convs = (data ?? []) as unknown as Array<{
        cliente_id: string; fechado_em: string | null; ultima_interacao: string;
        clientes: { telefone: string } | null;
      }>;
      const out: ClienteFechado[] = [];
      for (const c of convs) {
        if (!c.clientes?.telefone) continue;
        const ref = c.fechado_em ?? c.ultima_interacao;
        const dias = (now - new Date(ref).getTime()) / 86_400_000;
        let toque: 1 | 2 | null = null;
        if (dias >= 3 && dias < 14) toque = 1;
        else if (dias >= 28 && dias < 45) toque = 2;
        if (toque === null) continue;
        out.push({ clienteId: c.cliente_id, numero: c.clientes.telefone, toque });
      }
      return out;
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
    // Rate-cap GLOBAL: conta TODOS os envios da instância na janela (não por
    // destinatário). É a linha emissora que toma ban, não o número do lead.
    async contarEnviosHora(desde: Date): Promise<number> {
      const { count } = await sb
        .from("disparos")
        .select("id", { count: "exact", head: true })
        .eq("status", "enviado")
        .gte("criado_em", desde.toISOString());
      return count ?? 0;
    },
    async contarEnviosDia(desde: Date): Promise<number> {
      const { count } = await sb
        .from("disparos")
        .select("id", { count: "exact", head: true })
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
