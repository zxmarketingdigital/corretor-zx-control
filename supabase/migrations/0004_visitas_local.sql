-- Visitas agendadas manualmente pelo painel podem registrar o local de encontro
-- (endereço do imóvel, plantão, etc). Exibido na aba Visitas.
alter table visitas add column if not exists local text;
