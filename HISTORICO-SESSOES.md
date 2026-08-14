# Histórico de Sessões — corretor-zx-control

> Registro do que foi feito a cada sessão de trabalho neste projeto (mais recente no topo).
> Mantido pelo `/encerrar` via `zx-worklog.py`. Ler no início pra recuperar contexto.

---

## 2026-08-13 — Fix Gemini aposentado (404)

**Feito:** Mesmo defeito do gemini-2.5-flash/2.0-flash aposentado encontrado e corrigido nos 4 repos irmaos da linha de nicho + no setup Semana 1, apos achar na Clinica Cheia (aluno Diogo reportou).
**Fix:** modelo default trocado p/ alias gemini-flash-lite-latest, GEMINI_MODEL opcional com trim+fallback, parser resiliente a part sem text e a thought:true (raciocinio interno).
**Arquivos:** src/gemini/client.ts (contabilidade, corretor) · src/config.ts+src/ia.ts (juridico) · scripts/agent_bant.py+setup/setup_agent.py (semana1) · setup/configure.mjs+setup/smoke.mjs (corretor).
**Deploy:** push origin/main nos 4 (CI verde: 101/164/84 testes). Cascas geradoras (~/.claude/skills/criar-repo-setup-colaborador/templates/) corrigidas junto p/ setup novo nao nascer quebrado; regra registrada na SKILL.md.
**Pendencias:** nenhuma. Aviso enviado no grupo ZX Control 5 com instrucao de git pull + wrangler deploy.

## 2026-07-15 — seed de contexto (histórico anterior não capturado)

<!-- zx-seed:v1 -->
> **[seed — derivado de git log / Mission Control, NÃO é registro de sessão.]** Histórico anterior a esta data não foi capturado. A partir daqui, o `/encerrar` e o cron noturno mantêm o histórico real.

**Commits recentes (git):**
- 2026-07-13  5933be9  WIP: limpeza de arquivos soltos entre sessões (13/Jul/26)
- 2026-07-04  07e2e59  fix(corretor-zx-control): corrige refs quebradas no wizard configure.mjs (nome do proprio arquivo + config.example.js)
- 2026-06-10  436dd6e  feat: PR template com checklist DoD Setup de Nicho v2 (N1-N6)
- 2026-06-10  0ba2cb8  feat: backfill DoD Setup de Nicho v2 — LP do aluno, proposta comercial, demo local e perfil CI nicho-dod
- 2026-06-10  fc7e20a  Painel premium (design system ZX Control) + cadastro manual de cliente e visita
- 2026-06-10  2a056ec  chore(processo): guardrails pós-review do PR #2 — CI smoke-db + DoD + auto-review
- 2026-06-10  4029daf  docs: README reflete lançamento v1.0.0 (estava em 'v0.x em desenvolvimento')
- 2026-06-10  0264fd6  fix(review): corrige 4 bloqueantes + 3 HIGH do review do PR #2
- 2026-06-09  003dc48  feat: janela de disparo em horario do Brasil (08-18) + coluna fechado_em
- 2026-06-09  aad49c9  feat: seletores dos 6 crons proativos (fatia 2)
- 2026-06-09  43d0592  feat: camada de dados Supabase + fiacao do Worker (fatia 1)
- 2026-06-09  37b49be  fix: Gemini 2.5-flash, status Evolution v2 e limpeza da anon key

