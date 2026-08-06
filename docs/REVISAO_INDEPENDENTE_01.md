# Revisão independente 01 — `feature/creative-intelligence`

Revisão adversarial dos 3 commits da branch (`e21f9f45`, `44901414`, `65818f54`).
Postura: assumir que há bugs e procurá-los. Nada foi corrigido; só encontrado e documentado.

- Data: 2026-08-06
- Escopo: 6 migrations `ci_*`, `ci_schema_test.py`, cliente SpreshApp (4 arquivos), `.env.example`
- Método: execução real das duas suítes + **harnesses independentes** escritos para esta revisão
  (`/tmp/rev/repro.ts`, `/tmp/rev/repro2b.ts`, `/tmp/rev/sqlprobe.py`, `/tmp/rev/sql2.py`)

**Resumo:** 4 bugs de gravidade alta, 6 de média, 6 de baixa. As duas suítes passam (55 asserções),
mas **uma delas é tautológica e mascara exatamente o bug de maior impacto**.

---

## 1. Comandos executados e saída real

### 1.1 Suíte do schema (a entregue)

```
$ python3 supabase/tests/ci_schema_test.py
OK     20260806100000_ci_core.sql
... (6 arquivos)
RERUN OK — migrations idempotentes

PASS  uma única página oficial por marca
PASS  import idempotente (brand_id, ad_archive_id)
PASS  deduplicação por SHA-256
PASS  view de dedup conta duplicata evitada  [assets=1 links=2 evitadas=1 8000000B vs 16000000B ingênuo]
PASS  claim pega o job da fila
PASS  segundo claim não repega job em execução
PASS  reaper devolve job órfão à fila com backoff  [('retrying', 'lease_expired', True)]
PASS  conceito magro fica insufficient_evidence, não 'low'  [8.10 → insufficient_evidence]
PASS  RLS esconde os dados de outro usuário  [estranho vê 0, dono vê 3]

TODOS OS TESTES PASSARAM
EXIT=0
```

### 1.2 Suíte do cliente (a entregue)

```
$ npx --yes tsx supabase/functions/_shared/spreshapp/spreshapp.node-smoke.ts
PASS  epoch em milissegundos não vira ano 56000
... (40 testes)
PASS  cursor de parada é devolvido para retomar sem repagar   <-- ver BUG-02: não afirma nada
PASS  estimativa é conservadora e explicada

TODOS OS 40 TESTES PASSARAM
EXIT=0
```

### 1.3 Typecheck

`tsconfig.app.json` tem `"include": ["src"]` — **`supabase/functions/` não é typechecado por
nenhuma configuração do repo.** Rodei explicitamente:

```
$ npx -p typescript@5.6.3 tsc --noEmit --skipLibCheck --strict --target ES2022 \
    --module esnext --moduleResolution bundler --allowImportingTsExtensions --lib ES2022,DOM \
    supabase/functions/_shared/spreshapp/{types,client,normalize}.ts
EXIT=0          # os 3 arquivos de produção passam em --strict, limpos
```

Incluindo o arquivo de teste:

```
spreshapp.node-smoke.ts(188,28): error TS2339: Property 'page_id' does not exist on type ...
spreshapp.node-smoke.ts(391,32): error TS2871: This expression is always nullish.   <-- BUG-02
spreshapp.node-smoke.ts(16..19): error TS2307: Cannot find module 'node:assert/strict' ...  (falta @types/node no meu invoke, não é bug)
```

Nenhum erro **pré-existente** foi tocado: os arquivos são todos novos, `main` não tem
`supabase/functions/_shared/spreshapp/`.

### 1.4 Segredos

```
$ git grep -lE "sk_sprs_[A-Za-z0-9]{8}|github_pat_|FlyV1|SUPABASE_SERVICE_ROLE_KEY *= *[A-Za-z0-9]" $(git rev-list --all)
(saída vazia — 0 matches em 3918 commits)
```

**Limpo.** Verificações adicionais:

