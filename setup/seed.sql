-- Dados demo para smoke test e onboarding.
-- Execute após aplicar as migrations: psql $SUPABASE_URL -f seed.sql

insert into imoveis (titulo, tipo, transacao, preco, cidade, bairro, regiao, quartos, area_m2, descricao, status, origem) values
  ('Apartamento 2 quartos - Centro',  'apartamento', 'venda',   450000, 'São Paulo', 'República',  'centro',  2, 65,  'Ótima localização, próximo ao metrô.',        'ativo', 'seed'),
  ('Casa 3 quartos - Zona Sul',       'casa',        'venda',   620000, 'São Paulo', 'Moema',      'sul',     3, 120, 'Casa com jardim e 2 vagas.',                  'ativo', 'seed'),
  ('Sala comercial - Centro',         'sala',        'locacao',   4500, 'São Paulo', 'Paulista',   'centro',  0, 40,  'Ideal para consultório ou pequeno escritório.','ativo', 'seed'),
  ('Terreno - Zona Norte',            'terreno',     'venda',   180000, 'São Paulo', 'Santana',    'norte',   0, 250, 'Terreno plano com ótimo acesso.',             'ativo', 'seed'),
  ('Apartamento 1 quarto - Zona Leste','apartamento','locacao',  2200, 'São Paulo', 'Tatuapé',    'leste',   1, 42,  'Mobiliado, condomínio incluso.',              'ativo', 'seed')
on conflict do nothing;

insert into clientes (telefone, nome, orcamento_min, orcamento_max, regiao, tipo, finalidade, elegivel_proativo, origem, consentimento, consentimento_em) values
  ('5511900000001', 'Demo Lead 1', 350000,  600000, 'centro', 'apartamento', 'morar',   true,  'seed', true, now()),
  ('5511900000002', 'Demo Lead 2', 500000,  800000, 'sul',    'casa',        'morar',   true,  'seed', true, now()),
  ('5511900000003', 'Demo Lead 3', 100000,  250000, null,     'terreno',     'investir',true,  'seed', true, now())
on conflict (telefone) do nothing;
