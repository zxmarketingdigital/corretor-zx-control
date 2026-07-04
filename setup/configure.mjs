#!/usr/bin/env node
// Wizard de configuração do Corretor ZX Control.
// Uso: node setup/configure.mjs
// Requerimentos: Node 22+, acesso ao Supabase e Evolution já provisionados.

import { createInterface } from "readline";
import { writeFileSync, existsSync } from "fs";

const rl = createInterface({ input: process.stdin, output: process.stdout });
const ask = (q) => new Promise((r) => rl.question(q, r));

function section(title) {
  console.log(`\n${"─".repeat(50)}`);
  console.log(`  ${title}`);
  console.log("─".repeat(50));
}

async function pingSupabase(url, key) {
  const res = await fetch(`${url}/rest/v1/imoveis?select=id&limit=1`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  });
  return res.ok || res.status === 406; // 406 = tabela existe mas sem dados
}

async function pingGemini(key) {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${key}`,
    { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents: [{ parts: [{ text: "ping" }] }] }) },
  );
  return res.ok;
}

async function pingEvolution(url, instance, key) {
  const res = await fetch(`${url}/instance/fetchInstances`, {
    headers: { apikey: key },
  });
  if (!res.ok) return false;
  const data = await res.json().catch(() => []);
  return Array.isArray(data);
}

console.log("\n╔══════════════════════════════════════════════╗");
console.log("║   Corretor ZX Control — Wizard de Setup     ║");
console.log("╚══════════════════════════════════════════════╝");

section("1. Dados do Corretor");
const nomeCorretor = await ask("  Nome do corretor: ");
const googleLink = await ask("  Link Google Minha Empresa (avaliações): ");

section("2. Supabase");
const supabaseUrl = await ask("  SUPABASE_URL (ex: https://xxx.supabase.co): ");
const supabaseKey = await ask("  SUPABASE_SERVICE_KEY (service_role key): ");
process.stdout.write("  Verificando conexão Supabase… ");
const supabaseOk = await pingSupabase(supabaseUrl, supabaseKey).catch(() => false);
console.log(supabaseOk ? "✓ OK" : "✗ Falhou (verifique URL e key)");

section("3. Gemini Flash");
const geminiKey = await ask("  GEMINI_API_KEY: ");
process.stdout.write("  Verificando Gemini… ");
const geminiOk = await pingGemini(geminiKey).catch(() => false);
console.log(geminiOk ? "✓ OK" : "✗ Falhou (verifique a API key)");

section("4. Evolution API (WhatsApp)");
const evolutionUrl = await ask("  EVOLUTION_URL (ex: https://evo.seuservidor.com): ");
const evolutionInstance = await ask("  EVOLUTION_INSTANCE: ");
const evolutionKey = await ask("  EVOLUTION_API_KEY: ");
process.stdout.write("  Verificando Evolution… ");
const evoOk = await pingEvolution(evolutionUrl, evolutionInstance, evolutionKey).catch(() => false);
console.log(evoOk ? "✓ OK" : "✗ Falhou (verifique URL, instância e key)");

section("5. Segurança do Painel");
const panelToken = await ask("  PANEL_TOKEN (token secreto para o painel — crie um forte): ");
const webhookSecret = await ask("  WEBHOOK_SECRET (segredo para validar webhooks): ");

rl.close();

// Escreve .dev.vars (desenvolvimento local)
const devVars = [
  `CORRETOR_NOME="${nomeCorretor}"`,
  `GOOGLE_REVIEW_LINK="${googleLink}"`,
  `SUPABASE_URL="${supabaseUrl}"`,
  `SUPABASE_SERVICE_KEY="${supabaseKey}"`,
  `GEMINI_API_KEY="${geminiKey}"`,
  `WHATSAPP_PROVIDER="evolution"`,
  `EVOLUTION_URL="${evolutionUrl}"`,
  `EVOLUTION_INSTANCE="${evolutionInstance}"`,
  `EVOLUTION_API_KEY="${evolutionKey}"`,
  `PANEL_TOKEN="${panelToken}"`,
  `WEBHOOK_SECRET="${webhookSecret}"`,
].join("\n");

writeFileSync(".dev.vars", devVars);
console.log("\n  ✓ .dev.vars criado (apenas para desenvolvimento local)");

section("6. Próximos passos");
console.log(`
  1. Aplique as migrations no Supabase:
     psql "$SUPABASE_URL" -f supabase/migrations/0001_init.sql
     psql "$SUPABASE_URL" -f supabase/migrations/0002_config.sql

  2. (Opcional) Carregue dados demo:
     psql "$SUPABASE_URL" -f setup/seed.sql

  3. Configure os secrets no Wrangler (produção):
     pnpm exec wrangler secret put SUPABASE_URL
     pnpm exec wrangler secret put SUPABASE_SERVICE_KEY
     pnpm exec wrangler secret put GEMINI_API_KEY
     pnpm exec wrangler secret put EVOLUTION_URL
     pnpm exec wrangler secret put EVOLUTION_INSTANCE
     pnpm exec wrangler secret put EVOLUTION_API_KEY
     pnpm exec wrangler secret put PANEL_TOKEN
     pnpm exec wrangler secret put WEBHOOK_SECRET

  4. Faça o deploy:
     pnpm run deploy

  5. Configure o painel (Cloudflare Pages):
     - cp painel/config.example.js painel/config.js
     - Edite com WORKER_URL e BEARER_TOKEN
     - Suba o painel para Cloudflare Pages

  6. Conecte o WhatsApp:
     - Acesse o painel → Config → Status Evolution → "Reconectar"
     - Escaneie o QR Code com o WhatsApp do corretor

  7. Smoke test:
     WORKER_URL=https://... PANEL_TOKEN=... WEBHOOK_SECRET=... node setup/smoke.mjs
`);

if (!supabaseOk || !geminiOk || !evoOk) {
  console.warn("  ⚠  Uma ou mais verificações falharam. Revise as credenciais antes de continuar.\n");
  process.exit(1);
}
console.log("  Setup completo! Boa instalação.\n");
