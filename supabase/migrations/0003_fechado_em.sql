-- Adiciona `fechado_em` em conversas: marca QUANDO o negócio foi fechado.
-- Antes disso o pós-venda (Agente 5) usava `ultima_interacao` como proxy de D+3/D+30.
-- Um trigger preenche a coluna automaticamente quando `estado` passa a 'fechado',
-- então qualquer caminho (painel, WhatsApp) que feche o negócio já registra a data.

alter table conversas add column if not exists fechado_em timestamptz;

-- Backfill: conversas já fechadas recebem a última interação como aproximação.
update conversas
   set fechado_em = ultima_interacao
 where estado = 'fechado' and fechado_em is null;

-- Trigger: seta fechado_em no momento em que o estado vira 'fechado'.
create or replace function set_fechado_em() returns trigger as $$
begin
  if new.estado = 'fechado' and (old.estado is distinct from 'fechado') then
    new.fechado_em = now();
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_set_fechado_em on conversas;
create trigger trg_set_fechado_em
  before update on conversas
  for each row execute function set_fechado_em();
