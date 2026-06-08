# Corretor ZX Control — Pacote de Nicho ZX Control v3 (Imobiliário)

> Data: 2026-06-08 · Slug: `corretor-zx-control` · Linha: pacotes de nicho ZX Control v3
> Irmão de: `clinica-cheia` (1º pacote, estética, `v1.0.0`)
> Status: spec aprovado em brainstorming + **revisado pós team-review (3 agentes, 2026-06-08)**.
> Próximo passo: plano de implementação (skill writing-plans).

## 1. Resumo

2º pacote da **linha de produtos de nicho** do ZX Control v3. O aluno do ZX Control instala e
**revende** o produto pronto (white-label) pro cliente final, acompanhado de uma **masterclass de
como vender/precificar**. Este pacote atende o **nicho imobiliário**.

- **Cliente final do v1:** **corretor autônomo** (trabalha sozinho / poucos imóveis próprios e
  parcerias). A **imobiliária** (multi-corretor) é camada futura, não entra no v1.
- **Promessa-âncora:** *"Nenhum lead esfria"* — responde na hora, qualifica, casa com o estoque,
  agenda visita e persegue follow-up que o corretor humano nunca faz. Métrica que o corretor
  sente: **visitas agendadas + taxa de resposta**.
- **Eixo de valor do dia 1 (pitch):** Agente 1 (atende enquanto o corretor está na rua/visita) +
  anti-no-show + Agente 5 (indicação). O **radar** é diferencial vendável, mas **liga depois que a
  Carteira enche** — vendido como "valor que cresce", não como entrega imediata (ver §9).

## 2. Decisões travadas

| # | Decisão | Valor |
|---|---------|-------|
| 1 | Cliente final do v1 | Corretor autônomo (imobiliária = camada futura) |
| 2 | Promessa-âncora | "Nenhum lead esfria" (reativo); radar é agente, não fundação |
| 3 | Nº de agentes | 5 (o anti-no-show é **cron** que reusa a lógica do Agente 1 — ver §4) |
| 4 | Fonte do Catálogo | Fonte única, origem plugável (manual / CSV principais · feed XML / API = atalho/gancho) |
| 5 | Fonte do radar | **Só o Catálogo** (qualquer origem). **Sem Apify, sem scraping.** |
| 6 | WhatsApp | **Evolution API por padrão** — **divergência consciente da linha** (ver §3.1) |
| 7 | Cérebro | Google Gemini Flash (só NL + redação; **matching = SQL**, ver §3.2) |
| 8 | Abordagem de build | **Monolito com boa higiene de módulos** (revertida a decisão "engine/ separado já agora") |
| 9 | Extração do engine genérico | **Fora do v1** — só quando houver 2 moldes (Clínica refatorada + Corretor) |
| 10 | Validação | Testes + sandbox E2E + smoke na instalação. **Sem corretor-piloto.** |
| 11 | Anti-ban (Evolution) | **Throttle de taxa por número** (não só dedup) é requisito de núcleo (§3.1) |
| 12 | LGPD | Opt-out "responda SAIR" + registro de consentimento em todo disparo proativo (§4) |

## 3. Arquitetura

Construído como **monolito com boa higiene de módulos** (mesmo padrão da Clínica v1.0.0, que é
`src/ painel/ setup/ supabase/ tests/` — **sem** camada `engine/` extraída). Os adapters, o
scheduler, o wrapper Gemini e os agentes ficam em **arquivos/módulos próprios e bem separados
dentro do mesmo repo**, mas **não** se cria a fronteira de pastas `engine/` vs `nicho/` agora.

> **Por que monolito, não split engine/nicho:** a Clínica v1.0.0 não tem um `engine/` pronto pra
> herdar — ela é monolítica. Extrair uma camada genérica a partir de **um único** nicho é abstração
> prematura. A extração real do engine acontece quando houver **dois moldes** (Clínica + Corretor)
> pra comparar — exatamente o critério que a linha já adota pro builder `nucleo-nicho` (Fase 2).
> Regra de higiene: só vira candidato a "genérico" o que for trivialmente reusável (wrapper Gemini,
> retry HTTP, primitivas de scheduler). A promoção pra um pacote `engine/` é trabalho **futuro**.

