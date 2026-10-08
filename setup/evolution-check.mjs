// Checagem da Evolution API usada pelo setup/configure.mjs.
// Uma resposta vazia, ilegível ou sem a instância informada NÃO é sucesso: devolve { ok:false, motivo }.
// (Mesmo formato que src/adapters/whatsapp/evolution.ts lê: v2 plano {name, connectionStatus}; v1 {instance:{instanceName,status}}.)

const ESTADOS_VALIDOS = new Set(["open", "connecting", "close"]);

export async function verificarEvolution(url, instance, key, fetchFn = fetch) {
  const base = String(url ?? "").trim().replace(/\/+$/, "");
  const nome = String(instance ?? "").trim();
  if (!base) return { ok: false, motivo: "EVOLUTION_URL vazia" };
  if (!nome) return { ok: false, motivo: "EVOLUTION_INSTANCE vazia" };

  const res = await fetchFn(`${base}/instance/fetchInstances`, { headers: { apikey: key } });
  if (!res.ok) return { ok: false, motivo: `Evolution respondeu HTTP ${res.status} (verifique URL e API key)` };

  let data;
  try {
    data = await res.json();
  } catch {
    return { ok: false, motivo: "resposta da Evolution não é JSON válido (a URL aponta mesmo para a Evolution API?)" };
  }
  if (!Array.isArray(data)) return { ok: false, motivo: "resposta da Evolution inesperada (esperava a lista de instâncias)" };
  if (data.length === 0) return { ok: false, motivo: "a Evolution respondeu sem nenhuma instância (resposta vazia)" };

  const achada = data.find((d) => d && typeof d === "object" && (d.name ?? d.instance?.instanceName) === nome);
  if (!achada) return { ok: false, motivo: `instância "${nome}" não existe nesta Evolution (confira o nome)` };

  const estado = achada.connectionStatus ?? achada.instance?.status;
  if (typeof estado !== "string" || !ESTADOS_VALIDOS.has(estado)) {
    return { ok: false, motivo: `instância "${nome}" sem estado de conexão válido (recebido: ${JSON.stringify(estado ?? null)})` };
  }
  return { ok: true, estado };
}
