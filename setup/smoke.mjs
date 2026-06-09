/**
 * setup/smoke.mjs — Validação pós-instalação (linha ZX Control v3).
 * Sai com código 1 se qualquer check crítico falhar.
 *
 * PRINCÍPIO: este script SÓ VALIDA, nunca gera nem altera lógica.
 *
 * Uso:
 *   node setup/smoke.mjs
 *
 * Variáveis opcionais:
 *   SMOKE_TEST_PHONE  — número (E.164 com DDI, ex: 5511999990001) para testar envio WhatsApp.
 *                       Se ausente, o check de WhatsApp é pulado (sem falha).
 *   WORKER_URL        — URL do Worker deployado. Se ausente, check /health é pulado.
 */

import { readFileSync, existsSync } from "fs";
import { resolve } from "path";
import { createClient } from "@supabase/supabase-js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Carrega .env do CWD sem dependências externas. */
function carregarDotEnv() {
  const envPath = resolve(process.cwd(), ".env");
  if (!existsSync(envPath)) return {};
  const linhas = readFileSync(envPath, "utf8").split("\n");
  const resultado = {};
  for (const linha of linhas) {
    const sem = linha.replace(/#[^'"]*$/, "").trim();
    if (!sem || !sem.includes("=")) continue;
    const idx = sem.indexOf("=");
    const chave = sem.slice(0, idx).trim().replace(/^export\s+/, "");
    let valor = sem.slice(idx + 1).trim();
    if ((valor.startsWith('"') && valor.endsWith('"')) ||
        (valor.startsWith("'") && valor.endsWith("'"))) {
      valor = valor.slice(1, -1);
    }
    if (chave) resultado[chave] = valor;
  }
  return resultado;
}

/** Nome do negócio em runtime — primeira var terminada em _NOME (ex: CORRETOR_NOME). */
function nomeNegocio(env) {
  const par = Object.entries(env).find(([k]) => k.endsWith("_NOME"));
  return (par && par[1]) || "(produto)";
}

const OK   = "✅";
const FAIL = "❌";
const SKIP = "⚠️ ";

// Tabela e colunas do schema (confira em supabase/migrations/0001_init.sql):
const TABELA_CONTATOS = "clientes";
const COL_NOME        = "nome";
const COL_TELEFONE    = "telefone";   // unique — chave de conflito no upsert

// ---------------------------------------------------------------------------
// Checks
// ---------------------------------------------------------------------------

/** Check 1 — Variáveis obrigatórias presentes. */
function checkVars(env) {
  // WEBHOOK_SECRET excluído: autentica o webhook entrante (provider→Worker), não é usado aqui.
  const obrigatorias = [
    "CORRETOR_NOME",
    "WHATSAPP_PROVIDER",
    "EVOLUTION_URL",
    "EVOLUTION_INSTANCE",
    "EVOLUTION_API_KEY",
    "SUPABASE_URL",
    "SUPABASE_SERVICE_KEY",
    "SUPABASE_ANON_KEY",
    "GEMINI_API_KEY",
    "PANEL_TOKEN",
    "GOOGLE_REVIEW_LINK",
  ];
  const faltando = obrigatorias.filter((k) => !env[k]);
  if (faltando.length > 0) {
    return { passou: false, msg: `Variáveis ausentes: ${faltando.join(", ")}` };
  }
  return { passou: true, msg: "Todas as variáveis obrigatórias presentes." };
}

/** Check 2 — Supabase: insert, read, delete de registro de teste. */
async function checkSupabase(url, serviceKey) {
  const supabase = createClient(url, serviceKey, { auth: { persistSession: false } });
  const testPhone = "5500000000000";
  try {
    const { error: insErr } = await supabase
      .from(TABELA_CONTATOS)
      .upsert({ [COL_NOME]: "Smoke Test", [COL_TELEFONE]: testPhone }, { onConflict: COL_TELEFONE });
    if (insErr) return { passou: false, msg: `Upsert falhou: ${insErr.message}` };

    const { data, error: selErr } = await supabase
      .from(TABELA_CONTATOS)
      .select(COL_TELEFONE)
      .eq(COL_TELEFONE, testPhone)
      .single();
    if (selErr || !data) return { passou: false, msg: `Select falhou: ${selErr?.message}` };

    const { error: delErr } = await supabase
      .from(TABELA_CONTATOS)
      .delete()
      .eq(COL_TELEFONE, testPhone);
    if (delErr) return { passou: false, msg: `Delete falhou: ${delErr.message}` };

    return { passou: true, msg: "Insert + read + delete OK." };
  } catch (e) {
    return { passou: false, msg: `Exceção: ${e.message}` };
  }
}

/** Check 3 — WhatsApp: envia mensagem de teste para SMOKE_TEST_PHONE. Pulado se ausente. */
async function checkWhatsApp(env) {
  const phone = env["SMOKE_TEST_PHONE"];
  if (!phone) {
    return { passou: true, pulado: true, msg: "SMOKE_TEST_PHONE não definido — check pulado." };
  }
  const provider = (env["WHATSAPP_PROVIDER"] || "evolution").toLowerCase();
  const texto = `🔧 Smoke test ${nomeNegocio(env)} — pode ignorar esta mensagem.`;

  try {
    if (provider === "evolution") {
      const url      = (env["EVOLUTION_URL"] || "").replace(/\/$/, "");
      const instance = env["EVOLUTION_INSTANCE"];
      const res = await fetch(`${url}/message/sendText/${instance}`, {
        method:  "POST",
        headers: { "Content-Type": "application/json", apikey: env["EVOLUTION_API_KEY"] },
        body:    JSON.stringify({ number: phone, text: texto }),
        signal:  AbortSignal.timeout(10_000),
      });
      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        return { passou: false, pulado: false, msg: `Evolution retornou ${res.status}: ${txt.slice(0, 200)}` };
      }
      return { passou: true, pulado: false, msg: `Mensagem de teste enviada para ${phone}.` };
    }
    return { passou: true, pulado: true, msg: `Provider '${provider}' não coberto no smoke — check pulado.` };
  } catch (e) {
    return { passou: false, pulado: false, msg: `Erro ao chamar provider: ${e.message}` };
  }
}

