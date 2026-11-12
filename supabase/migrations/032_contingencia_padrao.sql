-- =====================================================================
-- Operação Capi — Migration 032: Contingência padronizada
-- Rodar UMA vez no SQL Editor do Supabase. Só mexe no schema ops.
--
-- Pedido da usuária (12/11/2026): a contingência é um processo padrão.
--   1. Um roteiro padrão por tipo (perfil, BM, conta, página), já com as
--      tarefas de cada dia (texto aprovado por ela).
--   2. Cadastrou um ativo em Ativos → ele entra sozinho no aquecimento,
--      no Dia 1, com o roteiro padrão do tipo.
--   3. Marcou todas as tarefas → o aquecimento conclui sozinho e o ativo
--      fica "Pronto". Desmarcar uma tarefa reabre.
--   4. Cada perfil/BM/conta/página ganha a coluna "aquecimento":
--      a_classificar | aquecendo | pronto. Os que já existem começam em
--      a_classificar (ela escolhe um por um no app), menos os que já têm
--      aquecimento (em andamento → aquecendo; concluído → pronto).
--   5. BM passa a ter aquecimento e reserva mínima.
-- =====================================================================

-- 1. BM nos aquecimentos ---------------------------------------------------
drop index if exists ops.aquecimentos_um_em_andamento;
alter table ops.aquecimentos drop constraint aquecimentos_um_ativo;
alter table ops.aquecimentos drop column ativo_tipo, drop column ativo_id;
alter table ops.aquecimentos add column bm_id uuid references ops.bms on delete cascade;
alter table ops.aquecimentos add column ativo_tipo text generated always as (
  case when perfil_id is not null then 'perfil' when bm_id is not null then 'bm'
       when pagina_id is not null then 'pagina' else 'conta' end) stored;
alter table ops.aquecimentos add column ativo_id uuid generated always as (coalesce(perfil_id, bm_id, pagina_id, conta_id)) stored;
alter table ops.aquecimentos add constraint aquecimentos_um_ativo check (num_nonnulls(perfil_id, bm_id, pagina_id, conta_id) = 1);
create unique index aquecimentos_um_em_andamento on ops.aquecimentos (ativo_tipo, ativo_id) where status = 'andamento';

alter table ops.rotinas_aquecimento drop constraint rotinas_aquecimento_tipo_check;
alter table ops.rotinas_aquecimento add constraint rotinas_aquecimento_tipo_check check (tipo in ('perfil', 'bm', 'pagina', 'conta'));
alter table ops.reserva_minima drop constraint reserva_minima_tipo_check;
alter table ops.reserva_minima add constraint reserva_minima_tipo_check check (tipo in ('perfil', 'bm', 'pagina', 'conta'));
insert into ops.reserva_minima (tipo, minimo) values ('bm', 0) on conflict (tipo) do nothing;

-- 2. Roteiro padrão: um por tipo ------------------------------------------
alter table ops.rotinas_aquecimento add column padrao boolean not null default false;
create unique index rotinas_um_padrao_por_tipo on ops.rotinas_aquecimento (tipo) where padrao;

-- 3. Situação do aquecimento em cada ativo --------------------------------
alter table ops.perfis add column aquecimento text not null default 'a_classificar'
  check (aquecimento in ('a_classificar', 'aquecendo', 'pronto'));
alter table ops.bms add column aquecimento text not null default 'a_classificar'
  check (aquecimento in ('a_classificar', 'aquecendo', 'pronto'));
alter table ops.contas_anuncio add column aquecimento text not null default 'a_classificar'
  check (aquecimento in ('a_classificar', 'aquecendo', 'pronto'));
alter table ops.paginas add column aquecimento text not null default 'a_classificar'
  check (aquecimento in ('a_classificar', 'aquecendo', 'pronto'));

-- 4. Iniciar aquecimento (igual à 029, agora com BM) -----------------------
create or replace function ops.iniciar_aquecimento(p_tipo text, p_id uuid, p_rotina uuid, p_inicio date)
returns uuid language plpgsql set search_path = '' as $$
declare
  v_rotina ops.rotinas_aquecimento;
  v_id uuid;
