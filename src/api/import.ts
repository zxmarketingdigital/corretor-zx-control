import { parseCsvClientes, parseCsvImoveis } from "../adapters/catalog/csv";

export interface ImportDeps {
  upsertImoveis(imoveis: unknown[]): Promise<{ inseridos: number; atualizados: number }>;
  upsertClientes(clientes: unknown[]): Promise<{ inseridos: number; atualizados: number }>;
}

export async function handleImportImoveis(req: Request, deps: ImportDeps): Promise<Response> {
  const text = await req.text();
  const { imoveis, erros } = parseCsvImoveis(text);
  if (imoveis.length === 0 && erros.length > 0) {
    return Response.json({ error: "Nenhum imóvel válido", erros }, { status: 422 });
  }
  const { inseridos, atualizados } = await deps.upsertImoveis(imoveis);
  return Response.json({ inseridos, atualizados, erros }, { status: 200 });
}

export async function handleImportClientes(req: Request, deps: ImportDeps): Promise<Response> {
  const text = await req.text();
  const { clientes, erros } = parseCsvClientes(text);
  if (clientes.length === 0 && erros.length > 0) {
    return Response.json({ error: "Nenhum cliente válido", erros }, { status: 422 });
  }
  const { inseridos, atualizados } = await deps.upsertClientes(clientes);
  return Response.json({ inseridos, atualizados, erros }, { status: 200 });
}
