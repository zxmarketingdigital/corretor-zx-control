export interface ImovelInput {
  ref?: string;
  titulo: string;
  tipo: string;
  transacao: "venda" | "locacao";
  preco: number;
  cidade?: string;
  bairro?: string;
  regiao?: string;
  quartos?: number;
  area_m2?: number;
  descricao?: string;
}

export interface ClienteInput {
  telefone: string;
  nome?: string;
  regiao?: string;
  tipo?: string;
  orcamento_min?: number;
  orcamento_max?: number;
  finalidade?: "morar" | "investir";
}

const IMOVEL_ALIASES: Record<string, string> = {
  title: "titulo", name: "titulo", nome: "titulo",
  type: "tipo",
  transaction: "transacao", transacao_tipo: "transacao",
  price: "preco", valor: "preco", preco_venda: "preco",
  neighborhood: "bairro", district: "bairro",
  region: "regiao", zone: "regiao", zona: "regiao",
  rooms: "quartos", bedrooms: "quartos", dormitorios: "quartos",
  area: "area_m2", size: "area_m2", metragem: "area_m2",
  description: "descricao",
  code: "ref", codigo: "ref",
};

const CLIENTE_ALIASES: Record<string, string> = {
  phone: "telefone", celular: "telefone", whatsapp: "telefone",
  name: "nome",
  region: "regiao", zona: "regiao",
  type: "tipo",
  budget_min: "orcamento_min", valor_min: "orcamento_min",
  budget_max: "orcamento_max", valor_max: "orcamento_max",
  purpose: "finalidade",
};

function detectSep(firstLine: string): string {
  return firstLine.includes(";") ? ";" : ",";
}

function normHeader(h: string, aliases: Record<string, string>): string {
  const lc = h.trim().toLowerCase().replace(/\s+/g, "_");
  return aliases[lc] ?? lc;
}

function parseRows(text: string): { headers: string[]; rows: Record<string, string>[] } {
  const lines = text.trim().split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return { headers: [], rows: [] };
  const sep = detectSep(lines[0]!);
  const rawHeaders = lines[0]!.split(sep).map((h) => h.trim());
  const rows = lines.slice(1).map((line) => {
    const cols = line.split(sep);
    const row: Record<string, string> = {};
    rawHeaders.forEach((h, i) => { row[h] = (cols[i] ?? "").trim(); });
    return row;
  });
  return { headers: rawHeaders, rows };
}

export function parseCsvImoveis(text: string): { imoveis: ImovelInput[]; erros: string[] } {
  const { headers, rows } = parseRows(text);
  const normHeaders = headers.map((h) => normHeader(h, IMOVEL_ALIASES));
  const imoveis: ImovelInput[] = [];
  const erros: string[] = [];

  rows.forEach((row, idx) => {
    const norm: Record<string, string> = {};
    headers.forEach((h, i) => { norm[normHeaders[i]!] = row[h] ?? ""; });

    const titulo = norm["titulo"];
    const tipo = norm["tipo"];
    const transacao = norm["transacao"] as "venda" | "locacao";
    const preco = parseFloat(norm["preco"] ?? "");

    if (!titulo || !tipo || !transacao || isNaN(preco)) {
      erros.push(`Linha ${idx + 2}: campos obrigatórios faltando (titulo, tipo, transacao, preco)`);
      return;
    }
    imoveis.push({
      titulo, tipo, transacao, preco,
      ref: norm["ref"] || undefined,
      cidade: norm["cidade"] || undefined,
      bairro: norm["bairro"] || undefined,
      regiao: norm["regiao"] || undefined,
      quartos: norm["quartos"] ? parseInt(norm["quartos"]) : undefined,
      area_m2: norm["area_m2"] ? parseFloat(norm["area_m2"]) : undefined,
      descricao: norm["descricao"] || undefined,
    });
  });

  return { imoveis, erros };
}

export function parseCsvClientes(text: string): { clientes: ClienteInput[]; erros: string[] } {
  const { headers, rows } = parseRows(text);
  const normHeaders = headers.map((h) => normHeader(h, CLIENTE_ALIASES));
  const clientes: ClienteInput[] = [];
  const erros: string[] = [];

  rows.forEach((row, idx) => {
    const norm: Record<string, string> = {};
    headers.forEach((h, i) => { norm[normHeaders[i]!] = row[h] ?? ""; });

    const telefone = norm["telefone"]?.replace(/\D/g, "");
    if (!telefone) {
      erros.push(`Linha ${idx + 2}: telefone obrigatório`);
      return;
    }
    clientes.push({
      telefone,
      nome: norm["nome"] || undefined,
      regiao: norm["regiao"] || undefined,
      tipo: norm["tipo"] || undefined,
      orcamento_min: norm["orcamento_min"] ? parseFloat(norm["orcamento_min"]) : undefined,
      orcamento_max: norm["orcamento_max"] ? parseFloat(norm["orcamento_max"]) : undefined,
      finalidade: (norm["finalidade"] as "morar" | "investir") || undefined,
    });
  });

  return { clientes, erros };
}
