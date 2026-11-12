-- =====================================================================
-- Operação Capi — Migration 034: contar as métricas a partir de uma data
-- Rodar UMA vez no SQL Editor do Supabase. Só mexe no schema ops.
--
-- Pedido da usuária (12/11/2026): as ofertas estavam pausadas e os ads vão
-- subir de novo, agora seguindo a regra do Bidcap. Gasto, vendas, ROAS,
-- classificação e fases passam a contar só a partir de 13/11/2026.
--   1. ofertas.metricas_desde (data, editável na oferta). Todas = 13/11/2026.
--   2. ops.ranking, ops.fase_veiculacao e ops.cobertura_oferta ignoram o que
--      é anterior a essa data. Nada é apagado: mudar a data traz de volta.
--   3. As veiculações que não estão "rodando" perdem o rodando_desde: quando
--      voltarem a rodar, o D1 é o dia em que voltarem. As que estão
--      "rodando" contam a partir de 13/11.
-- =====================================================================

-- 1. Data de início das métricas ---------------------------------------------
alter table ops.ofertas add column metricas_desde date;
update ops.ofertas set metricas_desde = date '2026-11-13';

-- 2. Fases e ranking a partir dessa data -------------------------------------
-- (igual à 033: o início da fase é o mais recente entre rodando_desde e metricas_desde)
create or replace function ops.fase_veiculacao(p_oferta uuid default null, p_card uuid default null)
returns table (
  veiculacao_id uuid, card_id uuid, conta_id uuid, status text, dia int, fase text,
  veredito text, roas_validacao numeric, gasto_validacao numeric, faturamento_validacao numeric, no_spend boolean
)
language plpgsql stable security definer set search_path = '' as $$
#variable_conflict use_column
declare
  hoje date := (now() at time zone 'America/Sao_Paulo')::date;
begin
  if not ops.is_membro() then
    raise exception 'acesso negado' using errcode = '42501';
  end if;

  return query
  with v as (
    select x.id, x.card_id, x.conta_id, x.status, greatest((x.rodando_desde at time zone 'America/Sao_Paulo')::date, o.metricas_desde) as inicio,
           o.dias_validacao, o.roas_avanca, o.roas_monitora, o.gasto_nospend, o.escalando
    from ops.veiculacoes x
    join ops.cards c on c.id = x.card_id
    join ops.ofertas o on o.id = c.oferta_id
    where x.rodando_desde is not null and not c.arquivado
      and (p_oferta is null or c.oferta_id = p_oferta)
      and (p_card is null or c.id = p_card)
  ),
  ids as (
    select v.id, array_agg(a.meta_ad_id) as ids
    from v join ops.veiculacoes_anuncios a on a.veiculacao_id = v.id
    group by v.id
  ),
  gasto as (
    select v.id,
      coalesce(sum(d.gasto_brl) filter (where d.dia between v.inicio and v.inicio + v.dias_validacao - 1), 0) as g_val,
      coalesce(sum(d.gasto_brl) filter (where d.dia = hoje - 1), 0) as g1,
      coalesce(sum(d.gasto_brl) filter (where d.dia = hoje - 2), 0) as g2
    from v
    join ops.veiculacoes_anuncios a on a.veiculacao_id = v.id
    join ops.metricas_anuncio_dia d on d.meta_ad_id = a.meta_ad_id
    group by v.id
  ),
  fat as (
    select v.id,
      coalesce((select sum(s.valor) from ops.vendas_por_dia(i.ids, v.inicio) s
                 where s.status = 'approved' and s.dia <= v.inicio + v.dias_validacao - 1), 0) as f
    from v join ids i on i.id = v.id
  )
  select v.id, v.card_id, v.conta_id, v.status,
    (hoje - v.inicio + 1)::int,
    case when hoje - v.inicio + 1 <= v.dias_validacao then 'validacao'
         when v.escalando then 'escala'
         else 'pre_escala' end,
    case when hoje - v.inicio + 1 <= v.dias_validacao or i.id is null then null
         when coalesce(g.g_val, 0) <= 0 then 'falhou'
         when coalesce(f.f, 0) / g.g_val >= v.roas_avanca then 'avanca'
         when coalesce(f.f, 0) / g.g_val >= v.roas_monitora then 'monitora'
         else 'falhou' end,
    case when coalesce(g.g_val, 0) > 0 then round(coalesce(f.f, 0) / g.g_val, 2) end,
    coalesce(g.g_val, 0),
    coalesce(f.f, 0),
    (v.status = 'rodando' and i.id is not null and hoje - v.inicio >= 2
      and coalesce(g.g1, 0) < v.gasto_nospend and coalesce(g.g2, 0) < v.gasto_nospend)
  from v
  left join ids i on i.id = v.id
  left join gasto g on g.id = v.id
  left join fat f on f.id = v.id
  where v.inicio <= hoje;   -- antes da data de início das métricas, ainda não tem fase
end $$;

