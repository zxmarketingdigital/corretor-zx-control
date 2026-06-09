import { handleApi } from "./api/router";
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

// Stub DB — real implementation connects to Supabase at deploy time via injected deps.
function makeStubDb(_env: Env) {
  return {
    existeDisparo: async () => false,
    contarEnviosHora: async () => 0,
    contarEnviosDia: async () => 0,
    clienteOptOut: async () => false,
    registrarDisparo: async () => {},
  };
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
      await handleWebhook(body, {
        parseWebhook: (b) => adapter.parseWebhook(b),
        getOrCreateCliente: async () => ({ id: "", nome: null, opt_out: false }),
        getHistorico: async () => [],
        gemini: (p) => geminiFlash(p, env),
        matchImoveis: async () => [],
        upsertPerfilCliente: async () => {},
        saveMsg: async () => {},
        send: (n, m) => adapter.send(n, m),
        setOptOut: async () => {},
        nomeCorretor: env.CORRETOR_NOME ?? "Corretor",
      });
      return new Response("ok", { status: 200 });
    }

    // Panel API — import endpoints
    if (pathname === "/api/import/imoveis" && request.method === "POST") {
      return handleImportImoveis(request, {
        upsertImoveis: async () => ({ inseridos: 0, atualizados: 0 }),
        upsertClientes: async () => ({ inseridos: 0, atualizados: 0 }),
      });
    }
    if (pathname === "/api/import/clientes" && request.method === "POST") {
      return handleImportClientes(request, {
        upsertImoveis: async () => ({ inseridos: 0, atualizados: 0 }),
        upsertClientes: async () => ({ inseridos: 0, atualizados: 0 }),
      });
    }

    // Panel API
    if (pathname.startsWith("/api/")) {
      const adapter = createAdapter(env);
      return handleApi(request, {
        panelToken: env.PANEL_TOKEN ?? "",
        listImoveis: async () => [],
        createImovel: async () => ({}),
        listClientes: async () => [],
        listConversas: async () => [],
        listVisitas: async () => [],
        updateVisitaStatus: async () => {},
        listDisparos: async () => [],
        adapterStatus: () => adapter.status(),
        getConfig: async () => ({}),
        setConfig: async () => {},
      });
    }

    return new Response("corretor-zx-control", { status: 200 });
  },

  async scheduled(_event: ScheduledController, env: Env, _ctx: ExecutionContext): Promise<void> {
    const adapter = createAdapter(env);
    const db = makeStubDb(env);
    const dispatchFn = (opts: Parameters<typeof dispatch>[2]) => dispatch(db, adapter, opts);
    const gemini = (p: string) => geminiFlash(p, env);

    // Sync catalog feeds before agents so radar sees fresh listings
    await runSyncCatalog({
      getConfig: async () => null,
      setConfig: async () => {},
      upsertImoveis: async () => ({ inseridos: 0, atualizados: 0 }),
      fetchText: async (url) => { const r = await fetch(url); return r.text(); },
    });

    await runAntiNoshow({
      listarVisitasProximas: async () => [],
      dispatch: dispatchFn,
      nomeCorretor: env.CORRETOR_NOME ?? "Corretor",
      now: new Date(),
    });

    await runFollowup({
      listarLeadsParaFollowup: async () => [],
      dispatch: dispatchFn,
      gemini,
      now: new Date(),
    });

    await runRadar({
      listarImoveisNovos: async () => [],
      listarClientesElegiveisParaImovel: async () => [],
      dispatch: (opts) => dispatchFn({ ...opts }),
      gemini,
      now: new Date(),
    });

    await runReativador({
      listarClientesFrios: async () => [],
      dispatch: dispatchFn,
      gemini,
      now: new Date(),
    });

    await runPosvenda({
      listarClientesFechados: async () => [],
      dispatch: dispatchFn,
      gemini,
      googleLink: env.GOOGLE_REVIEW_LINK ?? "",
      now: new Date(),
    });
  },
} satisfies ExportedHandler<Env>;
