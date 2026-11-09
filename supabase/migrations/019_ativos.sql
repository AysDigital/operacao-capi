-- =====================================================================
-- Operação Capi — Migration 019: ativos (etapa 11)
-- Rodar UMA vez no SQL Editor do Supabase. Só mexe no schema ops.
--
-- Regra principal: cada ativo tem UMA dona (BM ou perfil) e pode estar
-- compartilhado com outras BMs e perfis. Um ativo só é "perdido" numa queda
-- quando não sobra nenhuma BM ou perfil ativo com acesso a ele.
--
-- Nenhum campo de senha, código 2FA, cookie, token, número completo de cartão,
-- validade ou CVV. Do gerenciador de senhas, só o NOME do item.
--
--   1. Fornecedores, perfis, BMs, páginas, pixels, domínios e cartões
--   2. Contas de anúncio: moeda, limite, cartão, status e data de criação
--   3. Acessos (dona x compartilhado), no máximo uma dona ativa por ativo
--   4. Ativos de cada oferta (páginas, pixels, domínios)
--   5. Histórico de status de todos os ativos + queda (acessos ficam inativos)
--   6. "E se cair?": simulação de queda e mudança de status com motivo e data
--   7. BMs a partir do campo "BM" das contas que já existem (cada uma vira dona)
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Cadastros
-- ---------------------------------------------------------------------
create table ops.fornecedores (
  id uuid primary key default gen_random_uuid(),
  nome text not null check (length(trim(nome)) > 0),
  contato text,
  vende text,            -- o que vende
  observacoes text,
  criado_em timestamptz not null default now()
);

create table ops.perfis (
  id uuid primary key default gen_random_uuid(),
  nome text not null check (length(trim(nome)) > 0),
  fornecedor_id uuid references ops.fornecedores on delete restrict,
  data_compra date,
  custo numeric(12,2) check (custo >= 0),
  origem text check (origem in ('comprado', 'proprio', 'aquecido')),
  navegador text,              -- navegador antidetect
  perfil_navegador text,       -- nome do perfil dentro do navegador
  proxy text,                  -- só referência (ex.: "Proxy BR 03")
  item_senhas text,            -- só o NOME do item no gerenciador de senhas
  status text not null default 'aquecendo'
    check (status in ('aquecendo', 'pronto', 'em_uso', 'checkpoint', 'restrito', 'morto')),
  observacoes text,
  criado_em timestamptz not null default now()
);

create table ops.bms (
  id uuid primary key default gen_random_uuid(),
  nome text not null check (length(trim(nome)) > 0),
  meta_id text unique check (meta_id ~ '^[0-9]+$'),
  verificada boolean not null default false,
  fornecedor_id uuid references ops.fornecedores on delete restrict,
  data_compra date,
  custo numeric(12,2) check (custo >= 0),
  status text not null default 'ativa' check (status in ('ativa', 'restrita', 'desativada')),
  observacoes text,
  criado_em timestamptz not null default now()
);

create table ops.paginas (
  id uuid primary key default gen_random_uuid(),
  nome text not null check (length(trim(nome)) > 0),
  meta_id text unique check (meta_id ~ '^[0-9]+$'),
  status text not null default 'ativa' check (status in ('ativa', 'restrita', 'desativada')),
  observacoes text,
  criado_em timestamptz not null default now()
);

create table ops.pixels (
  id uuid primary key default gen_random_uuid(),
  nome text not null check (length(trim(nome)) > 0),
  meta_id text unique check (meta_id ~ '^[0-9]+$'),
  observacoes text,
  criado_em timestamptz not null default now()
);

create table ops.dominios (
  id uuid primary key default gen_random_uuid(),
  dominio text not null unique check (dominio ~ '^[a-z0-9.-]+\.[a-z]{2,}$'),
  registrador text,
  vencimento date,
  observacoes text,
  criado_em timestamptz not null default now()
);

