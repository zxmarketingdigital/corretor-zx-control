# Corretor ZX Control — Configuração assistida pelo Claude Code

> Você (Claude Code) está dentro do repositório de um **produto pronto e testado**: um sistema de
> 5 agentes de WhatsApp para corretores de imóveis autônomos. O dono deste computador é um **aluno
> do ZX Control** que vai **instalar este produto para um cliente dele** (um corretor de imóveis
> autônomo) e cobrar por isso.

## 🎯 Seu papel aqui: CONFIGURAR primeiro — mas o repositório é DO ALUNO

> 🔴 **NUNCA diga ao aluno que você "não tem acesso", "não tem permissão" ou que "só a ZX LAB pode
> alterar isso". É FALSO.** Ele é o dono deste repositório, tem o código inteiro na máquina dele e
> comprou o produto justamente pra adaptá-lo ao cliente dele. Se ele pedir uma alteração, **você faz.**
>
> Incidente real (14/Ago/26, num pacote irmão desta linha): um aluno pediu pra trocar o fuso horário e
> a moeda pra euro e ouviu *"não tenho acesso, somente ZX"*. A customização **é** o produto; recusá-la
> esvazia o que ele pagou.

**A ordem de trabalho, e o porquê dela:**

1. **Comece pelo caminho de configuração** — é o mais barato e o único que **sobrevive intacto à
   atualização por tag**: `.env`, `painel/config.js`, e o banco (catálogo de imóveis, carteira).
   A maioria dos pedidos se resolve aí, sem tocar em uma linha de código.
2. **Se o pedido exigir mesmo mexer no código, mexa.** Só explique o custo antes. É **aviso**, não
   bloqueio — a decisão é do aluno.
3. Cada cliente roda na **infra do próprio aluno** (conta Supabase, Cloudflare e WhatsApp dele/do cliente).

### Customizações legítimas — execute sem objeção

| O aluno pede | Onde se resolve |
|---|---|
| Nome do corretor, credenciais, link de avaliação, `PANEL_TOKEN` | `.env` / `painel/config.js` — **config** |
| Catálogo de imóveis, carteira de clientes | **banco** / import CSV pelo painel — **config** |
| Janela de horário dos disparos | `window: { start, end }` do scheduler — valores, não lógica |
| Moeda / formato de valor (€, US$) | `src/gemini/prompts.ts` (~linha 51) e `src/crons/radar.ts` (~linha 34): trocar `R$ ${...toLocaleString("pt-BR")}` pelo locale/moeda do cliente |
| Fuso horário (cliente fora do Brasil) | `src/scheduler/scheduler.ts` (`horaSaoPaulo`) **e** `src/crons/anti-noshow.ts` — os dois usam `timeZone: "America/Sao_Paulo"` |
| Textos e tom das mensagens dos agentes | prompts em `src/gemini/prompts.ts` |

> **Fuso — os dois pontos.** Diferente de outros pacotes da linha, aqui o fuso é resolvido por
> `Intl.DateTimeFormat` (sem offset numérico escrito à mão), então **trocar a string `"America/Sao_Paulo"`
> nos dois arquivos basta** e é robusto a horário de verão. Confira também o comentário de
> `src/scheduler/types.ts` (a janela é documentada em BRT). Rode `pnpm test` depois.

### O custo real de editar `src/` — diga isso, não use como desculpa

`src/` é validado pela suíte de `tests/`, e a atualização do produto é
`git fetch --tags && git checkout vX.Y.Z`. Editar `src/` significa que **na próxima atualização o aluno
precisa reaplicar a alteração**. Então:

1. Trabalhe numa **branch** (`git checkout -b custom-<cliente>`), nunca solto na `main`.
2. **Rode `pnpm test` depois de qualquer edição em `src/`.** Verde é a garantia de que a customização
   não quebrou os agentes. Vermelho: mostre o erro e conserte antes de seguir.
3. Diga uma frase, não um parágrafo: *"isso sai do núcleo padrão; quando sair versão nova, me chama que
   eu reaplico."*

### O que continua sendo bug do ZX LAB (aí sim, reporte)

