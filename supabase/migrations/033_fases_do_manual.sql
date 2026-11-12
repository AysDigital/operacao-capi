-- =====================================================================
-- Operação Capi — Migration 033: fases do manual de tráfego (etapa 13)
-- Rodar UMA vez no SQL Editor do Supabase. Só mexe no schema ops.
--
-- Manual de Bidcap: cada anúncio passa por Validação (D1–D3 desde que
-- começou a rodar), Pré-escala (D4+) e Escala. No fim do D3, o ROAS dos
-- dias de validação decide: avança, monitora ou falhou.
--   1. Regras novas na oferta e papel da conta (Bidcap principal / No-Bid).
--   2. veiculacoes.rodando_desde (primeira vez em "rodando") e origem.
--   3. ops.fase_veiculacao: dia, fase, veredito e ROAS da validação.
--   4. ops.classificar ganha no_spend e mid_spender; ops.ranking passa os
--      dados e devolve se o card já foi para uma conta No-Bid.
--   5. ops.mandar_para_nobid: cria a veiculação na conta secundária.
-- Vendas: só pelas funções já autorizadas (ops.ranking e ops.vendas_por_dia).
-- =====================================================================

-- 1. Regras da oferta e papel da conta --------------------------------------
alter table ops.ofertas
  add column roas_avanca numeric(6, 2) not null default 1.3 check (roas_avanca > 0),
  add column roas_monitora numeric(6, 2) not null default 0.8 check (roas_monitora > 0),
  add column dias_validacao int not null default 3 check (dias_validacao between 1 and 30),
  add column gasto_nospend numeric(12, 2) not null default 5 check (gasto_nospend >= 0),
  add column escalando boolean not null default false;
update ops.ofertas set escalando = true where status = 'escalando';

alter table ops.contas_anuncio
  add column papel text not null default 'nenhum' check (papel in ('principal_bidcap', 'secundaria_nobid', 'nenhum'));

-- 2. Desde quando a veiculação roda ----------------------------------------
alter table ops.veiculacoes
  add column rodando_desde timestamptz,
  add column origem text;   -- ex.: "Mid-spender vindo da AC01LUC"

create or replace function ops.veiculacoes_rodando_desde() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.status = 'rodando' and new.rodando_desde is null then
    new.rodando_desde := coalesce(new.data_status, now());
  end if;
  return new;
end $$;

-- roda depois de veiculacoes_preparar (ordem alfabética), que já acertou data_status
create trigger veiculacoes_rodando_desde before insert or update on ops.veiculacoes
  for each row execute function ops.veiculacoes_rodando_desde();

do $$
begin
  perform set_config('ops.silencio', '1', true);
  update ops.veiculacoes v
     set rodando_desde = coalesce(
       (select min(a.criado_em) from ops.atividades a
         where a.tipo in ('veiculacao_status', 'veiculacao_criada')
           and a.dados ->> 'veiculacao_id' = v.id::text
           and a.dados ->> 'para' = 'rodando'),
       case when v.status = 'rodando' then v.data_status end)
   where v.rodando_desde is null;
end $$;

-- 3. Fase de cada veiculação -------------------------------------------------
-- dia = dias desde rodando_desde (D1 = o dia em que começou), em Brasília.
-- fase: validacao (até dias_validacao), depois pre_escala, ou escala se a oferta está escalando.
-- veredito (só depois que a validação fechou): ROAS dos dias de validação
--   ≥ roas_avanca → avanca; ≥ roas_monitora → monitora; abaixo ou sem gasto → falhou.
-- no_spend: rodando há 2+ dias e gasto < gasto_nospend ontem e anteontem.
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
    select x.id, x.card_id, x.conta_id, x.status, (x.rodando_desde at time zone 'America/Sao_Paulo')::date as inicio,
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
  left join fat f on f.id = v.id;
end $$;

revoke execute on function ops.fase_veiculacao(uuid, uuid) from public, anon;
grant execute on function ops.fase_veiculacao(uuid, uuid) to authenticated;

-- 4. Classificação com no_spend e mid_spender ---------------------------------
drop function ops.ranking(uuid, int, text);
drop function ops.classificar(numeric, numeric, bigint, numeric, numeric, numeric);

