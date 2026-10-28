# Diagnóstico para as métricas (etapa 6a)

Feito em 28/10/2026 sem alterar nada no banco nem no código. As fontes foram:
- o código e a documentação do projeto financeiro, que já lê tabelas do dashboard;
- os **nomes** das variáveis de ambiente do dashboard (os valores, que são segredos, não foram lidos);
- duas consultas só de leitura rodadas pela usuária no SQL Editor (apêndice).

## Resumo

| Pergunta | Resposta |
| --- | --- |
| O dashboard guarda métricas da Meta (gasto, impressões, cliques…)? | **Não.** Nenhuma tabela tem métricas. Da Meta, o banco só guarda as 22 contas de anúncio e o token de acesso cifrado. O dashboard consulta a Meta na hora. |
| As vendas trazem o ID do anúncio? | **Sim.** `public.purchases.ad_id` tem o ID do anúncio em **350 de 426 vendas dos últimos 30 dias (82%)**. |
| Dá para casar vendas com os cards? | **Sim, pelo `ad_id`**, assim que as veiculações tiverem o ID do anúncio preenchido. Hoje nenhuma tem: o cruzamento deu 0 de 0. |
| Reaproveitar ou integração própria? | **Os dois.** Vendas: ler do dashboard por uma função no `ops`. Métricas da Meta: integração própria, porque o dashboard não as guarda. |

## 1. Dados do Meta

- **Não há tabela de métricas.** O inventário do schema `public` tem 15 tabelas, e a única da Meta é `public.meta_ad_accounts`, com 22 linhas e as colunas `id`, `area_id`, `label`, `ad_account_id`, `ads_token`, `created_at` e `updated_at`.
  - Cada linha é uma **conta de anúncio** (nível conta), com o nome (ex.: "CONTA 02 - BM 01 - Henrique") e o token de acesso **cifrado**. A chave de decifrar fica só no servidor do dashboard (`ENCRYPTION_KEY`).
  - Não existe nenhum dado por campanha, conjunto ou anúncio, nem gasto, impressões, cliques, CTR, CPM, compras ou ThruPlays/visualizações de 3 s, seja diário ou acumulado.
- **Como o dashboard consegue os números:** consulta a Marketing API na hora, com os tokens cifrados. As rotinas dele rodam no **Vercel Cron**, e o arquivo de variáveis cita "execução das Regras e limpeza do rate limit". Isso não aparece no banco. As tabelas de regras automáticas (`automation_rules`, `rule_executions`) estão vazias.
- **Contas:** das 22 contas do dashboard, só **1 está cadastrada em `ops.contas_anuncio`** com o mesmo ID: "CONTA 03 - BM 01 - Cecilia" (1482101403822536). As outras 21 existem só no dashboard. Nenhuma conta da operação ficou de fora do dashboard. Três contas são em dólar ("[Dólar]" no nome).
- **O financeiro já resolveu o gasto do jeito próprio:**
  - função `api/meta-spend` no Vercel, com a chave `META_ADS_TOKEN` em variável de ambiente;
  - Marketing API `/insights`, diário, mas no nível **conta** (só o gasto total da conta, não por anúncio);
  - contas em dólar convertidas pela PTAX.

## 2. Dados de vendas

- **Tabela:** `public.purchases`, com 1.561 linhas no total.
  - Vem do **webhook da Mundpay**: todas as vendas dos últimos 30 dias têm `plataforma = mundpay`.
  - Não há UTMify nem outra fonte. As tabelas `checkout_integrations`, `events_log` e `visitors` estão vazias.
- **Colunas:**
  - identificação: `transaction_id`, `produto`, `plataforma`, `area_id`;
  - valores: `valor`, `valor_liquido`, `moeda`, `status`, `tipo_oferta`;
  - rastreio: `utm_source`, `utm_medium`, `utm_campaign`, `utm_term`, `utm_content`, `ad_id`, `match`;
  - datas: `pago_em`, `data_venda`, `created_at`, `updated_at`;
  - o webhook inteiro em `raw_webhook`;
  - dados pessoais do comprador (`email`, `telefone`, `user_id`, geolocalização), que **não devem ser lidos** pelo app da operação.
- **`utm_content` vem no formato `nome do anúncio|ID do anúncio`.** Exemplo: `ad12-h1-m1-w|120250768421540262`. É a macro `{{ad.name}}|{{ad.id}}` da Meta.
- **Formatos nos últimos 30 dias (426 vendas):**

  | Campo | Formato | Vendas | Valores distintos |
  | --- | --- | --- | --- |
  | `utm_content` | nome\|ID | 343 | 76 |
  | `utm_content` | vazio | 79 | — |
  | `utm_content` | macro sem preencher (`{{ad.name}}\|{{ad.id}}`) | 4 | 1 |
  | `ad_id` | ID de anúncio (15+ dígitos) | **350** | **75** |
  | `ad_id` | vazio | 75 | — |
  | `ad_id` | número curto (`52524054582432`, 14 dígitos) | 1 | 1 |