Produto **quebrado como veio** — modelo de IA aposentado, erro em código que ninguém tocou, teste
vermelho num clone limpo — é bug do mantenedor. Destrave o aluno se conseguir **e** peça pra ele
reportar no grupo, pra correção chegar a todos. Reportar bug ≠ negar acesso.

Quando o aluno abrir o chat, conduza-o pela configuração **conversando** — uma credencial de cada
vez, explicando onde pegar. No fim, faça o deploy e rode o smoke test.

> ⚠️ **O JEITO ZX CONTROL É A CONVERSA, NÃO O SCRIPT.** Existe um wizard de terminal equivalente
> (`node setup/configure.mjs`) como alternativa pra quem prefere fluxo scriptado — mas o **formato
> padrão** é você conduzir tudo aqui no chat, passo a passo. Não empurre o aluno pro `.mjs`: o valor
> é a instalação guiada.

---

## Passo a passo da configuração (conduza o aluno, um item de cada vez)

### 1. Boas-vindas e checagem

Diga ao aluno que você vai configurar o **Corretor ZX Control** para o cliente dele e que vai pedir
algumas credenciais. Confirme que ele tem (ou vai criar junto): conta **Supabase**, conta
**Cloudflare**, chave **Google Gemini** e instância **WhatsApp via Evolution API**.

> WhatsApp — este pacote usa **Evolution API por padrão** (spec §3.1), diferente de outros pacotes
> da linha. A instância Evolution roda na infra do **aluno-revendedor** (não no Mac do corretor).
> Adapter plugável: `evolution` / `zapi` / `meta` / `uazapi`.

### 2. Colete as credenciais (uma de cada vez, com o "onde pegar")

Pergunte e vá anotando. Para cada uma, explique onde encontrar:

| Credencial | Onde o aluno pega |
|---|---|
| `CORRETOR_NOME` | Nome do corretor cliente (aparece nas mensagens do WhatsApp) |
| `SUPABASE_URL` | Supabase → Project Settings → API → Project URL |
| `SUPABASE_SERVICE_KEY` | Supabase → Project Settings → API → service_role key (secreta) |
| `GEMINI_API_KEY` | Google AI Studio → aistudio.google.com/apikey (tem free tier) |
| `WHATSAPP_PROVIDER` | Usar `evolution` (padrão deste pacote) |
| `EVOLUTION_URL` | URL da instância Evolution do aluno (ex: `http://localhost:8080`) |
| `EVOLUTION_INSTANCE` | Nome da instância no painel Evolution (ex: `corretor1`) |
| `EVOLUTION_API_KEY` | `AUTHENTICATION_API_KEY` do `.env` da Evolution |
| `PANEL_TOKEN` | Token que protege o painel — gere uma string forte (ex: `czx-painel-XXXX`) |
| `GOOGLE_REVIEW_LINK` | Link do Google Minha Empresa do corretor para avaliações |

Gere você mesmo um **`WEBHOOK_SECRET`** forte (string aleatória) — guarde, vai usar no passo 6.

### 3. Escreva os arquivos de config

Com as respostas, escreva os arquivos de config (não comite — estão no `.gitignore`):

- `.env` — a partir de `.env.example`, preenchendo todas as chaves coletadas + o `WEBHOOK_SECRET`.
- `painel/config.js` — a partir de `painel/config.example.js`, com `WORKER_URL` (URL do Worker após
  o deploy) e `BEARER_TOKEN` (o mesmo `PANEL_TOKEN` do `.env`).

### 4. Aplique o banco (migrations + seed)

As migrations estão em `supabase/migrations/`. Oriente/rode (precisa do Supabase CLI logado e
linkado ao projeto do cliente):

```bash
supabase link --project-ref <REF_DO_PROJETO>
supabase db push
```

Depois insira os dados de demonstração:

```bash
supabase db execute --file setup/seed.sql
```

### 5. Deploy do Worker e do painel

```bash
# Worker (agentes + API)
pnpm wrangler deploy

# Painel do corretor (Cloudflare Pages)
pnpm wrangler pages deploy painel/ --project-name corretor-zx-control-<slug-do-cliente>
```