- `.env` foi removido do versionamento (`44901414`) e `.gitignore:16-21` cobre `.env*`.
- O `.env` que existia no histórico continha só `SUPABASE_PUBLISHABLE_KEY` / `VITE_*` (anon key
  JWT, pública por design) e URLs. **Nenhum service-role key, nenhuma chave SpreshApp.**
- `.env.example` tem todos os valores em branco (`SPRESHAPP_API_KEY=`, `SUPABASE_SERVICE_ROLE_KEY=`).

Ressalva (baixa): o anon JWT continua recuperável em `git show 44901414^:.env`. É chave pública,
mas expõe o project ref `mtrovtowcpttdqygtrwq`. `git rm --cached` não limpa histórico.

---

## 2. BUGS

### BUG-01 — `collectBrandAds` perde/erra o cursor de retomada quando para por `max_ads` — **ALTA**

**Arquivo:** `supabase/functions/_shared/spreshapp/client.ts`, linhas **444, 461, 468, 477**

`cursor` só é atualizado no fim do laço (linha 468). Quando o break acontece em `max_ads`
(linha 461) — que é o caminho **padrão**, já que `ci_import_runs.max_ads` nasce `20` —, `cursor`
ainda contém o cursor que *produziu* a página atual, não o cursor da próxima. Na primeira página
ele é `undefined`, e o retorno vira `null` (linha 477).

**Reprodução** (`/tmp/rev/repro.ts`, saída real):

```
A) stopReason=max_ads  nextCursor=null  ads=20  creditos=20
   API disse next_cursor='CURSOR_PAGE_2'. Cliente devolveu: null
A2) stopReason=max_ads nextCursor='C1' (API na pag.2 disse 'C2')
```

**Consequência:** `ci_import_runs.next_cursor` recebe `null` (caso A) ou um cursor atrasado em uma
página (caso A2). Retomar a importação recomeça do zero ou repete a última página — **repagando
1 crédito por anúncio já pago**. Isso contradiz frontalmente o docblock da própria função
("Devolve também o cursor onde parou, para retomar depois sem repagar o que já veio") e a razão
de existir da coluna `next_cursor` na migration.

---

### BUG-02 — O teste que deveria pegar o BUG-01 é uma tautologia — **ALTA**

**Arquivo:** `supabase/functions/_shared/spreshapp/spreshapp.node-smoke.ts`, linha **391**

```ts
await test("cursor de parada é devolvido para retomar sem repagar", async () => {
  ...
  assert.equal(r.stopReason, "max_ads");
  assert.equal(r.nextCursor, undefined ?? r.nextCursor);   // <-- compara x com x
});
```

`undefined ?? r.nextCursor` avalia para `r.nextCursor`. A asserção é `assert.equal(x, x)`.

**Reprodução:**

```
E) 'assert.equal(r.nextCursor, undefined ?? r.nextCursor)' com nextCursor=null:
   PASSOU (tautologia: compara x com x)
   PASSOU tambem com 'qualquer_lixo' -> o teste nao afirma nada
```

`tsc --strict` já sinaliza isso (`TS2871: This expression is always nullish`), mas o repo não
typecheca `supabase/functions/`. **Gravidade alta não pelo teste em si, mas porque "TODOS OS 40
TESTES PASSARAM" é a evidência com que esta entrega se apresenta — e um desses 40 é vazio.**

---

### BUG-03 — O teto de créditos é furável: reserva assume 50 anúncios/página — **ALTA**

**Arquivo:** `client.ts`, linhas **155** (`ASSUMED_PAGE_SIZE = 50`), **353**, **375**, **392-393**, **450**

A reserva de pior caso é `max(maxAdsPerPageObserved, 50) × 1`. Se a API devolver uma página maior,
`settle(worstCase, actual)` (linha 393) soma o custo **real** ao `spent`, sem qualquer teto. O
próprio docblock admite que a API não documenta page size e que o tamanho "é decidido pelo
servidor" — mas a linha 11-14 do mesmo arquivo promete "Nunca gasta mais crédito do que o
orçamento permite".

**Reprodução** (teto 50, servidor devolve 300 anúncios numa página):

```
B) teto=50  gasto REAL=300  budget.used=300  ads devolvidos=20
   -> estourou o teto em 250 creditos
```

