-- =====================================================================
-- Operação Capi — Migration 036: quadro de uso das contas ↔ aquecimento
-- Rodar UMA vez no SQL Editor do Supabase. Só mexe no schema ops.
--
-- Pedido da usuária (13/11/2026):
--   1. Conta colocada na coluna "Aquecimento" do quadro de uso → entra no
--      aquecimento (Dia 1) da Contingência com o roteiro padrão de conta.
--   2. Conta que entra no aquecimento pela Contingência (cadastro novo,
--      "Precisa aquecer", "Iniciar aquecimento") → vai para a coluna
--      "Aquecimento" do quadro de uso. Quando o aquecimento conclui, ela
--      passa para "Sem uso" (pronta para usar).
-- Tirar a conta da coluna "Aquecimento" não mexe no aquecimento em andamento.
-- =====================================================================

-- 1. Coluna "Aquecimento" → começa o aquecimento --------------------------------
create or replace function ops.contas_uso_aquecer() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_rotina uuid;
begin
  if new.uso = 'aquecimento' and old.uso is distinct from 'aquecimento'
     and new.status = 'ativa'
     and not exists (select 1 from ops.aquecimentos a where a.conta_id = new.id and a.status = 'andamento') then
    select id into v_rotina from ops.rotinas_aquecimento where tipo = 'conta' and padrao and ativa;
    if v_rotina is not null then
      perform ops.iniciar_aquecimento('conta', new.id, v_rotina, null);
    end if;
  end if;
  return null;
end $$;

create trigger contas_uso_aquecer after update of uso on ops.contas_anuncio
  for each row execute function ops.contas_uso_aquecer();

revoke execute on function ops.contas_uso_aquecer() from public, anon, authenticated;

-- 2. Aquecimento → coluna do quadro de uso (igual à 032, mais o bloco "conta") ----
create or replace function ops.aquecimentos_sincronizar() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  r record;
  v_novo text;
  v_tabela text;
begin
  if tg_op = 'DELETE' then r := old; else r := new; end if;
  v_tabela := case r.ativo_tipo when 'perfil' then 'perfis' when 'bm' then 'bms'
                when 'conta' then 'contas_anuncio' when 'pagina' then 'paginas' end;

  if exists (select 1 from ops.aquecimentos a where a.ativo_tipo = r.ativo_tipo and a.ativo_id = r.ativo_id and a.status = 'andamento') then
    v_novo := 'aquecendo';
  elsif tg_op <> 'DELETE' and new.status = 'concluido' then
    v_novo := 'pronto';
  elsif (tg_op = 'DELETE' and old.status = 'andamento') or (tg_op = 'UPDATE' and new.status = 'interrompido') then
    v_novo := 'a_classificar';
  end if;
  if v_novo is not null then
    execute format('update ops.%I set aquecimento = $1 where id = $2 and aquecimento <> $1', v_tabela) using v_novo, r.ativo_id;
  end if;

  -- conta: o quadro de uso acompanha o aquecimento (036)
  if r.ativo_tipo = 'conta' then
    if v_novo = 'aquecendo' then
      update ops.contas_anuncio
         set uso = 'aquecimento', uso_desde = (now() at time zone 'America/Sao_Paulo')::date, uso_oferta_id = null,
             uso_posicao = extract(epoch from now()) * 1000
       where id = r.ativo_id and uso <> 'aquecimento';
    elsif tg_op = 'UPDATE' and new.status = 'concluido' and old.status = 'andamento' then
      update ops.contas_anuncio
         set uso = 'parada', uso_desde = (now() at time zone 'America/Sao_Paulo')::date,
             uso_posicao = extract(epoch from now()) * 1000
       where id = r.ativo_id and uso = 'aquecimento';
    end if;
  end if;

  -- perfil com status "Aquecendo" passa a "Pronto" quando o aquecimento conclui
  if tg_op = 'UPDATE' and r.ativo_tipo = 'perfil' and new.status = 'concluido' and old.status = 'andamento'
     and exists (select 1 from ops.perfis p where p.id = r.ativo_id and p.status = 'aquecendo') then
    perform set_config('ops.status_motivo', 'Aquecimento concluído (' || r.rotina_nome || ')', true);
    update ops.perfis set status = 'pronto' where id = r.ativo_id;
    perform set_config('ops.status_motivo', '', true);
  end if;
  return null;
end $$;

-- 3. Contas que já estão aquecendo vão para a coluna "Aquecimento" ---------------
update ops.contas_anuncio c
   set uso = 'aquecimento', uso_desde = coalesce(c.uso_desde, (now() at time zone 'America/Sao_Paulo')::date)
 where c.uso <> 'aquecimento'
   and exists (select 1 from ops.aquecimentos a where a.conta_id = c.id and a.status = 'andamento');

-- Conferência: contas na coluna Aquecimento com e sem aquecimento em andamento.
select count(*) filter (where exists (select 1 from ops.aquecimentos a where a.conta_id = c.id and a.status = 'andamento')) as na_coluna_e_aquecendo,
       count(*) filter (where not exists (select 1 from ops.aquecimentos a where a.conta_id = c.id and a.status = 'andamento')) as na_coluna_sem_aquecimento
from ops.contas_anuncio c
where c.uso = 'aquecimento';