**Pilares herdados da linha (não rediscutidos):**
- Serverless: **Cloudflare Workers** (webhook + Cron Triggers) + **Supabase** (uma base por
  instalação, agenda própria embutida, **RLS habilitado por padrão** em todas as tabelas) + **Pages**
  (painel). Free tier por instalação (ressalva do WhatsApp em §3.1).
- **Núcleo congelado e versionado** (`vX.Y.Z`); instalação **só configura, nunca gera código**.
- **Update:** descentralizado, `git pull` da tag nova por instalação.

### 3.1 WhatsApp via Evolution API (divergência consciente da linha)

A Clínica **desencorajou** Evolution pra revenda (não é serverless — exige container/VPS sempre-ligado
por cliente). Aqui a decisão é **manter Evolution como default mesmo assim**. Consequências assumidas
e mitigações que viram **requisito de núcleo**:

- **Quem hospeda:** a instância Evolution de cada corretor roda na **infra do aluno-revendedor**
  (que opera uma agência ZX Control e já tem/terá esse stack), **não** no Mac do corretor nem em
  free tier de CF. O "free tier por instalação" vale pra Workers+Supabase+Pages; o WhatsApp é o
  componente não-serverless e fica explícito na masterclass de quem o sustenta.
- **Anti-ban (requisito, não detalhe de adapter):** 3 dos 5 agentes disparam proativo sobre o número.
  Dedup **não** protege contra ban — ban vem de *volume/padrão*. O scheduler precisa de **throttle de
  taxa por número** conservador por padrão, calibrado pra número pessoal não-aquecido (referência ZX:
  20/h · 80/dia · intervalo mínimo). Isso é testado (§10).
- **Adapter plugável preservado:** Z-API / Meta Cloud API / uazapi continuam implementáveis sem mexer
  no núcleo. **Meta Cloud API (oficial, com template)** é o caminho recomendado na masterclass pra
  quem quiser escalar disparo proativo fora da janela de 24h com segurança.
- **Reconexão:** a instância cai (sessão expira) → painel mostra status e alerta; a masterclass ensina
  reconexão por QR.

### 3.2 Onde o Gemini entra (e onde NÃO entra)

- **Gemini Flash faz:** (a) interpretar a conversa do lead → extrair critérios estruturados
  (orçamento, região, tipo, finalidade); (b) redigir mensagens.
- **Gemini NÃO faz matching de inventário.** O match imóvel×perfil é **query SQL no Supabase** (faixa
  de preço, região, tipo, finalidade, ordenado por aderência) — barato, determinístico e testável.
  Pôr catálogo no prompt seria caro, não-determinístico e estouraria contexto quando crescer.

## 4. Os 5 agentes

> Toda saída **proativa** (Agentes 2, 3, 4 e o cron anti-no-show) passa pelo scheduler com:
> dedup + idempotência + **janela com limite inferior e superior** + **throttle de taxa por número**
> + **opt-out** (cliente que respondeu "SAIR" nunca mais recebe proativo). Lições diretas dos 3 bugs
> de spam/ban que a Clínica corrigiu — aqui viram **invariantes testadas** (§10), não adjetivos.

### Agente 1 — Atendente + Qualificador (reativo, tempo real)
Agente-espinha. Atende WhatsApp 24/7 (inclusive um **link/QR "fale comigo"** que o corretor põe na
bio/anúncio/placa → cai direto aqui, dando porta de entrada de lead barata). Qualifica no padrão
imobiliário: **orçamento, entrada/financiamento, tipo, região, prazo de mudança, finalidade
(morar/investir)**. Faz **match via SQL** no Catálogo e apresenta os imóveis aderentes. Oferece
**agendar visita**. Aceita o corretor **marcar fechado/perdido pelo próprio WhatsApp** (pergunta
proativa "o cliente X fechou ou desistiu?") — elimina a maior parte da dependência de painel. Todo
lead vira registro na **Carteira** com perfil de busca + **origem/consentimento** capturados.
**Guardrails (CDC/CRECI):** nunca afirmar disponibilidade sem checar o Catálogo, nunca prometer
condição/aprovação de financiamento, sempre encaminhar negociação ao corretor humano.

