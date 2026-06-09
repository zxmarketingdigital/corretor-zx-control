export interface Imovel {
  id: string;
  titulo: string;
  tipo: string;
  transacao: "venda" | "locacao";
  preco: number;
  regiao: string | null;
  quartos: number | null;
  area_m2: number | null;
  status: string;
}

export interface PerfilBusca {
  transacao: "venda" | "locacao";
  tipo?: string | null;
  regiao?: string | null;
  orcamento_min?: number | null;
  orcamento_max?: number | null;
  finalidade?: string | null;
}

const MAX_RESULTADOS = 3;

export function buildMatchFilter(imovel: Imovel, perfil: PerfilBusca): boolean {
  if (imovel.status !== "ativo") return false;
  if (imovel.transacao !== perfil.transacao) return false;
  if (perfil.orcamento_min != null && imovel.preco < perfil.orcamento_min) return false;
  if (perfil.orcamento_max != null && imovel.preco > perfil.orcamento_max) return false;
  if (perfil.regiao != null && imovel.regiao != null && imovel.regiao !== perfil.regiao) return false;
  if (perfil.tipo != null && imovel.tipo !== perfil.tipo) return false;
  return true;
}

function scoreAderencia(imovel: Imovel, perfil: PerfilBusca): number {
  let score = 0;
  if (perfil.regiao && imovel.regiao === perfil.regiao) score += 2;
  if (perfil.tipo && imovel.tipo === perfil.tipo) score += 2;
  if (perfil.orcamento_max && imovel.preco <= perfil.orcamento_max) score += 1;
  return score;
}

export function rankImoveis(imoveis: Imovel[], perfil: PerfilBusca): Imovel[] {
  return imoveis
    .slice()
    .sort((a, b) => scoreAderencia(b, perfil) - scoreAderencia(a, perfil))
    .slice(0, MAX_RESULTADOS);
}
