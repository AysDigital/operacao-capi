-- =====================================================================
-- 020: queda manual
-- =====================================================================
-- Pedido da usuária (10/11/2026): quando uma BM ou perfil cai, o sistema
-- NÃO mexe em mais nada. Ela marca à mão o que mais caiu junto.
--
--   1. ops.ativos_log_status só registra o histórico de status
--      (não inativa mais os acessos da BM/perfil que caiu).
--   2. ops.mudar_status_ativo só muda o status com motivo e data
--      (não simula mais a queda; devolve sempre null).
--
-- O "E se cair?" (ops.simular_queda) continua igual: só mostra, não muda nada.
-- Tudo dentro do schema ops.
-- =====================================================================

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
  return null;
end $$;

create or replace function ops.mudar_status_ativo(p_tipo text, p_id uuid, p_status text, p_motivo text, p_data date)
returns jsonb language plpgsql set search_path = '' as $$
declare
  v_tabela text := case p_tipo when 'perfil' then 'perfis' when 'bm' then 'bms'
                     when 'conta' then 'contas_anuncio' when 'pagina' then 'paginas' end;
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

-- Conferência: deve mostrar false (a função não mexe mais em acessos).
select position('ops.acessos' in pg_get_functiondef('ops.ativos_log_status'::regproc)) > 0 as ainda_mexe_em_acessos;
