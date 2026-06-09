# Corretor ZX Control — Configuração assistida pelo Claude Code

> Você (Claude Code) está dentro do repositório de um **produto pronto e testado**: um sistema de
> 5 agentes de WhatsApp para corretores de imóveis autônomos. O dono deste computador é um **aluno
> do ZX Control** que vai **instalar este produto para um cliente dele** (um corretor de imóveis
> autônomo) e cobrar por isso.

## 🎯 Seu papel aqui: CONFIGURAR, nunca programar

**Regra de ouro — leia com atenção:**

- A **lógica dos agentes é congelada e validada** (suíte de testes verde em `tests/`). Você **NUNCA
  edita arquivos em `src/`**. Não "melhore", não "ajuste", não reescreva agente nenhum.
- Seu trabalho é **só configurar este produto para o cliente do aluno**: coletar as credenciais,
  escrever os arquivos de config, aplicar o banco, fazer o deploy e validar.
- Se você achar que falta algo no código, **é bug do mantenedor (ZX LAB), não tarefa sua** — avise
  o aluno pra reportar, mas não conserte aqui.
- Cada cliente roda na **infra do próprio aluno** (conta Supabase, Cloudflare e WhatsApp dele/do cliente).

Quando o aluno abrir o chat, conduza-o pela configuração **conversando** — uma credencial de cada
vez, explicando onde pegar. No fim, faça o deploy e rode o smoke test. É isso. Nada de código.

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
