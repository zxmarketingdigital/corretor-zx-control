# Corretor Cheio — Pacote de Nicho ZX Control v3 (Imobiliário)

> Data: 2026-06-08 · Slug: `corretor-cheio` · Linha: pacotes de nicho ZX Control v3
> Irmão de: `clinica-cheia` (1º pacote, estética, `v1.0.0`)
> Status do documento: spec aprovado em brainstorming, aguardando plano de implementação.

## 1. Resumo

2º pacote da **linha de produtos de nicho** do ZX Control v3. O aluno do ZX Control instala e
**revende** o produto pronto (white-label) pro cliente final, acompanhado de uma **masterclass de
como vender/precificar**. Este pacote atende o **nicho imobiliário**.

- **Cliente final do v1:** **corretor autônomo** (trabalha sozinho / poucos imóveis próprios e
  parcerias). A **imobiliária** (multi-corretor) é camada futura, não entra no v1.
- **Promessa-âncora:** *"Nenhum lead esfria"* — responde na hora, qualifica, casa com o estoque,
  agenda visita e persegue follow-up que o corretor humano nunca faz. Métrica que o corretor
  sente: **visitas agendadas + taxa de resposta**.
- **Motor proativo:** o **radar de oportunidades/lançamentos** entra como um dos 5 agentes, em
  cima da base reativa — não é a fundação.

## 2. Decisões travadas (brainstorming 2026-06-08)

| # | Decisão | Valor |
|---|---------|-------|
| 1 | Cliente final do v1 | Corretor autônomo (imobiliária = camada futura) |
| 2 | Promessa-âncora | "Nenhum lead esfria" (reativo); radar é agente, não fundação |
| 3 | Nº de agentes | 5 (o 6º — anti-no-show — vive **dentro** do Agente 1) |
| 4 | Fonte do Catálogo de imóveis | Fonte única, origem plugável em camadas (manual / CSV / feed XML padrão / API custom) |
| 5 | Fonte do radar | **Só o Catálogo** (qualquer origem). **Sem Apify, sem scraping.** |
| 6 | WhatsApp | **Evolution API por padrão**; adapter plugável (Z-API/Meta/uazapi = gancho opcional) |
| 7 | Cérebro | Google Gemini Flash (herdado da linha) |
| 8 | Abordagem de build | **C** — construir à mão JÁ separando `engine/` (genérico) de `nicho-imobiliaria/` (semente da Fase 2) |
| 9 | Migração da Clínica pro engine | **Fora de escopo** — trabalho futuro opcional |
| 10 | Validação | Testes + sandbox E2E + smoke na instalação. **Sem corretor-piloto.** |

## 3. Arquitetura

Código nasce dividido em duas camadas (decisão C — semeia a Fase 2 da linha):

### `engine/` — genérico, nicho-agnóstico
Derivado dos padrões já provados da Clínica Cheia, mas escrito pra servir **qualquer** nicho:
- **Adapter de WhatsApp** — interface única; **Evolution API como default**; Z-API / Meta / uazapi
  como implementações opcionais plugáveis.
- **Runtime de scheduler/cron** — execução dos agentes cron com dedup, idempotência e janela
  anti-spam de fábrica (lição dos bugs da Clínica: agente cron sem dedup vira flood/ban).
- **Casca do painel** (Cloudflare Pages) — shell de layout/auth/navegação; as telas concretas
  vêm do nicho.
- **Wrapper Gemini Flash** — chamada ao cérebro com retry/timeout.
- **Framework de adapters de origem de dados** — contrato comum que o Catálogo do nicho implementa.

### `nicho-imobiliaria/` — específico do nicho
- Os **5 agentes** (prompts + lógica de funil imobiliário).
- O **schema** (catálogo + carteira + conversas + visitas + disparos).
- Os **adapters de origem do Catálogo** (manual / CSV / feed XML / API custom).
- As **telas do painel** específicas.
- A **masterclass de venda**.

### Pilares herdados da linha (não rediscutidos)
- Serverless: **Cloudflare Workers** (webhook + Cron Triggers) + **Supabase** (uma base por
  instalação, com agenda própria embutida) + **Pages** (painel). Free tier por instalação.
- **Núcleo congelado e versionado** (`vX.Y.Z`); instalação **só configura, nunca gera código**.
- **Update:** descentralizado, `git pull` da tag nova por instalação.

### Limite de escopo arquitetural
O `engine/` é **validado por imobiliárias** neste projeto. A Clínica Cheia **não** é migrada pra
cima dele agora (risco separado). O builder genérico formal (`nucleo-nicho`, Fase 2) só é escrito
depois, com **dois moldes** (Clínica + Imobiliária) pra comparar e extrair a abstração certa.

## 4. Os 5 agentes

### Agente 1 — Atendente + Qualificador (reativo, tempo real)
Agente-espinha. Atende WhatsApp 24/7. Qualifica no padrão imobiliário: **orçamento,
entrada/financiamento aprovado, tipo de imóvel, região, prazo de mudança, finalidade
(morar/investir)**. Consulta o **Catálogo** e apresenta os imóveis que casam com o perfil. Oferece
**agendar visita**. Função embutida (o "6º agente"): **confirma a visita no dia anterior e reagenda
se cair** (anti-no-show). Todo lead que entra vira automaticamente um registro na **Carteira de
Clientes** com o perfil de busca capturado.

