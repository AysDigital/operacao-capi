-- =====================================================================
-- Operação Capi — Migration 010: apaga os dados de teste da 009
-- Rodar UMA vez no SQL Editor do Supabase. Só mexe no schema ops.
-- Volta ops.vendas_por_anuncio (007) e ops.ranking (008) a ler só o dashboard,
-- apaga a oferta TESTE-PT com os cards, as métricas falsas (IDs 999000000000…)
-- e a tabela ops.vendas_teste.
-- =====================================================================

-- 1. Funções de volta à versão sem as vendas de teste
create or replace function ops.vendas_por_anuncio(p_ids text[], p_desde date default null)
returns table (ad_id text, tipo_oferta text, status text, vendas bigint, valor numeric, valor_liquido numeric)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not ops.is_membro() then
    raise exception 'acesso negado' using errcode = '42501';
  end if;
  return query
  select p.ad_id, coalesce(p.tipo_oferta, 'principal'), p.status, count(*)::bigint,
         coalesce(sum(p.valor), 0), coalesce(sum(p.valor_liquido), 0)
  from public.purchases p
  where p.ad_id = any (p_ids)
    and p.status in ('approved', 'refunded', 'chargeback')
    and (p_desde is null
         or (coalesce(p.data_venda, p.created_at) at time zone 'America/Sao_Paulo')::date >= p_desde)
  group by p.ad_id, coalesce(p.tipo_oferta, 'principal'), p.status;
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
  venda as (
    select a.card_id,
      count(*) filter (where p.status = 'approved' and coalesce(p.tipo_oferta, 'principal') = 'principal'
                         and (a.desde is null or x.dia >= a.desde)) as vendas,
      count(*) filter (where p.status = 'approved' and coalesce(p.tipo_oferta, 'principal') <> 'principal'
                         and (a.desde is null or x.dia >= a.desde)) as vendas_extras,
      coalesce(sum(p.valor) filter (where p.status = 'approved' and (a.desde is null or x.dia >= a.desde)), 0) as faturamento,
      coalesce(sum(p.valor_liquido) filter (where p.status = 'approved' and (a.desde is null or x.dia >= a.desde)), 0) as faturamento_liquido,
      count(*) filter (where p.status <> 'approved' and (a.desde is null or x.dia >= a.desde)) as reembolsos,
      coalesce(sum(p.valor) filter (where p.status <> 'approved' and (a.desde is null or x.dia >= a.desde)), 0) as valor_reembolsado,
      count(*) filter (where p.status = 'approved' and coalesce(p.tipo_oferta, 'principal') = 'principal'
                         and x.dia >= a.desde_aval) as vendas_aval,
      coalesce(sum(p.valor) filter (where p.status = 'approved' and x.dia >= a.desde_aval), 0) as faturamento_aval
    from anuncios a
    join public.purchases p on p.ad_id = a.meta_ad_id
    cross join lateral (select (coalesce(p.data_venda, p.created_at) at time zone 'America/Sao_Paulo')::date as dia) x
    where p.status in ('approved', 'refunded', 'chargeback')
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


-- 2. Dados de teste
do $$
declare
  v_oferta uuid;
begin
  perform set_config('ops.silencio', '1', true);
  select id into v_oferta from ops.ofertas where codigo = 'TESTE' and idioma = 'PT';
  delete from ops.metricas_anuncio_dia where meta_ad_id like '999000000000%';
  if v_oferta is not null then
    delete from ops.cards where oferta_id = v_oferta;   -- veiculações, anexos, atividades... vão junto
    delete from ops.ofertas where id = v_oferta;
  end if;
end $$;

drop table ops.vendas_teste;
