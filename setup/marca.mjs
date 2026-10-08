#!/usr/bin/env node
// Marca do aluno: valida nome, cor primária, cor secundária e logo, e grava no config que o painel lê.
//
// Dois jeitos de usar:
//   1) Pelo wizard: setup/configure.mjs importa perguntarMarca() e gravarMarca().
//   2) Direto (é o que o Claude Code roda na conversa de instalação):
//        node setup/marca.mjs --nome "Carlos Imóveis" --cor "#1E88E5" [--cor-secundaria "#0D47A1"] \
//             [--logo ~/Downloads/logo.png | --logo https://site.com/logo.svg] [--check]
//      O token do painel NÃO vai por argumento (apareceria no histórico e na lista de processos):
//      é lido de PANEL_TOKEN (ambiente) ou da linha PANEL_TOKEN= do .env na raiz do repo.
//      --check só valida e imprime, sem gravar nada.
//
// Onde grava (tudo gitignored; nada disso vai pro repositório público):
//   painel/config.js        window.APP_CONFIG.MARCA  (o painel já lê esse arquivo)
//   docs/marca.config.js    window.MARCA_CONFIG      (páginas de docs/, sem token nenhum)
//   painel/assets/logo.*    cópia do logo local (docs/assets/logo.* também)

import { existsSync, mkdirSync, copyFileSync, readFileSync, writeFileSync, readdirSync, unlinkSync } from "node:fs";
import { join, dirname, extname, resolve } from "node:path";
import { homedir } from "node:os";
import { fileURLToPath, pathToFileURL } from "node:url";

await import("../painel/marca.js"); // script clássico: registra globalThis.ZXMarca (mesma lógica do navegador)
const Z = globalThis.ZXMarca;

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..");
const EXT_LOGO = [".png", ".jpg", ".jpeg", ".svg", ".webp"];

export const AVISO_COR_PADRAO =
  "Usando a cor padrão ZX (âmbar). Troque depois em painel/config.js (campo MARCA.cor_primaria).";

// ── Validação de cada campo ────────────────────────────────────────────────

/** @returns {{ok:true,valor:string|null,padrao?:boolean}|{ok:false,erro:string}} */
export function validarCor(v, { obrigatoria }) {
  const s = String(v ?? "").trim();
  if (!s) return obrigatoria ? { ok: true, valor: Z.COR_PADRAO, padrao: true } : { ok: true, valor: null };
  const h = Z.normalizarHex(s);
  return h ? { ok: true, valor: h } : { ok: false, erro: `"${s}" não é uma cor válida. Use o formato #RRGGBB (ex: #1E88E5) ou #RGB.` };
}

function limparCaminho(s) {
  let t = String(s).trim();
  // arrastar arquivo pro terminal costuma vir entre aspas ou com espaços escapados
  if ((t.startsWith('"') && t.endsWith('"')) || (t.startsWith("'") && t.endsWith("'"))) t = t.slice(1, -1);
  t = t.replace(/\\ /g, " ");
  if (t === "~" || t.startsWith("~/")) t = join(homedir(), t.slice(1));
  return t;
}

/** Logo: vazio, URL https ou caminho de arquivo local (png/jpg/svg/webp). */
export function validarLogoEntrada(v) {
  const s = String(v ?? "").trim();
  if (!s) return { ok: true, logo: null, origem: null };
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(s)) {
    const url = Z.validarLogo(s);
    return url ? { ok: true, logo: url, origem: null } : { ok: false, erro: "Para logo por link, use uma URL https:// completa." };
  }
  const caminho = resolve(limparCaminho(s));
  if (!EXT_LOGO.includes(extname(caminho).toLowerCase())) return { ok: false, erro: `Logo precisa ser png, jpg, svg ou webp (recebi "${extname(caminho) || "sem extensão"}").` };
  if (!existsSync(caminho)) return { ok: false, erro: `Não achei o arquivo ${caminho}.` };
  return { ok: true, logo: null, origem: caminho }; // logo vira "assets/logo.<ext>" ao gravar
}

/** Valida os 4 campos de uma vez. Não grava nada. */
export function validarMarca({ nome, cor_primaria, cor_secundaria, logo }) {
  const erros = [];
  const avisos = [];
  const n = String(nome ?? "").replace(/\s+/g, " ").trim(); // quebra de linha/U+2028 no nome não vai pro JS gerado
  if (!n) erros.push("nome é obrigatório.");
  const cor = validarCor(cor_primaria, { obrigatoria: true });
  if (!cor.ok) erros.push(`cor_primaria: ${cor.erro}`);
  else if (cor.padrao) avisos.push(AVISO_COR_PADRAO);
  const sec = validarCor(cor_secundaria, { obrigatoria: false });
  if (!sec.ok) erros.push(`cor_secundaria: ${sec.erro}`);
  const lg = validarLogoEntrada(logo);
  if (!lg.ok) erros.push(`logo: ${lg.erro}`);
  if (erros.length) return { ok: false, erros, avisos };
  return {
    ok: true,
    erros,
    avisos,
    marca: { nome: n, cor_primaria: cor.valor, cor_secundaria: sec.valor ?? "", logo: lg.logo ?? "" },
    logoOrigem: lg.origem,
  };
}