begin
  select * into v_rotina from ops.rotinas_aquecimento where id = p_rotina;
  if v_rotina.id is null then raise exception 'Roteiro não encontrado.'; end if;
  if v_rotina.tipo <> p_tipo then raise exception 'Este roteiro é para outro tipo de ativo.'; end if;
  if exists (select 1 from ops.aquecimentos where ativo_tipo = p_tipo and ativo_id = p_id and status = 'andamento') then
    raise exception 'Este ativo já tem um aquecimento em andamento.';
  end if;

  insert into ops.aquecimentos (perfil_id, bm_id, pagina_id, conta_id, rotina_id, rotina_nome, duracao_dias, inicio)
  values (case when p_tipo = 'perfil' then p_id end, case when p_tipo = 'bm' then p_id end,
          case when p_tipo = 'pagina' then p_id end, case when p_tipo = 'conta' then p_id end,
          v_rotina.id, v_rotina.nome, v_rotina.duracao_dias,
          coalesce(p_inicio, (now() at time zone 'America/Sao_Paulo')::date))
  returning id into v_id;

  insert into ops.aquecimento_tarefas (aquecimento_id, dia, texto, diaria, ordem)
  select v_id, t.dia, t.texto, false, t.ordem
  from ops.rotinas_tarefas t
  where t.rotina_id = v_rotina.id and t.dia is not null and t.dia <= v_rotina.duracao_dias;

  insert into ops.aquecimento_tarefas (aquecimento_id, dia, texto, diaria, ordem)
  select v_id, d, t.texto, true, t.ordem - 1e9
  from ops.rotinas_tarefas t
  cross join generate_series(1, v_rotina.duracao_dias) as d
  where t.rotina_id = v_rotina.id and t.dia is null;

  return v_id;
end $$;

-- Mandar vários ativos de um tipo para o aquecimento com o roteiro padrão.
create or replace function ops.aquecer_com_padrao(p_tipo text, p_ids uuid[])
returns int language plpgsql set search_path = '' as $$
declare
  v_rotina uuid;
  v_id uuid;
  n int := 0;
begin
  select id into v_rotina from ops.rotinas_aquecimento where tipo = p_tipo and padrao and ativa;
  if v_rotina is null then raise exception 'Não há roteiro padrão ativo para este tipo de ativo.'; end if;
  foreach v_id in array p_ids loop
    if not exists (select 1 from ops.aquecimentos where ativo_tipo = p_tipo and ativo_id = v_id and status = 'andamento') then
      perform ops.iniciar_aquecimento(p_tipo, v_id, v_rotina, null);
      n := n + 1;
    end if;
  end loop;
  return n;
end $$;

revoke execute on function ops.aquecer_com_padrao(text, uuid[]) from public, anon;
grant execute on function ops.aquecer_com_padrao(text, uuid[]) to authenticated;

-- 5. Cadastrou → entra no aquecimento --------------------------------------
create or replace function ops.aquecer_ao_cadastrar() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_tipo text := case tg_table_name when 'perfis' then 'perfil' when 'bms' then 'bm'
                   when 'contas_anuncio' then 'conta' when 'paginas' then 'pagina' end;
  v_rotina uuid;
begin
  if new.aquecimento <> 'a_classificar' then return null; end if;   -- já veio como pronto
  if new.status in ('checkpoint', 'restrito', 'morto', 'restrita', 'desativada') then return null; end if;
  select id into v_rotina from ops.rotinas_aquecimento where tipo = v_tipo and padrao and ativa;
  if v_rotina is not null then
    perform ops.iniciar_aquecimento(v_tipo, new.id, v_rotina, null);
  end if;
  return null;
end $$;

create trigger aquecer_ao_cadastrar after insert on ops.perfis for each row execute function ops.aquecer_ao_cadastrar();
create trigger aquecer_ao_cadastrar after insert on ops.bms for each row execute function ops.aquecer_ao_cadastrar();
create trigger aquecer_ao_cadastrar after insert on ops.contas_anuncio for each row execute function ops.aquecer_ao_cadastrar();
create trigger aquecer_ao_cadastrar after insert on ops.paginas for each row execute function ops.aquecer_ao_cadastrar();

