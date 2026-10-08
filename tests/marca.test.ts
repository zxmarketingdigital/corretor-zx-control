// Marca do aluno: validação de cor/logo, derivação das CSS vars, contraste e espelho docs/marca.js.
import { describe, expect, it } from "vitest";
// @ts-ignore script clássico sem tipos: registra globalThis.ZXMarca
import "../painel/marca.js";
import painelSrc from "../painel/marca.js?raw";
import docsSrc from "../docs/marca.js?raw";

const Z = (globalThis as any).ZXMarca;

describe("ZXMarca", () => {
  it("normaliza hex #RGB e #RRGGBB, rejeita o resto", () => {
    expect(Z.normalizarHex("#abc")).toBe("#AABBCC");
    expect(Z.normalizarHex(" #1e88e5 ")).toBe("#1E88E5");
    for (const ruim of ["1E88E5", "#12", "#GGGGGG", "azul", "", null, "#1E88E5FF"]) expect(Z.normalizarHex(ruim)).toBeNull();
  });

  it("logo: aceita https e assets/ relativo; rejeita javascript:, data:, http e ..", () => {
    expect(Z.validarLogo("assets/logo.png")).toBe("assets/logo.png");
    expect(Z.validarLogo("https://x.com/l.svg")).toBe("https://x.com/l.svg");
    for (const ruim of ["javascript:alert(1)", "data:image/png;base64,AA", "http://x.com/l.png", "assets/../x.png", "/etc/x.png", "assets/logo.exe", "assets/outro.png", "https://user:senha@x.com/l.png", "assets/logo.png/x", ""]) expect(Z.validarLogo(ruim)).toBeNull();
  });

  it("sem cor válida cai no âmbar padrão e sinaliza", () => {
    const m = Z.normalizar({ nome: "Ana", cor_primaria: "azul" });
    expect(m.cor_primaria).toBe("#D97706");
    expect(m.usaCorPadrao).toBe(true);
    expect(m.avisos.length).toBeGreaterThan(0);
  });

  it("deriva as vars a partir da cor da marca", () => {
    const v = Z.variaveis(Z.normalizar({ nome: "Ana", cor_primaria: "#1E88E5" }));
    expect(v["--primary"]).toBe("#1E88E5");
    expect(v["--brand"]).toBe("#1E88E5");
    expect(v["--primary-rgb"]).toBe("30, 136, 229");
  });

  it("cor_secundaria vira o --primary-light (--brand-2)", () => {
    const v = Z.variaveis(Z.normalizar({ nome: "A", cor_primaria: "#1E88E5", cor_secundaria: "#90CAF9" }));
    expect(v["--brand-2"]).toBe("#90CAF9");
  });

  it("texto do botão tem contraste legível: escuro em cor clara, contraste mínimo em qualquer cor", () => {
    expect(Z.variaveis(Z.normalizar({ cor_primaria: "#FFE082" }))["--on-primary"]).toBe("#0D0D0D");
    // cor de marca escura demais para o fundo do painel é clareada até 4,5:1, e o texto do botão acompanha
    for (const c of ["#000000", "#0D47A1", "#1E88E5", "#FFE082"]) {
      const v = Z.variaveis(Z.normalizar({ cor_primaria: c }));
      expect(Z.contraste(v["--primary"], "#0D0D0D")).toBeGreaterThanOrEqual(4.5);
      expect(Z.contraste(v["--on-primary"], v["--primary"])).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("cor muito escura gera link/texto legível no fundo escuro", () => {
    const v = Z.variaveis(Z.normalizar({ cor_primaria: "#0A1A3A" }));
    expect(Z.contraste(v["--primary-light"], "#0D0D0D")).toBeGreaterThanOrEqual(4.5);
  });

  it("docs/marca.js é espelho idêntico de painel/marca.js", () => {
    expect(docsSrc).toBe(painelSrc);
  });
});