create or replace function ops.ranking(p_oferta uuid default null, p_dias int default null, p_nivel text default 'anuncio')
returns table (
  oferta_id uuid, ad_num int, hook_num int, var_num int, cards uuid[],
  gasto numeric, impressoes bigint, cliques bigint, cliques_link bigint, compras_meta bigint,
  visualizacoes_3s bigint, thruplays bigint,
  vendas bigint, vendas_extras bigint, faturamento numeric, faturamento_liquido numeric,
  reembolsos bigint, valor_reembolsado numeric,
  classificacao text, no_bid boolean
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
           greatest(case when p_dias is null then hoje - (o.periodo_avaliacao - 1)
                         when p_dias = 0 then null
                         else hoje - (p_dias - 1) end, o.metricas_desde) as desde,
           greatest(hoje - (o.periodo_avaliacao - 1), o.metricas_desde) as desde_aval,
           o.gasto_minimo, o.roas_minimo, o.cpa_alvo, o.gasto_nospend, o.metricas_desde
    from ops.cards c
    join ops.ofertas o on o.id = c.oferta_id
    where c.tipo = 'ad' and not c.arquivado and (p_oferta is null or c.oferta_id = p_oferta)
      and exists (select 1 from ops.veiculacoes_anuncios v where v.card_id = c.id)
  ),
  anuncios as (
    select c.id as card_id, v.meta_ad_id, c.desde, c.desde_aval
    from c join ops.veiculacoes_anuncios v on v.card_id = c.id
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
  ),
  -- veiculações rodando há 2+ dias, com o gasto de ontem e anteontem
  rod as (
    select v.card_id,
      coalesce((select sum(d.gasto_brl) from ops.veiculacoes_anuncios a join ops.metricas_anuncio_dia d on d.meta_ad_id = a.meta_ad_id
                 where a.veiculacao_id = v.id and d.dia = hoje - 1), 0) as g1,
      coalesce((select sum(d.gasto_brl) from ops.veiculacoes_anuncios a join ops.metricas_anuncio_dia d on d.meta_ad_id = a.meta_ad_id
                 where a.veiculacao_id = v.id and d.dia = hoje - 2), 0) as g2
    from ops.veiculacoes v
    join c on c.id = v.card_id
    where v.status = 'rodando' and v.rodando_desde is not null
      and greatest((v.rodando_desde at time zone 'America/Sao_Paulo')::date, c.metricas_desde) <= hoje - 2
      and exists (select 1 from ops.veiculacoes_anuncios a where a.veiculacao_id = v.id)
  ),
  nospend as (
    select r.card_id, bool_and(r.g1 < c.gasto_nospend and r.g2 < c.gasto_nospend) as ns
    from rod r join c on c.id = r.card_id
    group by r.card_id
  ),
  -- contas: elegível a mid-spender (Bidcap principal ou sem papel) e se já está numa No-Bid
  papel as (
    select c.id as card_id,
      bool_or(ca.papel in ('principal_bidcap', 'nenhum') and v.meta_ad_id is not null) as elegivel,
      bool_or(ca.papel = 'secundaria_nobid') as no_bid
    from c
    join ops.veiculacoes v on v.card_id = c.id
    join ops.contas_anuncio ca on ca.id = v.conta_id
    group by c.id
  ),
  -- mediana do gasto (período de avaliação) dos ads rodando, por oferta
  mediana as (
    select c.oferta_id, percentile_cont(0.5) within group (order by coalesce(meta.gasto_aval, 0)) as med
    from c left join meta on meta.card_id = c.id
    where exists (select 1 from ops.veiculacoes v where v.card_id = c.id and v.status = 'rodando')
    group by c.oferta_id
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
                    max(c.gasto_minimo), max(c.roas_minimo), max(c.cpa_alvo),
                    coalesce(bool_and(nospend.ns) filter (where nospend.card_id is not null), false),
                    max(mediana.med)::numeric,
                    coalesce(bool_or(papel.elegivel), false)),
    coalesce(bool_or(papel.no_bid), false)
  from c
  left join meta on meta.card_id = c.id
  left join venda on venda.card_id = c.id
  left join nospend on nospend.card_id = c.id
  left join papel on papel.card_id = c.id
  left join mediana on mediana.oferta_id = c.oferta_id
  group by c.oferta_id, c.ad_num, c.h, c.m;
end $$;

-- (igual à 031: o gasto sem card também só a partir de metricas_desde)
create or replace function ops.cobertura_oferta(p_oferta uuid, p_desde date default null)
returns table (gasto_total numeric, gasto_sem_card numeric, anuncios_sem_card bigint)
language sql stable set search_path = '' as $$
  with contas as (
    select distinct v.conta_id from ops.veiculacoes v join ops.cards c on c.id = v.card_id where c.oferta_id = p_oferta
  ),
  ligados as (select meta_ad_id from ops.veiculacoes_anuncios),
  d as (
    select m.meta_ad_id, m.gasto_brl, (m.meta_ad_id in (select meta_ad_id from ligados)) as ligado
    from ops.metricas_anuncio_dia m
    where m.conta_id in (select conta_id from contas)
      and m.dia >= coalesce(greatest(p_desde, (select o.metricas_desde from ops.ofertas o where o.id = p_oferta)), '-infinity'::date)
  )
  select coalesce(sum(gasto_brl), 0),
         coalesce(sum(gasto_brl) filter (where not ligado), 0),
         count(distinct meta_ad_id) filter (where not ligado and gasto_brl > 0)
  from d;
$$;

-- 3. Recomeço das fases -------------------------------------------------------
do $$
begin
  perform set_config('ops.silencio', '1', true);
  update ops.veiculacoes set rodando_desde = null where status <> 'rodando' and rodando_desde is not null;
end $$;

-- Conferência: ofertas com a data e veiculações com início de fase.
select o.codigo || '-' || o.idioma as oferta, o.metricas_desde,
       count(v.id) filter (where v.status = 'rodando') as rodando,
       count(v.rodando_desde) as com_inicio_de_fase
from ops.ofertas o
left join ops.cards c on c.oferta_id = o.id
left join ops.veiculacoes v on v.card_id = c.id
group by o.codigo, o.idioma, o.metricas_desde
order by 1;