### Anti-no-show (cron que reusa a lógica do Agente 1)
Confirma a visita **no dia anterior** e reagenda se cair. É **job cron** (proativo/agendado) que
compartilha prompt/contexto com o Agente 1 — não roda dentro do webhook reativo.

### Agente 2 — Follow-up incansável (cron)
Faz a promessa "nenhum lead esfria" valer. Persegue lead que não respondeu e lead pós-visita que
sumiu, com **cadência multi-toque configurável** (defaults fixados no plano).

### Agente 3 — Radar de oportunidades / lançamentos (cron)
Imóvel/lançamento novo no **Catálogo** → casa (SQL) com o **perfil dos clientes elegíveis** da
Carteira → dispara conversa proativa. **Idempotente** (não reavisa cliente×imóvel já avisado).
**Fonte = só o Catálogo.** Só dispara pra cliente **elegível** (ver §5).

### Agente 4 — Reativador de carteira fria (cron)
Clientes antigos elegíveis que sumiram, ou investidores → reativação periódica com **cadência longa**.

### Agente 5 — Pós-venda + Indicação/Avaliação (cron)
Quem fechou → acompanha, pede **indicação** (corretor vive disso — peça de destaque do pitch) e
**avaliação no Google**. Idempotente.

## 5. Modelo de dados (Supabase — uma base por instalação, RLS habilitado)

| Tabela | Papel | Observações |
|--------|-------|-------------|
| `imoveis` | **Catálogo — fonte única** | Alimenta match (Agente 1) e radar (Agente 3) via SQL. Origem plugável (§6). Campo de **última atualização** pra auto-expiração. |
| `clientes` | **Carteira** | Criada automaticamente pelos leads do Agente 1 + **import CSV (passo de onboarding)**. Guarda **perfil de busca** + **estado de elegibilidade pra disparo proativo** + **origem/consentimento** (LGPD). |
| `conversas` / `mensagens` | Histórico por contato | Estado do funil: `novo → qualificado → visita_agendada → visitou → negociacao → fechado/perdido`. |
| `visitas` | Agendamentos | Status pra anti-no-show e métricas. |
| `disparos` | Log de saída | Base única de dedup / idempotência / **rate-cap por número** / opt-out de todos os crons. |

**Elegibilidade pra proativo:** radar/reativador só disparam pra cliente com interação mínima e sem
opt-out — senão a Carteira (que enche de lead-curioso e número errado) vira fonte de spam/ban.

## 6. Origem do Catálogo (adapter plugável)

1. **Cadastro manual no painel** — **caminho principal**; funciona pra quem não tem sistema.
2. **Import CSV/planilha** — **caminho principal**; o que o autônomo realmente consegue prover.
3. **Feed XML padrão (VRSync / Canal Pro)** — **atalho quando disponível** (não "preferido"): o feed
   é recurso de CRM pago (Jetimob/Vista/Tecimob/Imobzi) que o autônomo enxuto raramente tem; cada CRM
   tem dialeto, então o adapter é **best-effort por dialeto** com fallback e aviso no painel quando
   não parsear. Validar com 2-3 feeds reais antes de prometer "um adapter".
4. **API custom** — gancho documentado pro caso raro de sistema próprio.

## 7. Painel (Cloudflare Pages)

- Catálogo de imóveis: CRUD + status do feed/import + alerta de imóvel desatualizado.
- Carteira de clientes: perfil de busca + estado no funil + elegibilidade/consentimento.
- Conversas: ver histórico, assumir manualmente.
- Visitas: agenda + marcar realizada / no-show.
- Operação: marcar **fechado/perdido** (também possível **pelo WhatsApp**, via Agente 1), disparar radar manual.
- Configuração: WhatsApp adapter (Evolution default), origem do catálogo, cadências dos crons, status da instância Evolution.

## 8. Pontos de operação (a masterclass DEVE ensinar) + mitigações

O produto depende de duas ações do corretor — e o autônomo é notoriamente desorganizado, então as
mitigações vão **além de "ensinar"**:
1. **Manter o Catálogo atualizado.** Mitigações: import CSV como caminho principal; **auto-expiração**
   (imóvel sem atualização há X dias → Agente 1 para de oferecê-lo ativamente e avisa o corretor).
