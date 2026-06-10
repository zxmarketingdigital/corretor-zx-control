// Dados fictícios para a DEMO local do Corretor ZX Control.
// Carteira realista de um corretor autônomo em São Paulo.
// Datas são relativas a "agora" pra o painel mostrar imóveis desatualizados,
// visitas futuras/passadas e um audit log recente.

const now = Date.now();
const H = 3600_000;
const D = 86400_000;
const ago = (ms) => new Date(now - ms).toISOString();
const ahead = (ms) => new Date(now + ms).toISOString();

// ── Catálogo (imoveis) ──────────────────────────────────────────────────────
// Mistura proposital: ativos recentes, alguns desatualizados (>7d → ⚠ no painel),
// vendidos e inativos — pra demonstrar auto-expiração e status.
export const imoveis = [
  { id: "i1",  titulo: "Apto 2 quartos — Pinheiros",            tipo: "apartamento", transacao: "venda",   preco: 685000,  cidade: "São Paulo", bairro: "Pinheiros",     regiao: "oeste",  quartos: 2, area_m2: 68,  status: "ativo",    origem: "manual",  atualizado_em: ago(1*D) },
  { id: "i2",  titulo: "Casa 3 quartos — Moema",                tipo: "casa",        transacao: "venda",   preco: 1250000, cidade: "São Paulo", bairro: "Moema",         regiao: "sul",    quartos: 3, area_m2: 140, status: "ativo",    origem: "manual",  atualizado_em: ago(2*D) },
  { id: "i3",  titulo: "Studio mobiliado — Vila Madalena",      tipo: "apartamento", transacao: "locacao", preco: 3200,    cidade: "São Paulo", bairro: "Vila Madalena", regiao: "oeste",  quartos: 1, area_m2: 38,  status: "ativo",    origem: "csv",     atualizado_em: ago(3*H) },
  { id: "i4",  titulo: "Cobertura 3 suítes — Itaim Bibi",       tipo: "apartamento", transacao: "venda",   preco: 2950000, cidade: "São Paulo", bairro: "Itaim Bibi",    regiao: "sul",    quartos: 3, area_m2: 210, status: "ativo",    origem: "manual",  atualizado_em: ago(5*H) },
  { id: "i5",  titulo: "Apto 2 quartos — Tatuapé",              tipo: "apartamento", transacao: "venda",   preco: 520000,  cidade: "São Paulo", bairro: "Tatuapé",       regiao: "leste",  quartos: 2, area_m2: 61,  status: "ativo",    origem: "csv",     atualizado_em: ago(12*D) }, // ⚠ desatualizado
  { id: "i6",  titulo: "Sala comercial — Av. Paulista",         tipo: "sala",        transacao: "locacao", preco: 5800,    cidade: "São Paulo", bairro: "Bela Vista",    regiao: "centro", quartos: 0, area_m2: 55,  status: "ativo",    origem: "manual",  atualizado_em: ago(1*D) },
  { id: "i7",  titulo: "Casa térrea 2 quartos — Santana",       tipo: "casa",        transacao: "venda",   preco: 740000,  cidade: "São Paulo", bairro: "Santana",       regiao: "norte",  quartos: 2, area_m2: 110, status: "ativo",    origem: "manual",  atualizado_em: ago(6*D) },
  { id: "i8",  titulo: "Apto 1 quarto — República",             tipo: "apartamento", transacao: "locacao", preco: 2100,    cidade: "São Paulo", bairro: "República",     regiao: "centro", quartos: 1, area_m2: 40,  status: "ativo",    origem: "csv",     atualizado_em: ago(18*D) }, // ⚠ desatualizado
  { id: "i9",  titulo: "Terreno 250m² — Granja Viana",          tipo: "terreno",     transacao: "venda",   preco: 430000,  cidade: "Cotia",     bairro: "Granja Viana", regiao: "oeste",  quartos: 0, area_m2: 250, status: "ativo",    origem: "manual",  atualizado_em: ago(4*D) },
  { id: "i10", titulo: "Apto 3 quartos — Perdizes",             tipo: "apartamento", transacao: "venda",   preco: 980000,  cidade: "São Paulo", bairro: "Perdizes",      regiao: "oeste",  quartos: 3, area_m2: 96,  status: "ativo",    origem: "manual",  atualizado_em: ago(8*H) },
  { id: "i11", titulo: "Loft — Vila Olímpia",                   tipo: "apartamento", transacao: "locacao", preco: 4500,    cidade: "São Paulo", bairro: "Vila Olímpia",  regiao: "sul",    quartos: 1, area_m2: 52,  status: "ativo",    origem: "csv",     atualizado_em: ago(2*D) },
  { id: "i12", titulo: "Apto 2 quartos — Brooklin",             tipo: "apartamento", transacao: "venda",   preco: 615000,  cidade: "São Paulo", bairro: "Brooklin",      regiao: "sul",    quartos: 2, area_m2: 64,  status: "vendido",  origem: "manual",  atualizado_em: ago(9*D) },
  { id: "i13", titulo: "Casa de condomínio — Alphaville",       tipo: "casa",        transacao: "venda",   preco: 1850000, cidade: "Barueri",   bairro: "Alphaville",   regiao: "oeste",  quartos: 4, area_m2: 320, status: "ativo",    origem: "manual",  atualizado_em: ago(1*D) },
  { id: "i14", titulo: "Kitnet — Liberdade",                    tipo: "apartamento", transacao: "locacao", preco: 1600,    cidade: "São Paulo", bairro: "Liberdade",     regiao: "centro", quartos: 1, area_m2: 28,  status: "inativo",  origem: "csv",     atualizado_em: ago(22*D) },
];