-- Ordem: no_spend (parou de gastar) > sem_dados > vencedor > mid_spender > perdedor > promissor > em_teste.
create or replace function ops.classificar(
  p_gasto numeric, p_faturamento numeric, p_vendas bigint,
  p_gasto_minimo numeric, p_roas_minimo numeric, p_cpa_alvo numeric,
  p_no_spend boolean, p_gasto_mediana numeric, p_mid_elegivel boolean
) returns text
language sql immutable set search_path = '' as $$
  select case
    when coalesce(p_no_spend, false) then 'no_spend'
    when coalesce(p_gasto, 0) <= 0 then 'sem_dados'
    when p_gasto >= coalesce(p_gasto_minimo, 0)
         and ((p_roas_minimo is not null and coalesce(p_faturamento, 0) / p_gasto >= p_roas_minimo)
              or (p_cpa_alvo is not null and p_vendas > 0 and p_gasto / p_vendas <= p_cpa_alvo))
      then 'vencedor'
    when coalesce(p_mid_elegivel, false) and p_gasto_mediana is not null and p_gasto < p_gasto_mediana
         and coalesce(p_vendas, 0) >= 1
         and ((p_roas_minimo is not null and coalesce(p_faturamento, 0) / p_gasto >= p_roas_minimo)
              or (p_cpa_alvo is not null and p_gasto / p_vendas <= p_cpa_alvo))
      then 'mid_spender'
    when p_cpa_alvo is not null and coalesce(p_vendas, 0) = 0 and p_gasto >= 2 * p_cpa_alvo then 'perdedor'
    when p_gasto_minimo is not null and p_vendas > 0 and p_gasto < p_gasto_minimo then 'promissor'
    else 'em_teste'
  end
$$;

-- Igual à 031, mais: no_spend, mediana de gasto dos ads rodando da oferta,
-- conta elegível a mid-spender e no_bid (já tem veiculação em conta No-Bid).
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
           case when p_dias is null then hoje - (o.periodo_avaliacao - 1)
                when p_dias = 0 then null
                else hoje - (p_dias - 1) end as desde,
           hoje - (o.periodo_avaliacao - 1) as desde_aval,
           o.gasto_minimo, o.roas_minimo, o.cpa_alvo, o.gasto_nospend
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
      and (v.rodando_desde at time zone 'America/Sao_Paulo')::date <= hoje - 2
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

revoke execute on function ops.classificar(numeric, numeric, bigint, numeric, numeric, numeric, boolean, numeric, boolean) from public, anon;
revoke execute on function ops.ranking(uuid, int, text) from public, anon;
grant execute on function ops.classificar(numeric, numeric, bigint, numeric, numeric, numeric, boolean, numeric, boolean) to authenticated;
grant execute on function ops.ranking(uuid, int, text) to authenticated;

-- 5. Mandar para No-Bid ------------------------------------------------------
create or replace function ops.mandar_para_nobid(p_card uuid, p_conta uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_destino ops.contas_anuncio;
  v_origem text;
  v_id uuid;
begin
  if not ops.is_membro() then
    raise exception 'acesso negado' using errcode = '42501';
  end if;
  select * into v_destino from ops.contas_anuncio where id = p_conta;
  if v_destino.id is null or not v_destino.ativa or v_destino.papel <> 'secundaria_nobid' then
    raise exception 'Escolha uma conta ativa marcada como "Secundária No-Bid".';
  end if;
  if exists (select 1 from ops.veiculacoes where card_id = p_card and conta_id = p_conta) then
    raise exception 'Este card já está na conta %.', v_destino.apelido;
  end if;

  select string_agg(ca.apelido, ', ' order by ca.apelido) into v_origem
  from ops.veiculacoes v join ops.contas_anuncio ca on ca.id = v.conta_id
  where v.card_id = p_card and ca.papel in ('principal_bidcap', 'nenhum') and v.status <> 'nao_subido';

  insert into ops.veiculacoes (card_id, conta_id, status, origem)
  values (p_card, p_conta, 'nao_subido', 'Mid-spender vindo da ' || coalesce(v_origem, 'conta principal'))
  returning id into v_id;

  perform ops.registrar(p_card, 'nobid',
    'Mid-spender vindo da ' || coalesce(v_origem, 'conta principal') || ': mandado para ' || v_destino.apelido || ' (No-Bid)',
    jsonb_build_object('veiculacao_id', v_id, 'conta_id', p_conta));
  return v_id;
end $$;

revoke execute on function ops.mandar_para_nobid(uuid, uuid) from public, anon;
grant execute on function ops.mandar_para_nobid(uuid, uuid) to authenticated;

-- Conferência: veiculações com data de início, por status, e as regras novas.
select v.status, count(*) as veiculacoes, count(v.rodando_desde) as com_rodando_desde,
       (select count(*) from ops.ofertas where escalando) as ofertas_escalando
from ops.veiculacoes v
group by v.status
order by v.status;
