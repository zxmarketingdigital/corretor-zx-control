// Testa setup/marca.mjs (validação + gravação) em diretório temporário. Rodar: node --test setup/marca.selftest.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, copyFileSync, symlinkSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import vm from "node:vm";
import { validarMarca, gravarMarca, lerPanelToken, lerAppConfig, AVISO_COR_PADRAO } from "./marca.mjs";

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
  gravarMarca(v, { raiz });
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

test("token do painel vem de env ou .env, nunca de argumento", () => {
  const raiz = mkdtempSync(join(tmpdir(), "marca-"));
  assert.equal(lerPanelToken(raiz, {}), undefined);
  writeFileSync(join(raiz, ".env"), 'A=1\nPANEL_TOKEN="czx-abc"\n');
  assert.equal(lerPanelToken(raiz, {}), "czx-abc");
  assert.equal(lerPanelToken(raiz, { PANEL_TOKEN: "envtok" }), "envtok");
});

test("config.js é lido sem executar: comentários, // dentro de URL, aspas simples e vírgula final", () => {
  const raiz = mkdtempSync(join(tmpdir(), "marca-"));
  const arq = join(raiz, "config.js");
  writeFileSync(arq, `// topo\nwindow.APP_CONFIG = {\n  WORKER_URL: 'https://w.example/x', /* c */\n  "BEARER_TOKEN": "t//k", // fim\n  MARCA: { nome: "A", },\n};\n`);
  assert.deepEqual(JSON.parse(JSON.stringify(lerAppConfig(arq))), { WORKER_URL: "https://w.example/x", BEARER_TOKEN: "t//k", MARCA: { nome: "A" } });
});

test("config.js com código (escape de contexto, location.origin) é recusado sem executar e sem sobrescrever", () => {
  const raiz = mkdtempSync(join(tmpdir(), "marca-"));
  mkdirSync(join(raiz, "painel"));
  const marcador = join(raiz, "executou.txt");
  const hostil = `window.APP_CONFIG = { X: this.constructor.constructor("return process")().mainModule.require("fs").writeFileSync(${JSON.stringify(marcador)}, "x") };`;
  const arq = join(raiz, "painel", "config.js");
  writeFileSync(arq, hostil);
  assert.throws(() => gravarMarca(validarMarca({ nome: "A", cor_primaria: "#112233" }), { raiz }), /Nada foi alterado/);
  assert.equal(existsSync(marcador), false);
  assert.equal(readFileSync(arq, "utf8"), hostil);
  const dinamico = 'window.APP_CONFIG = { WORKER_URL: location.origin, BEARER_TOKEN: "t" };';
  writeFileSync(arq, dinamico);
  assert.throws(() => gravarMarca(validarMarca({ nome: "A", cor_primaria: "#112233" }), { raiz }), /Nada foi alterado/);
  assert.equal(readFileSync(arq, "utf8"), dinamico);
});

test("token novo sincroniza o painel; sem token novo o existente fica", () => {
  const raiz = mkdtempSync(join(tmpdir(), "marca-"));
  mkdirSync(join(raiz, "painel"));
  writeFileSync(join(raiz, "painel", "config.js"), 'window.APP_CONFIG = { WORKER_URL: "https://w.example", BEARER_TOKEN: "antigo" };');
  const v = validarMarca({ nome: "A", cor_primaria: "#112233" });
  gravarMarca(v, { raiz });
  assert.equal(lerJs(join(raiz, "painel", "config.js"), "APP_CONFIG").BEARER_TOKEN, "antigo");
  gravarMarca(v, { raiz, bearerToken: "novo" });
  assert.equal(lerJs(join(raiz, "painel", "config.js"), "APP_CONFIG").BEARER_TOKEN, "novo");
});

