-- =====================================================================
-- Operação Capi — Migration 007: métricas por anúncio (vendas do dashboard + Meta)
-- Rodar UMA vez no SQL Editor do Supabase. Só cria objetos no schema ops.
--
-- LEITURA FORA DO ops AUTORIZADA pela usuária em 28/10/2026 (ver DIAGNOSTICO_METRICAS.md):
--   - public.meta_ad_accounts: só número e nome da conta (NUNCA ads_token);
--   - public.purchases: só valores agregados por anúncio (NUNCA e-mail, telefone ou
--     qualquer dado do comprador).
-- Nada é escrito fora do ops.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Importar contas de anúncio do dashboard
-- ---------------------------------------------------------------------
-- Copia as contas que ainda não existem no ops (pelo número da conta).
-- Nome "CONTA 02 - BM 01 - Henrique" vira nome "Conta 02" e BM "BM 01 - Henrique".
-- Apelido: o primeiro "C{n}" livre (dá para trocar depois em Configurações).
create or replace function ops.importar_contas_dashboard() returns int
language plpgsql security definer set search_path = '' as $$
declare
  c record;
  n int := 1;
  v_apelido text;
  total int := 0;
begin
  if not ops.is_membro() and coalesce(auth.jwt() ->> 'role', '') <> '' then
    raise exception 'acesso negado' using errcode = '42501';
  end if;

  for c in
    select regexp_replace(m.ad_account_id, '^act_', '') as numero, m.label
    from public.meta_ad_accounts m
    where not exists (
      select 1 from ops.contas_anuncio o where o.meta_ad_account_id = regexp_replace(m.ad_account_id, '^act_', '')
    )
    order by m.label
  loop
    loop
      v_apelido := 'C' || n;
      exit when not exists (select 1 from ops.contas_anuncio o where o.apelido = v_apelido);
      n := n + 1;
    end loop;
    insert into ops.contas_anuncio (nome, apelido, bm_nome, meta_ad_account_id, ativa)
    values (
      initcap(trim(split_part(c.label, ' - ', 1))),
      v_apelido,
      nullif(trim(substr(c.label, length(split_part(c.label, ' - ', 1)) + 4)), ''),
      c.numero,
      true
    );
    total := total + 1;
  end loop;
  return total;
end $$;

-- Importa agora as contas que só existem no dashboard.
select ops.importar_contas_dashboard();

-- ---------------------------------------------------------------------
-- 2. Vendas por anúncio (lidas do dashboard, agregadas)
-- ---------------------------------------------------------------------
-- Casa public.purchases.ad_id com o meta_ad_id das veiculações.
-- Dia da venda no fuso de Brasília. Valores em reais. Cartão recusado (canceled) não é venda.
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

-- ---------------------------------------------------------------------
-- 3. Métricas diárias da Meta, por anúncio (gravadas pela função api/meta-metricas)
-- ---------------------------------------------------------------------
create table ops.metricas_anuncio_dia (
  meta_ad_id text not null,
  dia date not null,
  conta_id uuid references ops.contas_anuncio on delete set null,
  nome_no_meta text,
  moeda text not null default 'BRL',
  cotacao numeric(12, 6) not null default 1,   -- PTAX de venda do dia (1 para BRL)
  gasto numeric(14, 2) not null default 0,      -- na moeda da conta
  gasto_brl numeric(14, 2) not null default 0,  -- sem IOF
  impressoes bigint not null default 0,
  cliques bigint not null default 0,
  cliques_link bigint not null default 0,
  compras_meta int not null default 0,          -- compras atribuídas pela Meta (pixel)
  visualizacoes_3s bigint not null default 0,
  thruplays bigint not null default 0,
  atualizado_em timestamptz not null default now(),
  primary key (meta_ad_id, dia)
);
create index on ops.metricas_anuncio_dia (dia);

-- Cada busca na Meta (para saber quando foi a última e o que falhou).
create table ops.metricas_buscas (
  id uuid primary key default gen_random_uuid(),
  feita_em timestamptz not null default now(),
  feita_por uuid references ops.membros on delete set null default auth.uid(),
  desde date not null,
  ate date not null,
  contas int not null default 0,
  linhas int not null default 0,
  falhas jsonb not null default '[]'
);
create index on ops.metricas_buscas (feita_em desc);

alter table ops.metricas_anuncio_dia enable row level security;
alter table ops.metricas_buscas enable row level security;
create policy membros_tudo on ops.metricas_anuncio_dia for all to authenticated using (ops.is_membro()) with check (ops.is_membro());
create policy membros_tudo on ops.metricas_buscas for all to authenticated using (ops.is_membro()) with check (ops.is_membro());

-- ---------------------------------------------------------------------
-- 4. Permissões
-- ---------------------------------------------------------------------
revoke execute on function ops.importar_contas_dashboard() from public, anon;
revoke execute on function ops.vendas_por_anuncio(text[], date) from public, anon;
grant execute on function ops.importar_contas_dashboard() to authenticated;
grant execute on function ops.vendas_por_anuncio(text[], date) to authenticated;
