import { parseXmlFeedImoveis } from "../adapters/catalog/xml";
import { parseCsvImoveis, type ImovelInput } from "../adapters/catalog/csv";

export interface SyncCatalogDeps {
  getConfig(chave: string): Promise<string | null>;
  setConfig(chave: string, valor: unknown): Promise<void>;
  upsertImoveis(imoveis: ImovelInput[]): Promise<{ inseridos: number; atualizados: number }>;
  fetchText(url: string): Promise<string>;
}

export async function runSyncCatalog(deps: SyncCatalogDeps): Promise<void> {
  const source = await deps.getConfig("catalog_source");
  if (!source || source === "manual") return;

  const feedUrl = await deps.getConfig("catalog_feed_url");
  if (!feedUrl) {
    await deps.setConfig("catalog_last_sync_erro", "catalog_feed_url não configurada");
    return;
  }

  let text: string;
  try {
    text = await deps.fetchText(feedUrl);
  } catch (e) {
    await deps.setConfig("catalog_last_sync_erro", `Falha ao buscar feed: ${e instanceof Error ? e.message : String(e)}`);
    return;
  }

  let imoveis: ImovelInput[];
  let erros: string[];

  if (source === "xml") {
    ({ imoveis, erros } = parseXmlFeedImoveis(text));
  } else if (source === "csv") {
    ({ imoveis, erros } = parseCsvImoveis(text));
  } else {
    await deps.setConfig("catalog_last_sync_erro", `Fonte desconhecida: ${source}`);
    return;
  }

  const resultado = imoveis.length > 0
    ? await deps.upsertImoveis(imoveis)
    : { inseridos: 0, atualizados: 0 };

  await deps.setConfig("catalog_last_sync", {
    em: new Date().toISOString(),
    inseridos: resultado.inseridos,
    atualizados: resultado.atualizados,
    erros,
  });
}