// ── Pergunta interativa (usada pelo wizard) ────────────────────────────────

async function perguntarAte(ask, texto, validar) {
  for (;;) {
    const r = validar(await ask(texto));
    if (r.ok) return r;
    console.log(`  ✗ ${r.erro}`);
  }
}

export async function perguntarMarca(ask, { nomePadrao = "" } = {}) {
  console.log("  A marca aparece no painel que o cliente vai ver (cor, nome e logo).");
  const nome = await perguntarAte(ask, `  Nome da marca${nomePadrao ? ` [${nomePadrao}]` : ""}: `, (v) => {
    const s = String(v).trim() || nomePadrao;
    return s ? { ok: true, valor: s } : { ok: false, erro: "O nome é obrigatório." };
  });
  const cor = await perguntarAte(ask, `  Cor primária em hex (ex: #1E88E5) — Enter usa o âmbar padrão ZX: `, (v) => validarCor(v, { obrigatoria: true }));
  if (cor.padrao) console.log(`  ⚠ ${AVISO_COR_PADRAO}`);
  const sec = await perguntarAte(ask, "  Cor secundária em hex (opcional, Enter pula): ", (v) => validarCor(v, { obrigatoria: false }));
  const logo = await perguntarAte(ask, "  Logo: caminho do arquivo (png/jpg/svg/webp) ou link https (opcional, Enter pula): ", validarLogoEntrada);
  return {
    marca: { nome: nome.valor, cor_primaria: cor.valor, cor_secundaria: sec.valor ?? "", logo: logo.logo ?? "" },
    logoOrigem: logo.origem,
  };
}

// ── Gravação ───────────────────────────────────────────────────────────────

/**
 * Lê `window.APP_CONFIG = {...};` SEM executar o arquivo. Aceita só o formato que o painel usa:
 * objeto literal com strings, números, booleanos, null, objetos aninhados, comentários e vírgula final.
 * Qualquer outra construção (chamada, location.origin, template literal) lança erro.
 * Retorna null se o arquivo não existe.
 */
export function lerAppConfig(arquivo) {
  if (!existsSync(arquivo)) return null;
  const src = readFileSync(arquivo, "utf8");
  let json = "";
  let i = 0;
  const n = src.length;
  while (i < n) {
    const c = src[i];
    if (c === '"' || c === "'") { // string: copia como JSON
      let j = i + 1, buf = "";
      while (j < n && src[j] !== c) {
        if (src[j] === "\\") { buf += src[j] + (src[j + 1] ?? ""); j += 2; } else { buf += src[j++]; }
      }
      if (j >= n) throw new Error("string sem fechamento");
      json += c === '"' ? `"${buf}"` : JSON.stringify(buf.replace(/\\(.)/g, "$1"));
      i = j + 1;
    } else if (c === "/" && src[i + 1] === "/") { while (i < n && src[i] !== "\n") i++; }
    else if (c === "/" && src[i + 1] === "*") { const e = src.indexOf("*/", i + 2); if (e < 0) throw new Error("comentário sem fechamento"); i = e + 2; }
    else { json += c; i++; }
  }
  const m = /^\s*window\.APP_CONFIG\s*=\s*(\{[\s\S]*\})\s*;?\s*$/.exec(json);
  if (!m) throw new Error("formato inesperado (esperado: window.APP_CONFIG = { ... };)");
  const corpo = m[1]
    .replace(/([{,]\s*)([A-Za-z_$][\w$]*)(\s*:)/g, '$1"$2"$3') // chaves sem aspas
    .replace(/,(\s*[}\]])/g, "$1"); // vírgula final
  const cfg = JSON.parse(corpo); // qualquer expressão (location.origin, chamadas) falha aqui
  if (!cfg || typeof cfg !== "object" || Array.isArray(cfg)) throw new Error("APP_CONFIG não é um objeto");
  return cfg;
}