// ── Carteira (clientes) ─────────────────────────────────────────────────────
// `estado` é o estado do funil (o painel lê c.estado p/ o badge).
export const clientes = [
  { id: "c1",  nome: "Mariana Alves",      telefone: "5511988120341", regiao: "oeste",  tipo: "apartamento", finalidade: "morar",    orcamento_min: 500000, orcamento_max: 720000,  estado: "visita_agendada", elegivel_proativo: true,  opt_out: false, origem: "link_qr",  consentimento: true },
  { id: "c2",  nome: "Roberto Camargo",    telefone: "5511991450872", regiao: "sul",    tipo: "casa",        finalidade: "morar",    orcamento_min: 900000, orcamento_max: 1400000, estado: "qualificado",     elegivel_proativo: true,  opt_out: false, origem: "whatsapp", consentimento: true },
  { id: "c3",  nome: "Juliana Prado",      telefone: "5511987330219", regiao: "oeste",  tipo: "apartamento", finalidade: "investir", orcamento_min: 300000, orcamento_max: 450000,  estado: "negociacao",      elegivel_proativo: true,  opt_out: false, origem: "whatsapp", consentimento: true },
  { id: "c4",  nome: "Fernando Dias",      telefone: "5511996701338", regiao: "sul",    tipo: "apartamento", finalidade: "morar",    orcamento_min: 2500000,orcamento_max: 3200000, estado: "visitou",         elegivel_proativo: true,  opt_out: false, origem: "link_qr",  consentimento: true },
  { id: "c5",  nome: "Patrícia Nunes",     telefone: "5511994820765", regiao: "leste",  tipo: "apartamento", finalidade: "morar",    orcamento_min: 400000, orcamento_max: 560000,  estado: "novo",            elegivel_proativo: false, opt_out: false, origem: "whatsapp", consentimento: false },
  { id: "c6",  nome: "André Tavares",      telefone: "5511983910442", regiao: "centro", tipo: "sala",        finalidade: "investir", orcamento_min: 0,      orcamento_max: 6500,    estado: "qualificado",     elegivel_proativo: true,  opt_out: false, origem: "whatsapp", consentimento: true },
  { id: "c7",  nome: "Camila Figueiredo",  telefone: "5511990028451", regiao: "norte",  tipo: "casa",        finalidade: "morar",    orcamento_min: 600000, orcamento_max: 800000,  estado: "fechado",         elegivel_proativo: true,  opt_out: false, origem: "csv",      consentimento: true },
  { id: "c8",  nome: "Lucas Moreira",      telefone: "5511987661209", regiao: "sul",    tipo: "apartamento", finalidade: "investir", orcamento_min: 500000, orcamento_max: 700000,  estado: "perdido",         elegivel_proativo: false, opt_out: true,  origem: "whatsapp", consentimento: true },
  { id: "c9",  nome: "Beatriz Santana",    telefone: "5511995573380", regiao: "oeste",  tipo: "apartamento", finalidade: "morar",    orcamento_min: 800000, orcamento_max: 1100000, estado: "novo",            elegivel_proativo: false, opt_out: false, origem: "link_qr",  consentimento: false },
  { id: "c10", nome: "Eduardo Lima",       telefone: "5511982240916", regiao: "oeste",  tipo: "terreno",     finalidade: "investir", orcamento_min: 350000, orcamento_max: 500000,  estado: "qualificado",     elegivel_proativo: true,  opt_out: false, origem: "csv",      consentimento: true },
  { id: "c11", nome: "Renata Castro",      telefone: "5511990116628", regiao: "sul",    tipo: "apartamento", finalidade: "morar",    orcamento_min: 380000, orcamento_max: 480000,  estado: "visita_agendada", elegivel_proativo: true,  opt_out: false, origem: "whatsapp", consentimento: true },
  { id: "c12", nome: "Marcos Vinícius",    telefone: "5511986703355", regiao: "oeste",  tipo: "casa",        finalidade: "morar",    orcamento_min: 1500000,orcamento_max: 2000000, estado: "visitou",         elegivel_proativo: true,  opt_out: false, origem: "csv",      consentimento: true },
];

