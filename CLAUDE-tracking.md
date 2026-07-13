# Corretor ZX Control — Estado do Projeto (tracking Rafael)

> ⚠️ Este arquivo é para TRACKING do Rafael, não para o colaborador.
> O guia do desenvolvedor está em `CLAUDE.md`.
> Última atualização: 2026-06-10

## Estado atual

- **Tag v1.0.0** → merge commit `7d7822f` (README fix está no commit seguinte `4029daf`)
- **PENDENTE**: decidir entre mover tag ou criar v1.0.1
  ```bash
  # Opção A — mover tag:
  git tag -f v1.0.0 4029daf && git push origin -f v1.0.0
  # Opção B — criar v1.0.1:
  git tag v1.0.1 4029daf && git push origin v1.0.1
  ```

## PR #2 — Revisão multi-agente (10/Jun/2026)

4 bugs CRITICAL identificados e corrigidos (PR #2 chegou com suíte 100% verde):

| Bug | Descrição | Fix |
|-----|-----------|-----|
| B1 | Auth bypass em `/api/import/*` (roteado antes do bloco autenticado) | Guard Bearer no bloco /api/import/ do index.ts |
| B2 | Rate-cap contando DESTINATÁRIO (cada lead é único → cap nunca disparava) | contarEnviosHora/Dia sem filtro `numero` |
| B3 | Zero delay entre envios (burst → risco de ban) | delayMs 3000–10000ms + sleep injetável |
| B4 | `regiao` lida no match mas nunca gravada por XML/CSV import | xml.ts deriva de bairro/cidade; csv.ts fallback |

10 testes de regressão: `tests/regressao-pr2-fixes.test.ts`
CI smoke-db: `.github/workflows/ci.yml` (job `smoke-db`)

## Próximos PRs esperados do Álvaro

1. Primitivas de núcleo: scheduler anti-ban, adapter WhatsApp (Evolution), wrapper Gemini
2. Agente 1 (reativo + anti-no-show + matching SQL)
3. Agentes 2/3/4/5 (um PR por agente)
4. Painel (Cloudflare Pages)
5. Setup/smoke.mjs
6. Origens do catálogo (CSV principal; XML best-effort)
7. Masterclass + guia de instalação

Cada PR: auto-review adversarial colado + ≤1000 linhas + CI verde.