test("symlink no config, nas pastas ou no logo é recusado sem gravar fora da raiz", () => {
  const raiz = mkdtempSync(join(tmpdir(), "marca-"));
  const fora = mkdtempSync(join(tmpdir(), "fora-"));
  mkdirSync(join(raiz, "painel"));
  const v = validarMarca({ nome: "A", cor_primaria: "#112233" });
  // config.js é link para fora
  writeFileSync(join(fora, "alvo.js"), "NAO_TOCAR");
  symlinkSync(join(fora, "alvo.js"), join(raiz, "painel", "config.js"));
  assert.throws(() => gravarMarca(v, { raiz }), /link simbólico|ilegível|Não consegui/);
  assert.equal(readFileSync(join(fora, "alvo.js"), "utf8"), "NAO_TOCAR");
  // painel/assets é link para fora
  const raiz2 = mkdtempSync(join(tmpdir(), "marca-"));
  mkdirSync(join(raiz2, "painel"));
  symlinkSync(fora, join(raiz2, "painel", "assets"));
  const logo = join(raiz2, "l.png"); writeFileSync(logo, "png");
  assert.throws(() => gravarMarca(validarMarca({ nome: "A", cor_primaria: "#112233", logo }), { raiz: raiz2 }), /link simbólico|fora da pasta/);
  assert.equal(existsSync(join(fora, "logo.png")), false);
  // logo de origem é link
  const raiz3 = mkdtempSync(join(tmpdir(), "marca-"));
  mkdirSync(join(raiz3, "painel"));
  symlinkSync(join(fora, "alvo.js"), join(raiz3, "x.png"));
  assert.throws(() => gravarMarca(validarMarca({ nome: "A", cor_primaria: "#112233", logo: join(raiz3, "x.png") }), { raiz: raiz3 }), /link simbólico/);
});

test("troca de logo: o antigo só some depois do novo estar no lugar; config ilegível não mexe em assets", () => {
  const raiz = mkdtempSync(join(tmpdir(), "marca-"));
  mkdirSync(join(raiz, "painel"));
  const png = join(raiz, "a.png"); writeFileSync(png, "png");
  const svg = join(raiz, "b.svg"); writeFileSync(svg, "<svg/>");
  gravarMarca(validarMarca({ nome: "A", cor_primaria: "#112233", logo: png }), { raiz });
  gravarMarca(validarMarca({ nome: "A", cor_primaria: "#112233", logo: svg }), { raiz });
  assert.equal(existsSync(join(raiz, "painel", "assets", "logo.png")), false);
  assert.equal(readFileSync(join(raiz, "painel", "assets", "logo.svg"), "utf8"), "<svg/>");
  writeFileSync(join(raiz, "painel", "config.js"), "window.APP_CONFIG = { X: location.origin };");
  assert.throws(() => gravarMarca(validarMarca({ nome: "A", cor_primaria: "#112233", logo: png }), { raiz }), /Nada foi alterado/);
  assert.equal(existsSync(join(raiz, "painel", "assets", "logo.svg")), true);
  assert.equal(existsSync(join(raiz, "painel", "assets", "logo.png")), false);
});

test("parser: escapes de aspas simples; .env com comentário inline e aspas", () => {
  const raiz = mkdtempSync(join(tmpdir(), "marca-"));
  const arq = join(raiz, "c.js");
  writeFileSync(arq, "window.APP_CONFIG = { T: 'a\\nb', U: 'it\\'s' };");
  assert.deepEqual(JSON.parse(JSON.stringify(lerAppConfig(arq))), { T: "a\nb", U: "it's" });
  writeFileSync(arq, "window.APP_CONFIG = { T: 'a\\u0041' };");
  assert.throws(() => lerAppConfig(arq), /não suportado/);
  writeFileSync(join(raiz, ".env"), 'OUTRO=1\nPANEL_TOKEN=abc123 # token do painel\n');
  assert.equal(lerPanelToken(raiz, {}), "abc123");
  writeFileSync(join(raiz, ".env"), 'export PANEL_TOKEN="com espaco # e hash"\n');
  assert.equal(lerPanelToken(raiz, {}), "com espaco # e hash");
});