- **`ad_id` já vem separado.** O dashboard já tira o ID de dentro do `utm_content`, e é essa coluna que serve para casar com o `meta_ad_id`. O `utm_content` inteiro nunca é igual ao `ad_id`, porque tem o nome junto.
- **`match`:** vale `none` em todas as vendas. O dashboard não usa essa coluna para nada que ajude aqui.
- **Valor, moeda, status e tipo:**
  - `valor` e `valor_liquido` em reais (`numeric`, não em centavos);
  - `moeda` = BRL em todas;
  - `status`: `approved` 365, `canceled` 44 (cartão recusado, não é venda), `refunded` 16, `chargeback` 1;
  - `tipo_oferta`: `principal` 336, `up_sell` 54, `down_sell` 36.
- **Atenção:**
  - **a venda mais recente gravada é de 26/10 às 00:44.** Se houve vendas depois disso, o webhook do dashboard parou de gravar e vale conferir com a Mundpay. O financeiro também já tinha visto upsells e downsells que não chegaram a esta tabela;
  - 4 vendas chegaram com a macro sem preencher. Algum anúncio ou link está com o parâmetro de URL montado de um jeito que a Meta não substituiu;
  - ainda não se sabe se upsell e downsell herdam o `ad_id` da venda principal. Dá para conferir com uma consulta curta antes de decidir como somar o faturamento por anúncio.

## 3. Cruzamento com `ops.veiculacoes`

- **Hoje: 0 de 0.** Nenhuma veiculação tem `meta_ad_id` preenchido, então não há o que cruzar.
- **Potencial:** nos últimos 30 dias, **75 anúncios diferentes** geraram venda com `ad_id`. Cada um deles pode ser ligado a um card quando o ID for preenchido na veiculação.
- **Ajuda para preencher:** o nome no `utm_content` (`ad12-h1-m1-w`) segue quase a mesma lógica AD/H/M dos cards. A nomenclatura não deve ser usada para casar métricas automaticamente (regra do projeto), mas pode **sugerir** o ID ao preencher a veiculação, com a usuária confirmando.

## 4. Recomendação

**Vendas: reaproveitar o dashboard.**
- **Como:** uma função `security definer` no `ops`, só de leitura (no mesmo modelo de `fin.meta_ad_accounts_list()` do financeiro).
- **O que devolve:** por `ad_id` e por dia, a quantidade de vendas aprovadas, o faturamento (`valor` e `valor_liquido`), reembolsos e chargebacks, separando principal de upsell/downsell. **Nunca** devolve e-mail, telefone ou outro dado do comprador.
- **No app:** métricas do card = soma das veiculações, casando `purchases.ad_id` com `veiculacoes.meta_ad_id`. Por conta, é a mesma coisa filtrando a veiculação.
- **O que falta:**
  - autorização da usuária para o `ops` ler `public.purchases` (hoje o CLAUDE.md proíbe sem autorização);
  - conferir se upsell e downsell trazem `ad_id`;
  - conferir o webhook parado desde 26/10.

**Métricas da Meta: integração própria.**
- **Por quê:** o dashboard não guarda nada e os tokens dele são cifrados com uma chave que só ele tem. Não dá para ler os números pelo banco.
- **Como (mesmo caminho do financeiro):**
  - uma função no Vercel do projeto `operacao-capi` chama `/insights` com `level=ad` e `time_increment=1`;
  - campos: gasto, impressões, cliques, CTR, CPM, alcance, `actions` (compras), `video_thruplay_watched_actions` e as visualizações de 3 s;
  - grava por dia e por anúncio numa tabela nova do `ops`, por exemplo `ops.metricas_anuncio_dia`, com chave dia + `ad_id`;
  - busca só as contas de `ops.contas_anuncio` e converte as contas em dólar pela PTAX.
- **Quando busca:** ao abrir o quadro ou o card, se a última busca tiver mais de 1 hora (como o Painel do financeiro), ou por agendamento.
- **O que falta:**
  1. cadastrar em `ops.contas_anuncio` as 21 contas que só existem no dashboard. Dá para fazer de uma vez com uma migration que copia número e nome do dashboard, sem o token, se a usuária autorizar;
  2. pôr a mesma chave da Meta do financeiro (`META_ADS_TOKEN`) nas variáveis do projeto `operacao-capi` no Vercel. Ela já tem acesso às contas da operação;
  3. preencher o ID do anúncio nas veiculações. Com a integração, o app pode listar os anúncios de cada conta (nome e ID) para escolher, em vez de colar o ID.

**Ordem sugerida:**
1. Cadastrar as contas.
2. Vendas por anúncio, que já funciona com o dado do dashboard.
3. Integração da Meta: gasto e métricas, e com isso ROAS e CPA por card.
4. Escolher o anúncio da lista da Meta na veiculação.

