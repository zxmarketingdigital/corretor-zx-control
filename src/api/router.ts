// API REST do Worker → consumida pelo painel (Cloudflare Pages).
// Autenticação: Bearer token (PANEL_TOKEN, wrangler secret).
// Todas as rotas sob /api/*; CORS liberado para * (Pages em subdomínio CF).

export interface ApiDeps {
  panelToken: string;
  listImoveis(): Promise<unknown[]>;
  createImovel(data: unknown): Promise<unknown>;
  listClientes(): Promise<unknown[]>;
  createCliente(data: unknown): Promise<unknown>;
  listConversas(clienteId?: string): Promise<unknown[]>;
  listVisitas(): Promise<unknown[]>;
  createVisita(data: unknown): Promise<unknown>;
  updateVisitaStatus(id: string, status: string): Promise<void>;
  listDisparos(): Promise<unknown[]>;
  adapterStatus(): Promise<string>;
  getConfig(): Promise<Record<string, unknown>>;
  setConfig(data: Record<string, unknown>): Promise<void>;
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Authorization, Content-Type",
    },
  });
}

// Fail-closed: sem token configurado (wrangler secret não rodado) nega tudo,
// em vez de aceitar "Bearer " vazio e expor a API/PII do painel.
export function auth(req: Request, token: string): boolean {
  if (!token) return false;
  const header = req.headers.get("Authorization") ?? "";
  return header === `Bearer ${token}`;
}

export async function handleApi(req: Request, deps: ApiDeps): Promise<Response> {
  // Preflight CORS
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
        "Access-Control-Allow-Headers": "Authorization, Content-Type",
      },
    });
  }

  if (!auth(req, deps.panelToken)) return json({ error: "Unauthorized" }, 401);

  const url = new URL(req.url);
  const path = url.pathname.replace(/^\/api/, "");
  const method = req.method;

  // GET /imoveis
  if (method === "GET" && path === "/imoveis") {
    return json(await deps.listImoveis());
  }
  // POST /imoveis
  if (method === "POST" && path === "/imoveis") {
    const data = await req.json();
    return json(await deps.createImovel(data), 201);
  }
  // GET /clientes
  if (method === "GET" && path === "/clientes") {
    return json(await deps.listClientes());
  }
  // POST /clientes (cadastro manual pelo painel)
  if (method === "POST" && path === "/clientes") {
    const data = await req.json();
    return json(await deps.createCliente(data), 201);
  }
  // GET /conversas
  if (method === "GET" && path === "/conversas") {
    const clienteId = url.searchParams.get("clienteId") ?? undefined;
    return json(await deps.listConversas(clienteId));
  }
  // GET /visitas
  if (method === "GET" && path === "/visitas") {
    return json(await deps.listVisitas());
  }
  // POST /visitas (agendamento manual pelo painel)
  if (method === "POST" && path === "/visitas") {
    const data = await req.json();
    return json(await deps.createVisita(data), 201);
  }
  // PUT /visitas/:id/status
  const visitaMatch = path.match(/^\/visitas\/([^/]+)\/status$/);
  if (method === "PUT" && visitaMatch) {
    const body = (await req.json()) as { status: string };
    await deps.updateVisitaStatus(visitaMatch[1]!, body.status);
    return json({ ok: true });
  }
  // GET /disparos
  if (method === "GET" && path === "/disparos") {
    return json(await deps.listDisparos());
  }
  // GET /status
  if (method === "GET" && path === "/status") {
    return json({ evolution: await deps.adapterStatus() });
  }
  // GET /config
  if (method === "GET" && path === "/config") {
    return json(await deps.getConfig());
  }
  // PUT /config
  if (method === "PUT" && path === "/config") {
    const data = (await req.json()) as Record<string, unknown>;
    await deps.setConfig(data);
    return json({ ok: true });
  }

  return json({ error: "Not Found" }, 404);
}