/** Check 4 — Gemini: chamada trivial com GEMINI_API_KEY. */
async function checkGemini(apiKey, env) {
  const model = env["GEMINI_MODEL"] || "gemini-2.0-flash";
  const url   = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  const body  = JSON.stringify({
    contents: [{ parts: [{ text: "Responda apenas a palavra: ok" }] }],
    generationConfig: { maxOutputTokens: 5 },
  });
  try {
    const res = await fetch(url, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body,
      signal: AbortSignal.timeout(15_000),
    });
    if (res.status === 400 || res.status === 401 || res.status === 403) {
      const txt = await res.text().catch(() => "");
      return { passou: false, msg: `Gemini auth error ${res.status}: ${txt.slice(0, 200)}` };
    }
    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      return { passou: false, msg: `Gemini retornou ${res.status}: ${txt.slice(0, 200)}` };
    }
    return { passou: true, msg: "Autenticação e resposta OK." };
  } catch (e) {
    return { passou: false, msg: `Erro ao chamar Gemini: ${e.message}` };
  }
}

/** Check 5 — Worker /health: GET e espera 200. Pulado se WORKER_URL ausente. */
async function checkWorker(workerUrl) {
  if (!workerUrl) {
    return { passou: true, pulado: true, msg: "WORKER_URL não definido — check pulado." };
  }
  const healthUrl = workerUrl.replace(/\/$/, "") + "/health";
  try {
    const res = await fetch(healthUrl, { signal: AbortSignal.timeout(10_000) });
    if (res.status !== 200) {
      return { passou: false, pulado: false, msg: `Worker /health retornou ${res.status} (esperado 200).` };
    }
    return { passou: true, pulado: false, msg: "Worker /health OK (200)." };
  } catch (e) {
    return { passou: false, pulado: false, msg: `Erro ao chamar Worker: ${e.message}` };
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const env = { ...carregarDotEnv(), ...process.env };

  console.log(`\n🔍  Smoke test — ${nomeNegocio(env)}`);
  console.log("=".repeat(50));

  let falhou = false;

  {
    const r = checkVars(env);
    console.log(`${r.passou ? OK : FAIL}  [1/5] Variáveis: ${r.msg}`);
    if (!r.passou) falhou = true;
  }

  if (env["SUPABASE_URL"] && env["SUPABASE_SERVICE_KEY"]) {
    const r = await checkSupabase(env["SUPABASE_URL"], env["SUPABASE_SERVICE_KEY"]);
    console.log(`${r.passou ? OK : FAIL}  [2/5] Supabase: ${r.msg}`);
    if (!r.passou) falhou = true;
  } else {
    console.log(`${FAIL}  [2/5] Supabase: credenciais ausentes.`);
    falhou = true;
  }

  {
    const r = await checkWhatsApp(env);
    const icon = r.pulado ? SKIP : r.passou ? OK : FAIL;
    console.log(`${icon}  [3/5] WhatsApp: ${r.msg}`);
    if (!r.passou && !r.pulado) falhou = true;
  }

  if (env["GEMINI_API_KEY"]) {
    const r = await checkGemini(env["GEMINI_API_KEY"], env);
    console.log(`${r.passou ? OK : FAIL}  [4/5] Gemini: ${r.msg}`);
    if (!r.passou) falhou = true;
  } else {
    console.log(`${FAIL}  [4/5] Gemini: GEMINI_API_KEY ausente.`);
    falhou = true;
  }

  {
    const r = await checkWorker(env["WORKER_URL"]);
    const icon = r.pulado ? SKIP : r.passou ? OK : FAIL;
    console.log(`${icon}  [5/5] Worker: ${r.msg}`);
    if (!r.passou && !r.pulado) falhou = true;
  }

  console.log("=".repeat(50));
  if (falhou) {
    console.log(`\n${FAIL}  Smoke falhou. Corrija os erros acima e rode novamente.\n`);
    process.exit(1);
  } else {
    console.log(`\n${OK}  Tudo OK! Instalação validada com sucesso.\n`);
  }
}

main().catch((e) => {
  console.error("Erro inesperado no smoke:", e);
  process.exit(1);
});
