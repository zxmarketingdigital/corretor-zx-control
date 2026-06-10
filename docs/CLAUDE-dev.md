# Corretor ZX Control — guia do desenvolvedor (Claude Code)

> Você (Claude Code) está no repositório de um **produto em construção**: o **Corretor ZX Control**,
> 2º pacote da linha de produtos de nicho do ZX Control v3 (o 1º é a Clínica Cheia). É um sistema de
> **5 agentes de WhatsApp** para o **corretor de imóveis autônomo**. O dono deste repo é um
> **desenvolvedor colaborador** contratado pra construir o produto. O ZX LAB (Rafael, `@zxmarketingdigital`)
> revisa e publica.

## 🎯 Seu papel: CONSTRUIR o produto a partir do spec, via PR

Diferente do repo de um produto já pronto (onde o Claude só configura), **aqui você desenvolve código**.
Mas dentro de regras firmes:

1. **O spec é a fonte de verdade. Leia-o inteiro antes de tocar em qualquer arquivo:**
   `docs/specs/2026-06-08-corretor-zx-control-design.md`. Tudo que você construir tem que sair dele.
   Se algo no spec estiver ambíguo ou faltando, **pergunte ao colaborador humano** (que pergunta ao
   Rafael) — não invente requisito.
2. **TDD sempre.** Escreva o teste primeiro, veja falhar, implemente o mínimo, veja passar. O núcleo
   da linha é validado por teste — sem suíte verde não há release.
3. **Monolito com boa higiene de módulos.** Adapters, scheduler, wrapper Gemini e agentes em
   arquivos/módulos próprios e bem separados — mas **NÃO** crie a fronteira de pastas `engine/` vs
   `nicho/`. Essa extração é trabalho futuro (decisão registrada no spec §3). Estrutura: `src/`,
   `tests/`, `supabase/`, `painel/`, `setup/`.
4. **PR pequeno e escopado.** Um PR por unidade coerente (um agente, o schema, o adapter…). `pnpm ci`
   tem que passar local antes de abrir.

## Regras inquebráveis (saem do spec — não negocie)

- **Stack da linha:** Cloudflare **Workers** (webhook + Cron Triggers) + **Supabase** (1 base por
  instalação, **RLS habilitado por padrão em toda tabela**) + **Pages** (painel). Cérebro: **Gemini Flash**.
- **Matching imóvel×perfil = SQL no Supabase.** Gemini só pra (a) extrair critério da conversa do lead
  e (b) redigir mensagem. **Nunca** mande o catálogo no prompt.
- **WhatsApp:** **Evolution API é o default** deste pacote (spec §3.1), mas o adapter é **plugável**
  (interface única; `zapi`/`meta`/`uazapi` implementáveis sem mexer no núcleo).
- **Todo disparo proativo** (Agentes 2/3/4 + cron anti-no-show) passa pelo scheduler com, **como
  invariantes testadas**: dedup (chave distingue toques diferentes do mesmo agente) + idempotência +
  **janela com limite inferior E superior em America/Sao_Paulo** + **rate-cap GLOBAL da linha
  emissora** + **delay/jitter entre envios** + **opt-out "SAIR"**. A Clínica teve 3 bugs de spam/ban
  exatamente aqui — não repita.
  > ⚠️ **"Rate-cap por número" significa o número QUE ENVIA (a instância do corretor), nunca o
  > destinatário.** Quem toma ban é a linha emissora. Contar envios por destinatário faz o cap nunca
  > disparar (cada lead é um número distinto) — foi exatamente o bug CRITICAL do PR #2. O teste do
  > cap deve usar **N destinatários distintos** e provar que o N+1 além do cap é bloqueado.
- **Agente 1** tem guardrails CDC/CRECI: não afirmar disponibilidade sem checar o Catálogo, não
  prometer condição/aprovação de financiamento, sempre encaminhar negociação ao corretor humano.
