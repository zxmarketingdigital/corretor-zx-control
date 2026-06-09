import type { ImovelInput } from "./csv";

export { ImovelInput };

// Known root tags for VRSync/Canal Pro/Jetimob dialects
const KNOWN_ROOT_TAGS = new Set(["Imoveis", "ListaImoveis", "imoveis"]);

function getTag(xml: string, tag: string): string {
  const m = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "i").exec(xml);
  return m ? m[1]!.trim() : "";
}

function normalizeTransacao(cat: string): "venda" | "locacao" | null {
  // Strip diacritics for comparison
  const lc = cat.toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "");
  if (lc.includes("venda")) return "venda";
  if (lc.includes("loc") || lc.includes("aluguel")) return "locacao";
  return null;
}

function isMalformed(xml: string): boolean {
  const t = xml.trim();
  // Ends with an unclosed tag opener
  if (t.endsWith("<")) return true;
  // Count open vs close tags (rough heuristic, ignores PI and comments)
  const opens = (t.match(/<[A-Za-z][^>]*>/g) ?? []).length;
  const closes = (t.match(/<\/[A-Za-z][^>]*>/g) ?? []).length;
  // Completely tagless but non-empty → not XML
  if (opens === 0 && closes === 0 && !t.startsWith("<?")) return true;
  return false;
}

function parseImovelBlock(block: string, idx: number): { item: ImovelInput; erro: null } | { item: null; erro: string } {
  const ref = getTag(block, "CodigoImovel") || undefined;
  const titulo = getTag(block, "TituloImovel");
  const tipoRaw = getTag(block, "TipoImovel");
  const tipo = tipoRaw.toLowerCase();
  const categoriaRaw = getTag(block, "Categoria");
  const transacao = normalizeTransacao(categoriaRaw);

  let preco: number | undefined;
  const pv = getTag(block, "PrecoVenda");
  const pl = getTag(block, "PrecoLocacao");
  const pg = getTag(block, "Preco");
  if (pv) preco = parseFloat(pv);
  else if (pl) preco = parseFloat(pl);
  else if (pg) preco = parseFloat(pg);

  if (!titulo || !tipo || !transacao || preco === undefined || isNaN(preco)) {
    const missing: string[] = [];
    if (!titulo) missing.push("TituloImovel");
    if (!tipo) missing.push("TipoImovel");
    if (!transacao) missing.push("Categoria");
    if (preco === undefined || isNaN(preco)) missing.push("Preco");
    return { item: null, erro: `Imóvel ${idx + 1}: campos obrigatórios faltando (${missing.join(", ")})` };
  }

  const bairro = getTag(block, "Bairro") || undefined;
  const cidade = getTag(block, "Cidade") || undefined;
  const areaRaw = getTag(block, "AreaTotal") || getTag(block, "Area");
  const area_m2 = areaRaw ? parseFloat(areaRaw) : undefined;
  const quartosRaw = getTag(block, "Dormitorios") || getTag(block, "Quartos");
  const quartos = quartosRaw ? parseInt(quartosRaw) : undefined;
  const descricao = getTag(block, "Descricao") || getTag(block, "Observacoes") || undefined;

  return {
    item: { ref, titulo, tipo, transacao, preco, bairro, cidade, area_m2, quartos, descricao },
    erro: null,
  };
}

export function parseXmlFeedImoveis(xml: string): { imoveis: ImovelInput[]; erros: string[] } {
  if (!xml?.trim()) {
    return { imoveis: [], erros: ["XML vazio"] };
  }

  if (isMalformed(xml)) {
    return { imoveis: [], erros: ["XML malformado"] };
  }

  // Extract root tag name
  const rootMatch = xml.trim().match(/<([A-Za-z][A-Za-z0-9_:.-]*)[^>]*>/);
  if (!rootMatch) {
    return { imoveis: [], erros: ["XML sem root tag reconhecível"] };
  }

  // Skip XML declaration if it was matched
  let rootTag = rootMatch[1]!;
  if (rootTag.startsWith("?xml")) {
    const secondMatch = xml.replace(/<\?xml[^?]*\?>/, "").trim().match(/<([A-Za-z][A-Za-z0-9_:.-]*)[^>]*>/);
    if (!secondMatch) return { imoveis: [], erros: ["XML sem root tag"] };
    rootTag = secondMatch[1]!;
  }

  if (!KNOWN_ROOT_TAGS.has(rootTag)) {
    return { imoveis: [], erros: [`Dialeto desconhecido: root tag <${rootTag}> não reconhecida`] };
  }

  // Extract all <Imovel>...</Imovel> blocks (case-sensitive, as per VRSync spec)
  const imovelRegex = /<Imovel[^>]*>([\s\S]*?)<\/Imovel>/gi;
  const imoveis: ImovelInput[] = [];
  const erros: string[] = [];
  let match: RegExpExecArray | null;
  let idx = 0;

  while ((match = imovelRegex.exec(xml)) !== null) {
    const result = parseImovelBlock(match[1]!, idx++);
    if (result.erro) erros.push(result.erro);
    else imoveis.push(result.item!);
  }

  return { imoveis, erros };
}
