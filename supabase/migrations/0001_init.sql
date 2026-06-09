-- Corretor ZX Control — schema inicial (spec §5)
-- Uma base por instalação. RLS habilitado por padrão em TODA tabela (decisão de núcleo, spec §3).
-- O Worker acessa via service key (bypassa RLS); nenhuma policy permissiva é criada para
-- anon/authenticated, de modo que a base nasce trancada. Anti-spam/ban e LGPD vivem aqui.

-- =============================================================================
-- imoveis — Catálogo (fonte única). Alimenta match (Agente 1) e radar (Agente 3) via SQL.
-- Origem plugável (§6). `atualizado_em` habilita a auto-expiração (§8).
-- =============================================================================
create table if not exists imoveis (
  id            uuid primary key default gen_random_uuid(),
  ref           text,                                  -- código externo/anúncio (origem plugável)
  titulo        text not null,
  tipo          text not null,                         -- apartamento | casa | terreno | sala | ...
  transacao     text not null check (transacao in ('venda', 'locacao')),
  preco         numeric(12, 2) not null,
  cidade        text,
  bairro        text,
  regiao        text,
  quartos       int,
  area_m2       numeric(10, 2),
  descricao     text,
  status        text not null default 'ativo' check (status in ('ativo', 'inativo', 'vendido')),
  origem        text not null default 'manual',        -- manual | csv | feed_xml | api (§6)
  atualizado_em timestamptz not null default now(),    -- auto-expiração (§8)
  criado_em     timestamptz not null default now()
);
create index if not exists imoveis_match_idx on imoveis (status, transacao, tipo, regiao, preco);

-- =============================================================================
-- clientes — Carteira. Criada pelos leads do Agente 1 + import CSV de onboarding (§8).
-- Guarda perfil de busca + elegibilidade p/ proativo + origem/consentimento (LGPD §12).
-- =============================================================================
create table if not exists clientes (
  id                 uuid primary key default gen_random_uuid(),
  nome               text,
  telefone           text not null unique,             -- número de WhatsApp (normalizado)
  -- perfil de busca
  orcamento_min      numeric(12, 2),
  orcamento_max      numeric(12, 2),
  regiao             text,
  tipo               text,
  finalidade         text check (finalidade in ('morar', 'investir')),
  prazo_mudanca      text,
  entrada_financiamento text,
  -- elegibilidade p/ disparo proativo (radar/reativador só disparam p/ elegível, §5)
  elegivel_proativo  boolean not null default false,
  -- LGPD (§12): origem + consentimento + opt-out "SAIR"
  origem             text not null default 'whatsapp', -- whatsapp | csv | manual | link_qr
  consentimento      boolean not null default false,
  consentimento_em   timestamptz,
  opt_out            boolean not null default false,   -- respondeu "SAIR" → nunca mais proativo
  opt_out_em         timestamptz,
  criado_em          timestamptz not null default now()
);

-- =============================================================================
-- conversas / mensagens — histórico por contato + estado do funil.
-- =============================================================================
create table if not exists conversas (
  id               uuid primary key default gen_random_uuid(),
  cliente_id       uuid not null references clientes (id) on delete cascade,
  estado           text not null default 'novo'
                   check (estado in ('novo', 'qualificado', 'visita_agendada',
                                     'visitou', 'negociacao', 'fechado', 'perdido')),
  ultima_interacao timestamptz not null default now(),
  criado_em        timestamptz not null default now()
);
create index if not exists conversas_cliente_idx on conversas (cliente_id);

create table if not exists mensagens (
  id         uuid primary key default gen_random_uuid(),
  conversa_id uuid not null references conversas (id) on delete cascade,
  direcao    text not null check (direcao in ('entrada', 'saida')),
  conteudo   text not null,
  criado_em  timestamptz not null default now()
);
create index if not exists mensagens_conversa_idx on mensagens (conversa_id, criado_em);

-- =============================================================================
-- visitas — agendamentos. Status p/ anti-no-show e métricas.
-- =============================================================================
create table if not exists visitas (
  id            uuid primary key default gen_random_uuid(),
  cliente_id    uuid not null references clientes (id) on delete cascade,
  imovel_id     uuid references imoveis (id) on delete set null,
  agendada_para timestamptz not null,
  status        text not null default 'agendada'
                check (status in ('agendada', 'confirmada', 'realizada', 'no_show', 'cancelada')),
  criado_em     timestamptz not null default now()
);
create index if not exists visitas_agenda_idx on visitas (agendada_para, status);

-- =============================================================================
-- disparos — Log de saída. BASE ÚNICA de dedup / idempotência / rate-cap por número /
-- opt-out de todos os crons (§5, §10). O scheduler (núcleo anti-ban) consulta isto.
-- =============================================================================
create table if not exists disparos (
  id                uuid primary key default gen_random_uuid(),
  cliente_id        uuid not null references clientes (id) on delete cascade,
  imovel_id         uuid references imoveis (id) on delete set null,  -- p/ idempotência cliente×imóvel (radar)
  agente            text not null,                                    -- antinoshow | followup | radar | reativador | posvenda
  numero            text not null,                                    -- número emissor → rate-cap por número (§3.1)
  chave_idempotencia text not null unique,                            -- bloqueia disparo duplicado
  status            text not null default 'enviado'
                    check (status in ('enviado', 'falhou', 'bloqueado')),
  criado_em         timestamptz not null default now()
);
create index if not exists disparos_ratecap_idx on disparos (numero, criado_em);
create index if not exists disparos_cliente_idx on disparos (cliente_id, criado_em);

-- =============================================================================
-- RLS — habilitado por padrão em TODA tabela (invariante de núcleo da linha, §3).
-- =============================================================================
alter table imoveis   enable row level security;
alter table clientes  enable row level security;
alter table conversas enable row level security;
alter table mensagens enable row level security;
alter table visitas   enable row level security;
alter table disparos  enable row level security;
