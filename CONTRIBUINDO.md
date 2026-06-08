# Como contribuir (passo a passo)

Este repositório segue o modelo **"você propõe, o ZX LAB publica"**. Você desenvolve numa branch e abre
um **Pull Request (PR)**; o Rafael (`@zxmarketingdigital`) revisa, aprova e faz o merge. Você **não**
consegue (nem deve) dar push direto na `main` — ela é protegida.

## Pré-requisitos (uma vez)

1. Tenha uma **conta GitHub própria** (não a do ZX LAB) e **aceite o convite** de colaborador que
   chegou no seu email/GitHub.
2. Abra o repositório no **claude.ai/code** (ou Claude Code local) com a **sua** conta.

## O fluxo de cada tarefa

1. **Diga ao Claude:** *"leia o CLAUDE.md e me conduza"*. Ele lê o `CLAUDE.md` + o spec e propõe o plano.
2. **Crie uma branch** pra tarefa (nunca trabalhe direto na `main`):
   ```bash
   git checkout -b feat/agente-1-atendente
   ```
3. **Desenvolva via TDD** (teste primeiro). Mantenha o PR pequeno e focado num pedaço coerente.
4. **Garanta o CI verde local** antes de abrir:
   ```bash
   pnpm ci
   ```
5. **Abra o PR:**
   ```bash
   git push -u origin feat/agente-1-atendente
   gh pr create --fill
   ```
   Preencha o checklist do template.
6. **Avise o Rafael** que o PR está pronto. Ele revisa, comenta ou aprova+mergeia.
7. Se ele pedir ajustes, **faça na mesma branch** e dê push — o PR atualiza sozinho.

## Regras que o CI e a proteção da branch garantem

- Todo PR roda o **CI** (typecheck + testes + wrangler dry-run).
- Todo PR precisa de **1 aprovação do dono do código** (`@zxmarketingdigital`).
- **Sem push direto** na `main`, **sem force-push**, **sem mexer em `.github/`**.
- **Sem segredo** commitado (secret scanning bloqueia).

## Dúvidas de escopo

Se o spec estiver ambíguo ou faltando algo, **pergunte antes de inventar**. Decisão de produto é do
Rafael — registre a dúvida no PR ou avise por fora.