// ── Conversas + mensagens ───────────────────────────────────────────────────
export const conversas = [
  { id: "cv1",  cliente_id: "c1",  cliente_nome: "Mariana Alves",     estado: "visita_agendada", ultima_interacao: ago(2*H) },
  { id: "cv2",  cliente_id: "c2",  cliente_nome: "Roberto Camargo",   estado: "qualificado",     ultima_interacao: ago(5*H) },
  { id: "cv3",  cliente_id: "c3",  cliente_nome: "Juliana Prado",     estado: "negociacao",      ultima_interacao: ago(1*D + 3*H) },
  { id: "cv4",  cliente_id: "c4",  cliente_nome: "Fernando Dias",     estado: "visitou",         ultima_interacao: ago(20*H) },
  { id: "cv5",  cliente_id: "c5",  cliente_nome: "Patrícia Nunes",    estado: "novo",            ultima_interacao: ago(40*60000) },
  { id: "cv6",  cliente_id: "c6",  cliente_nome: "André Tavares",     estado: "qualificado",     ultima_interacao: ago(7*H) },
  { id: "cv7",  cliente_id: "c7",  cliente_nome: "Camila Figueiredo", estado: "fechado",         ultima_interacao: ago(3*D) },
  { id: "cv11", cliente_id: "c11", cliente_nome: "Renata Castro",     estado: "visita_agendada", ultima_interacao: ago(4*H) },
];

