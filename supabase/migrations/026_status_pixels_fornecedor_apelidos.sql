-- =====================================================================
-- 026: status dos pixels, fornecedor/origem dos perfis, apelidos das contas
-- =====================================================================
-- Pedidos da usuária (10/11/2026):
--   1. Pixels ganham status (ativo / desativado), para separar ativos e
--      desativados na página Ativos. Quem tinha "Desativado no Meta" na
--      observação vira desativado. O status entra no histórico como os outros.
--   2. Perfis Henrique, Cecília e Nina: fornecedor BW Digital, origem comprado.
--      Os demais: origem própria ("Pessoal").
--   3. Apelido das contas = AC + número da conta + 3 letras da BM dona.
--      Ex.: "CONTA 01 - BM 01 - Luciano Peters" → AC01LUC.
--      Se a BM não for a 01, o número dela vai no fim (BM 02 - Viewy → AC01VIE2),
--      para não repetir apelido entre BMs com o mesmo nome.
-- Tudo dentro do schema ops. Tudo num bloco só: se algo não bater, nada é gravado.
-- =====================================================================

-- 1. Status dos pixels ----------------------------------------------------
alter table ops.pixels
  add column status text not null default 'ativo' check (status in ('ativo', 'desativado'));

update ops.pixels set
  status = case when observacoes ilike '%Desativado no Meta%' then 'desativado' else 'ativo' end,
  observacoes = nullif(btrim(regexp_replace(coalesce(observacoes, ''), '\s*Desativado no Meta\.?\s*', ' ', 'gi')), '');

alter table ops.ativos_status_log drop constraint ativos_status_log_ativo_tipo_check;
alter table ops.ativos_status_log add constraint ativos_status_log_ativo_tipo_check
  check (ativo_tipo in ('perfil', 'bm', 'conta', 'pagina', 'pixel'));

create or replace function ops.status_caido(p_status text) returns boolean
language sql immutable set search_path = '' as $$
  select p_status in ('checkpoint', 'restrito', 'morto', 'restrita', 'desativada', 'desativado');
$$;

create or replace function ops.status_ativo(p_tipo text, p_id uuid) returns text
language sql stable set search_path = '' as $$
  select case p_tipo
    when 'perfil' then (select status from ops.perfis where id = p_id)
    when 'bm' then (select status from ops.bms where id = p_id)
    when 'conta' then (select status from ops.contas_anuncio where id = p_id)
    when 'pagina' then (select status from ops.paginas where id = p_id)
    when 'pixel' then (select status from ops.pixels where id = p_id) end;
$$;

create or replace function ops.ativos_log_status() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_tipo text := case tg_table_name when 'perfis' then 'perfil' when 'bms' then 'bm'
                   when 'contas_anuncio' then 'conta' when 'paginas' then 'pagina' when 'pixels' then 'pixel' end;
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
  return null;
end $$;

create or replace function ops.ativos_apagar_log() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  delete from ops.ativos_status_log
  where ativo_id = old.id
    and ativo_tipo = case tg_table_name when 'perfis' then 'perfil' when 'bms' then 'bm'
                       when 'contas_anuncio' then 'conta' when 'paginas' then 'pagina' when 'pixels' then 'pixel' end;
  return null;
end $$;

create or replace function ops.mudar_status_ativo(p_tipo text, p_id uuid, p_status text, p_motivo text, p_data date)
returns jsonb language plpgsql set search_path = '' as $$
declare
  v_tabela text := case p_tipo when 'perfil' then 'perfis' when 'bm' then 'bms'
                     when 'conta' then 'contas_anuncio' when 'pagina' then 'paginas' when 'pixel' then 'pixels' end;
  n int;
begin
  if v_tabela is null then raise exception 'Este tipo de ativo não tem status.'; end if;
  if ops.status_ativo(p_tipo, p_id) is null then raise exception 'Ativo não encontrado.'; end if;
  perform set_config('ops.status_motivo', coalesce(p_motivo, ''), true);
  perform set_config('ops.status_data', coalesce(p_data::text, ''), true);
  execute format('update ops.%I set status = $1 where id = $2', v_tabela) using p_status, p_id;
  get diagnostics n = row_count;
  perform set_config('ops.status_motivo', '', true);
  perform set_config('ops.status_data', '', true);
  if n = 0 then raise exception 'Sem permissão para esta ação.' using errcode = '42501'; end if;
  return null;
