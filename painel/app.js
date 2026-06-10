// Painel Corretor ZX Control — SPA vanilla, sem bundler.
// Lê WORKER_URL e BEARER_TOKEN de window.APP_CONFIG (definido em config.js).

const cfg = window.APP_CONFIG ?? {};
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

// ── Modais de cadastro ────────────────────────────────────────────────────
function openModal(id) {
  document.getElementById(id)?.classList.add("open");
}
function closeModal(id) {
  document.getElementById(id)?.classList.remove("open");
}

// Fechar no X / botão Cancelar / clique fora / Esc
document.querySelectorAll(".modal-backdrop").forEach((bd) => {
  bd.addEventListener("click", (e) => { if (e.target === bd) bd.classList.remove("open"); });
  bd.querySelectorAll("[data-close]").forEach((btn) =>
    btn.addEventListener("click", () => bd.classList.remove("open")),
  );
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    document.querySelectorAll(".modal-backdrop.open").forEach((bd) => bd.classList.remove("open"));
  }
});

// Helpers de payload (contrato: numéricos como Number, checkbox como boolean)
function fdText(fd, key) {
  const v = (fd.get(key) ?? "").toString().trim();
  return v || undefined;
}
function fdNumber(fd, key) {
  const v = (fd.get(key) ?? "").toString().trim();
  return v === "" ? undefined : Number(v);
}
function stripUndefined(obj) {
  const out = {};
  Object.keys(obj).forEach((k) => { if (obj[k] !== undefined) out[k] = obj[k]; });
  return out;
}

// Abrir modais
document.getElementById("btn-novo-imovel")?.addEventListener("click", () => openModal("modal-imovel"));
document.getElementById("btn-novo-cliente")?.addEventListener("click", () => openModal("modal-cliente"));
document.getElementById("btn-nova-visita")?.addEventListener("click", async () => {
  const form = document.getElementById("form-nova-visita");
  const selCliente = form.querySelector("[name=cliente_id]");
  const selImovel = form.querySelector("[name=imovel_id]");
  selCliente.innerHTML = `<option value="">Carregando…</option>`;
  selImovel.innerHTML = `<option value="">—</option>`;
  openModal("modal-visita");
  try {
    const [clientes, imoveis] = await Promise.all([api("/clientes"), api("/imoveis")]);
    selCliente.innerHTML = `<option value="">Selecione o cliente…</option>` +
      clientes.map((c) => `<option value="${c.id}">${c.nome ?? "—"} · ${c.telefone}</option>`).join("");
    selImovel.innerHTML = `<option value="">— (nenhum)</option>` +
      imoveis.filter((i) => i.status === "ativo")
        .map((i) => `<option value="${i.id}">${i.titulo}</option>`).join("");
  } catch (e) {
    toast(`Erro ao carregar listas: ${e.message}`);
  }
});

// Submit: novo imóvel → POST /imoveis
document.getElementById("form-novo-imovel")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const fd = new FormData(e.target);
  const body = stripUndefined({
    titulo: fdText(fd, "titulo"),
    tipo: fdText(fd, "tipo"),
    transacao: fdText(fd, "transacao"),
    preco: fdNumber(fd, "preco"),
    cidade: fdText(fd, "cidade"),
    bairro: fdText(fd, "bairro"),
    regiao: fdText(fd, "regiao"),
    quartos: fdNumber(fd, "quartos"),
    area_m2: fdNumber(fd, "area_m2"),
    descricao: fdText(fd, "descricao"),
  });
  try {
    await api("/imoveis", { method: "POST", body });
    toast("Imóvel cadastrado");
    closeModal("modal-imovel");
    e.target.reset();
    loadCatalogo();
  } catch (err) { toast(`Erro: ${err.message}`); }
});

// Submit: novo cliente → POST /clientes
document.getElementById("form-novo-cliente")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const fd = new FormData(e.target);
  const body = stripUndefined({
    nome: fdText(fd, "nome"),
    telefone: fdText(fd, "telefone"),
    regiao: fdText(fd, "regiao"),
    tipo: fdText(fd, "tipo"),
    finalidade: fdText(fd, "finalidade"),
    orcamento_min: fdNumber(fd, "orcamento_min"),
    orcamento_max: fdNumber(fd, "orcamento_max"),
    elegivel_proativo: e.target.querySelector("[name=elegivel_proativo]").checked,
  });
  try {
    await api("/clientes", { method: "POST", body });
    toast("Cliente cadastrado");
    closeModal("modal-cliente");
    e.target.reset();
    loadCarteira();
  } catch (err) { toast(`Erro: ${err.message}`); }
});

// Submit: agendar visita → POST /visitas
document.getElementById("form-nova-visita")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const fd = new FormData(e.target);
  const agendadaLocal = (fd.get("agendada_para") ?? "").toString();
  const body = stripUndefined({
    cliente_id: fdText(fd, "cliente_id"),
    imovel_id: fdText(fd, "imovel_id"),
    local: fdText(fd, "local"),
    agendada_para: agendadaLocal ? new Date(agendadaLocal).toISOString() : undefined,
  });
  try {
    await api("/visitas", { method: "POST", body });
    toast("Visita agendada");
    closeModal("modal-visita");
    e.target.reset();
    loadVisitas();
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
