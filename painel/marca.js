// Marca do aluno — aplica nome, logo e cores (CSS custom properties) em runtime.
// Script clássico, sem bundler: expõe `globalThis.ZXMarca`. Também é carregável no Node
// (`await import("./marca.js")`), que é como setup/marca.mjs e os testes reaproveitam a validação.
//
// Contrato (campos em window.APP_CONFIG.MARCA no painel, window.MARCA_CONFIG nas páginas de docs):
//   nome           texto (obrigatório)
//   cor_primaria   "#RRGGBB" (se ausente/ inválida: cor padrão ZX, âmbar #D97706)
//   cor_secundaria "#RRGGBB" opcional (se ausente: derivada da primária)
//   logo           "assets/<arquivo>.png|jpg|jpeg|svg|webp" ou URL https (opcional; sem logo, só o nome)
//
// Esta cópia (painel/marca.js) é a fonte; docs/marca.js é um espelho idêntico (tests/marca.test.ts confere).
(function (root) {
  "use strict";

  var COR_PADRAO = "#D97706"; // âmbar ZX — fallback documentado quando o aluno não informa cor
  var FUNDO = "#0D0D0D";      // fundo do painel (as cores de texto precisam ter contraste com ele)
  var ESCURO = "#0D0D0D";
  var CLARO = "#FFFFFF";
  var EXT_LOGO = /\.(png|jpe?g|svg|webp)$/i;

  // "#RGB" ou "#RRGGBB" -> "#RRGGBB" maiúsculo; qualquer outra coisa -> null.
  function normalizarHex(v) {
    if (typeof v !== "string") return null;
    var m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(v.trim());
    if (!m) return null;
    var h = m[1];
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    return ("#" + h).toUpperCase();
  }

  function rgb(hex) {
    return [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];
  }

  function hex(r, g, b) {
    function p(n) { var s = Math.round(Math.max(0, Math.min(255, n))).toString(16); return s.length < 2 ? "0" + s : s; }
    return ("#" + p(r) + p(g) + p(b)).toUpperCase();
  }

  // t=0 devolve a, t=1 devolve b.
  function misturar(a, b, t) {
    var x = rgb(a), y = rgb(b);
    return hex(x[0] + (y[0] - x[0]) * t, x[1] + (y[1] - x[1]) * t, x[2] + (y[2] - x[2]) * t);
  }

  // Luminância relativa (WCAG 2.x), 0..1.
  function luminancia(h) {
    var c = rgb(h).map(function (v) {
      v = v / 255;
      return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  }

  function contraste(a, b) {
    var la = luminancia(a), lb = luminancia(b);
    return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
  }

  // Cor do texto sobre um fundo `bg` (botão): a de maior contraste entre quase-preto e branco.
  function textoSobre(bg) {
    return contraste(ESCURO, bg) >= contraste(CLARO, bg) ? ESCURO : CLARO;
  }

  // Clareia `h` em direção ao branco até ter contraste `min` com o fundo escuro do painel
  // (cor de marca muito escura, tipo azul-marinho, ficaria ilegível como link/texto).
  function legivelNoEscuro(h, min) {
    var t = 0, c = h;
    while (contraste(c, FUNDO) < min && t < 1) {
      t = Math.min(1, t + 0.05);
      c = misturar(h, CLARO, t);
    }
    return c;
  }

  function validarLogo(v) {
    if (typeof v !== "string") return null;
    var s = v.trim();
    if (!s) return null;
    if (/^https:\/\//i.test(s)) {
      try { var u = new URL(s); return u.protocol === "https:" && u.hostname ? u.href : null; } catch (e) { return null; }
    }
    // caminho relativo copiado pelo setup (nada de "..", barra inicial, "javascript:", "data:" etc.)
    return /^assets\/[A-Za-z0-9._-]+$/.test(s) && EXT_LOGO.test(s) ? s : null;
  }

  // Normaliza o objeto de marca. Nunca lança: campo inválido é descartado e vai para `avisos`.
  function normalizar(raw) {
    var r = raw && typeof raw === "object" ? raw : {};
    var avisos = [];
    var nome = typeof r.nome === "string" ? r.nome.trim() : "";
    var corRaw = r.cor_primaria;
    var cor = normalizarHex(corRaw);
    var padrao = false;
    if (!cor) {
      if (corRaw != null && String(corRaw).trim() !== "") avisos.push("cor_primaria inválida (" + corRaw + "): usando a cor padrão ZX");
      cor = COR_PADRAO;
      padrao = true;
    }
    var secRaw = r.cor_secundaria;
    var sec = normalizarHex(secRaw);
    if (!sec && secRaw != null && String(secRaw).trim() !== "") avisos.push("cor_secundaria inválida (" + secRaw + "): ignorada");
    var logo = validarLogo(r.logo);
    if (!logo && r.logo != null && String(r.logo).trim() !== "") avisos.push("logo inválido (" + r.logo + "): ignorado");
    return { nome: nome, cor_primaria: cor, cor_secundaria: sec, logo: logo, usaCorPadrao: padrao, avisos: avisos };
  }

  // Mapa de CSS custom properties derivado da marca.
  function variaveis(marca) {
    var m = marca.cor_primaria ? marca : normalizar(marca);
    var p = m.cor_primaria;
    var luz = m.cor_secundaria ? legivelNoEscuro(m.cor_secundaria, 4.5) : legivelNoEscuro(misturar(p, CLARO, 0.2), 4.5);
    var brilho = legivelNoEscuro(misturar(luz, CLARO, 0.35), 7);
    function lista(h) { return rgb(h).join(", "); }
    return {
      "--primary": p,
      "--primary-light": luz,
      "--primary-bright": brilho,
      "--primary-dark": misturar(p, ESCURO, 0.45),
      "--primary-rgb": lista(p),
      "--on-primary": textoSobre(p),
      "--on-primary-hover": textoSobre(luz),
      "--brand": p,
      "--brand-2": luz
    };
  }

  function aplicarDom(doc, m) {
    var i, els;
    if (m.nome) {
      // só troca o <title> nas páginas que pedem (<html data-marca-titulo>), ex.: o painel
      if (doc.documentElement.hasAttribute("data-marca-titulo")) doc.title = m.nome;
      els = doc.querySelectorAll('[data-marca="nome"]');
      for (i = 0; i < els.length; i++) els[i].textContent = m.nome; // textContent: nome nunca vira HTML
    }
    els = doc.querySelectorAll('[data-marca="barra"]'); // faixa de marca opcional (docs): só aparece se houver nome ou logo
    for (i = 0; i < els.length; i++) els[i].hidden = !(m.nome || m.logo);
    els = doc.querySelectorAll('[data-marca="logo"]');
    for (i = 0; i < els.length; i++) {
      var img = els[i];
      if (m.logo) {
        img.onerror = function () { this.hidden = true; };
        img.alt = m.nome || "";
        img.src = m.logo;
        img.hidden = false;
      } else {
        img.hidden = true; // sem logo: só o nome em texto. Nunca cai para logo ZX.
      }
    }
  }

  // Aplica a marca na página: cores já (evita piscar âmbar), nome/logo quando o DOM existir.
  // Sem marca configurada devolve null e não toca em nada (valem os padrões do CSS).
  function aplicar(raw, doc) {
    doc = doc || (typeof document !== "undefined" ? document : null);
    if (!doc || !raw || typeof raw !== "object") return null;
    var m = normalizar(raw);
    var el = doc.documentElement;
    // Cor padrão e sem secundária: o CSS já tem o âmbar original (com seus tons exatos). Não sobrescrever.
    if (!(m.usaCorPadrao && !m.cor_secundaria)) {
      var v = variaveis(m);
      for (var k in v) if (Object.prototype.hasOwnProperty.call(v, k)) el.style.setProperty(k, v[k]);
    }
    if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", function () { aplicarDom(doc, m); });
    else aplicarDom(doc, m);
    return m;
  }

  root.ZXMarca = {
    COR_PADRAO: COR_PADRAO,
    normalizarHex: normalizarHex,
    validarLogo: validarLogo,
    normalizar: normalizar,
    variaveis: variaveis,
    aplicar: aplicar,
    contraste: contraste,
    luminancia: luminancia,
    textoSobre: textoSobre
  };
})(typeof globalThis !== "undefined" ? globalThis : this);