export const mensagens = {
  cv1: [
    { direcao: "entrada", conteudo: "Oi, vi o anúncio do apto em Pinheiros, ainda tá disponível?" },
    { direcao: "saida",   conteudo: "Oi, Mariana! Tá sim 🙂 É o apto de 2 quartos, 68m², em Pinheiros, por R$ 685.000. Posso te fazer só 3 perguntinhas rápidas pra ver se encaixa no que você procura?" },
    { direcao: "entrada", conteudo: "Pode!" },
    { direcao: "saida",   conteudo: "Qual a faixa de valor que você tá considerando, é pra morar ou investir, e tem preferência de região?" },
    { direcao: "entrada", conteudo: "Até uns 720 mil, é pra morar, e queria zona oeste mesmo" },
    { direcao: "saida",   conteudo: "Perfeito, encaixa certinho! Tenho esse de Pinheiros e um de 3 quartos em Perdizes por R$ 980.000 (esse passa um pouco). Quer agendar uma visita ao de Pinheiros? Tenho amanhã 10h ou quinta 16h." },
    { direcao: "entrada", conteudo: "Amanhã 10h fica ótimo" },
    { direcao: "saida",   conteudo: "Fechado! Agendei pra amanhã às 10h em Pinheiros. Te mando a confirmação na véspera. Qualquer coisa é só chamar 👋" },
  ],
  cv2: [
    { direcao: "entrada", conteudo: "Boa tarde, procuro uma casa na zona sul" },
    { direcao: "saida",   conteudo: "Boa tarde, Roberto! Ótimo. Qual faixa de investimento e quantos quartos você precisa?" },
    { direcao: "entrada", conteudo: "De 900 mil a 1,4 milhão, 3 quartos no mínimo" },
    { direcao: "saida",   conteudo: "Tenho uma casa de 3 quartos em Moema, 140m², por R$ 1.250.000 — bem dentro do seu perfil. Quer ver fotos e agendar uma visita?" },
    { direcao: "entrada", conteudo: "Me manda as fotos primeiro" },
    { direcao: "saida",   conteudo: "Claro, te envio agora. Se gostar, consigo encaixar uma visita ainda essa semana 🙂" },
  ],
  cv3: [
    { direcao: "entrada", conteudo: "Tenho interesse no studio da Vila Madalena pra investir" },
    { direcao: "saida",   conteudo: "Boa escolha pra locação, Juliana! O studio tá R$ 3.200/mês de aluguel. Você tá pensando em comprar pra alugar, certo?" },
    { direcao: "entrada", conteudo: "Isso. Qual o valor de compra e a rentabilidade?" },
    { direcao: "saida",   conteudo: "Vou levantar o número de venda com o proprietário e já te passo o cálculo de rentabilidade. Posso te ligar pra alinhar a proposta?" },
    { direcao: "entrada", conteudo: "Pode sim, depois das 18h" },
  ],
  cv4: [
    { direcao: "saida",   conteudo: "Fernando, e aí? O que achou da cobertura no Itaim que você visitou ontem?" },
    { direcao: "entrada", conteudo: "Gostei muito, mas achei o valor um pouco alto" },
    { direcao: "saida",   conteudo: "Entendo. Quer que eu leve uma contraproposta ao proprietário? Me diz o valor que faria sentido pra você que eu negocio." },
  ],
  cv5: [
    { direcao: "entrada", conteudo: "oi" },
    { direcao: "saida",   conteudo: "Oi! Aqui é o assistente do corretor Carlos 🙂 Você tá procurando imóvel pra comprar ou alugar? Me conta um pouco do que precisa que eu te ajudo." },
  ],
  cv6: [
    { direcao: "entrada", conteudo: "Procuro sala comercial na região da Paulista pra alugar" },
    { direcao: "saida",   conteudo: "Tenho uma sala de 55m² na Av. Paulista por R$ 5.800/mês, ótima pra escritório. Qual seu orçamento de aluguel e quando pretende ocupar?" },
    { direcao: "entrada", conteudo: "Até 6.500, pra começar mês que vem" },
    { direcao: "saida",   conteudo: "Encaixa! Quer agendar uma visita essa semana pra conhecer o espaço?" },
  ],
  cv7: [
    { direcao: "saida",   conteudo: "Camila, parabéns pela casa nova em Santana! 🎉 Foi um prazer te ajudar. Posso contar com uma indicação de alguém que também esteja procurando imóvel?" },
    { direcao: "entrada", conteudo: "Com certeza! Minha irmã tá querendo comprar, vou passar seu contato" },
    { direcao: "saida",   conteudo: "Maravilha, muito obrigado! 🙏 E se puder deixar uma avaliação rápida no Google me ajuda demais: [link]. Conte comigo sempre!" },
  ],
  cv11: [
    { direcao: "entrada", conteudo: "Vi um apartamento de 2 quartos por uns 450 mil, tem algo assim?" },
    { direcao: "saida",   conteudo: "Tenho sim, Renata! Um de 2 quartos no Tatuapé por R$ 520.000 e opções na faixa de 380–480 mil. Pra morar, certo? Qual região prefere?" },
    { direcao: "entrada", conteudo: "Zona sul de preferência, pra morar" },
    { direcao: "saida",   conteudo: "Perfeito, vou separar as opções da zona sul no seu orçamento. Consigo te mostrar 2 imóveis numa visita única. Sexta 14h funciona?" },
    { direcao: "entrada", conteudo: "Funciona!" },
    { direcao: "saida",   conteudo: "Agendado pra sexta 14h. Te confirmo na véspera 👍" },
  ],
};

