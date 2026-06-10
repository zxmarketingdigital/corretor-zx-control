#!/usr/bin/env node
/**
 * setup/importar-planilha.mjs — Importa CSV de imóveis ou clientes via API do Worker.
 *
 * Uso:
 *   node setup/importar-planilha.mjs imoveis  caminho.csv
 *   node setup/importar-planilha.mjs clientes caminho.csv
 *
 * Requer WORKER_URL e PANEL_TOKEN no .env ou no ambiente.
 *
 * Formatos de CSV aceitos:
 *   Imóveis:  titulo, tipo, transacao, preco, regiao, quartos, area_m2, descricao (separador , ou ;)
 *   Clientes: telefone, nome, regiao, tipo, orcamento_min, orcamento_max, finalidade
 */

import { readFileSync, existsSync } from "fs";
import { resolve } from "path";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const env = { ...carregarDotEnv(), ...process.env };

  const [, , tipo, arquivoArg] = process.argv;

  if (!tipo || !["imoveis", "clientes"].includes(tipo)) {
    console.error("Uso: node setup/importar-planilha.mjs imoveis|clientes caminho.csv");
    process.exit(1);
  }

  if (!arquivoArg) {
    console.error("Erro: informe o caminho do arquivo CSV.");
    process.exit(1);
  }

  const csvPath = resolve(process.cwd(), arquivoArg);
  if (!existsSync(csvPath)) {
    console.error(`Erro: arquivo não encontrado: ${csvPath}`);
    process.exit(1);
  }

  const workerUrl = (env["WORKER_URL"] || "").replace(/\/$/, "");
  const panelToken = env["PANEL_TOKEN"];

  if (!workerUrl || !panelToken) {
    console.error("Erro: WORKER_URL e PANEL_TOKEN precisam estar no .env ou no ambiente.");
    process.exit(1);
  }

  const csvContent = readFileSync(csvPath, "utf8");
  const endpoint = `/api/import/${tipo}`;

  console.log(`\n📤  Importando ${tipo} de ${csvPath}...`);

  let res;
  try {
    res = await fetch(`${workerUrl}${endpoint}`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${panelToken}`,
        "Content-Type":  "text/plain; charset=utf-8",
      },
      body: csvContent,
      signal: AbortSignal.timeout(30_000),
    });
  } catch (e) {
    console.error(`Erro ao conectar no Worker: ${e.message}`);
    process.exit(1);
  }

  let resultado;
  try {
    resultado = await res.json();
  } catch {
    console.error(`Worker retornou status ${res.status} sem JSON válido.`);
    process.exit(1);
  }

  if (!res.ok) {
    console.error(`Worker retornou ${res.status}: ${JSON.stringify(resultado)}`);
    process.exit(1);
  }

  const { inseridos = 0, atualizados = 0, erros = [] } = resultado;
  console.log(`✅  Inseridos: ${inseridos}  |  Atualizados: ${atualizados}`);
  if (erros.length > 0) {
    console.warn(`\n⚠️   ${erros.length} linha(s) com erro:`);
    erros.forEach((e) => console.warn(`     ${e}`));
  }
  console.log();
}

main().catch((e) => {
  console.error("Erro inesperado:", e);
  process.exit(1);
});
