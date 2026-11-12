-- =====================================================================
-- Operação Capi — Migration 031: mais de um ID da Meta na mesma veiculação
-- Rodar UMA vez no SQL Editor do Supabase. Só mexe no schema ops.
--
-- Às vezes o mesmo AD é subido de novo na mesma conta sem duplicar, e ganha um
-- ID novo na Meta. O ID principal continua em ops.veiculacoes.meta_ad_id; os
-- outros ficam em ops.veiculacoes_ids_extras. Métricas e vendas do card somam
-- todos os IDs (view ops.veiculacoes_anuncios). Um ID nunca pode estar em dois
-- lugares (nem como principal e extra ao mesmo tempo).
-- =====================================================================

-- 1. Tabela dos IDs extras
create table ops.veiculacoes_ids_extras (
  id uuid primary key default gen_random_uuid(),
  veiculacao_id uuid not null references ops.veiculacoes on delete cascade,
  meta_ad_id text not null unique check (meta_ad_id ~ '^[0-9]+$'),
  nome_no_meta text,
  criado_em timestamptz not null default now()
);
create index on ops.veiculacoes_ids_extras (veiculacao_id);

alter table ops.veiculacoes_ids_extras enable row level security;
create policy membros_tudo on ops.veiculacoes_ids_extras for all to authenticated using (ops.is_membro()) with check (ops.is_membro());
grant select, insert, update, delete on ops.veiculacoes_ids_extras to authenticated;

-- 2. Um ID só pode aparecer uma vez (principal ou extra)
create or replace function ops.veiculacoes_ids_extras_conferir() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_card text;
begin
  new.meta_ad_id := trim(new.meta_ad_id);
  select c.nome into v_card
    from ops.veiculacoes v join ops.cards c on c.id = v.card_id
   where v.meta_ad_id = new.meta_ad_id;
  if found then
    raise exception 'Esse ID de anúncio já está no card %.', v_card;
  end if;
  return new;
end $$;

create trigger veiculacoes_ids_extras_conferir before insert or update on ops.veiculacoes_ids_extras
  for each row execute function ops.veiculacoes_ids_extras_conferir();

create or replace function ops.veiculacoes_conferir_id_extra() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_card text;
begin
  if new.meta_ad_id is not null and (tg_op = 'INSERT' or new.meta_ad_id is distinct from old.meta_ad_id) then
    select c.nome into v_card
      from ops.veiculacoes_ids_extras e
      join ops.veiculacoes v on v.id = e.veiculacao_id
      join ops.cards c on c.id = v.card_id
     where e.meta_ad_id = trim(new.meta_ad_id);
    if found then
      raise exception 'Esse ID de anúncio já está no card %.', v_card;
    end if;
  end if;
  return new;
end $$;

create trigger veiculacoes_conferir_id_extra before insert or update on ops.veiculacoes
  for each row execute function ops.veiculacoes_conferir_id_extra();

-- 3. Histórico do card
create or replace function ops.veiculacoes_ids_extras_log() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  r record;
  v record;
  conta text;
begin
  if tg_op = 'DELETE' then r := old; else r := new; end if;
  select x.card_id, x.conta_id into v from ops.veiculacoes x where x.id = r.veiculacao_id;
  if not found then return null; end if;   -- veiculação apagada junto
  select apelido into conta from ops.contas_anuncio where id = v.conta_id;
  if tg_op = 'INSERT' then
    perform ops.registrar(v.card_id, 'veiculacao_id', conta || ': outro ID do anúncio ' || r.meta_ad_id,
      jsonb_build_object('veiculacao_id', r.veiculacao_id, 'conta_id', v.conta_id, 'meta_ad_id', r.meta_ad_id, 'extra', true));
  elsif tg_op = 'DELETE' then
    perform ops.registrar(v.card_id, 'veiculacao_id', conta || ': ID do anúncio ' || r.meta_ad_id || ' removido',
      jsonb_build_object('veiculacao_id', r.veiculacao_id, 'conta_id', v.conta_id, 'de_meta_ad_id', r.meta_ad_id, 'extra', true));
  end if;
  return null;
end $$;

create trigger veiculacoes_ids_extras_log after insert or delete on ops.veiculacoes_ids_extras
  for each row execute function ops.veiculacoes_ids_extras_log();

revoke execute on function ops.veiculacoes_ids_extras_conferir() from public, anon, authenticated;
revoke execute on function ops.veiculacoes_conferir_id_extra() from public, anon, authenticated;
revoke execute on function ops.veiculacoes_ids_extras_log() from public, anon, authenticated;

-- 4. Todos os IDs de cada veiculação (principal + extras)
create view ops.veiculacoes_anuncios with (security_invoker = true) as
select v.id as veiculacao_id, v.card_id, c.oferta_id, v.conta_id, v.meta_ad_id, true as principal
  from ops.veiculacoes v join ops.cards c on c.id = v.card_id
 where v.meta_ad_id is not null
union all
select v.id, v.card_id, c.oferta_id, v.conta_id, e.meta_ad_id, false
  from ops.veiculacoes_ids_extras e
  join ops.veiculacoes v on v.id = e.veiculacao_id
  join ops.cards c on c.id = v.card_id;

grant select on ops.veiculacoes_anuncios to authenticated;

-- 5. Ranking e cobertura passam a somar todos os IDs
-- (igual à 010, trocando ops.veiculacoes.meta_ad_id pela view acima)
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

-- (igual à 017, trocando a lista de IDs ligados pela view acima)
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
    where m.conta_id in (select conta_id from contas) and (p_desde is null or m.dia >= p_desde)
  )
  select coalesce(sum(gasto_brl), 0),
         coalesce(sum(gasto_brl) filter (where not ligado), 0),
         count(distinct meta_ad_id) filter (where not ligado and gasto_brl > 0)
  from d;
$$;

-- Conferência: tabela vazia e a view com o mesmo número de IDs de antes.
select (select count(*) from ops.veiculacoes_ids_extras) as ids_extras,
       (select count(*) from ops.veiculacoes_anuncios) as ids_na_view,
       (select count(*) from ops.veiculacoes where meta_ad_id is not null) as ids_principais;
