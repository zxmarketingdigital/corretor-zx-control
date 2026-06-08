## O que este PR faz

<!-- Em 1-2 frases. Aponte a seção do spec (docs/specs/) que ele implementa. -->

## Checklist (linha ZX Control de nicho)

- [ ] Segue o spec em `docs/specs/2026-06-08-corretor-zx-control-design.md`
- [ ] **Não** editei nada fora do escopo do PR
- [ ] Testes novos cobrem o comportamento (TDD) e `pnpm ci` passa local
- [ ] Disparo proativo (se tocado): dedup + janela inf/sup + rate-cap por número + opt-out "SAIR"
- [ ] Matching imóvel×perfil é **SQL** (Gemini só pra NL/redação)
- [ ] RLS habilitado nas tabelas novas
- [ ] Sem segredo/credencial commitada; sem ID interno do ZX LAB

## Como testar

<!-- comandos / passos -->
