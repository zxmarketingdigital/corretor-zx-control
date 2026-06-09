import { describe, expect, it } from "vitest";
import { parseCsvImoveis, parseCsvClientes } from "../../src/adapters/catalog/csv";

describe("parseCsvImoveis", () => {
  it("parseia CSV bem formado com separador vírgula", () => {
    const csv = `titulo,tipo,transacao,preco,regiao\nCasa Centro,casa,venda,500000,centro\n`;
    const result = parseCsvImoveis(csv);
    expect(result.imoveis).toHaveLength(1);
    expect(result.imoveis[0]).toMatchObject({ titulo: "Casa Centro", tipo: "casa", transacao: "venda", preco: 500000 });
  });

  it("parseia CSV com separador ponto-e-vírgula", () => {
    const csv = `titulo;tipo;transacao;preco\nApto Norte;apartamento;locacao;2500\n`;
    const result = parseCsvImoveis(csv);
    expect(result.imoveis).toHaveLength(1);
    expect(result.imoveis[0]!.preco).toBe(2500);
  });

  it("aceita alias de cabeçalho (title → titulo, price → preco)", () => {
    const csv = `title,type,transaction,price\nCasa,casa,venda,300000\n`;
    const result = parseCsvImoveis(csv);
    expect(result.imoveis[0]).toMatchObject({ titulo: "Casa", preco: 300000 });
  });

  it("coloca linha com campos obrigatórios faltando em erros (não aborta)", () => {
    const csv = `titulo,tipo,transacao,preco\n,casa,venda,100000\nCasa Boa,casa,venda,200000\n`;
    const result = parseCsvImoveis(csv);
    expect(result.imoveis).toHaveLength(1);
    expect(result.erros).toHaveLength(1);
  });
});

describe("parseCsvClientes", () => {
  it("parseia CSV de clientes com telefone obrigatório", () => {
    const csv = `telefone,nome,regiao\n5511999990001,João,centro\n`;
    const result = parseCsvClientes(csv);
    expect(result.clientes).toHaveLength(1);
    expect(result.clientes[0]).toMatchObject({ telefone: "5511999990001", nome: "João" });
  });

  it("coloca linha sem telefone em erros", () => {
    const csv = `telefone,nome\n,João\n5511999990002,Ana\n`;
    const result = parseCsvClientes(csv);
    expect(result.clientes).toHaveLength(1);
    expect(result.erros).toHaveLength(1);
  });
});
