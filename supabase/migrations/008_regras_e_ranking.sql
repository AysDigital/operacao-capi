-- =====================================================================
-- Operação Capi — Migration 008: regras de performance, classificação e ranking
-- Rodar UMA vez no SQL Editor do Supabase. Só cria objetos no schema ops.
--
-- Leituras do dashboard (public.purchases), sempre agregadas e só por funções
-- security definer que conferem ops.is_membro():
--   - vendas somadas por anúncio (já autorizada em 28/10/2026, migration 007);
--   - data/hora da última venda registrada (autorizada em 04/11/2026, etapa 7).
-- Nunca lê e-mail, telefone ou outro dado do comprador. Nada é escrito fora do ops.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Regras de performance por oferta
-- ---------------------------------------------------------------------
alter table ops.ofertas
  add column cpa_alvo numeric(12, 2) check (cpa_alvo > 0),          -- R$
  add column roas_minimo numeric(6, 2) check (roas_minimo > 0),
  add column gasto_minimo numeric(12, 2) check (gasto_minimo >= 0),  -- R$ gasto para avaliar um anúncio
  add column periodo_avaliacao int not null default 7 check (periodo_avaliacao in (7, 14, 30));

-- ---------------------------------------------------------------------
-- 2. A regra de classificação (uma só, usada pelo quadro e pelo ranking)
-- ---------------------------------------------------------------------
-- vencedor:  gasto >= gasto mínimo e (ROAS >= ROAS mínimo ou CPA <= CPA alvo)
-- perdedor:  gastou 2x o CPA alvo ou mais sem nenhuma venda principal
-- promissor: tem vendas, mas ainda não atingiu o gasto mínimo
-- em_teste:  gastando, sem dados suficientes (ou oferta sem regras)
-- sem_dados: sem gasto no período
create or replace function ops.classificar(
  p_gasto numeric, p_faturamento numeric, p_vendas bigint,
  p_gasto_minimo numeric, p_roas_minimo numeric, p_cpa_alvo numeric
) returns text
language sql immutable set search_path = '' as $$
  select case
    when coalesce(p_gasto, 0) <= 0 then 'sem_dados'
    when p_gasto >= coalesce(p_gasto_minimo, 0)
         and ((p_roas_minimo is not null and coalesce(p_faturamento, 0) / p_gasto >= p_roas_minimo)
              or (p_cpa_alvo is not null and p_vendas > 0 and p_gasto / p_vendas <= p_cpa_alvo))
      then 'vencedor'
    when p_cpa_alvo is not null and coalesce(p_vendas, 0) = 0 and p_gasto >= 2 * p_cpa_alvo then 'perdedor'
    when p_gasto_minimo is not null and p_vendas > 0 and p_gasto < p_gasto_minimo then 'promissor'
    else 'em_teste'
  end
$$;

-- ---------------------------------------------------------------------
-- 3. Ranking: números e classificação dos cards Ad (com ID do anúncio)
-- ---------------------------------------------------------------------
-- p_oferta: null = todas.
-- p_dias:   período dos números. null = o período de avaliação de cada oferta; 0 = tudo.
-- p_nivel:  'anuncio' (um por card), 'hook' (AD+H) ou 'familia' (AD).
-- A classificação usa SEMPRE o período de avaliação da oferta, somando todas as veiculações.
-- Dias no calendário de Brasília. Vendas: aprovadas; reembolso e chargeback à parte.
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

-- ---------------------------------------------------------------------
-- 4. Última venda registrada no dashboard (só a data/hora, para o alerta)
-- ---------------------------------------------------------------------
create or replace function ops.ultima_venda() returns timestamptz
language plpgsql stable security definer set search_path = '' as $$
begin
  if not ops.is_membro() then
    raise exception 'acesso negado' using errcode = '42501';
  end if;
  return (select max(p.created_at) from public.purchases p);
end $$;

-- ---------------------------------------------------------------------
-- 5. Permissões
-- ---------------------------------------------------------------------
revoke execute on function ops.classificar(numeric, numeric, bigint, numeric, numeric, numeric) from public, anon;
revoke execute on function ops.ranking(uuid, int, text) from public, anon;
revoke execute on function ops.ultima_venda() from public, anon;
grant execute on function ops.classificar(numeric, numeric, bigint, numeric, numeric, numeric) to authenticated;
grant execute on function ops.ranking(uuid, int, text) to authenticated;
grant execute on function ops.ultima_venda() to authenticated;
