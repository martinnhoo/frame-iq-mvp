# Deploy do Creative Intelligence pelo Lovable

O banco de produção do AdBrief (`mtrovtowcpttdqygtrwq`) está sob o Lovable
Cloud. Ele não aparece na sua conta pessoal do Supabase — nem pelo token, nem
pelo dashboard. Verificado: a Management API responde **403** para esse ref, e
o dashboard redireciona para a lista de organizações, onde só existe a
"Martinho" com 4 projetos, nenhum deles o de produção.

Por isso este passo é seu. Eu escrevo, você publica.

**Nada do teste real pode começar antes disto estar aplicado.**

---

## 1. O que precisa ser aplicado

### 7 migrations, nesta ordem

| # | Arquivo | O que cria |
|---|---|---|
| 1 | `20260806100000_ci_core.sql` | marcas, páginas, anúncios, mídias, import runs |
| 2 | `20260806100100_ci_assets_storage.sql` | assets com dedup, inventário, **bucket `ci-media`** |
| 3 | `20260806100200_ci_jobs.sql` | filas, `ci_claim_job`, `ci_reap_stale_jobs` |
| 4 | `20260806100300_ci_analysis.sql` | transcript, cenas, keyframes, OCR, rostos anônimos |
| 5 | `20260806100400_ci_taxonomy.sql` | termos, conceitos, variantes, learnings |
| 6 | `20260806100500_ci_results_and_scale_signal.sql` | auditoria de IA, métricas estimadas, Scale Signal |
| 7 | `20260806100600_ci_hardening.sql` | correções de segurança — **não pule esta** |

A ordem importa: a 100100 referencia tabelas da 100000, e assim por diante.
A 100600 fecha um furo em que qualquer usuário logado conseguia sobrescrever
o Scale Signal da marca de outra pessoa.

Todas são idempotentes — reaplicar não quebra. Testado rodando a sequência
três vezes seguidas contra um Postgres real.

### 2 edge functions

| Função | Para quê |
|---|---|
| `ci-brand-search` | busca a página oficial da marca · 5 créditos por chamada |
| `ci-import-run` | importa os anúncios · 1 crédito por anúncio retornado |

Elas dependem de `supabase/functions/_shared/`:
`ci-guard.ts` e a pasta `spreshapp/` inteira (`client.ts`, `types.ts`,
`normalize.ts`).

### 1 secret novo

| Secret | Valor | Onde pegar |
|---|---|---|
| `SPRESHAPP_API_KEY` | começa com `sk_sprs_` | https://spreshapp.com/app/api-access |

Opcionais, com padrão seguro se ausentes:

```
SPRESHAPP_MAX_ADS_PER_RUN=20      # padrão 20
SPRESHAPP_MAX_CREDITS_PER_RUN=50  # padrão 50
CI_ALLOWED_EMAILS=martinhovff@gmail.com
```

`SUPABASE_SERVICE_ROLE_KEY` já existe (consta no `SECRETS_SETUP.md`).

---

## 2. O prompt para colar no Lovable

Copie daqui para baixo, inteiro:

---

> Preciso aplicar um módulo novo no Supabase deste projeto. O código já está na
> branch `feature/creative-intelligence` do repositório `martinnhoo/frame-iq-mvp`.
>
> **1. Aplique estas 7 migrations, nesta ordem exata:**
>
> ```
> supabase/migrations/20260806100000_ci_core.sql
> supabase/migrations/20260806100100_ci_assets_storage.sql
> supabase/migrations/20260806100200_ci_jobs.sql
> supabase/migrations/20260806100300_ci_analysis.sql
> supabase/migrations/20260806100400_ci_taxonomy.sql
> supabase/migrations/20260806100500_ci_results_and_scale_signal.sql
> supabase/migrations/20260806100600_ci_hardening.sql
> ```
>
> Elas criam 32 tabelas com prefixo `ci_`, 10 views, 6 funções e um bucket
> privado chamado `ci-media`. Nenhuma tabela existente é alterada ou removida —
> em particular, `public.ads` NÃO é tocada. São todas idempotentes.
>
> **2. Publique estas 2 edge functions:**
>
> ```
> supabase/functions/ci-brand-search
> supabase/functions/ci-import-run
> ```
>
> Elas importam de `supabase/functions/_shared/ci-guard.ts` e de
> `supabase/functions/_shared/spreshapp/`, então esses arquivos precisam ir junto.
>
> **3. Adicione este secret:**
>
> ```
> SPRESHAPP_API_KEY = <cole a chave que começa com sk_sprs_>
> ```
>
> **4. Não altere nada mais.** Não mexa em migrations antigas, não mude o schema
> de tabelas existentes, não altere outras edge functions.

