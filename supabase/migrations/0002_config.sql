-- Tabela de configuração da instalação (adapter, cadências, status feed).
-- Acessada pelo painel via Worker API (service key — bypassa RLS).
create table if not exists config (
  chave       text primary key,
  valor       jsonb not null,
  atualizado_em timestamptz not null default now()
);

alter table config enable row level security;