// ── Visitas ─────────────────────────────────────────────────────────────────
export const visitas = [
  { id: "v1", cliente_id: "c1",  cliente_nome: "Mariana Alves",  imovel_id: "i1",  local: "Pinheiros — R. dos Pinheiros, 1200",   agendada_para: ahead(1*D - 2*H), status: "agendada"  },
  { id: "v2", cliente_id: "c11", cliente_nome: "Renata Castro",  imovel_id: "i11", local: "Vila Olímpia — R. Fiandeiras, 340",     agendada_para: ahead(3*D),       status: "confirmada"},
  { id: "v3", cliente_id: "c4",  cliente_nome: "Fernando Dias",  imovel_id: "i4",  local: "Itaim Bibi — R. João Cachoeira, 88",    agendada_para: ago(1*D),         status: "realizada" },
  { id: "v4", cliente_id: "c12", cliente_nome: "Marcos Vinícius",imovel_id: "i13", local: "Alphaville — Al. Rio Negro, 500",        agendada_para: ago(2*D),         status: "realizada" },
  { id: "v5", cliente_id: "c2",  cliente_nome: "Roberto Camargo",imovel_id: "i2",  local: "Moema — Av. Jurema, 210",               agendada_para: ago(3*D + 4*H),   status: "no_show"   },
  { id: "v6", cliente_id: "c6",  cliente_nome: "André Tavares",  imovel_id: "i6",  local: "Av. Paulista, 1800 — 14º andar",        agendada_para: ahead(2*D + 5*H), status: "agendada"  },
];

// ── Disparos (audit log dos crons / anti-ban) ───────────────────────────────
export const disparos = [
  { id: "d1",  cliente_id: "c1",  agente: "antinoshow",  numero: "5511970000001", status: "enviado",   criado_em: ago(1*H) },
  { id: "d2",  cliente_id: "c11", agente: "antinoshow",  numero: "5511970000001", status: "enviado",   criado_em: ago(2*H) },
  { id: "d3",  cliente_id: "c2",  agente: "followup",    numero: "5511970000001", status: "enviado",   criado_em: ago(4*H) },
  { id: "d4",  cliente_id: "c3",  agente: "followup",    numero: "5511970000001", status: "enviado",   criado_em: ago(6*H) },
  { id: "d5",  cliente_id: "c10", agente: "radar",       numero: "5511970000001", status: "enviado",   criado_em: ago(8*H) },
  { id: "d6",  cliente_id: "c3",  agente: "radar",       numero: "5511970000001", status: "enviado",   criado_em: ago(9*H) },
  { id: "d7",  cliente_id: "c8",  agente: "reativador",  numero: "5511970000001", status: "bloqueado", criado_em: ago(10*H) }, // opt-out "SAIR"
  { id: "d8",  cliente_id: "c12", agente: "reativador",  numero: "5511970000001", status: "enviado",   criado_em: ago(11*H) },
  { id: "d9",  cliente_id: "c7",  agente: "posvenda",    numero: "5511970000001", status: "enviado",   criado_em: ago(1*D) },
  { id: "d10", cliente_id: "c6",  agente: "followup",    numero: "5511970000001", status: "enviado",   criado_em: ago(1*D + 2*H) },
  { id: "d11", cliente_id: "c2",  agente: "radar",       numero: "5511970000001", status: "bloqueado", criado_em: ago(1*D + 5*H) }, // rate-cap por número
  { id: "d12", cliente_id: "c4",  agente: "followup",    numero: "5511970000001", status: "falhou",    criado_em: ago(1*D + 8*H) }, // instância caiu
  { id: "d13", cliente_id: "c10", agente: "reativador",  numero: "5511970000001", status: "enviado",   criado_em: ago(2*D) },
  { id: "d14", cliente_id: "c1",  agente: "followup",    numero: "5511970000001", status: "enviado",   criado_em: ago(2*D + 6*H) },
];

// ── Config (estado mutável da aba Config) ───────────────────────────────────
export const config = {
  whatsapp_provider: "evolution",
  evolution_url: "https://evo.minhaagencia.com.br",
  evolution_instance: "corretor-carlos",
  followup_dias: 1,
  reativador_dias: 30,
};

export const adapterStatus = "connected";