end $$;

create trigger pixels_log_status after insert or update of status on ops.pixels
  for each row execute function ops.ativos_log_status();
create trigger pixels_apagar_log after delete on ops.pixels
  for each row execute function ops.ativos_apagar_log();

insert into ops.ativos_status_log (ativo_tipo, ativo_id, de, para, data, motivo)
select 'pixel', id, null, status, criado_em, 'Situação quando o inventário começou'
from ops.pixels;

-- 2 e 3. Fornecedor/origem dos perfis e apelidos das contas ---------------
do $do$
declare
  v_forn uuid;
  v_problemas text;
  v_lista jsonb;
  n int;
begin
  -- Fornecedor BW Digital (cadastrado pela usuária).
  select count(*) into n from ops.fornecedores where nome ilike '%bw digital%';
  if n <> 1 then raise exception 'Esperava achar 1 fornecedor "BW Digital", achei %.', n; end if;
  select id into v_forn from ops.fornecedores where nome ilike '%bw digital%';

  update ops.perfis set fornecedor_id = v_forn, origem = 'comprado' where nome in ('Henrique', 'Cecília', 'Nina');
  get diagnostics n = row_count;
  if n <> 3 then raise exception 'Esperava 3 perfis comprados (Henrique, Cecília, Nina), achei %.', n; end if;
  update ops.perfis set origem = 'proprio' where fornecedor_id is null and origem is null;

  -- Apelidos novos (calculados numa lista em memória, sem criar tabela).
  with base as (
    select c.id, c.apelido as antigo, c.nome, b.nome as bm,
      lpad(substring(c.nome from '(?i)(?:conta|ca)\s*0*(\d+)'), 2, '0') as num,
      left(translate(upper(btrim(regexp_replace(b.nome, '^\s*BM\s*\d+\s*-\s*', '', 'i'))),
                     'ÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ', 'AAAAAEEEEIIIIOOOOOUUUUC'), 3) as sigla,
      substring(b.nome from '(?i)BM\s*0*(\d+)')::int as num_bm
    from ops.contas_anuncio c
    left join ops.acessos a on a.conta_id = c.id and a.papel = 'dona' and a.ativo
    left join ops.bms b on b.id = a.por_bm_id
  )
  select jsonb_agg(jsonb_build_object(
    'id', id, 'antigo', antigo, 'nome', nome, 'bm', bm,
    'novo', 'AC' || num || sigla || case when num_bm is distinct from 1 then coalesce(num_bm::text, '') else '' end))
  into v_lista
  from base;

  select string_agg(x.antigo || ' (' || x.nome || ' / ' || coalesce(x.bm, 'sem BM dona') || ')', '; ')
  into v_problemas
  from jsonb_to_recordset(v_lista) as x(id uuid, antigo text, nome text, bm text, novo text)
  where x.novo is null;
  if v_problemas is not null then raise exception 'Não consegui montar o apelido de: %', v_problemas; end if;

  select string_agg(d.novo, ', ') into v_problemas
  from (select x.novo from jsonb_to_recordset(v_lista) as x(novo text) group by x.novo having count(*) > 1) d;
  if v_problemas is not null then raise exception 'Apelidos repetidos: %', v_problemas; end if;

  -- Em duas etapas, para não esbarrar na regra de apelido único no meio da troca.
  update ops.contas_anuncio c set apelido = 'TMP-' || c.id::text;
  update ops.contas_anuncio c set apelido = x.novo
  from jsonb_to_recordset(v_lista) as x(id uuid, novo text)
  where x.id = c.id;
end
$do$;

-- Conferência: a lista de contas com o apelido novo.
select apelido, nome, bm_nome, status from ops.contas_anuncio order by apelido;
