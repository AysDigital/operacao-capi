-- =====================================================================
-- Operação Capi — Migration 009: dados de teste (TEMPORÁRIO)
-- Rodar UMA vez no SQL Editor do Supabase. Só cria e escreve no schema ops.
--
-- Para ver a etapa 7 funcionando antes de cadastrar os ads reais:
--   - oferta "Oferta de teste" (TESTE-PT) com regras de performance;
--   - 7 cards Ad em "Em veiculação", um para cada situação, com IDs de anúncio
--     falsos (começam com 999000000000);
--   - métricas da Meta falsas em ops.metricas_anuncio_dia;
--   - vendas falsas em ops.vendas_teste (NÃO em public.purchases: o dashboard não é tocado).
-- ops.ranking e ops.vendas_por_anuncio passam a somar ops.vendas_teste.
-- Tudo isso sai numa migration de limpeza depois do teste.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Vendas de teste
-- ---------------------------------------------------------------------
create table ops.vendas_teste (
  id uuid primary key default gen_random_uuid(),
  ad_id text not null,
  dia date not null,
  tipo_oferta text not null default 'principal',
  status text not null default 'approved',
  valor numeric not null,
  valor_liquido numeric not null
);
alter table ops.vendas_teste enable row level security;
create policy membros_tudo on ops.vendas_teste for all to authenticated using (ops.is_membro()) with check (ops.is_membro());

-- ---------------------------------------------------------------------
-- 2. As funções de vendas passam a somar as vendas de teste
-- ---------------------------------------------------------------------
create or replace function ops.vendas_por_anuncio(p_ids text[], p_desde date default null)
returns table (ad_id text, tipo_oferta text, status text, vendas bigint, valor numeric, valor_liquido numeric)
language plpgsql stable security definer set search_path = '' as $$
#variable_conflict use_column
begin
  if not ops.is_membro() then
    raise exception 'acesso negado' using errcode = '42501';
  end if;
  return query
  select v.ad_id, v.tipo_oferta, v.status, count(*)::bigint, coalesce(sum(v.valor), 0), coalesce(sum(v.valor_liquido), 0)
  from (
    select p.ad_id, coalesce(p.tipo_oferta, 'principal') as tipo_oferta, p.status, p.valor::numeric as valor,
           p.valor_liquido::numeric as valor_liquido,
           (coalesce(p.data_venda, p.created_at) at time zone 'America/Sao_Paulo')::date as dia
    from public.purchases p
    where p.ad_id = any (p_ids) and p.status in ('approved', 'refunded', 'chargeback')
    union all
    select t.ad_id, t.tipo_oferta, t.status, t.valor, t.valor_liquido, t.dia
    from ops.vendas_teste t
    where t.ad_id = any (p_ids)
  ) v
  where p_desde is null or v.dia >= p_desde
  group by v.ad_id, v.tipo_oferta, v.status;
end $$;

create or replace function ops.ranking(p_oferta uuid default null, p_dias int default null, p_nivel text default 'anuncio')
returns table (
  oferta_id uuid, ad_num int, hook_num int, var_num int, cards uuid[],
  gasto numeric, impressoes bigint, cliques bigint, cliques_link bigint, compras_meta bigint,
  visualizacoes_3s bigint, thruplays bigint,
  vendas bigint, vendas_extras bigint, faturamento numeric, faturamento_liquido numeric,
  reembolsos bigint, valor_reembolsado numeric,
  classificacao text
)
language plpgsql stable security definer set search_path = '' as $$
#variable_conflict use_column
declare
  hoje date := (now() at time zone 'America/Sao_Paulo')::date;
