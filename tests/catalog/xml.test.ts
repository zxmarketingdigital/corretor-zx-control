import { describe, expect, it } from "vitest";
import { parseXmlFeedImoveis } from "../../src/adapters/catalog/xml";

const FEED_VRSYNC = `<?xml version="1.0" encoding="UTF-8"?>
<Imoveis>
  <Imovel>
    <CodigoImovel>REF001</CodigoImovel>
    <TituloImovel>Casa Jardins</TituloImovel>
    <TipoImovel>Casa</TipoImovel>
    <Categoria>Venda</Categoria>
    <PrecoVenda>750000</PrecoVenda>
    <Bairro>Jardins</Bairro>
    <Cidade>São Paulo</Cidade>
    <AreaTotal>180</AreaTotal>
    <Dormitorios>4</Dormitorios>
  </Imovel>
  <Imovel>
    <CodigoImovel>REF002</CodigoImovel>
    <TituloImovel>Apto Paulista</TituloImovel>
    <TipoImovel>Apartamento</TipoImovel>
    <Categoria>Locação</Categoria>
    <PrecoLocacao>4500</PrecoLocacao>
    <Bairro>Bela Vista</Bairro>
    <Cidade>São Paulo</Cidade>
    <AreaTotal>70</AreaTotal>
    <Dormitorios>2</Dormitorios>
  </Imovel>
</Imoveis>`;

const FEED_ITEM_INVALIDO = `<?xml version="1.0"?>
<Imoveis>
  <Imovel>
    <TituloImovel>Sem preço</TituloImovel>
    <TipoImovel>Casa</TipoImovel>
    <Categoria>Venda</Categoria>
  </Imovel>
  <Imovel>
    <CodigoImovel>REF003</CodigoImovel>
    <TituloImovel>Válido</TituloImovel>
    <TipoImovel>Casa</TipoImovel>
    <Categoria>Venda</Categoria>
    <PrecoVenda>200000</PrecoVenda>
  </Imovel>
</Imoveis>`;

describe("parseXmlFeedImoveis — dialeto VRSync/Canal Pro", () => {
  it("parseia feed válido e extrai 2 imóveis", () => {
    const { imoveis, erros } = parseXmlFeedImoveis(FEED_VRSYNC);
    expect(imoveis).toHaveLength(2);
    expect(erros).toHaveLength(0);
  });

  it("mapeia campos corretamente (CodigoImovel→ref, Categoria→transacao)", () => {
    const { imoveis } = parseXmlFeedImoveis(FEED_VRSYNC);
    expect(imoveis[0]).toMatchObject({
      ref: "REF001", titulo: "Casa Jardins", tipo: "casa",
      transacao: "venda", preco: 750000, bairro: "Jardins", quartos: 4,
    });
    expect(imoveis[1]).toMatchObject({ transacao: "locacao", preco: 4500 });
  });

  it("item inválido (sem preço) vai para erros[], não aborta o feed", () => {
    const { imoveis, erros } = parseXmlFeedImoveis(FEED_ITEM_INVALIDO);
    expect(imoveis).toHaveLength(1);
    expect(erros).toHaveLength(1);
  });

  it("dialeto desconhecido (root tag diferente) retorna imoveis=[] e 1 erro", () => {
    const { imoveis, erros } = parseXmlFeedImoveis(`<OutroFormato><Item/></OutroFormato>`);
    expect(imoveis).toHaveLength(0);
    expect(erros.length).toBeGreaterThanOrEqual(1);
  });

  it("XML malformado retorna imoveis=[] e erro", () => {
    const { imoveis, erros } = parseXmlFeedImoveis("<broken><");
    expect(imoveis).toHaveLength(0);
    expect(erros.length).toBeGreaterThanOrEqual(1);
  });
});