function copiarLogo(origem, raiz) {
  const ext = extname(origem).toLowerCase();
  const nomeFinal = `logo${ext}`;
  for (const dir of [join(raiz, "painel", "assets"), join(raiz, "docs", "assets")]) {
    mkdirSync(dir, { recursive: true });
    for (const f of readdirSync(dir)) if (/^logo\.[a-z]+$/i.test(f) && f !== nomeFinal) unlinkSync(join(dir, f)); // troca de extensão não deixa logo velho
    copyFileSync(origem, join(dir, nomeFinal));
  }
  return `assets/${nomeFinal}`;
}

/**
 * Grava a marca. `entrada` é o retorno de validarMarca()/perguntarMarca() ({marca, logoOrigem}).
 * Preserva WORKER_URL/BEARER_TOKEN de um painel/config.js que já exista.
 */
export function gravarMarca({ marca, logoOrigem }, { raiz = RAIZ, bearerToken } = {}) {
  // whitelist: só os 4 campos da marca. Nada mais (token, URL do Worker) entra em docs/marca.config.js
  const m = { nome: marca.nome, cor_primaria: marca.cor_primaria, cor_secundaria: marca.cor_secundaria ?? "", logo: marca.logo ?? "" };
  if (logoOrigem) m.logo = copiarLogo(logoOrigem, raiz);

  const arquivoConfig = join(raiz, "painel", "config.js");
  let base;
  try {
    base = lerAppConfig(arquivoConfig) ?? lerAppConfig(join(raiz, "painel", "config.example.js")) ?? {};
  } catch (e) {
    // não sobrescreve um config existente que não foi entendido: perderia WORKER_URL e token
    throw new Error(`Não consegui ler painel/config.js (${e.message}). Nada foi alterado. Corrija o arquivo (ou mova-o) e rode de novo.`);
  }
  const cfg = { ...base, MARCA: m };
  // token novo (PANEL_TOKEN do wizard/.env) sincroniza o painel; sem token novo, o existente fica
  if (bearerToken) cfg.BEARER_TOKEN = bearerToken;
  writeFileSync(
    arquivoConfig,
    "// Gerado por setup/marca.mjs. Contém o token do painel: NÃO commitar (está no .gitignore).\n" +
      `window.APP_CONFIG = ${JSON.stringify(cfg, null, 2)};\n`,
  );

  mkdirSync(join(raiz, "docs"), { recursive: true });
  const arquivoDocs = join(raiz, "docs", "marca.config.js");
  writeFileSync(
    arquivoDocs,
    "// Gerado por setup/marca.mjs: marca para as páginas de docs/ (sem token). NÃO commitar (está no .gitignore).\n" +
      `window.MARCA_CONFIG = ${JSON.stringify(m, null, 2)};\n`,
  );
  return { marca: m, arquivos: [arquivoConfig, arquivoDocs] };
}

// ── CLI ────────────────────────────────────────────────────────────────────

/** Token do painel: variável de ambiente ou .env/.dev.vars da raiz (gitignored). Nunca por argumento. */
export function lerPanelToken(raiz = RAIZ, env = process.env) {
  if (env.PANEL_TOKEN) return env.PANEL_TOKEN.trim();
  for (const f of [".env", ".dev.vars"]) {
    const arq = join(raiz, f);
    if (!existsSync(arq)) continue;
    const m = /^\s*PANEL_TOKEN\s*=\s*["']?([^"'\r\n]+?)["']?\s*$/m.exec(readFileSync(arq, "utf8"));
    if (m) return m[1];
  }
  return undefined;
}

function lerArgs(argv) {
  const out = {};
  const mapa = { "--nome": "nome", "--cor": "cor_primaria", "--cor-secundaria": "cor_secundaria", "--logo": "logo" };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--check") out.check = true;
    else if (mapa[argv[i]]) out[mapa[argv[i]]] = argv[++i] ?? "";
    else throw new Error(`Argumento desconhecido: ${argv[i]}`);
  }
  return out;
}

async function main() {
  let args;
  try { args = lerArgs(process.argv.slice(2)); } catch (e) { console.error(e.message); process.exit(2); }
  const v = validarMarca(args);
  for (const a of v.avisos) console.log(`⚠ ${a}`);
  if (!v.ok) {
    for (const e of v.erros) console.error(`✗ ${e}`);
    process.exit(1);
  }
  if (args.check) {
    console.log(JSON.stringify({ ...v.marca, logoOrigem: v.logoOrigem }, null, 2));
    return;
  }
  let r;
  try { r = gravarMarca(v, { bearerToken: lerPanelToken() }); } catch (e) { console.error(`✗ ${e.message}`); process.exit(1); }
  console.log(`✓ Marca gravada: ${r.marca.nome} · ${r.marca.cor_primaria}${r.marca.logo ? ` · logo ${r.marca.logo}` : " · sem logo (só o nome)"}`);
  for (const a of r.arquivos) console.log(`  ${a}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