**Consequência:** 250 créditos a mais do que o usuário autorizou, numa cota gratuita de 100/mês.
O teste "paginação para quando o orçamento não cobre a próxima página" (smoke:396-405) usa página
de 40 anúncios com teto 50 — 40 ≤ 50, então nunca exercita o estouro.

---

### BUG-04 — `ci_compute_scale_signal` é SECURITY DEFINER, concedida a `authenticated` e não checa o dono do brand — **ALTA**

**Arquivo:** `supabase/migrations/20260806100500_ci_results_and_scale_signal.sql`, linhas **251-256** e **382-383**

```sql
create or replace function public.ci_compute_scale_signal(p_brand_id uuid)
  ... security definer ...
grant execute on function public.ci_compute_scale_signal(uuid) to service_role, authenticated;
```

Nenhuma verificação `where user_id = auth.uid()` em nenhum ponto. Qualquer sessão `authenticated`
que conheça (ou adivinhe) um `brand_id` alheio escreve na base do outro tenant. É a mesma classe
fechada em `20260804090000_fechar_buracos_de_credito.sql` §2 ("RPCs de crédito executáveis por
qualquer um"), e aqui foi reaberta — a diferença é que `ci_claim_job` e `ci_reap_stale_jobs`
fizeram o REVOKE certo, esta não.

**Reprodução** (usuário A chama a função com o `brand_id` de B):

```
== 4. EXECUTE nas funcoes ci_* ==
   ('ci_claim_job',            True, 'postgres=X/postgres | service_role=X/postgres')
   ('ci_reap_stale_jobs',      True, 'postgres=X/postgres | service_role=X/postgres')
   ('ci_compute_scale_signal', True, 'postgres=X/postgres | service_role=X/postgres | authenticated=X/postgres')

== 5. ci_compute_scale_signal como AUTHENTICATED sobre a marca de OUTRO usuario ==
   RETORNOU: 3 conceitos processados da marca do usuario B  <-- IDOR
   linhas escritas em ci_concept_scale_components (dono=B): (3, '7e6ea8b5-...')
   config criada para a marca de B: 1
   scale_band gravado em ci_concepts de B: [('medium',)]
```

Escreve em 3 tabelas alheias (`ci_concepts`, `ci_concept_scale_components`, e **cria**
`ci_scale_signal_config`) e vaza a contagem de conceitos do outro tenant pelo valor de retorno.
Não decide custo em créditos, mas decide o número que o produto exibe.

**Nota:** `anon` está corretamente bloqueado (`permission denied for function`). O buraco é só
para `authenticated`.

---

### BUG-05 — Anúncios pagos são descartados em silêncio pelo `slice()` — **MÉDIA**

**Arquivo:** `client.ts`, linhas **471-479**

```ts
// Cortar o excedente é só apresentação — os créditos já foram cobrados por
// tudo que a API devolveu. Guardamos todos, mas reportamos o corte.
return { ads: collected.slice(0, params.maxAds), ... };
```

O comentário afirma duas coisas falsas: não guarda todos (`collected` é local e some), e não
reporta o corte (nenhuma chave do retorno diz quantos foram descartados).

**Reprodução:**

```
C) pagos=50  devolvidos=20  PERDIDOS=30 (nenhum campo reporta o corte)
   chaves do retorno: ads,pagesFetched,creditsSpent,nextCursor,stopReason
```

30 créditos gastos em anúncios que nunca chegam ao banco. Combinado com o BUG-01, eles também não
são recuperáveis pela retomada.

---

### BUG-06 — `release()` duplo libera a reserva de outra chamada em voo — **MÉDIA**

**Arquivo:** `client.ts`, linhas **386-389** (`settleAdsPage`) e **365-367** (`getBrandAdsPage`)

Quando a resposta é 200 sem o array `ads`, `settleAdsPage` chama `this.budget.release(worstCase)`
e lança; o `catch` de `getBrandAdsPage` chama `release(worstCase)` **de novo**. Como `release` é
`reserved = max(0, reserved - worstCase)`, com uma única chamada em voo o efeito é nulo — mas o
`CreditBudget` é compartilhado por import run, e a segunda liberação come a reserva de outra
chamada concorrente.

**Reprodução** (reserva paralela de 900 num teto de 1000):

```
D) antes: available=100 (reserva paralela de 900 em voo)
   erro: invalid_response
D) depois: available=150  <- reserva alheia foi liberada? SIM (BUG)
```

Mesmo padrão existe no caminho de sucesso: se o `logger` injetado lançar depois do `settle`
(linha 401), o `catch` da linha 366 libera uma reserva que já foi liquidada.

**Sobre a pergunta do escopo — "existe caminho onde `reserve` acontece e nem `settle` nem
`release` são chamados?" Não achei.** Os 4 métodos de endpoint fazem `reserve` **antes** do
`try` (então um `budget_exceeded` não deixa reserva pendurada) e têm `release` no `catch`. O
problema é o oposto: liberação a mais, não a menos.

---

### BUG-07 — Divisão por zero em `ci_compute_scale_signal` com config gravável pelo usuário — **MÉDIA**

**Arquivo:** `20260806100500_ci_results_and_scale_signal.sql`, linhas **320-325**

```sql
1 - (extract(epoch from (now() - c.last_seen_at)) / 86400.0
     - cfg.recency_window_days) / cfg.recency_window_days
```

Todos os outros divisores usam `nullif(cfg.sat_*, 0)` (linhas 307-313). Este não. E
`ci_scale_signal_config` tem policy `FOR ALL to authenticated` (linhas 214-217) sem nenhum CHECK
constraint na coluna, então o próprio usuário pode zerá-la pela UI.

**Reprodução:**

```
== 6. divisao por zero: recency_window_days = 0 ==
   ERRO: division by zero
   CONTEXT: PL/pgSQL function ci_compute_scale_signal(uuid) line 65 at assignment
```

A função aborta inteira — nenhum conceito da marca recebe sinal.

**Resposta direta à pergunta do escopo:** `nrc` **não** fica negativo (o `greatest(0, ...)` da
linha 322 protege) e **não** há overflow. O problema é só a divisão por zero.

---

### BUG-08 — `ci_scale_cfg_owner` não valida a posse do `brand_id` — **MÉDIA**

**Arquivo:** `20260806100500_ci_results_and_scale_signal.sql`, linhas **214-217**

`with check (user_id = auth.uid())` valida a coluna `user_id`, mas não que o `brand_id` pertença
a quem escreve.

**Reprodução:**

```
== 9. squat de config: usuario A insere config para a marca de B ==
   INSERIU config para brand_id de B com user_id de A  <-- WITH CHECK nao valida brand ownership
```

Combinado com `unique (brand_id, version)`, o atacante pode ocupar a versão `v1` da marca da
vítima com pesos arbitrários. Toda a linha de `ci_concept_scale_components` gerada depois sai com
pesos do atacante. É a mesma lacuna que a migration 20260804090000 corrigiu em
`user_preferences` — lá o WITH CHECK foi adicionado; aqui ele existe mas cobre a coluna errada.

---

### BUG-09 — `collectMedia` cobre um único formato de anúncio, sem fixture real que o valide — **MÉDIA**

**Arquivo:** `supabase/functions/_shared/spreshapp/normalize.ts`, linhas **342-368**

Só são lidos `ad.video_url`, `ad.image_url` e `ad.cards[]`. **A documentação oficial
(https://spreshapp.com/docs/api) nunca mostra `cards`, `is_active`, `ad_ended_on`, `page_id`,
`title`, `caption`, `link_description`, `cta_type`, `countries`, `languages` nem
`publisher_platform`.** O exemplo de resposta documentado tem exatamente 8 campos
(`ad_archive_id, page_name, body_text, display_format, ad_started_on, cta, landing_page,
video_url|image_url`). Todo o resto de `types.ts` e `normalize.ts` é inferência não validada — e
**a única fixture entregue é de `page-search`**, o endpoint que *não* passa pelo normalizador.

**Reprodução** com formatos plausíveis da Ad Library:

```
I) collectMedia com formatos alternativos:
   videos[] (formato comum da Ad Library): media=0 media_type=video
   snapshot.cards aninhado:                media=0 media_type=unknown
   images[]:                               media=0 media_type=image
   cards[] (formato assumido pelo cliente):media=1 media_type=image
   normalizeAds -> aceitos=4 recusados=0  (anuncio SEM midia nao e recusado nem sinalizado)
```

**Consequência:** se o formato real divergir, o anúncio é gravado em `ci_ads` com
`media_type='video'` e **zero linhas em `ci_ad_media_sources`** — nenhum download job nasce, o
crédito já foi pago, e nada em `NormalizeBatchResult.rejected` sinaliza a perda. É perda
silenciosa de mídia, que é justamente o que o arquivo diz combater ("Nunca descartados em
silêncio", linha 417).

---

### BUG-10 — `ci_concepts_review` permite mover o conceito para a marca de outro e forjar o sinal — **MÉDIA**

**Arquivo:** `20260806100400_ci_taxonomy.sql`, linhas **322-325**

`for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid())` —
policy protege a linha, não as colunas. O comentário diz que a revisão é "confirmar, renomear,
merge/split", mas a policy libera **todas** as colunas.

**Reprodução:**

```
== authenticated pode mover conceito para a marca de outro? ==
   linhas atualizadas: 1 -> conceito de A agora aponta para a marca de B, com scale_band forjado
   estado: [(True, 'very_high')]
```

Mesmo diagnóstico da migration 20260804090000 §1 ("`for all using(...)` protege a LINHA, não as
COLUNAS"). Vale igual para `ci_person_clusters_review` (`20260806100300:303-305`). Não decide
custo, mas decide o número exibido e polui a marca alheia.

---

### BUG-11 — `nullif(sat, 0)` transforma saturação zerada em nota máxima — **BAIXA**

**Arquivo:** `20260806100500`, linhas **307-313**

`least(x / nullif(0,0), 1)` → `least(NULL, 1)`. Em Postgres `least` **ignora NULL** e devolve `1`.
Saturação negativa não é barrada por nada (sem CHECK constraint na config).

```
== 7. saturacao = 0 ==
   sat=120 -> signal=53.83 longevity_norm=0.75
   sat=0   -> signal=58.83 longevity_norm=1   (esperado erro ou 0, veio 1.0 = maximo)

== 8. saturacao negativa ==
   sat=-10 -> (Decimal('-141.17'), 'low', '-9.0', '-180.00')
```

Um sinal de **-141.17** cabe em `numeric(6,2)` e é gravado sem reclamação. Não há overflow (os
pesos são `numeric(4,3)`, teto 9.999 × 9 componentes × 100 = 8999.1 < 9999.99), mas a ausência de
CHECKs deixa a fórmula produzir números fora de 0..100 que a UI vai exibir.

---

### BUG-12 — `toIso`: ramo string sem sanidade de ano e dependente de fuso — **BAIXA**

**Arquivo:** `normalize.ts`, linhas **301-302**

O ramo numérico (289-299) rejeita ano < 2015 ou > 2100. O ramo string não rejeita nada.

```
F) toIso('1969-07-20') -> 1969-07-20T00:00:00.000Z  <- aceito
   runningDays a partir de 1969: 20837
   toIso('0001-01-01') -> 0001-01-01T00:00:00.000Z
G) toIso('Aug 6, 2026') -> 2026-08-06T03:00:00.000Z  <- deslocado pelo TZ do runtime
```

`running_days = 20837` é exatamente o "lixo silencioso" que o docblock de `toIso` diz evitar. O
segundo caso significa que a mesma resposta da API produz `started_on` diferente conforme o fuso
onde a edge function roda.

**Sobre o resto de `toIso` e `runningDays`: não achei bug.** O corte em `1e11` está correto para
qualquer data real (epoch-s > 1e11 = ano 5138+; epoch-ms < 1e11 = antes de 1973, já rejeitado
pelo piso de 2015). `runningDays` não tem off-by-one: contagem inclusiva (mesmo dia = 1,
01/08→02/08 = 2, ativo desde 01/08 com hoje 06/08 = 6), `null` sem início, `null` para inativo
sem fim, `null` se `end < start`. O único detalhe discutível é que 23:00→01:00 do dia seguinte
conta 1 e não 2 — é coerente com "dias corridos", não é bug.

---

### BUG-13 — `ci_claim_job` re-reivindica job que já estourou as tentativas — **BAIXA**

**Arquivo:** `20260806100200_ci_jobs.sql`, linhas **410-417** (download) e **431-438** (analysis)

O `where` filtra só `status in ('queued','retrying')` e `next_retry_at`. Não há guarda contra
`attempts >= max_attempts`.

```
== 12. ci_claim_job repega job com attempts >= max_attempts? ==
   job com attempts=99 / max=5 foi reclamado? SIM <-- sem guarda
```

Hoje só o reaper transiciona para `failed`, então na prática não acontece — mas basta o worker
marcar `retrying` sem checar `attempts` para o job entrar em laço infinito de retentativas pagas.

---

### BUG-14 — `arr()` com objeto produz `"[object Object]"` — **BAIXA**

**Arquivo:** `normalize.ts`, linhas **267-274**. `normalizeAd({countries: {a:1}})` →
`countries: ["[object Object]"]`, gravado em `ci_ads.countries text[]`.

---

### BUG-15 — Referência quebrada e fixture única — **BAIXA**

- `client.ts:7` aponta para `docs/CREATIVE_INTELLIGENCE_AUDIT.md §2.4`. **A pasta `docs/` não
  existe neste repositório** (o documento está no outro projeto). `git log --all --
  docs/CREATIVE_INTELLIGENCE_AUDIT.md` não retorna nada.
- Uma única fixture (`brand_page-search__shapermint.json`), do endpoint que não passa pelo
  normalizador. Ver BUG-09.

---

### BUG-16 — Strings `sk_sprs_*` no smoke test disparam scanners — **BAIXA**

`spreshapp.node-smoke.ts` contém `"sk_sprs_TEST0000..."` e `"sk_sprs_outraChaveSecreta"`. São
fixtures, não chaves reais, mas casam com o padrão `sk_sprs_[A-Za-z0-9]{8}` de qualquer scanner
(GitHub secret scanning, gitleaks). Vão gerar alerta.

---

## 3. O que VERIFIQUEI funcionando

Confirmado por harness independente, não por confiar na suíte entregue.

| Item | Como verifiquei | Resultado |
|---|---|---|
| **Idempotência das migrations** | Apliquei as 6 migrations **3 vezes seguidas** num Postgres limpo (a suíte entregue só faz 2) | `IDEMPOTENCIA: 3 aplicacoes completas OK` |
| **FKs adiadas** | `pg_constraint` | `ci_ads_concept_id_fkey → ci_concepts`, `ci_ad_media_sources_asset_id_fkey → ci_assets`, `ci_speakers_person_cluster_fkey → ci_person_clusters` — as 3 criadas, todas `ON DELETE SET NULL` |
| **RLS habilitada** | `pg_class.relrowsecurity` | 31 tabelas `ci_*`, **0 sem RLS** |
| **Buraco de crédito (a classe da 20260804090000)** | INSERT/UPDATE como `authenticated` em `ci_import_runs` (que tem `max_ads`/`max_credits`/`credits_spent`) | `INSERT: bloqueado (RLS)`, `UPDATE: 0 linhas`. **Fechado.** Só 4 policies não-SELECT existem: `ci_brands` (FOR ALL), `ci_concepts` e `ci_person_clusters` (UPDATE), `ci_scale_signal_config` (FOR ALL). Nenhuma toca tabela de crédito. |
| **`anon`** | SELECT/INSERT/RPC | `SELECT ci_ads → 0 linhas`; `INSERT ci_brands → RLS violation`; `ci_compute_scale_signal → permission denied`; `ci_claim_job → permission denied` |
| **REVOKE de `ci_claim_job` / `ci_reap_stale_jobs`** | `pg_proc.proacl` | `postgres=X \| service_role=X` — PUBLIC/anon/authenticated removidos corretamente. **Não dá para chamar como `authenticated`.** |
| **`uq_ci_brand_pages_one_selected`** | 2 páginas `is_selected=true` na mesma marca | bloqueado; 2 não-selecionadas convivem. Faz o que promete. |
| **`uq_ci_concept_one_baseline`** | 2 membros `is_baseline=true` no mesmo conceito | bloqueado. Faz o que promete. |
| **Colisão de nomes em `public`** | 33 objetos `ci_*` novos × todos os `create table/view` das 34 migrations pré-existentes | **interseção vazia**. Nenhum objeto pré-existente começa com `ci_`. `public.ads` intacta (`ci_ads` é outra tabela). |
| **Bucket** | `storage.buckets` | `('ci-media', public=False, 524288000)` — privado, e o `on conflict do update` força `public=false` a cada reaplicação. |
| **Cliente × doc oficial** | `web_fetch` de https://spreshapp.com/docs/api | Paths, verbos, parâmetros e **custos batem 100%**: `POST /v1/ad-search` (corpo JSON, todos os 9 campos), `GET /v1/brand/page-search?q=` (5 créditos), `GET /v1/brand/:page_id` (`sort`/`display_format`/`country`/`cursor`), `GET /v1/ad-details/:id` (1 quando retorna, 0 quando não). Prefixo de chave `sk_sprs_` confirmado — o regex do `redact()` é adequado. 429 duplo (rate-limit vs `credits_exhausted`/`reset_at`) e 503 retentável também batem. |
| **`redact()`** | Revisão dos 4 caminhos pedidos | **Não achei buraco.** Mensagem de erro: `toError` redige o corpo antes de virar `detail` (280). `detail`: idem. Log: o logger só recebe `method/path/status/durationMs/attempt/requestId/creditsCharged/errorCode/message`, e `message` vem de string literal ou de `redact()` (258). URL: a chave vai em header `Authorization`, nunca em query, e o `path` logado é o template. Com o prefixo `sk_sprs_` confirmado na doc, os dois regexes cobrem o caso. |
| **Laço infinito em `collectBrandAds`** | Repro com cursor repetido | `seenCursors` funciona; **não achei caminho de laço infinito.** |
| **Typecheck dos 3 arquivos de produção** | `tsc --strict` | `EXIT=0`, limpo |
| **Segredos** | `git grep` nos 3918 commits | 0 matches |

---

## 4. O que NÃO consegui verificar, e por quê

1. **Chamada real à API SpreshApp.** Não há chave (`.env.example` vazio, e não devo usar uma).
   Toda a validação do cliente é contra `fetch` stubado. **O formato real das respostas de
   `/v1/brand/:page_id`, `/v1/ad-search` e `/v1/ad-details/:id` continua não verificado** — ver
   BUG-09. Esse é o maior ponto cego desta revisão.
2. **Deploy real no Supabase.** Testei em Postgres **16.2** local (pgserver). O Supabase roda
   PG15. `alter view ... set (security_invoker = on)` (usado em 10 views) exige **PG15+** — ok,
   mas não confirmado contra a instância de destino.
3. **`ci_reap_stale_jobs` em concorrência real.** Só testei o caminho feliz. `power(2, attempts)`
   estoura (`value out of range: overflow`) a partir de ~`attempts=1024`; inalcançável com
   `max_attempts=5`, então não conto como bug.
4. **Comportamento com service_role real.** No harness o `service_role` é `BYPASSRLS`, como no
   Supabase, mas não testei o PostgREST no meio.
5. **`ci_refresh_taxonomy_stats()`** é citada em `20260806100400:42` como quem recalcula os
   agregados — **a função não existe em nenhuma migration**. Os campos `ad_count`,
   `asset_count`, `concept_count` de `ci_taxonomy_terms` (e todos os agregados de `ci_concepts`,
   que alimentam o scale signal) ficam em `0` até alguém escrevê-los.

---

## 5. Contra a especificação — §8 do `CREATIVE_INTELLIGENCE_AUDIT.md`

### Item 1 — Cliente SpreshApp tipado

| Exigido | Estado |
|---|---|
| 4 endpoints reais | OK — os 4, conferidos contra a doc |
| timeout | OK — `AbortController`, 30s default |
| backoff | OK — exponencial + jitter, respeita `Retry-After` |
| 401/403/404/429/5xx | OK — todos mapeados, retryable correto |
| cursor | **MEIO** — pagina e detecta ciclo, mas devolve o cursor errado no caminho padrão (BUG-01) |
| contador de créditos | **MEIO** — existe e recusa antes do I/O, mas o teto é furável (BUG-03) e há double-release (BUG-06) |
| logs sem secret | OK — verificado nos 4 caminhos |
| **fixtures reais anonimizadas** (plural) | **NÃO ENTREGUE** — 1 fixture, do único endpoint que não passa pelo normalizador. Nenhuma de `brand/:page_id`, `ad-search` ou `ad-details` (BUG-09) |

### Item 2 — Migrations do schema `ci`

| Exigido | Estado |
|---|---|
| Migrations do schema `ci` | **MEIO** — entregues como **6 arquivos**, não os "12 arquivos" do plano. Substância (31 tabelas + 10 views) está lá; a contagem de arquivos não |
| RLS | **MEIO** — presente em 31/31 tabelas, mas com 3 furos: BUG-04 (IDOR na RPC), BUG-08 (config squat), BUG-10 (update de colunas) |
| Índices | OK — presentes e corretos, incluindo os 2 únicos parciais e os GIN de FTS |
| "entregues a você para deploy via Lovable" | OK — arquivos prontos; deploy não executado |

### Item 0 (pré-requisito)

`.env.example` OK · `git rm --cached .env` OK · **"esta auditoria commitada"** NÃO — `docs/` não
existe neste repositório; o documento vive só no outro projeto (BUG-15).

---

## 6. Veredito

### Pronto para seguir

- **O schema.** Idempotente (provado 3×), 31 tabelas, RLS em todas, FKs adiadas criadas, índices
  únicos parciais funcionando, sem colisão de nomes, bucket privado, e — o mais importante — **a
  classe de buraco de crédito da 20260804090000 está fechada**: nenhuma tabela que decide custo ou
  consumo aceita escrita de `anon` ou `authenticated`. Os REVOKEs de `ci_claim_job` e
  `ci_reap_stale_jobs` estão corretos.
- **O transporte do cliente.** Retry, backoff, classificação de erro, timeout e redação de chave
  estão certos e conferem com a doc oficial endpoint por endpoint, parâmetro por parâmetro,
  custo por custo.
- **A branch está limpa de segredos** em todos os 3918 commits.

### Precisa ser corrigido antes de seguir para os itens 3-4 do plano (storage e worker)

Bloqueantes, nesta ordem:

1. **BUG-01 + BUG-02** — o cursor de retomada e o teste vazio que o esconde. Sem isso, toda
   importação retomada repaga créditos, e a suíte não vai avisar.
2. **BUG-03** — o teto de créditos precisa virar teto de verdade (limitar por `available` na
   liquidação, não só na reserva), ou a promessa do docblock precisa ser retirada.
3. **BUG-04** — `ci_compute_scale_signal` precisa de `where user_id = auth.uid()` ou de
   `revoke ... from authenticated`, como as outras duas funções já fazem.
4. **BUG-09** — antes de qualquer download, capturar **uma fixture real** de
   `GET /v1/brand/:page_id` e de `GET /v1/ad-details/:id` e rodar `collectMedia` contra ela. Hoje
   metade de `types.ts` é palpite, e o modo de falha é perda silenciosa de mídia paga.

Corrigíveis em paralelo: BUG-05..BUG-08, BUG-10 (média) e BUG-11..BUG-16 (baixa).

**Nada aqui invalida o desenho.** O schema é o artefato mais sólido da entrega. Os problemas de
maior impacto estão todos concentrados na contabilidade de créditos e na paginação do cliente —
que é, justamente, o pedaço que a suíte de testes diz cobrir e onde ela tem um teste vazio.
