// Testa setup/marca.mjs (validação + gravação) em diretório temporário. Rodar: node --test setup/marca.selftest.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, copyFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import vm from "node:vm";
import { validarMarca, gravarMarca, AVISO_COR_PADRAO } from "./marca.mjs";

function lerJs(arq, chave) {
  const ctx = { window: {} };
  vm.runInNewContext(readFileSync(arq, "utf8"), ctx);
  return ctx.window[chave];
}

test("nome vazio e cor inválida são erros", () => {
  const v = validarMarca({ nome: " ", cor_primaria: "azul" });
  assert.equal(v.ok, false);
  assert.equal(v.erros.length, 2);
});

test("sem cor: padrão âmbar com aviso explícito", () => {
  const v = validarMarca({ nome: "Ana" });
  assert.equal(v.ok, true);
  assert.equal(v.marca.cor_primaria, "#D97706");
  assert.deepEqual(v.avisos, [AVISO_COR_PADRAO]);
});

test("#RGB é normalizado; logo inexistente e extensão errada são rejeitados", () => {
  assert.equal(validarMarca({ nome: "A", cor_primaria: "#1ae" }).marca.cor_primaria, "#11AAEE");
  assert.equal(validarMarca({ nome: "A", cor_primaria: "#1ae", logo: "/nao/existe.png" }).ok, false);
  assert.equal(validarMarca({ nome: "A", cor_primaria: "#1ae", logo: "/x/arquivo.exe" }).ok, false);
  assert.equal(validarMarca({ nome: "A", cor_primaria: "#1ae", logo: "http://x.com/l.png" }).ok, false);
});

test("grava config preservando WORKER_URL/BEARER, copia logo e gera docs/marca.config.js", () => {
  const raiz = mkdtempSync(join(tmpdir(), "marca-"));
  mkdirSync(join(raiz, "painel"));
  writeFileSync(join(raiz, "painel", "config.js"), 'window.APP_CONFIG = { WORKER_URL: "https://w.example", BEARER_TOKEN: "tok" };');
  const logo = join(raiz, "origem.png");
  writeFileSync(logo, "png");
  const v = validarMarca({ nome: "Carlos", cor_primaria: "#1E88E5", logo });
  gravarMarca(v, { raiz, bearerToken: "outro" });
  const cfg = lerJs(join(raiz, "painel", "config.js"), "APP_CONFIG");
  assert.equal(cfg.WORKER_URL, "https://w.example");
  assert.equal(cfg.BEARER_TOKEN, "tok");
  assert.deepEqual(JSON.parse(JSON.stringify(cfg.MARCA)), { nome: "Carlos", cor_primaria: "#1E88E5", cor_secundaria: "", logo: "assets/logo.png" });
  assert.ok(existsSync(join(raiz, "painel", "assets", "logo.png")));
  assert.ok(existsSync(join(raiz, "docs", "assets", "logo.png")));
  const docs = lerJs(join(raiz, "docs", "marca.config.js"), "MARCA_CONFIG");
  assert.equal(docs.nome, "Carlos");
  assert.ok(!readFileSync(join(raiz, "docs", "marca.config.js"), "utf8").includes("BEARER"));
});

test("sem config.js prévio parte do exemplo e usa o bearer informado", () => {
  const raiz = mkdtempSync(join(tmpdir(), "marca-"));
  mkdirSync(join(raiz, "painel"));
  copyFileSync(new URL("../painel/config.example.js", import.meta.url), join(raiz, "painel", "config.example.js"));
  gravarMarca(validarMarca({ nome: "B", cor_primaria: "#112233" }), { raiz, bearerToken: "novo" });
  const cfg = lerJs(join(raiz, "painel", "config.js"), "APP_CONFIG");
  assert.equal(cfg.BEARER_TOKEN, "novo");
  assert.equal(cfg.MARCA.logo, "");
});

test("nome hostil não escapa do literal JS; logo com espaço e caminho absoluto funciona; docs nunca leva token", () => {
  const raiz = mkdtempSync(join(tmpdir(), "marca-"));
  mkdirSync(join(raiz, "painel"));
  writeFileSync(join(raiz, "painel", "config.js"), 'window.APP_CONFIG = { WORKER_URL: "https://w", BEARER_TOKEN: "segredo123", MARCA: { token: "segredo123" } };');
  mkdirSync(join(raiz, "pasta com espaço"));
  const logo = join(raiz, "pasta com espaço", "meu logo.PNG");
  writeFileSync(logo, "png");
  const hostil = 'Ana"; alert(1)//</script>\u2028\nX';
  const v = validarMarca({ nome: hostil, cor_primaria: "#112233", logo: `'${logo}'` });
  assert.equal(v.ok, true);
  gravarMarca(v, { raiz });
  const docsTxt = readFileSync(join(raiz, "docs", "marca.config.js"), "utf8");
  assert.ok(!docsTxt.includes("segredo123"));
  assert.ok(!docsTxt.includes("WORKER_URL"));
  const docs = lerJs(join(raiz, "docs", "marca.config.js"), "MARCA_CONFIG");
  assert.equal(docs.nome, 'Ana"; alert(1)//</script> X');
  assert.equal(docs.logo, "assets/logo.png");
  assert.deepEqual(Object.keys(docs).sort(), ["cor_primaria", "cor_secundaria", "logo", "nome"]);
  const cfg = lerJs(join(raiz, "painel", "config.js"), "APP_CONFIG");
  assert.equal(Object.keys(cfg.MARCA).includes("token"), false); // MARCA é substituída, não mesclada
});