---

## Apêndice: consultas usadas (somente leitura)

### 1. Inventário das tabelas (linhas, colunas, datas mais recentes e IDs que casam com `ops.veiculacoes`)

```sql
with tabelas as (
  select n.nspname as esquema, c.relname as tabela, c.oid
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where c.relkind in ('r', 'p', 'v', 'm')
    and n.nspname not in ('pg_catalog', 'information_schema', 'ops', 'fin', 'auth', 'storage', 'realtime',
      'extensions', 'graphql', 'graphql_public', 'vault', 'pgsodium', 'pgsodium_masks', 'cron', 'net',
      'supabase_functions', 'supabase_migrations', '_realtime', '_analytics', 'pgbouncer')
    and n.nspname not like 'pg\_%'
)
select
  t.esquema,
  t.tabela,
  (xpath('/row/n/text()', query_to_xml(format('select count(*) as n from %I.%I', t.esquema, t.tabela), false, true, '')))[1]::text::bigint as linhas,
  (select string_agg(a.attname || ' ' || format_type(a.atttypid, a.atttypmod), ', ' order by a.attnum)
     from pg_attribute a where a.attrelid = t.oid and a.attnum > 0 and not a.attisdropped) as colunas,
  (select string_agg(a.attname || ' até ' || coalesce((xpath('/row/m/text()', query_to_xml(
            format('select max(%I)::text as m from %I.%I', a.attname, t.esquema, t.tabela), false, true, '')))[1]::text, '—'), '; ' order by a.attnum)
     from pg_attribute a
     where a.attrelid = t.oid and a.attnum > 0 and not a.attisdropped
       and a.atttypid in ('date'::regtype, 'timestamp'::regtype, 'timestamptz'::regtype)) as datas_mais_recentes,
  (select string_agg(a.attname || ': ' || (xpath('/row/n/text()', query_to_xml(
            format('select count(distinct v.meta_ad_id) as n from ops.veiculacoes v where v.meta_ad_id in (select %I::text from %I.%I)',
                   a.attname, t.esquema, t.tabela), false, true, '')))[1]::text
          || ' de ' || (select count(*) from ops.veiculacoes where meta_ad_id is not null), '; ')
     from pg_attribute a
     where a.attrelid = t.oid and a.attnum > 0 and not a.attisdropped
       and a.attname ~* '(^|_)ad_?id$') as ids_de_anuncio_que_casam_com_ops
from tabelas t
order by t.esquema, t.tabela;
```

### 2. Vendas dos últimos 30 dias (formatos de `utm_content`/`ad_id`, status, moeda, tipo) e contas de anúncio

```sql
with d as (
  select * from public.purchases
  where coalesce(data_venda, created_at) >= now() - interval '30 days'
),
campos as (
  select x.campo, x.v
  from d, lateral (values ('1. utm_content', d.utm_content), ('2. ad_id', d.ad_id)) as x(campo, v)
)
select campo,
       case
         when v is null or v = '' then 'vazio'
         when v ~ '^\d{15,}$' then 'só números 15+ dígitos (ID de anúncio)'
         when v ~ '^\d+$' then 'números curtos'
         when v ~ '\{\{.*\}\}' then 'macro sem preencher'
         else 'texto (nome?)'
       end as formato,
       count(*) as vendas,
       count(distinct v) as distintos,
       (array_agg(distinct v) filter (where v is not null and v <> ''))[1:5] as exemplos
from campos group by 1, 2
union all
select '3. utm_content igual ao ad_id?',
       case when utm_content = ad_id then 'iguais'
            when coalesce(utm_content, '') = '' or coalesce(ad_id, '') = '' then 'um dos dois vazio'
            else 'diferentes' end,
       count(*), null, null
from d group by 1, 2
union all select '4. match', coalesce(match, '(vazio)'), count(*), null, null from d group by 1, 2
union all select '5. status', coalesce(status, '(vazio)'), count(*), null, null from d group by 1, 2
union all select '6. moeda', coalesce(moeda, '(vazio)'), count(*), null, null from d group by 1, 2
union all select '7. tipo_oferta', coalesce(tipo_oferta, '(vazio)'), count(*), null, null from d group by 1, 2
union all select '8. plataforma', coalesce(plataforma, '(vazio)'), count(*), null, null from d group by 1, 2
union all
select '9. contas de anúncio',
       case when m.conta is null then 'só na operação'
            when o.id is null then 'só no dashboard'
            else 'nos dois' end,
       count(*), null,
       array_agg(coalesce(m.label, o.apelido || ' · ' || o.nome) || ' (' || coalesce(m.conta, o.meta_ad_account_id, 'sem ID') || ')')
from (select regexp_replace(ad_account_id, '^act_', '') as conta, label from public.meta_ad_accounts) m
full join ops.contas_anuncio o on o.meta_ad_account_id = m.conta
group by 1, 2
order by 1, 3 desc;
```