- **LGPD:** registrar origem/consentimento do contato; opt-out automático em todo proativo.
- **Núcleo congelado e versionado:** distribuição por **tag** `vX.Y.Z` (ver `RELEASING.md`), nunca a `main`.
- **Sem segredo no repo.** Credenciais vivem em `.env`/wrangler secret (gitignored). Sem ID interno do ZX LAB.
- **Um valor, um lugar.** Model id do Gemini, janelas de horário, caps de envio e qualquer valor de
  configuração ficam em **uma constante exportada única** que todos os consumidores importam — incluindo
  `setup/` e `painel/`. Literal repetido em 2+ arquivos = fix incompleto garantido (o fix do
  `gemini-2.0`→`2.5` do PR #2 esqueceu `setup/configure.mjs` exatamente por isso).
- **Auth em TODA rota nova, falha-fechado.** Rota nova no Worker exige Bearer/secret e o check tem que
  estar no caminho DELA (não só existir em outra rota — o PR #2 roteou os imports ANTES do bloco
  autenticado). Token ausente/vazio → 401 sempre.

## Definition of Done (sem isso o PR volta)

1. **Teste de invariante de verdade**: para cada invariante tocado (auth, anti-ban, dedup, match),
   existe um teste que **falha se o seu código for revertido**. Critério objetivo: `git stash` no seu
   código, rode a suíte — o teste novo TEM que quebrar. Se continua verde, é teatro (mock testando mock).
2. **Caminho de integração coberto**: se um fluxo grava (import/webhook) e outro lê (match/cron), há um
   teste passando dados reais do parser de ponta a ponta — coluna gravada = coluna lida. (O match por
   região do PR #2 retornava sempre vazio porque import gravava `bairro` e o match lia `regiao`; a suíte
   unitária verde não viu.)
3. **Fix de valor/ID com grep**: trocou um valor? `grep -rn` do valor antigo no repo inteiro, zero
   ocorrências.
4. **Auto-review adversarial rodado** e resultado colado no PR (prompt no `CONTRIBUINDO.md`).
5. `pnpm ci` verde local + PR ≤ ~1.000 linhas de diff.

## Ordem de construção sugerida (derive seu plano do spec)

Você decide o plano detalhado a partir do spec; uma sequência que reduz risco:

1. `supabase/migrations/` — schema do §5 (imoveis, clientes, conversas/mensagens, visitas, disparos) **com RLS**.
2. Primitivas de núcleo: wrapper Gemini (retry/timeout), **scheduler com anti-ban testado**, **adapter
   WhatsApp (Evolution)** atrás de interface.
3. **Agente 1** (reativo) + **matching SQL** + captura de carteira/consentimento.
4. **Cron anti-no-show** (reusa lógica do Agente 1).
5. Agentes **2, 3, 4, 5** (cada um um PR; todos sob as invariantes anti-ban).
6. `painel/` (Pages) — telas do §7.
7. `setup/` — wizard de configuração + `smoke.mjs` (valida instalação).
8. Origens do Catálogo do §6 (manual/CSV principais; feed XML best-effort).
9. Conteúdo da masterclass / guia de instalação (modele no CLAUDE.md de instalador da Clínica Cheia).

## Modelo de colaboração (importante)

- A `main` é **protegida**: você **não dá push direto**. Crie branch, abra **PR** com sua própria conta GitHub.
- **Só o Rafael (`@zxmarketingdigital`) aprova e mergeia.** Você propõe; ele publica.
- **Nunca edite `.github/`** (workflows/CODEOWNERS) — é território do dono.
- Fluxo leigo passo-a-passo: ver `CONTRIBUINDO.md`.

## Comandos

```bash
pnpm install            # 1ª vez (gera o lockfile no seu 1º PR)
pnpm test               # roda a suíte
pnpm typecheck          # tsc src + tests
pnpm ci                 # typecheck + testes + wrangler dry-run (tem que passar antes do PR)
pnpm dev                # wrangler dev local
```