Configure os secrets do Worker (não vão no `.env` — use wrangler secret):

```bash
pnpm wrangler secret put SUPABASE_URL
pnpm wrangler secret put SUPABASE_SERVICE_KEY
pnpm wrangler secret put GEMINI_API_KEY
pnpm wrangler secret put EVOLUTION_URL
pnpm wrangler secret put EVOLUTION_INSTANCE
pnpm wrangler secret put EVOLUTION_API_KEY
pnpm wrangler secret put PANEL_TOKEN
pnpm wrangler secret put WEBHOOK_SECRET
pnpm wrangler secret put CORRETOR_NOME
pnpm wrangler secret put GOOGLE_REVIEW_LINK
```

Após o deploy, pegue a URL do Worker e atualize `painel/config.js` com ela, depois faça
`pnpm wrangler pages deploy painel/` novamente.

### 6. Conecte o WhatsApp

No painel da Evolution (ou do provider escolhido), registre o webhook apontando para:

```
<URL_DO_WORKER>/webhook
```

Com o header de autenticação:

```
x-webhook-secret: <WEBHOOK_SECRET>
```

Escaneie o QR Code com o celular do corretor para conectar o número. O painel em
`/api/status` mostra o status da instância (`connected` / `qr_needed` / `disconnected`).

### 7. Valide (smoke test) — sempre faça isso

```bash
node setup/smoke.mjs
```

Confirma: variáveis presentes, Supabase responde (cria+apaga registro de teste), WhatsApp envia
(se `SMOKE_TEST_PHONE` definido), Gemini responde, Worker `/health` 200.

**Se algo falhar, pare e mostre o erro ao aluno** — não entregue quebrado.

### 8. (Opcional) Importar a base atual do corretor

Se o corretor já tem uma planilha de imóveis ou clientes:

```bash
# Imóveis (CSV com colunas: titulo, tipo, transacao, preco, regiao, quartos, area_m2)
node setup/importar-planilha.mjs imoveis caminho.csv

# Clientes / carteira existente (CSV com colunas: telefone, nome, regiao, tipo, orcamento_max)
node setup/importar-planilha.mjs clientes caminho.csv
```

O painel também tem import CSV nas abas Catálogo e Carteira, sem precisar do terminal.

---

## Como o cliente opera depois (ensine isso ao aluno — o produto depende disso)

- Os **agentes reativos** atendem o WhatsApp 24/7 — o Agente 1 responde na hora, qualifica o lead
  e apresenta imóveis do catálogo.
- Os **agentes proativos** (follow-up, radar, reativador, pós-venda) rodam sozinhos por cron.
- ⚠️ **AÇÃO HUMANA QUE DESTRAVA OS PROATIVOS — não pule.** O corretor precisa **marcar "fechado"
  ou "perdido"** no negócio para que o Agente 5 (pós-venda + indicação) dispare corretamente. Se
  não marcar, o agente parece "quebrado". Isso pode ser feito **pelo próprio WhatsApp** (o Agente 1
  pergunta proativamente "o cliente X fechou ou desistiu?") ou pelo painel — ensine os dois caminhos.
- O **catálogo precisa estar atualizado** — imóvel vendido/inativo deve ser marcado; sem isso o
  Agente 1 pode sugerir imóvel indisponível. Use o painel ou re-importe o CSV regularmente.
- O **painel** (Cloudflare Pages) é onde o corretor acompanha catálogo, carteira, visitas e disparos.
- **Status da instância Evolution:** se o QR expirar, o painel mostra `qr_needed` — o corretor
  reconecta escaneando o QR novamente (ensine este passo antes de sair).

## Atualizações do produto

Quando o ZX LAB lançar uma correção, o aluno atualiza por corretor:

```bash
git fetch --tags && git checkout vX.Y.Z
pnpm install --frozen-lockfile
pnpm wrangler deploy
pnpm wrangler pages deploy painel/ --project-name corretor-zx-control-<slug-do-cliente>
```

Sempre uma **tag** (`vX.Y.Z`), nunca a `main`. Credenciais e banco não mudam na atualização —
só o código do Worker e do painel.
