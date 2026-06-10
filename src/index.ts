import { handleApi, auth } from "./api/router";
import { handleImportImoveis, handleImportClientes } from "./api/import";
import { handleWebhook } from "./agents/agent1";
import { runAntiNoshow } from "./crons/anti-noshow";
import { runFollowup } from "./crons/followup";
import { runRadar } from "./crons/radar";
import { runReativador } from "./crons/reativador";
import { runPosvenda } from "./crons/posvenda";
import { runSyncCatalog } from "./crons/sync-catalog";
import { createAdapter } from "./adapters/whatsapp/index";
import { geminiFlash } from "./gemini/client";
import { dispatch } from "./scheduler/scheduler";
import { createDb, createSchedulerDb } from "./db/supabase";

export interface Env {
  SUPABASE_URL: string;
  SUPABASE_SERVICE_KEY: string;
  GEMINI_API_KEY: string;
  WHATSAPP_PROVIDER: string;
  EVOLUTION_URL: string;
  EVOLUTION_INSTANCE: string;
  EVOLUTION_API_KEY: string;
  WEBHOOK_SECRET: string;
  PANEL_TOKEN: string;
  CORRETOR_NOME: string;
  GOOGLE_REVIEW_LINK: string;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const { pathname } = url;

    // Health check (smoke test + monitoramento)
    if (pathname === "/health" && request.method === "GET") {
      return new Response(JSON.stringify({ status: "ok", product: "corretor-zx-control" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Webhook (Agente 1 — reativo)
    if (pathname === "/webhook" && request.method === "POST") {
      const secret = request.headers.get("x-webhook-secret") ?? "";
      if (secret !== env.WEBHOOK_SECRET) {
        return new Response("Unauthorized", { status: 401 });
      }
      const body = await request.json().catch(() => null);
      const adapter = createAdapter(env);
      const db = createDb(env);
      await handleWebhook(body, {
        parseWebhook: (b) => adapter.parseWebhook(b),
        getOrCreateCliente: (tel) => db.getOrCreateCliente(tel),
        getHistorico: (id) => db.getHistorico(id),
        gemini: (p) => geminiFlash(p, env),
        matchImoveis: (perfil) => db.matchImoveis(perfil),
        upsertPerfilCliente: (id, perfil) => db.upsertPerfilCliente(id, perfil),
        saveMsg: (id, dir, txt) => db.saveMsg(id, dir, txt),
        send: (n, m) => adapter.send(n, m),
        setOptOut: (id) => db.setOptOut(id),
        nomeCorretor: env.CORRETOR_NOME ?? "Corretor",
      });
      return new Response("ok", { status: 200 });
    }

    // Panel API — import endpoints (gravam catálogo + PII de leads → exigem Bearer)
    if (pathname.startsWith("/api/import/")) {
      if (!auth(request, env.PANEL_TOKEN ?? "")) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { "Content-Type": "application/json" },
        });
      }
    }
    if (pathname === "/api/import/imoveis" && request.method === "POST") {
      const db = createDb(env);
      return handleImportImoveis(request, {
        upsertImoveis: (rows) => db.upsertImoveis(rows as Parameters<typeof db.upsertImoveis>[0]),
        upsertClientes: (rows) => db.upsertClientes(rows as Parameters<typeof db.upsertClientes>[0]),
      });
    }
    if (pathname === "/api/import/clientes" && request.method === "POST") {
      const db = createDb(env);
      return handleImportClientes(request, {
        upsertImoveis: (rows) => db.upsertImoveis(rows as Parameters<typeof db.upsertImoveis>[0]),
        upsertClientes: (rows) => db.upsertClientes(rows as Parameters<typeof db.upsertClientes>[0]),
      });
    }

    // Panel API
    if (pathname.startsWith("/api/")) {
      const adapter = createAdapter(env);
      const db = createDb(env);
      return handleApi(request, {
        panelToken: env.PANEL_TOKEN ?? "",
        listImoveis: () => db.listImoveis(),
        createImovel: (data) => db.createImovel(data),
        listClientes: () => db.listClientes(),
        createCliente: (data) => db.createCliente(data),
        listConversas: (id) => db.listConversas(id),
        listVisitas: () => db.listVisitas(),
        createVisita: (data) => db.createVisita(data),
        updateVisitaStatus: (id, status) => db.updateVisitaStatus(id, status),
        listDisparos: () => db.listDisparos(),
        adapterStatus: () => adapter.status(),
        getConfig: () => db.getConfig(),
        setConfig: (data) => db.setConfig(data),
      });
    }

    return new Response("corretor-zx-control", { status: 200 });
  },

  async scheduled(_event: ScheduledController, env: Env, _ctx: ExecutionContext): Promise<void> {
    const adapter = createAdapter(env);
    const db = createSchedulerDb(env);
    const cat = createDb(env);
    // Anti-ban: espaça cada envio com jitter aleatório (3–10s) para não emitir
    // rajada pela mesma linha Evolution. Combinado com o rate-cap global (20/h),
    // limita o burst total por execução.
    const dispatchFn = (opts: Parameters<typeof dispatch>[2]) =>
      dispatch(db, adapter, { ...opts, delayMs: 3000 + Math.floor(Math.random() * 7000) });
    const gemini = (p: string) => geminiFlash(p, env);

    // Sync catalog feeds before agents so radar sees fresh listings (real config + upsert).
    await runSyncCatalog({
      getConfig: (chave) => cat.getConfigKey(chave),
      setConfig: (chave, valor) => cat.setConfigKey(chave, valor),
      upsertImoveis: (rows) => cat.upsertImoveis(rows),
      fetchText: async (u) => {
        const r = await fetch(u);
        return r.text();
      },
    });

    // Seleção real dos alvos por cron (a frequência é garantida pela idempotência do scheduler).
    await runAntiNoshow({
      listarVisitasProximas: () => cat.listarVisitasProximas(),
      dispatch: dispatchFn,
      nomeCorretor: env.CORRETOR_NOME ?? "Corretor",
      now: new Date(),
    });

    await runFollowup({
      listarLeadsParaFollowup: () => cat.listarLeadsParaFollowup(),
      dispatch: dispatchFn,
      gemini,
      now: new Date(),
    });

    await runRadar({
      listarImoveisNovos: () => cat.listarImoveisNovos(),
      listarClientesElegiveisParaImovel: (imovel) => cat.listarClientesElegiveisParaImovel(imovel),
      dispatch: (opts) => dispatchFn({ ...opts }),
      gemini,
      now: new Date(),
    });

    await runReativador({
      listarClientesFrios: () => cat.listarClientesFrios(),
      dispatch: dispatchFn,
      gemini,
      now: new Date(),
    });

    await runPosvenda({
      listarClientesFechados: () => cat.listarClientesFechados(),
      dispatch: dispatchFn,
      gemini,
      googleLink: env.GOOGLE_REVIEW_LINK ?? "",
      now: new Date(),
    });
  },
} satisfies ExportedHandler<Env>;