-- 6. Aquecimento → situação do ativo ---------------------------------------
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

  -- perfil com status "Aquecendo" passa a "Pronto" quando o aquecimento conclui
  if tg_op = 'UPDATE' and r.ativo_tipo = 'perfil' and new.status = 'concluido' and old.status = 'andamento'
     and exists (select 1 from ops.perfis p where p.id = r.ativo_id and p.status = 'aquecendo') then
    perform set_config('ops.status_motivo', 'Aquecimento concluído (' || r.rotina_nome || ')', true);
    update ops.perfis set status = 'pronto' where id = r.ativo_id;
    perform set_config('ops.status_motivo', '', true);
  end if;
  return null;
end $$;

create trigger aquecimentos_sincronizar after insert or update of status or delete on ops.aquecimentos
  for each row execute function ops.aquecimentos_sincronizar();

-- 7. Checklist completo → concluído (e desmarcar reabre) --------------------
create or replace function ops.aquecimento_tarefas_conferir() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_aq uuid := coalesce(new.aquecimento_id, old.aquecimento_id);
  v_status text;
  v_falta boolean;
begin
  select status into v_status from ops.aquecimentos where id = v_aq;
  if v_status is null or v_status = 'interrompido' then return null; end if;
  v_falta := exists (select 1 from ops.aquecimento_tarefas where aquecimento_id = v_aq and not feito);
  if v_status = 'andamento' and not v_falta then
    update ops.aquecimentos set status = 'concluido', fim = (now() at time zone 'America/Sao_Paulo')::date where id = v_aq;
  elsif v_status = 'concluido' and v_falta then
    update ops.aquecimentos set status = 'andamento', fim = null where id = v_aq;
  end if;
  return null;
end $$;

create trigger aquecimento_tarefas_conferir after update of feito or delete on ops.aquecimento_tarefas
  for each row execute function ops.aquecimento_tarefas_conferir();

revoke execute on function ops.aquecer_ao_cadastrar() from public, anon, authenticated;
revoke execute on function ops.aquecimentos_sincronizar() from public, anon, authenticated;
revoke execute on function ops.aquecimento_tarefas_conferir() from public, anon, authenticated;

-- 8. Roteiros padrão (texto aprovado pela usuária em 12/11/2026) -------------
do $$
declare
  v uuid;
  int_perfil text := 'Interação natural: curtir posts, comentar com naturalidade e compartilhar 1 ou 2 publicações';