test("nome com vírgula e dois-pontos sobrevive a regravar a marca; PANEL_TOKEN só com espaços cai pro .env", () => {
  const raiz = mkdtempSync(join(tmpdir(), "marca-"));
  mkdirSync(join(raiz, "painel"));
  const v = validarMarca({ nome: "Carlos, Imóveis: Premium", cor_primaria: "#112233" });
  gravarMarca(v, { raiz, bearerToken: "t" });
  gravarMarca(v, { raiz });
  assert.equal(lerJs(join(raiz, "painel", "config.js"), "APP_CONFIG").MARCA.nome, "Carlos, Imóveis: Premium");
  writeFileSync(join(raiz, ".env"), "PANEL_TOKEN=do-env\n");
  assert.equal(lerPanelToken(raiz, { PANEL_TOKEN: "   " }), "do-env");
});

test("falha ao copiar o logo no 2º destino não apaga o logo antigo nem deixa o novo pela metade", () => {
  const raiz = mkdtempSync(join(tmpdir(), "marca-"));
  mkdirSync(join(raiz, "painel"));
  const png = join(raiz, "a.png"); writeFileSync(png, "png");
  const svg = join(raiz, "b.svg"); writeFileSync(svg, "<svg/>");
  gravarMarca(validarMarca({ nome: "A", cor_primaria: "#112233", logo: png }), { raiz });
  mkdirSync(join(raiz, "docs", "assets", "logo.svg")); // faz a cópia em docs/assets falhar
  assert.throws(() => gravarMarca(validarMarca({ nome: "A", cor_primaria: "#112233", logo: svg }), { raiz }));
  assert.equal(existsSync(join(raiz, "painel", "assets", "logo.png")), true);
  assert.equal(existsSync(join(raiz, "painel", "assets", "logo.svg")), false);
  assert.equal(lerJs(join(raiz, "painel", "config.js"), "APP_CONFIG").MARCA.logo, "assets/logo.png");
});

test("mesmo nome de logo: se a gravação dos configs falhar, o logo antigo volta", () => {
  const raiz = mkdtempSync(join(tmpdir(), "marca-"));
  mkdirSync(join(raiz, "painel"));
  const velho = join(raiz, "v.png"); writeFileSync(velho, "VELHO");
  const novo = join(raiz, "n.png"); writeFileSync(novo, "NOVO");
  gravarMarca(validarMarca({ nome: "A", cor_primaria: "#112233", logo: velho }), { raiz });
  rmSync(join(raiz, "docs", "marca.config.js"));
  mkdirSync(join(raiz, "docs", "marca.config.js")); // diretório no lugar do arquivo: a troca falha
  assert.throws(() => gravarMarca(validarMarca({ nome: "A", cor_primaria: "#112233", logo: novo }), { raiz }));
  assert.equal(readFileSync(join(raiz, "painel", "assets", "logo.png"), "utf8"), "VELHO");
  assert.equal(readFileSync(join(raiz, "docs", "assets", "logo.png"), "utf8"), "VELHO");
});

test("config.js com token sai 0600; --check já recusa logo simbólico", () => {
  const raiz = mkdtempSync(join(tmpdir(), "marca-"));
  mkdirSync(join(raiz, "painel"));
  gravarMarca(validarMarca({ nome: "A", cor_primaria: "#112233" }), { raiz, bearerToken: "t" });
  assert.equal(statSync(join(raiz, "painel", "config.js")).mode & 0o777, 0o600);
  writeFileSync(join(raiz, "real.png"), "p");
  symlinkSync(join(raiz, "real.png"), join(raiz, "link.png"));
  assert.equal(validarMarca({ nome: "A", cor_primaria: "#112233", logo: join(raiz, "link.png") }).ok, false);
});