---

## 3. Como validar que foi aplicado

Rode no **SQL Editor do Supabase** (pela interface do Lovable, se ela expuser,
ou pelo dashboard do projeto de produção).

### 3.1 As tabelas existem

```sql
select count(*) as tabelas_ci
from pg_tables
where schemaname = 'public' and tablename like 'ci\_%';
```

**Esperado: 32.** Menos que isso significa migration faltando.

### 3.2 Todas as migrations passaram

```sql
select
  (select count(*) from pg_tables  where schemaname='public' and tablename like 'ci\_%')  as tabelas,
  (select count(*) from pg_views   where schemaname='public' and viewname  like 'ci\_%')  as views,
  (select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace
     where n.nspname='public' and p.proname like 'ci\_%')                                  as funcoes,
  (select count(*) from pg_policies where schemaname='public' and tablename like 'ci\_%') as policies,
  (select count(*) from pg_indexes  where schemaname='public' and tablename like 'ci\_%')  as indices;
```

**Esperado, no mínimo:** 32 tabelas · 10 views · 6 funções · 33 policies · 117 índices.

### 3.3 A migration de segurança (100600) entrou

Esta é a mais fácil de esquecer e a mais importante:

```sql
select proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public'
   and proname in ('ci_owns_brand', 'ci_refresh_taxonomy_stats');
```

**Esperado: as duas linhas.** Se vier vazio, a 100600 não foi aplicada e o furo
de segurança continua aberto.

E confirme que o usuário não consegue forjar o Scale Signal:

```sql
select column_name, privilege_type
from information_schema.column_privileges
where table_name = 'ci_concepts' and grantee = 'authenticated'
  and privilege_type = 'UPDATE'
order by column_name;
```

**Esperado:** exatamente `name`, `description`, `hypothesis`, `review_status`,
`merged_into_id`, `reviewed_at` — e **nada** de `scale_band` ou `scale_signal`.

### 3.4 O bucket existe e é privado

```sql
select id, public, file_size_limit from storage.buckets where id = 'ci-media';
```

**Esperado:** uma linha, `public = false`, `file_size_limit = 524288000`.

Se vier `public = true`, pare: os vídeos ficariam acessíveis por URL
adivinhável.

### 3.5 As edge functions responderam

Com você logado no app, no console do navegador em adbrief.pro:

```js
const { data, error } = await supabase.functions.invoke('ci-brand-search', {
  body: { query: 'Shapermint' }
});
console.log(error ?? data);
```

**Esperado:** um objeto com `brand`, `pages` (15 itens) e
`likely_official_page_id: "606426623024865"`.

**Custa 5 créditos da SpreshApp.** Se você não quiser gastar agora, pule — eu
faço essa chamada durante o teste real.

Se der `{"error":"not_configured"}`, o secret `SPRESHAPP_API_KEY` não chegou.
Se der `{"error":"not_found"}` com 404, seu e-mail não está em
`CI_ALLOWED_EMAILS` — ou remova a variável, ou inclua o seu e-mail.

---

## 4. O que me mandar de volta

Cole aqui o resultado da consulta **3.2** e da **3.3**. Com esses dois números
eu sei se posso começar o teste real, e não começo antes.

---

## 5. O que NÃO fazer

- Não aplicar no projeto **Memoria** (`dcvgrilfovddkdgfplqy`) — não tem relação
  com o AdBrief.
- Não aplicar no **FrameIQ** (`pibkslzvwcnnarlcllmx`) — está pausado e não é
  para onde o app aponta.
- Não editar as migrations antes de aplicar. Se alguma falhar, me mande o erro
  exato em vez de ajustar — o ajuste precisa entrar como migration nova, senão
  o repositório e o banco divergem.

---

## 6. Depois disto

O worker ainda precisa dos secrets dele, mas isso é no Fly, não no Lovable:

```bash
fly secrets set -a adbrief-ci-worker \
  SUPABASE_URL="https://mtrovtowcpttdqygtrwq.supabase.co" \
  SUPABASE_SERVICE_ROLE_KEY="<a service role do projeto de produção>" \
  GEMINI_API_KEY="<a chave do Gemini>"
```

A `SUPABASE_SERVICE_ROLE_KEY` do projeto de produção você pega no Lovable
(ou no dashboard do projeto, em Project Settings → API Keys). Ela ignora RLS —
só o worker pode tê-la, nunca o frontend.