begin
  if not ops.is_membro() then
    raise exception 'acesso negado' using errcode = '42501';
  end if;
  if p_nivel not in ('anuncio', 'hook', 'familia') then
    raise exception 'nível inválido: %', p_nivel;
  end if;

  return query
  with c as (
    select c.id, c.oferta_id, c.ad_num,
           case when p_nivel <> 'familia' then c.hook_num end as h,
           case when p_nivel = 'anuncio' then c.var_num end as m,
           case when p_dias is null then hoje - (o.periodo_avaliacao - 1)
                when p_dias = 0 then null
                else hoje - (p_dias - 1) end as desde,
           hoje - (o.periodo_avaliacao - 1) as desde_aval,
           o.gasto_minimo, o.roas_minimo, o.cpa_alvo
    from ops.cards c
    join ops.ofertas o on o.id = c.oferta_id
    where c.tipo = 'ad' and not c.arquivado and (p_oferta is null or c.oferta_id = p_oferta)
      and exists (select 1 from ops.veiculacoes v where v.card_id = c.id and v.meta_ad_id is not null)
  ),
  anuncios as (
    select c.id as card_id, v.meta_ad_id, c.desde, c.desde_aval
    from c join ops.veiculacoes v on v.card_id = c.id
    where v.meta_ad_id is not null
  ),
  meta as (
    select a.card_id,
      coalesce(sum(d.gasto_brl) filter (where a.desde is null or d.dia >= a.desde), 0) as gasto,
      coalesce(sum(d.impressoes) filter (where a.desde is null or d.dia >= a.desde), 0)::bigint as impressoes,
      coalesce(sum(d.cliques) filter (where a.desde is null or d.dia >= a.desde), 0)::bigint as cliques,
      coalesce(sum(d.cliques_link) filter (where a.desde is null or d.dia >= a.desde), 0)::bigint as cliques_link,
      coalesce(sum(d.compras_meta) filter (where a.desde is null or d.dia >= a.desde), 0)::bigint as compras_meta,
      coalesce(sum(d.visualizacoes_3s) filter (where a.desde is null or d.dia >= a.desde), 0)::bigint as visualizacoes_3s,
      coalesce(sum(d.thruplays) filter (where a.desde is null or d.dia >= a.desde), 0)::bigint as thruplays,
      coalesce(sum(d.gasto_brl) filter (where d.dia >= a.desde_aval), 0) as gasto_aval
    from anuncios a
    join ops.metricas_anuncio_dia d on d.meta_ad_id = a.meta_ad_id
    group by a.card_id
  ),
  todas_vendas as (
    select p.ad_id, coalesce(p.tipo_oferta, 'principal') as tipo_oferta, p.status, p.valor::numeric as valor,
           p.valor_liquido::numeric as valor_liquido,
           (coalesce(p.data_venda, p.created_at) at time zone 'America/Sao_Paulo')::date as dia
    from public.purchases p
    where p.status in ('approved', 'refunded', 'chargeback')
      and p.ad_id in (select meta_ad_id from anuncios)
    union all
    select t.ad_id, t.tipo_oferta, t.status, t.valor, t.valor_liquido, t.dia
    from ops.vendas_teste t
  ),
  venda as (
    select a.card_id,
      count(*) filter (where p.status = 'approved' and p.tipo_oferta = 'principal'
                         and (a.desde is null or p.dia >= a.desde)) as vendas,
      count(*) filter (where p.status = 'approved' and p.tipo_oferta <> 'principal'
                         and (a.desde is null or p.dia >= a.desde)) as vendas_extras,
      coalesce(sum(p.valor) filter (where p.status = 'approved' and (a.desde is null or p.dia >= a.desde)), 0) as faturamento,
      coalesce(sum(p.valor_liquido) filter (where p.status = 'approved' and (a.desde is null or p.dia >= a.desde)), 0) as faturamento_liquido,
      count(*) filter (where p.status <> 'approved' and (a.desde is null or p.dia >= a.desde)) as reembolsos,
      coalesce(sum(p.valor) filter (where p.status <> 'approved' and (a.desde is null or p.dia >= a.desde)), 0) as valor_reembolsado,
      count(*) filter (where p.status = 'approved' and p.tipo_oferta = 'principal' and p.dia >= a.desde_aval) as vendas_aval,
      coalesce(sum(p.valor) filter (where p.status = 'approved' and p.dia >= a.desde_aval), 0) as faturamento_aval
    from anuncios a
    join todas_vendas p on p.ad_id = a.meta_ad_id
    group by a.card_id
  )
  select c.oferta_id, c.ad_num, c.h, c.m, array_agg(c.id order by c.id),
    coalesce(sum(meta.gasto), 0), coalesce(sum(meta.impressoes), 0)::bigint, coalesce(sum(meta.cliques), 0)::bigint,
    coalesce(sum(meta.cliques_link), 0)::bigint, coalesce(sum(meta.compras_meta), 0)::bigint,
    coalesce(sum(meta.visualizacoes_3s), 0)::bigint, coalesce(sum(meta.thruplays), 0)::bigint,
    coalesce(sum(venda.vendas), 0)::bigint, coalesce(sum(venda.vendas_extras), 0)::bigint,
    coalesce(sum(venda.faturamento), 0), coalesce(sum(venda.faturamento_liquido), 0),
    coalesce(sum(venda.reembolsos), 0)::bigint, coalesce(sum(venda.valor_reembolsado), 0),
    ops.classificar(coalesce(sum(meta.gasto_aval), 0), coalesce(sum(venda.faturamento_aval), 0),
                    coalesce(sum(venda.vendas_aval), 0)::bigint,
                    max(c.gasto_minimo), max(c.roas_minimo), max(c.cpa_alvo))
  from c
  left join meta on meta.card_id = c.id
  left join venda on venda.card_id = c.id
  group by c.oferta_id, c.ad_num, c.h, c.m;
