// Painel Corretor ZX Control — SPA vanilla, sem bundler.
// Lê WORKER_URL e BEARER_TOKEN de window.CZX_CONFIG (definido em config.js).

const cfg = window.CZX_CONFIG ?? {};
const BASE = (cfg.WORKER_URL ?? "").replace(/\/$/, "");
const TOKEN = cfg.BEARER_TOKEN ?? "";

// ── API helper ─────────────────────────────────────────────────────────────
async function api(path, { method = "GET", body } = {}) {
  const res = await fetch(`${BASE}/api${path}`, {
    method,
    headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`API ${method} ${path} → ${res.status}`);
  return res.json();
}

// ── Toast ─────────────────────────────────────────────────────────────────
const $toast = document.getElementById("toast");
let toastTimer;
function toast(msg, ms = 2500) {
  $toast.textContent = msg;
  $toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => $toast.classList.remove("show"), ms);
}

// ── Tab navigation ────────────────────────────────────────────────────────
document.querySelectorAll("nav button[data-tab]").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll("nav button[data-tab]").forEach((b) => b.classList.remove("active"));
    document.querySelectorAll(".tab").forEach((t) => t.classList.remove("active"));
    btn.classList.add("active");
    document.getElementById(`tab-${btn.dataset.tab}`).classList.add("active");
    loadTab(btn.dataset.tab);
  });
});

// ── Status badge ──────────────────────────────────────────────────────────
async function refreshStatus() {
  try {
    const { evolution } = await api("/status");
    const badge = document.getElementById("badge-status");
    badge.className = "";
    badge.classList.add(evolution);
    badge.title = `Evolution: ${evolution}`;
  } catch { /* silente */ }
}

// ── TAB: Catálogo ─────────────────────────────────────────────────────────
async function loadCatalogo() {
  const imoveis = await api("/imoveis");
  const now = Date.now();
  const rows = imoveis.map((i) => {
    const dias = Math.floor((now - new Date(i.atualizado_em).getTime()) / 86400000);
    const stale = dias > 7;
    const badge = stale ? `<span class="badge desatualizado">⚠ ${dias}d</span>` : `<span class="badge ${i.status}">${i.status}</span>`;
    return `<tr><td>${i.titulo}</td><td>${i.tipo}</td><td>${i.transacao}</td>
      <td>R$ ${Number(i.preco).toLocaleString("pt-BR")}</td>
      <td>${i.regiao ?? "—"}</td><td>${badge}</td></tr>`;
  }).join("");
  document.getElementById("table-catalogo").innerHTML =
    rows || `<tr><td colspan="6" style="color:var(--muted);text-align:center;padding:32px">Nenhum imóvel cadastrado</td></tr>`;
}

// ── TAB: Carteira ─────────────────────────────────────────────────────────
async function loadCarteira() {
  const clientes = await api("/clientes");
  const rows = clientes.map((c) =>
    `<tr><td>${c.nome ?? "—"}</td><td>${c.telefone}</td>
    <td>${c.regiao ?? "—"}</td><td>${c.tipo ?? "—"}</td>
    <td><span class="badge ${c.estado ?? "novo"}">${c.estado ?? "novo"}</span></td>
    <td>${c.elegivel_proativo ? "✓" : "—"}</td></tr>`,
  ).join("");
  document.getElementById("table-carteira").innerHTML =
    rows || `<tr><td colspan="6" style="color:var(--muted);text-align:center;padding:32px">Nenhum cliente</td></tr>`;
}

// ── TAB: Conversas ───────────────────────────────────────────────────────
async function loadConversas() {
  const conversas = await api("/conversas");
  const rows = conversas.map((c) => {
    const dt = new Date(c.ultima_interacao).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" });
    return `<tr><td>${c.cliente_nome ?? c.cliente_id}</td>
      <td><span class="badge ${c.estado}">${c.estado}</span></td>
      <td>${dt}</td>
      <td><button class="btn btn-sm btn-primary" onclick="verMensagens('${c.id}')">Ver</button></td></tr>`;
  }).join("");
  document.getElementById("table-conversas").innerHTML =
    rows || `<tr><td colspan="4" style="color:var(--muted);text-align:center;padding:32px">Nenhuma conversa</td></tr>`;
}