2. **Marcar fechado/perdido.** Mitigação: fazer isso **pelo WhatsApp** (Agente 1 pergunta), não só painel.
3. **Popular a Carteira cedo.** Mitigação: **import CSV de clientes vira passo de onboarding** (mesmo
   sem conversa, só o perfil) — dá combustível ao radar antes de a base encher organicamente.

## 9. Masterclass de venda (lado "como revender")

- **Pitch ancorado no dia 1:** Agente 1 (atende quando você está na rua) + anti-no-show + indicação.
  Radar vendido como **"valor que cresce"** (liga quando a carteira enche), com **honestidade** —
  não prometer disparo de radar no dia 1.
- **Precificação:** ancorar em **comissão**, não em mensalidade ("uma visita a mais fechada no ano
  paga a assinatura"); preferir **setup maior + mensalidade baixa** pra reduzir superfície de churn
  (renda do corretor é intermitente). Quem hospeda a instância Evolution (§3.1) entra no custo.
- **Instalação:** clonar tag → configurar → seed → deploy → conectar WhatsApp (Evolution) → smoke.
- **Operação:** os 3 pontos do §8.
- **LGPD/CRECI:** orientar a só importar contatos com relação comercial real; opt-out automático.

## 10. Validação (herdado da linha)

- Suíte de **testes automatizados** + **sandbox E2E** + **smoke na instalação**. **Sem corretor-piloto.**
- **Testes obrigatórios do scheduler (anti-ban/spam), desde o dia 1:** (a) não dispara 2x pro mesmo
  cliente na janela; (b) toda janela cron tem limite inferior **e** superior; (c) radar não reavisa
  cliente×imóvel; (d) **rate-cap por número/dia** respeitado; (e) opt-out "SAIR" bloqueia proativo.
- **Matching** vira teste de unidade (filtro SQL determinístico).
- Recomendação adicional (Evolution): **piloto-sombra** com número descartável rodando os crons 1-2
  semanas, observando taxa de envio, antes da 1ª revenda real.

## 11. Escopo do v1

**Entra (v1 completo):** os 5 agentes + anti-no-show · Catálogo com manual + CSV principais (feed XML
best-effort + API custom como gancho) · Carteira automática + import CSV de onboarding · link/QR de
captura → Agente 1 · painel · masterclass · adapter **Evolution** (Z-API/Meta/uazapi como gancho) ·
radar sobre o Catálogo · matching SQL · RLS + anti-ban + LGPD opt-out como núcleo.

**Fora do v1 (YAGNI / camadas futuras):**
- **Modo imobiliária multi-corretor** (distribuição de leads, papéis/permissões).
- **Extração do `engine/` genérico** — só com 2 moldes (Clínica + Corretor).
- **Builder `nucleo-nicho` (Fase 2)** e migração da Clínica.
- **Conector Apify** e qualquer **scraping próprio de portais**.
- **Ranking semântico** (embeddings) de imóvel — só se o match SQL não bastar, como camada opcional.
- Integração bidirecional de assinatura/contrato/CRM externo.
- **Distribuição via área de membros** depende da skill `/criar-setup-zxcontrol-v2` (pendente na
  linha) — o v1 entrega **núcleo + conteúdo da masterclass**; o trilho de distribuição entra quando a v2 existir.

## 12. Riscos conhecidos (pós-review)

- **🔴 Ban do número pessoal (Evolution + proativo):** mitigado por throttle de taxa por número como
  núcleo (§3.1/§10), opt-out, Meta oficial recomendado pra escala, piloto-sombra antes de revender.
- **🔴 Descasamento demo-vs-valor (radar vazio no dia 1):** mitigado por pitch ancorado no Agente 1 +
  anti-no-show + indicação, import CSV de carteira no onboarding, e honestidade sobre o radar (§9).
- **🟡 Catálogo desatualizado** cega Agente 1 e radar → auto-expiração + CSV principal + marcação por WhatsApp.
- **🟡 Feed XML cobre menos que o esperado** (CRM pago + dialetos) → rebaixado a atalho best-effort (§6).
- **🟡 Quem hospeda/monitora a instância Evolution** por corretor → definido como infra do aluno-revendedor (§3.1).
- **🟢 Abstração prematura do engine** → eliminada ao reverter pra monolito; extração só com 2 moldes.