end $$;

-- ---------------------------------------------------------------------
-- 3. A oferta, os cards e os números de teste
-- ---------------------------------------------------------------------
-- Regras: CPA alvo R$ 80, ROAS mínimo 1,5, gasto mínimo R$ 200, 7 dias.
-- Situações esperadas (últimos 7 dias):
--   AD1-H1-M1  2 contas  R$ 700, 12 vendas + 3 upsell  → Vencedor (com troféu)
--   AD1-H1-M2  1 conta   R$ 120, 2 vendas              → Promissor
--   AD1-H2-M1  1 conta   R$ 260, 0 vendas              → Perdedor
--   AD2-H1-M1  1 conta   R$ 90, 0 vendas               → Em teste
--   AD2-H1-M2  2 contas  R$ 400, 4 vendas (ROAS 0,97)  → Em teste
--   AD2-H2-M1  1 conta   R$ 350, 5 vendas + 2 upsell   → Vencedor
--   AD3-H1-M1  1 conta   em análise, sem gasto         → Sem dados
-- O AD1-H1-M1 tem também 13 dias mais antigos (aparecem em "30 dias" e "Tudo").
do $$
declare
  hoje date := (now() at time zone 'America/Sao_Paulo')::date;
  v_oferta uuid;
  v_lista uuid;
  v_contas uuid[];
  v_card uuid;
  v_id text;
  n int := 0;
  k int;
  i int;
  qtd int;
  g numeric;
  imp bigint;
  a record;