window.verMensagens = async (conversaId) => {
  try {
    const msgs = await api(`/conversas?clienteId=${conversaId}`);
    const linhas = (Array.isArray(msgs) ? msgs : []).map((m) =>
      `<div class="log-entry ${m.direcao}">[${m.direcao === "entrada" ? "Lead" : "Bot"}] ${m.conteudo}</div>`,
    ).join("");
    document.getElementById("table-conversas").innerHTML =
      `<tr><td colspan="4"><div style="padding:12px;max-height:300px;overflow-y:auto">${linhas || "Sem mensagens"}</div>
      <button class="btn btn-sm" onclick="loadConversas()" style="margin:8px">← Voltar</button></td></tr>`;
  } catch (e) { toast(`Erro: ${e.message}`); }
};

// ── TAB: Visitas ──────────────────────────────────────────────────────────
async function loadVisitas() {
  const visitas = await api("/visitas");
  const rows = visitas.map((v) => {
    const dt = new Date(v.agendada_para).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" });
    const btns = v.status === "agendada" || v.status === "confirmada"
      ? `<button class="btn btn-sm btn-primary" onclick="marcarVisita('${v.id}','realizada')">Realizada</button>
         <button class="btn btn-sm btn-danger" onclick="marcarVisita('${v.id}','no_show')">No-show</button>`
      : `<span class="badge ${v.status}">${v.status}</span>`;
    return `<tr><td>${v.cliente_nome ?? v.clienteId}</td><td>${dt}</td><td>${v.local ?? "—"}</td><td>${btns}</td></tr>`;
  }).join("");
  document.getElementById("table-visitas").innerHTML =
    rows || `<tr><td colspan="4" style="color:var(--muted);text-align:center;padding:32px">Nenhuma visita</td></tr>`;
}

window.marcarVisita = async (id, status) => {
  try {
    await api(`/visitas/${id}/status`, { method: "PUT", body: { status } });
    toast(`Visita marcada como ${status}`);
    loadVisitas();
  } catch (e) { toast(`Erro: ${e.message}`); }
};

// ── TAB: Operação ─────────────────────────────────────────────────────────
async function loadOperacao() {
  const disparos = await api("/disparos");
  const entries = disparos.slice(0, 100).map((d) => {
    const dt = new Date(d.criado_em).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
    return `<div class="log-entry ${d.status}">[${dt}] ${d.agente} → ${d.numero} | ${d.status}</div>`;
  }).join("");
  document.getElementById("log-disparos").innerHTML = entries || `<div class="log-entry" style="color:var(--muted)">Nenhum disparo registrado.</div>`;
}

// ── TAB: Config ──────────────────────────────────────────────────────────
async function loadConfig() {
  try {
    const cfg = await api("/config");
    const f = document.getElementById("form-config");
    if (cfg.whatsapp_provider) f.querySelector("[name=whatsapp_provider]").value = cfg.whatsapp_provider;
    if (cfg.evolution_url) f.querySelector("[name=evolution_url]").value = cfg.evolution_url;
    if (cfg.evolution_instance) f.querySelector("[name=evolution_instance]").value = cfg.evolution_instance;
    if (cfg.followup_dias) f.querySelector("[name=followup_dias]").value = cfg.followup_dias;
    if (cfg.reativador_dias) f.querySelector("[name=reativador_dias]").value = cfg.reativador_dias;
  } catch { /* silente na carga inicial */ }
}

document.getElementById("form-config")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const f = e.target;
  const data = {};
  new FormData(f).forEach((v, k) => { if (v) data[k] = v; });
  try {
    await api("/config", { method: "PUT", body: data });
    toast("Configuração salva");
  } catch (err) { toast(`Erro: ${err.message}`); }
});

// ── Tab loader ────────────────────────────────────────────────────────────
async function loadTab(tab) {
  try {
    if (tab === "catalogo") await loadCatalogo();
    else if (tab === "carteira") await loadCarteira();
    else if (tab === "conversas") await loadConversas();
    else if (tab === "visitas") await loadVisitas();
    else if (tab === "operacao") await loadOperacao();
    else if (tab === "config") await loadConfig();
  } catch (e) { toast(`Erro ao carregar: ${e.message}`); }
}

// ── Init ──────────────────────────────────────────────────────────────────
refreshStatus();
setInterval(refreshStatus, 30_000);
loadTab("catalogo");
