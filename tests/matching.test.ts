// Matching SQL é determinístico — testado sem banco (mock db).
import { describe, expect, it } from "vitest";
import { buildMatchFilter, rankImoveis } from "../src/matching/sql";
import type { Imovel, PerfilBusca } from "../src/matching/sql";

function imovel(overrides: Partial<Imovel>): Imovel {
  return {
    id: "i1", titulo: "Apto Centro", tipo: "apartamento",
    transacao: "venda", preco: 500_000, regiao: "centro",
    quartos: 2, area_m2: 70, status: "ativo", ...overrides,
  };
}

describe("buildMatchFilter", () => {
  it("exclui imóvel fora da faixa de preço", () => {
    const perfil: PerfilBusca = { transacao: "venda", orcamento_max: 400_000 };
    expect(buildMatchFilter(imovel({}), perfil)).toBe(false);
  });

  it("inclui imóvel dentro da faixa", () => {
    const perfil: PerfilBusca = { transacao: "venda", orcamento_min: 300_000, orcamento_max: 600_000 };
    expect(buildMatchFilter(imovel({}), perfil)).toBe(true);
  });

  it("filtra por transação: venda≠locacao", () => {
    const perfil: PerfilBusca = { transacao: "locacao" };
    expect(buildMatchFilter(imovel({ transacao: "venda" }), perfil)).toBe(false);
  });

  it("filtra por região quando especificada", () => {
    const perfil: PerfilBusca = { transacao: "venda", regiao: "norte" };
    expect(buildMatchFilter(imovel({ regiao: "centro" }), perfil)).toBe(false);
  });

  it("aceita qualquer região quando perfil.regiao é null", () => {
    const perfil: PerfilBusca = { transacao: "venda", regiao: null };
    expect(buildMatchFilter(imovel({ regiao: "bairro-x" }), perfil)).toBe(true);
  });

  it("filtra por tipo quando especificado", () => {
    const perfil: PerfilBusca = { transacao: "venda", tipo: "casa" };
    expect(buildMatchFilter(imovel({ tipo: "apartamento" }), perfil)).toBe(false);
  });

  it("aceita qualquer tipo quando perfil.tipo é null", () => {
    const perfil: PerfilBusca = { transacao: "venda", tipo: null };
    expect(buildMatchFilter(imovel({ tipo: "terreno" }), perfil)).toBe(true);
  });
});

describe("rankImoveis", () => {
  it("retorna no máximo 3 resultados", () => {
    const perfil: PerfilBusca = { transacao: "venda" };
    const lista = Array.from({ length: 10 }, (_, i) =>
      imovel({ id: `i${i}`, titulo: `Imovel ${i}` }),
    );
    expect(rankImoveis(lista, perfil)).toHaveLength(3);
  });

  it("coloca correspondências exatas (região+tipo) antes das parciais", () => {
    const perfil: PerfilBusca = { transacao: "venda", regiao: "centro", tipo: "apartamento" };
    const parcial = imovel({ id: "p", regiao: null, tipo: "apartamento" });
    const exato = imovel({ id: "e", regiao: "centro", tipo: "apartamento" });
    const ranked = rankImoveis([parcial, exato], perfil);
    expect(ranked[0]!.id).toBe("e");
  });
});