begin
  perform set_config('ops.silencio', '1', true);

  insert into ops.ofertas (nome, codigo, idioma, cor, status, cpa_alvo, roas_minimo, gasto_minimo, periodo_avaliacao)
  values ('Oferta de teste', 'TESTE', 'PT', '#7d786f', 'testando', 80, 1.5, 200, 7)
  returning id into v_oferta;

  select id into v_lista from ops.listas
  where not arquivada order by (nome = 'Em veiculação') desc, ordem limit 1;

  select array_agg(id order by apelido) into v_contas
  from (select id, apelido from ops.contas_anuncio where ativa order by apelido limit 2) x;
  if v_contas is null then
    raise exception 'cadastre pelo menos uma conta de anúncio ativa antes';
  end if;
  if array_length(v_contas, 1) = 1 then
    v_contas := v_contas || v_contas[1];
  end if;

  for a in
    select * from (values
      (1, 1, 1, 'VD',  2, 'rodando',    700::numeric, 12, 3, true),
      (1, 1, 2, 'VD',  1, 'rodando',    120::numeric,  2, 0, false),
      (1, 2, 1, 'VD',  1, 'rodando',    260::numeric,  0, 0, false),
      (2, 1, 1, 'IMG', 1, 'rodando',     90::numeric,  0, 0, false),
      (2, 1, 2, 'IMG', 2, 'rodando',    400::numeric,  4, 0, false),
      (2, 2, 1, 'IMG', 1, 'rodando',    350::numeric,  5, 2, false),
      (3, 1, 1, 'VD',  1, 'em_analise',   0::numeric,  0, 0, false)
    ) t(ad, h, m, formato, contas, status, gasto, vendas, upsells, trofeu)
  loop
    insert into ops.cards (oferta_id, lista_id, tipo, formato, ad_num, hook_num, var_num, nome, vencedor)
    values (v_oferta, v_lista, 'ad', a.formato, a.ad, a.h, a.m, '-', a.trofeu)
    returning id into v_card;

    for k in 1 .. a.contas loop
      n := n + 1;
      v_id := '999000000000' || lpad(n::text, 3, '0');
      insert into ops.veiculacoes (card_id, conta_id, status, meta_ad_id, nome_no_meta)
      values (v_card, v_contas[k], a.status, v_id, 'TESTE ' || a.formato || ' ad' || a.ad || '-h' || a.h || '-m' || a.m);

      -- Meta: gasto da conta dividido igualmente pelos 7 dias
      if a.gasto > 0 then
        for i in 0 .. 6 loop
          g := round(a.gasto / a.contas / 7, 2);
          imp := (g * 90)::bigint;
          insert into ops.metricas_anuncio_dia (meta_ad_id, dia, conta_id, nome_no_meta, gasto, gasto_brl, impressoes, cliques,
                                                cliques_link, compras_meta, visualizacoes_3s, thruplays)
          values (v_id, hoje - i, v_contas[k], 'TESTE', g, g, imp, (imp * 0.02)::bigint, (imp * (0.008 + a.h * 0.003))::bigint,
                  0, (imp * (0.22 + a.m * 0.04))::bigint, (imp * 0.07)::bigint);
        end loop;
      end if;

      -- Vendas: as da conta, espalhadas pelos 7 dias
      qtd := a.vendas / a.contas + case when k <= a.vendas % a.contas then 1 else 0 end;
      for i in 1 .. qtd loop
        insert into ops.vendas_teste (ad_id, dia, valor, valor_liquido) values (v_id, hoje - (i % 7), 97, 87);
      end loop;
      qtd := a.upsells / a.contas + case when k <= a.upsells % a.contas then 1 else 0 end;
      for i in 1 .. qtd loop
        insert into ops.vendas_teste (ad_id, dia, tipo_oferta, valor, valor_liquido) values (v_id, hoje - (i % 7), 'up_sell', 47, 42);
      end loop;

      -- Histórico mais antigo só no AD1-H1-M1 (8 a 20 dias atrás)
      if a.ad = 1 and a.h = 1 and a.m = 1 then
        for i in 8 .. 20 loop
          insert into ops.metricas_anuncio_dia (meta_ad_id, dia, conta_id, nome_no_meta, gasto, gasto_brl, impressoes, cliques,
                                                cliques_link, compras_meta, visualizacoes_3s, thruplays)
          values (v_id, hoje - i, v_contas[k], 'TESTE', 30, 30, 2700, 54, 30, 0, 700, 190);
          if i % 2 = 0 then
            insert into ops.vendas_teste (ad_id, dia, valor, valor_liquido) values (v_id, hoje - i, 97, 87);
          end if;
        end loop;
      end if;
    end loop;
  end loop;
end $$;