### Agente 2 — Follow-up incansável (cron)
Faz a promessa "nenhum lead esfria" valer. Persegue lead que não respondeu e lead pós-visita que
sumiu, com **cadência multi-toque configurável**. Dedup + janela anti-spam obrigatórios.

### Agente 3 — Radar de oportunidades / lançamentos (cron)
Quando entra imóvel/lançamento novo no **Catálogo** (por qualquer origem), casa com o **perfil dos
clientes da Carteira** e dispara conversa proativa ("saiu algo que bate com o que você procura").
**Idempotente** — não reavisa o mesmo cliente do mesmo imóvel. **Fonte = só o Catálogo** (sem
scraping, sem Apify).

### Agente 4 — Reativador de carteira fria (cron)
Clientes antigos que visitaram/cogitaram e sumiram, ou investidores → reativação periódica com
**cadência longa**. Dedup obrigatório.

### Agente 5 — Pós-venda + Indicação/Avaliação (cron)
Quem fechou → acompanha, pede **indicação** (corretor vive disso) e **avaliação no Google**.
Idempotente.

## 5. Modelo de dados (Supabase — uma base por instalação)

| Tabela | Papel | Observações |
|--------|-------|-------------|
| `imoveis` | **Catálogo — fonte única** | Alimenta Agente 1 (match) e Agente 3 (radar). Origem plugável (§6). |
| `clientes` | **Carteira** | Criada automaticamente pelos leads do Agente 1 + import opcional. Guarda o **perfil de busca** (orçamento, tipo, região, finalidade) — consultado por radar e reativador. |
| `conversas` / `mensagens` | Histórico por contato | Estado do funil: `novo → qualificado → visita_agendada → visitou → negociacao → fechado/perdido`. |
| `visitas` | Agendamentos | Status pra anti-no-show e métricas. |
| `disparos` | Log de saída | Dedup / idempotência / anti-spam de todos os agentes cron. |

## 6. Origem do Catálogo (adapter plugável, em camadas)

1. **Cadastro manual no painel** — sempre disponível; funciona pra quem não tem sistema.
2. **Import CSV/planilha** — pra quem tem lista mas não tem sistema.
3. **Feed XML padrão (VRSync / Canal Pro)** — o corretor cola a URL do feed do CRM → pull periódico.
   Cobre Jetimob / Vista / Tecimob / Imobzi / Ville Imob com **um único adapter**. É legítimo (o
   feed é do próprio corretor), estável e amplamente suportado. **Caminho preferido do "puxar via API".**
4. **API custom** — gancho documentado pro caso raro de sistema próprio sem feed.

## 7. Painel (Cloudflare Pages — casca do `engine/`, telas do nicho)

- Catálogo de imóveis: CRUD + status do feed/import.
- Carteira de clientes: perfil de busca + estado no funil.
- Conversas: ver histórico, assumir manualmente.
- Visitas: agenda + marcar realizada / no-show.
- Botões de operação: marcar **fechado/perdido**, disparar radar manual.
- Configuração: WhatsApp adapter (Evolution default), origem do catálogo, cadências dos crons.

## 8. Pontos de operação manual (a masterclass DEVE ensinar)

Igual ao "marque os atendimentos no painel" da Clínica — o produto depende disso:
1. O corretor mantém o **Catálogo atualizado** (ou pluga o feed XML) — senão Agente 1 e radar ficam cegos.
2. O corretor marca **"fechado"/"perdido"** no painel — senão pós-venda e métricas não disparam.

## 9. Masterclass de venda (lado "como revender" do pacote)

- Como **precificar e vender** pro corretor (setup + mensalidade).
- Como **instalar**: clonar tag → configurar → seed → deploy → conectar WhatsApp (Evolution) → smoke.
- Como **operar**: os 2 pontos manuais do §8.
- **Pitch**: promessa-âncora "nenhum lead esfria" + radar como diferencial.

## 10. Validação (herdado da linha)

- Suíte de **testes automatizados** + **sandbox E2E** + **smoke na instalação**.
- **Sem corretor-piloto** (decisão da linha) — garantia é o teste automatizado.

## 11. Escopo do v1

**Entra:** os 5 agentes · Catálogo com 3 origens ativas (manual / CSV / feed XML; API custom como
gancho documentado) · Carteira automática · painel · masterclass · adapter **Evolution API**
(Z-API/Meta/uazapi como gancho) · radar em cima do Catálogo.

**Fora do v1 (YAGNI / camadas futuras):**
- **Modo imobiliária multi-corretor** (distribuição de leads, papéis/permissões).
- **Migração da Clínica Cheia** pro engine compartilhado.
- **Builder genérico `nucleo-nicho` (Fase 2)** completo — só semeamos a separação `engine/` vs `nicho/`.
- **Conector Apify** e qualquer **scraping próprio de portais**.
- Integração bidirecional de assinatura/contrato/CRM externo.

## 12. Riscos conhecidos

- **Catálogo desatualizado** cega Agente 1 e radar → mitigado por feed XML + ensino na masterclass.
- **Marcação de fechado/perdido manual** → mesma mitigação da Clínica (masterclass + lembrete no painel).
- **Evolution API pra revenda** — exige instância por corretor e cuidado anti-ban; adapter plugável
  deixa trocar pra Z-API/Meta/uazapi sem mexer no núcleo se algum corretor precisar escalar.
- **Extração do `engine/` a partir de 1 nicho** — risco de abstração prematura; mitigado por só
  semear a separação agora e adiar o builder formal pra quando houver 2 moldes.