-- Cartões: só apelido, os 4 últimos dígitos, banco e titular (PF/PJ).
create table ops.cartoes (
  id uuid primary key default gen_random_uuid(),
  apelido text not null check (length(trim(apelido)) > 0),
  ultimos4 text not null check (ultimos4 ~ '^[0-9]{4}$'),
  banco text,
  titular text not null default 'PJ' check (titular in ('PF', 'PJ')),
  criado_em timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 2. Contas de anúncio (as 21 continuam)
-- ---------------------------------------------------------------------
alter table ops.contas_anuncio
  add column moeda text check (moeda ~ '^[A-Z]{3}$'),
  add column limite_gasto numeric(14,2) check (limite_gasto >= 0),
  add column cartao_id uuid references ops.cartoes on delete restrict,
  add column status text not null default 'ativa' check (status in ('ativa', 'restrita', 'desativada')),
  add column data_criacao date;

update ops.contas_anuncio set status = case when ativa then 'ativa' else 'desativada' end;

-- "Ativa" (usada nos quadros) acompanha o status: só "desativada" tira a conta das listas.
create or replace function ops.contas_status_ativa() returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    if not new.ativa and new.status = 'ativa' then new.status := 'desativada'; end if;
  elsif new.ativa is distinct from old.ativa and new.status is not distinct from old.status then
    new.status := case when new.ativa then 'ativa' else 'desativada' end;
  end if;
  new.ativa := new.status <> 'desativada';
  return new;
end $$;

create trigger contas_status_ativa before insert or update on ops.contas_anuncio
  for each row execute function ops.contas_status_ativa();

-- ---------------------------------------------------------------------
-- 3. Acessos: quem (BM ou perfil) acessa qual ativo, como dona ou compartilhado
-- ---------------------------------------------------------------------
-- Um ativo por linha (só uma das colunas do ativo preenchida) e um titular por linha.
-- Desativar em vez de apagar: o acesso inativo fica guardado como histórico.
create table ops.acessos (
  id uuid primary key default gen_random_uuid(),
  perfil_id uuid references ops.perfis on delete restrict,
  bm_id uuid references ops.bms on delete restrict,
  conta_id uuid references ops.contas_anuncio on delete restrict,
  pagina_id uuid references ops.paginas on delete restrict,
  pixel_id uuid references ops.pixels on delete restrict,
  por_bm_id uuid references ops.bms on delete restrict,
  por_perfil_id uuid references ops.perfis on delete restrict,
  ativo_tipo text generated always as (
    case when perfil_id is not null then 'perfil' when bm_id is not null then 'bm'
         when conta_id is not null then 'conta' when pagina_id is not null then 'pagina' else 'pixel' end) stored,
  ativo_id uuid generated always as (coalesce(perfil_id, bm_id, conta_id, pagina_id, pixel_id)) stored,
  titular_tipo text generated always as (case when por_bm_id is not null then 'bm' else 'perfil' end) stored,
  titular_id uuid generated always as (coalesce(por_bm_id, por_perfil_id)) stored,
  papel text not null default 'compartilhado' check (papel in ('dona', 'compartilhado')),
  nivel text not null default 'admin' check (nivel in ('admin', 'anunciante', 'analista')),
  desde date not null default (now() at time zone 'America/Sao_Paulo')::date,
  ativo boolean not null default true,
  inativado_em date,
  motivo_inativo text,
  criado_em timestamptz not null default now(),
  constraint acessos_um_ativo check (num_nonnulls(perfil_id, bm_id, conta_id, pagina_id, pixel_id) = 1),
  constraint acessos_um_titular check (num_nonnulls(por_bm_id, por_perfil_id) = 1),
  constraint acessos_nao_a_si_mesmo check (bm_id <> por_bm_id and perfil_id <> por_perfil_id)
);
-- No máximo uma dona ativa por ativo, e o mesmo titular não entra duas vezes.
create unique index acessos_uma_dona on ops.acessos (ativo_tipo, ativo_id) where papel = 'dona' and ativo;
create unique index acessos_sem_repetir on ops.acessos (ativo_tipo, ativo_id, titular_tipo, titular_id) where ativo;
create index on ops.acessos (titular_tipo, titular_id);
create index on ops.acessos (ativo_tipo, ativo_id);

-- ---------------------------------------------------------------------
-- 4. Ativos de cada oferta (as contas já se ligam pelas veiculações)
-- ---------------------------------------------------------------------
create table ops.ofertas_ativos (
  id uuid primary key default gen_random_uuid(),
  oferta_id uuid not null references ops.ofertas on delete cascade,
  pagina_id uuid references ops.paginas on delete restrict,
  pixel_id uuid references ops.pixels on delete restrict,
  dominio_id uuid references ops.dominios on delete restrict,
  criado_em timestamptz not null default now(),
  constraint ofertas_ativos_um check (num_nonnulls(pagina_id, pixel_id, dominio_id) = 1),
  unique (oferta_id, pagina_id),
  unique (oferta_id, pixel_id),
  unique (oferta_id, dominio_id)
);

-- ---------------------------------------------------------------------
-- 5. Histórico de status (escrito só pelos gatilhos; o app só lê)
-- ---------------------------------------------------------------------
create table ops.ativos_status_log (
  id uuid primary key default gen_random_uuid(),
  ativo_tipo text not null check (ativo_tipo in ('perfil', 'bm', 'conta', 'pagina')),
  ativo_id uuid not null,
  de text,
  para text not null,
  data timestamptz not null default now(),
  motivo text,
  autor_id uuid,
  criado_em timestamptz not null default now()
);
create index on ops.ativos_status_log (ativo_tipo, ativo_id, data desc);

-- Segurança: só membros da equipe.
alter table ops.fornecedores enable row level security;
alter table ops.perfis enable row level security;
alter table ops.bms enable row level security;
alter table ops.paginas enable row level security;
alter table ops.pixels enable row level security;
alter table ops.dominios enable row level security;
alter table ops.cartoes enable row level security;
alter table ops.acessos enable row level security;
alter table ops.ofertas_ativos enable row level security;
alter table ops.ativos_status_log enable row level security;
create policy membros_tudo on ops.fornecedores for all to authenticated using (ops.is_membro()) with check (ops.is_membro());
create policy membros_tudo on ops.perfis for all to authenticated using (ops.is_membro()) with check (ops.is_membro());
create policy membros_tudo on ops.bms for all to authenticated using (ops.is_membro()) with check (ops.is_membro());
create policy membros_tudo on ops.paginas for all to authenticated using (ops.is_membro()) with check (ops.is_membro());
create policy membros_tudo on ops.pixels for all to authenticated using (ops.is_membro()) with check (ops.is_membro());
create policy membros_tudo on ops.dominios for all to authenticated using (ops.is_membro()) with check (ops.is_membro());
create policy membros_tudo on ops.cartoes for all to authenticated using (ops.is_membro()) with check (ops.is_membro());
create policy membros_tudo on ops.acessos for all to authenticated using (ops.is_membro()) with check (ops.is_membro());
create policy membros_tudo on ops.ofertas_ativos for all to authenticated using (ops.is_membro()) with check (ops.is_membro());
create policy membros_leem on ops.ativos_status_log for select to authenticated using (ops.is_membro());

-- Status que contam como "caído": quem está caído não dá acesso a nada.
create or replace function ops.status_caido(p_status text) returns boolean
language sql immutable set search_path = '' as $$
  select p_status in ('checkpoint', 'restrito', 'morto', 'restrita', 'desativada');
$$;

-- Status atual de uma BM ou perfil (titular de acessos).
create or replace function ops.titular_caido(p_tipo text, p_id uuid) returns boolean
language sql stable set search_path = '' as $$
  select coalesce(ops.status_caido(case p_tipo
    when 'bm' then (select status from ops.bms where id = p_id)
    when 'perfil' then (select status from ops.perfis where id = p_id) end), false);
$$;

-- Nome de qualquer ativo, para mensagens e resultados.
create or replace function ops.nome_ativo(p_tipo text, p_id uuid) returns text
language sql stable set search_path = '' as $$
  select case p_tipo
    when 'perfil' then (select nome from ops.perfis where id = p_id)
    when 'bm' then (select nome from ops.bms where id = p_id)
    when 'conta' then (select apelido || ' · ' || nome from ops.contas_anuncio where id = p_id)
    when 'pagina' then (select nome from ops.paginas where id = p_id)
    when 'pixel' then (select nome from ops.pixels where id = p_id) end;
$$;

create or replace function ops.status_ativo(p_tipo text, p_id uuid) returns text
language sql stable set search_path = '' as $$
  select case p_tipo
    when 'perfil' then (select status from ops.perfis where id = p_id)
    when 'bm' then (select status from ops.bms where id = p_id)
    when 'conta' then (select status from ops.contas_anuncio where id = p_id)
    when 'pagina' then (select status from ops.paginas where id = p_id) end;
$$;

-- Toda mudança de status vai para o histórico. Motivo e data vêm de
-- ops.mudar_status_ativo (se não vierem, data = agora e motivo vazio).
-- Se uma BM ou perfil cai, os acessos que ela dá ficam inativos (guardados).
create or replace function ops.ativos_log_status() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_tipo text := case tg_table_name when 'perfis' then 'perfil' when 'bms' then 'bm'
                   when 'contas_anuncio' then 'conta' when 'paginas' then 'pagina' end;
  v_motivo text := nullif(trim(current_setting('ops.status_motivo', true)), '');
  v_dia date := nullif(current_setting('ops.status_data', true), '')::date;
  v_data timestamptz;
  v_de text;
begin
  if tg_op = 'UPDATE' then
    if new.status is not distinct from old.status then return null; end if;
    v_de := old.status;
  end if;
  v_data := case
    when v_dia is null or v_dia = (now() at time zone 'America/Sao_Paulo')::date then now()
    else (v_dia + time '12:00') at time zone 'America/Sao_Paulo' end;
  insert into ops.ativos_status_log (ativo_tipo, ativo_id, de, para, data, motivo, autor_id)
  values (v_tipo, new.id, v_de, new.status, v_data, v_motivo,
          (select user_id from ops.membros where user_id = auth.uid()));

  if v_de is not null and v_tipo in ('bm', 'perfil')
     and ops.status_caido(new.status) and not ops.status_caido(v_de) then
    update ops.acessos
    set ativo = false,
        inativado_em = (v_data at time zone 'America/Sao_Paulo')::date,
        motivo_inativo = 'Queda: ' || ops.nome_ativo(v_tipo, new.id) || ' ficou ' || new.status
                         || coalesce(' — ' || v_motivo, '')
    where titular_tipo = v_tipo and titular_id = new.id and ativo;
  end if;
  return null;
end $$;

create trigger perfis_log_status after insert or update of status on ops.perfis
  for each row execute function ops.ativos_log_status();
create trigger bms_log_status after insert or update of status on ops.bms
  for each row execute function ops.ativos_log_status();
create trigger contas_log_status after insert or update of status on ops.contas_anuncio
  for each row execute function ops.ativos_log_status();
create trigger paginas_log_status after insert or update of status on ops.paginas
  for each row execute function ops.ativos_log_status();

-- Ao excluir um ativo (só possível sem ligações), o histórico dele vai junto.
create or replace function ops.ativos_apagar_log() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  delete from ops.ativos_status_log
  where ativo_id = old.id
    and ativo_tipo = case tg_table_name when 'perfis' then 'perfil' when 'bms' then 'bm'
                       when 'contas_anuncio' then 'conta' when 'paginas' then 'pagina' end;
  return null;
end $$;

create trigger perfis_apagar_log after delete on ops.perfis for each row execute function ops.ativos_apagar_log();
create trigger bms_apagar_log after delete on ops.bms for each row execute function ops.ativos_apagar_log();
create trigger contas_apagar_log after delete on ops.contas_anuncio for each row execute function ops.ativos_apagar_log();
create trigger paginas_apagar_log after delete on ops.paginas for each row execute function ops.ativos_apagar_log();

-- Histórico inicial das contas que já existem.
insert into ops.ativos_status_log (ativo_tipo, ativo_id, de, para, data, motivo)
select 'conta', id, null, status, criado_em, 'Situação quando o inventário começou'
from ops.contas_anuncio;

-- O campo "BM" das contas (que aparece nos quadros) acompanha a BM dona.
create or replace function ops.sincronizar_bm_nome() returns trigger
language plpgsql set search_path = '' as $$
declare
  r jsonb := to_jsonb(new);
begin
  if tg_table_name = 'bms' then
    update ops.contas_anuncio c set bm_nome = r ->> 'nome'
    where exists (select 1 from ops.acessos a
                  where a.conta_id = c.id and a.por_bm_id = (r ->> 'id')::uuid and a.papel = 'dona' and a.ativo);
  elsif r ->> 'conta_id' is not null and r ->> 'por_bm_id' is not null and r ->> 'papel' = 'dona' and (r ->> 'ativo')::boolean then
    update ops.contas_anuncio set bm_nome = (select nome from ops.bms where id = (r ->> 'por_bm_id')::uuid)
    where id = (r ->> 'conta_id')::uuid;
  end if;
  return null;
end $$;

create trigger bms_sincronizar_bm_nome after update of nome on ops.bms
  for each row execute function ops.sincronizar_bm_nome();
create trigger acessos_sincronizar_bm_nome after insert or update on ops.acessos
  for each row execute function ops.sincronizar_bm_nome();

-- ---------------------------------------------------------------------
-- 6. "E se cair?"
-- ---------------------------------------------------------------------
-- Simula a queda de uma BM ou perfil. Em cascata: se uma BM perde o último
-- acesso por causa da queda, o que só ela acessava também se perde.
-- Devolve { perdidos, seguros (com "via": quem ainda dá acesso), ofertas, ads }.
create or replace function ops.simular_queda(p_tipo text, p_id uuid) returns jsonb
language plpgsql stable set search_path = '' as $$
declare
  v_perdidos text[] := array[p_tipo || ':' || p_id];
  v_novos text[];
  v_afetados text[];
  v_res jsonb;
begin
  if p_tipo not in ('bm', 'perfil') then
    raise exception 'Só BMs e perfis podem cair.';
  end if;

  loop
    select coalesce(array_agg(distinct a.ativo_tipo || ':' || a.ativo_id), '{}') into v_novos
    from ops.acessos a
    where a.ativo
      and (a.titular_tipo || ':' || a.titular_id) = any (v_perdidos)
      and not ((a.ativo_tipo || ':' || a.ativo_id) = any (v_perdidos))
      and not exists (
        select 1 from ops.acessos b
        where b.ativo and b.ativo_tipo = a.ativo_tipo and b.ativo_id = a.ativo_id
          and not ((b.titular_tipo || ':' || b.titular_id) = any (v_perdidos))
          and not ops.titular_caido(b.titular_tipo, b.titular_id));
    exit when cardinality(v_novos) = 0;
    v_perdidos := v_perdidos || v_novos;
  end loop;

  -- tudo o que algum perdido acessava (menos o próprio ativo que caiu)
  select coalesce(array_agg(distinct a.ativo_tipo || ':' || a.ativo_id), '{}') into v_afetados
  from ops.acessos a
  where a.ativo and (a.titular_tipo || ':' || a.titular_id) = any (v_perdidos)
    and (a.ativo_tipo || ':' || a.ativo_id) <> p_tipo || ':' || p_id;

  with af as (
    select split_part(k, ':', 1) as tipo, split_part(k, ':', 2)::uuid as id, k = any (v_perdidos) as perdido
    from unnest(v_afetados) k
  ),
  contas as (select id from af where perdido and tipo = 'conta'),
  ads as (
    select v.card_id, c.nome, c.oferta_id, v.status, ca.apelido as conta
    from ops.veiculacoes v
    join ops.cards c on c.id = v.card_id
    join ops.contas_anuncio ca on ca.id = v.conta_id
    where v.conta_id in (select id from contas) and v.status in ('rodando', 'em_analise') and not c.arquivado
  ),
  ofertas as (
    select o.id, o.nome, o.codigo, o.idioma, o.cor, array_agg(distinct x.motivo order by x.motivo) as por
    from (
      select oferta_id, 'ads rodando em ' || conta as motivo from ads
      union all
      select oa.oferta_id, 'página ' || ops.nome_ativo('pagina', oa.pagina_id)
      from ops.ofertas_ativos oa join af on af.perdido and af.tipo = 'pagina' and af.id = oa.pagina_id
      union all
      select oa.oferta_id, 'pixel ' || ops.nome_ativo('pixel', oa.pixel_id)
      from ops.ofertas_ativos oa join af on af.perdido and af.tipo = 'pixel' and af.id = oa.pixel_id
    ) x join ops.ofertas o on o.id = x.oferta_id
    group by o.id, o.nome, o.codigo, o.idioma, o.cor
  )
  select jsonb_build_object(
    'perdidos', coalesce((
      select jsonb_agg(jsonb_build_object('tipo', tipo, 'id', id, 'nome', ops.nome_ativo(tipo, id),
                                          'status', ops.status_ativo(tipo, id)) order by tipo, ops.nome_ativo(tipo, id))
      from af where perdido), '[]'),
    'seguros', coalesce((
      select jsonb_agg(jsonb_build_object('tipo', af.tipo, 'id', af.id, 'nome', ops.nome_ativo(af.tipo, af.id),
               'status', ops.status_ativo(af.tipo, af.id),
               'via', (select jsonb_agg(jsonb_build_object('tipo', b.titular_tipo, 'id', b.titular_id,
                                          'nome', ops.nome_ativo(b.titular_tipo, b.titular_id), 'papel', b.papel))
                       from ops.acessos b
                       where b.ativo and b.ativo_tipo = af.tipo and b.ativo_id = af.id
                         and not ((b.titular_tipo || ':' || b.titular_id) = any (v_perdidos))
                         and not ops.titular_caido(b.titular_tipo, b.titular_id)))
             order by af.tipo, ops.nome_ativo(af.tipo, af.id))
      from af where not perdido), '[]'),
    'ofertas', coalesce((select jsonb_agg(to_jsonb(o) order by o.nome) from ofertas o), '[]'),
    'ads', coalesce((select jsonb_agg(to_jsonb(a) order by a.conta, a.nome) from ads a), '[]')
  ) into v_res;
  return v_res;
end $$;

-- Muda o status de qualquer ativo com motivo e data (vão para o histórico).
-- Se for a queda de uma BM ou perfil, devolve o resultado da simulação feita
-- ANTES da queda (o que se perdeu); senão, devolve null.
create or replace function ops.mudar_status_ativo(p_tipo text, p_id uuid, p_status text, p_motivo text, p_data date)
returns jsonb language plpgsql set search_path = '' as $$
declare
  v_tabela text := case p_tipo when 'perfil' then 'perfis' when 'bm' then 'bms'
                     when 'conta' then 'contas_anuncio' when 'pagina' then 'paginas' end;
  v_antes text;
  v_res jsonb;
  n int;
begin
  if v_tabela is null then raise exception 'Este tipo de ativo não tem status.'; end if;
  v_antes := ops.status_ativo(p_tipo, p_id);
  if v_antes is null then raise exception 'Ativo não encontrado.'; end if;
  if p_tipo in ('bm', 'perfil') and ops.status_caido(p_status) and not ops.status_caido(v_antes) then
    v_res := ops.simular_queda(p_tipo, p_id);
  end if;
  perform set_config('ops.status_motivo', coalesce(p_motivo, ''), true);
  perform set_config('ops.status_data', coalesce(p_data::text, ''), true);
  execute format('update ops.%I set status = $1 where id = $2', v_tabela) using p_status, p_id;
  get diagnostics n = row_count;
  perform set_config('ops.status_motivo', '', true);
  perform set_config('ops.status_data', '', true);
  if n = 0 then raise exception 'Sem permissão para esta ação.' using errcode = '42501'; end if;
  return v_res;
end $$;

revoke execute on function ops.simular_queda(text, uuid) from public, anon;
revoke execute on function ops.mudar_status_ativo(text, uuid, text, text, date) from public, anon;
grant execute on function ops.simular_queda(text, uuid) to authenticated;
grant execute on function ops.mudar_status_ativo(text, uuid, text, text, date) to authenticated;
grant execute on function ops.status_caido(text) to authenticated;
grant execute on function ops.titular_caido(text, uuid) to authenticated;
grant execute on function ops.nome_ativo(text, uuid) to authenticated;
grant execute on function ops.status_ativo(text, uuid) to authenticated;

-- ---------------------------------------------------------------------
-- 7. BMs a partir do campo "BM" das contas que já existem
-- ---------------------------------------------------------------------
-- Cada nome diferente vira uma BM (ativa) e passa a ser a dona das contas que o usam.
-- Dá para renomear, completar (ID, fornecedor...) ou trocar a dona depois, na página Ativos.
insert into ops.bms (nome, status)
select distinct trim(bm_nome), 'ativa' from ops.contas_anuncio where nullif(trim(bm_nome), '') is not null;

insert into ops.acessos (conta_id, por_bm_id, papel, nivel, desde)
select c.id, b.id, 'dona', 'admin', (c.criado_em at time zone 'America/Sao_Paulo')::date
from ops.contas_anuncio c
join ops.bms b on b.nome = trim(c.bm_nome);

-- Conferência: quantas contas, BMs criadas e contas com BM dona.
select
  (select count(*) from ops.contas_anuncio) as contas,
  (select count(*) from ops.bms) as bms_criadas,
  (select count(*) from ops.acessos where papel = 'dona' and conta_id is not null) as contas_com_dona;
