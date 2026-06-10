# Corretor ZX Control

2º pacote da **linha de produtos de nicho do ZX Control v3** (irmão da Clínica Cheia). Um sistema de
**5 agentes de WhatsApp** para o **corretor de imóveis autônomo**, que o aluno do ZX Control instala e
revende ao corretor.

> **Status:** lançado — **`v1.0.0`** (funcional ponta a ponta, suíte verde). O design está aprovado e
> congelado em [`docs/specs/2026-06-08-corretor-zx-control-design.md`](docs/specs/2026-06-08-corretor-zx-control-design.md).

## Os 5 agentes

1. **Atendente + Qualificador** (reativo) — atende 24/7, qualifica, casa com o estoque (SQL), agenda visita.
2. **Follow-up incansável** (cron) — "nenhum lead esfria".
3. **Radar de oportunidades / lançamentos** (cron) — imóvel novo × perfil da carteira.
4. **Reativador de carteira fria** (cron).
5. **Pós-venda + Indicação/Avaliação** (cron).

\+ **anti-no-show** (cron que reusa o Agente 1, confirma a visita na véspera).

## Stack

Cloudflare Workers + Cron Triggers · Supabase (RLS) · Cloudflare Pages (painel) · Gemini Flash ·
adapter de WhatsApp plugável (**Evolution** por padrão).

## Desenvolvimento

Se você é o desenvolvedor colaborador: **leia o [`CLAUDE.md`](CLAUDE.md)** — ele te conduz. Fluxo de
contribuição em [`CONTRIBUINDO.md`](CONTRIBUINDO.md). Processo de release em [`RELEASING.md`](RELEASING.md).

```bash
pnpm install
pnpm ci      # typecheck + testes + wrangler dry-run
```