begin
  if exists (select 1 from ops.rotinas_aquecimento where padrao) then
    raise exception 'Já existe roteiro padrão: esta migration já rodou?';
  end if;

  insert into ops.rotinas_aquecimento (nome, tipo, duracao_dias, padrao) values ('Perfil padrão', 'perfil', 7, true) returning id into v;
  insert into ops.rotinas_tarefas (rotina_id, dia, texto, ordem) values
    (v, null, 'Entrar no perfil e ver se apareceu algum aviso ou bloqueio', 1),
    (v, 1, 'Conferir o login e trocar a senha', 1),
    (v, 1, 'Ativar a autenticação de dois fatores', 2),
    (v, 1, 'Trocar o e-mail e o telefone de recuperação', 3),
    (v, 1, int_perfil, 4),
    (v, 2, int_perfil, 1),
    (v, 3, 'Fazer uma publicação pessoal', 1),
    (v, 3, int_perfil, 2),
    (v, 4, int_perfil, 1),
    (v, 5, 'Entrar na BM, criando uma nova ou aceitando um convite', 1),
    (v, 6, int_perfil, 1),
    (v, 7, int_perfil, 1);

  insert into ops.rotinas_aquecimento (nome, tipo, duracao_dias, padrao) values ('BM padrão', 'bm', 5, true) returning id into v;
  insert into ops.rotinas_tarefas (rotina_id, dia, texto, ordem) values
    (v, null, 'Entrar na BM e ver se apareceu algum aviso', 1),
    (v, 1, 'Adicionar ao menos 3 administradores', 1),
    (v, 1, 'Não mexer em mais nada por pelo menos 12 horas', 2),
    (v, 2, 'Preencher os dados da empresa', 1),
    (v, 2, 'Adicionar e-mail e telefone', 2),
    (v, 2, 'Adicionar parceiros e compartilhar ativos', 3),
    (v, 3, 'Adicionar a forma de pagamento', 1),
    (v, 3, 'Conectar a página e o pixel', 2),
    (v, 4, 'Ver se a Qualidade da conta da BM está sem restrições', 1),
    (v, 5, 'Conferir o limite de gasto e se há alguma restrição', 1),
    (v, 5, 'Se foi liberado, criar mais contas até o limite máximo', 2);

  insert into ops.rotinas_aquecimento (nome, tipo, duracao_dias, padrao) values ('Conta padrão', 'conta', 7, true) returning id into v;
  insert into ops.rotinas_tarefas (rotina_id, dia, texto, ordem) values
    (v, null, 'Ver se há avisos ou anúncios rejeitados', 1),
    (v, 1, 'Conferir a moeda, o fuso e o nome', 1),
    (v, 1, 'Colocar o cartão', 2),
    (v, 1, 'Definir o limite de gasto da conta', 3),
    (v, 2, 'Ligar a página e o pixel', 1),
    (v, 2, 'Subir uma campanha de aquecimento com orçamento baixo', 2),
    (v, 3, 'Acompanhar a campanha de aquecimento', 1),
    (v, 4, 'Acompanhar a campanha de aquecimento', 1),
    (v, 5, 'Acompanhar a campanha de aquecimento', 1),
    (v, 5, 'Confirmar que a primeira cobrança foi paga', 2),
    (v, 6, 'Aumentar o orçamento aos poucos', 1),
    (v, 7, 'Confirmar que não há restrição', 1),
    (v, 7, 'Conferir o limite diário', 2);

  insert into ops.rotinas_aquecimento (nome, tipo, duracao_dias, padrao) values ('Página padrão', 'pagina', 7, true) returning id into v;
  insert into ops.rotinas_tarefas (rotina_id, dia, texto, ordem) values
    (v, 1, 'Colocar foto, capa, descrição e categoria', 1),
    (v, 1, 'Ligar a página à BM', 2),
    (v, 2, 'Fazer 2 ou 3 publicações', 1),
    (v, 2, 'Interações naturais', 2),
    (v, 3, 'Ver se a Qualidade da página está sem restrições', 1),
    (v, 3, 'Fazer 2 ou 3 publicações', 2),
    (v, 3, 'Interações naturais', 3),
    (v, 4, 'Fazer 2 ou 3 publicações', 1),
    (v, 4, 'Interações naturais', 2),
    (v, 5, 'Fazer 2 ou 3 publicações', 1),
    (v, 5, 'Interações naturais', 2),
    (v, 6, 'Fazer 2 ou 3 publicações', 1),
    (v, 6, 'Interações naturais', 2);

  -- aquecimentos que já existiam definem a situação dos ativos deles
  update ops.perfis x set aquecimento = case when exists (select 1 from ops.aquecimentos a where a.perfil_id = x.id and a.status = 'andamento') then 'aquecendo' else 'pronto' end
   where exists (select 1 from ops.aquecimentos a where a.perfil_id = x.id and a.status in ('andamento', 'concluido'));
  update ops.contas_anuncio x set aquecimento = case when exists (select 1 from ops.aquecimentos a where a.conta_id = x.id and a.status = 'andamento') then 'aquecendo' else 'pronto' end
   where exists (select 1 from ops.aquecimentos a where a.conta_id = x.id and a.status in ('andamento', 'concluido'));
  update ops.paginas x set aquecimento = case when exists (select 1 from ops.aquecimentos a where a.pagina_id = x.id and a.status = 'andamento') then 'aquecendo' else 'pronto' end
   where exists (select 1 from ops.aquecimentos a where a.pagina_id = x.id and a.status in ('andamento', 'concluido'));
end $$;

-- Conferência: 4 roteiros padrão com as tarefas e quantos ativos estão a classificar.
select r.tipo, r.nome, r.duracao_dias, count(t.id) as tarefas,
       case r.tipo when 'perfil' then (select count(*) from ops.perfis where aquecimento = 'a_classificar')
                   when 'bm' then (select count(*) from ops.bms where aquecimento = 'a_classificar')
                   when 'conta' then (select count(*) from ops.contas_anuncio where aquecimento = 'a_classificar')
                   else (select count(*) from ops.paginas where aquecimento = 'a_classificar') end as a_classificar
from ops.rotinas_aquecimento r
left join ops.rotinas_tarefas t on t.rotina_id = r.id
where r.padrao
group by r.tipo, r.nome, r.duracao_dias
order by r.tipo;
