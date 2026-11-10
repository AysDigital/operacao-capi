-- =====================================================================
-- 029: Contingência (etapa 12): rotinas de aquecimento, aquecimentos,
--      reserva mínima e base para a tela de quedas
-- =====================================================================
-- Princípio (pedido da usuária, 10/11/2026): a Contingência usa os ativos
-- que já existem, mas não muda nada sozinha. O sistema organiza, lembra e
-- avisa; quem muda status e coluna do quadro de uso é a usuária.
--
--   1. rotinas_aquecimento + rotinas_tarefas (dia vazio = todos os dias).
--      Começa vazia.
--   2. aquecimentos + aquecimento_tarefas. Ao iniciar, as tarefas da rotina
--      são copiadas (as de "todos os dias" viram uma por dia), então mudar a
--      rotina depois não altera aquecimentos em andamento.
--      Um ativo só tem um aquecimento em andamento por vez.
--   3. reserva_minima: quantos ativos prontos ter sempre, por tipo.
--   4. ativos_status_log.importacao: marca as linhas gravadas pelas
--      importações (019–026), que não são quedas de verdade.
-- Tudo dentro do schema ops.
-- =====================================================================

-- 1. Rotinas -------------------------------------------------------------
create table ops.rotinas_aquecimento (
  id uuid primary key default gen_random_uuid(),
  nome text not null check (length(trim(nome)) > 0),
  tipo text not null check (tipo in ('perfil', 'pagina', 'conta')),
  duracao_dias int not null check (duracao_dias between 1 and 365),
  ativa boolean not null default true,
  descricao text,
  criado_em timestamptz not null default now()
);

create table ops.rotinas_tarefas (
  id uuid primary key default gen_random_uuid(),
  rotina_id uuid not null references ops.rotinas_aquecimento on delete cascade,
  dia int check (dia >= 1),            -- vazio = todos os dias
  texto text not null check (length(trim(texto)) > 0),
  ordem double precision not null default 0,
  criado_em timestamptz not null default now()
);
create index on ops.rotinas_tarefas (rotina_id, dia, ordem);

-- 2. Aquecimentos --------------------------------------------------------
create table ops.aquecimentos (
  id uuid primary key default gen_random_uuid(),
  perfil_id uuid references ops.perfis on delete cascade,
  pagina_id uuid references ops.paginas on delete cascade,
  conta_id uuid references ops.contas_anuncio on delete cascade,
  ativo_tipo text generated always as (
    case when perfil_id is not null then 'perfil' when pagina_id is not null then 'pagina' else 'conta' end) stored,
  ativo_id uuid generated always as (coalesce(perfil_id, pagina_id, conta_id)) stored,
  rotina_id uuid references ops.rotinas_aquecimento on delete set null,
  rotina_nome text not null,           -- cópia: o nome continua mesmo se a rotina mudar ou sumir
  duracao_dias int not null check (duracao_dias >= 1),
  inicio date not null,
  status text not null default 'andamento' check (status in ('andamento', 'concluido', 'interrompido')),
  fim date,
  motivo text,                          -- quando interrompido
  observacoes text,
  criado_em timestamptz not null default now(),
  constraint aquecimentos_um_ativo check (num_nonnulls(perfil_id, pagina_id, conta_id) = 1)
);
create unique index aquecimentos_um_em_andamento on ops.aquecimentos (ativo_tipo, ativo_id) where status = 'andamento';
create index on ops.aquecimentos (status);

create table ops.aquecimento_tarefas (
  id uuid primary key default gen_random_uuid(),
  aquecimento_id uuid not null references ops.aquecimentos on delete cascade,
  dia int not null check (dia >= 1),
  texto text not null,
  diaria boolean not null default false,  -- veio de uma tarefa de "todos os dias"
  ordem double precision not null default 0,
  feito boolean not null default false,
  feito_em timestamptz
);
create index on ops.aquecimento_tarefas (aquecimento_id, dia, ordem);

-- 3. Reserva mínima ------------------------------------------------------
create table ops.reserva_minima (
  tipo text primary key check (tipo in ('perfil', 'pagina', 'conta')),
  minimo int not null default 0 check (minimo between 0 and 999)
);
insert into ops.reserva_minima (tipo, minimo) values ('perfil', 0), ('conta', 0), ('pagina', 0);

-- Segurança: só membros da equipe.
alter table ops.rotinas_aquecimento enable row level security;
alter table ops.rotinas_tarefas enable row level security;
alter table ops.aquecimentos enable row level security;
alter table ops.aquecimento_tarefas enable row level security;
alter table ops.reserva_minima enable row level security;
create policy membros_tudo on ops.rotinas_aquecimento for all to authenticated using (ops.is_membro()) with check (ops.is_membro());
create policy membros_tudo on ops.rotinas_tarefas for all to authenticated using (ops.is_membro()) with check (ops.is_membro());
create policy membros_tudo on ops.aquecimentos for all to authenticated using (ops.is_membro()) with check (ops.is_membro());
create policy membros_tudo on ops.aquecimento_tarefas for all to authenticated using (ops.is_membro()) with check (ops.is_membro());
create policy membros_tudo on ops.reserva_minima for all to authenticated using (ops.is_membro()) with check (ops.is_membro());

-- Inicia um aquecimento copiando as tarefas da rotina.
-- As tarefas de "todos os dias" viram uma por dia (1..duração), para marcar dia a dia.
create or replace function ops.iniciar_aquecimento(p_tipo text, p_id uuid, p_rotina uuid, p_inicio date)
returns uuid language plpgsql set search_path = '' as $$
declare
  v_rotina ops.rotinas_aquecimento;
  v_id uuid;
begin
  select * into v_rotina from ops.rotinas_aquecimento where id = p_rotina;
  if v_rotina.id is null then raise exception 'Rotina não encontrada.'; end if;
  if v_rotina.tipo <> p_tipo then raise exception 'Esta rotina é para outro tipo de ativo.'; end if;
  if exists (select 1 from ops.aquecimentos where ativo_tipo = p_tipo and ativo_id = p_id and status = 'andamento') then
    raise exception 'Este ativo já tem um aquecimento em andamento.';
  end if;

  insert into ops.aquecimentos (perfil_id, pagina_id, conta_id, rotina_id, rotina_nome, duracao_dias, inicio)
  values (case when p_tipo = 'perfil' then p_id end, case when p_tipo = 'pagina' then p_id end,
          case when p_tipo = 'conta' then p_id end, v_rotina.id, v_rotina.nome, v_rotina.duracao_dias,
          coalesce(p_inicio, (now() at time zone 'America/Sao_Paulo')::date))
  returning id into v_id;

  -- tarefas de dias específicos (até a duração)
  insert into ops.aquecimento_tarefas (aquecimento_id, dia, texto, diaria, ordem)
  select v_id, t.dia, t.texto, false, t.ordem
  from ops.rotinas_tarefas t
  where t.rotina_id = v_rotina.id and t.dia is not null and t.dia <= v_rotina.duracao_dias;

  -- tarefas de todos os dias: uma por dia, antes das específicas
  insert into ops.aquecimento_tarefas (aquecimento_id, dia, texto, diaria, ordem)
  select v_id, d, t.texto, true, t.ordem - 1e9
  from ops.rotinas_tarefas t
  cross join generate_series(1, v_rotina.duracao_dias) as d
  where t.rotina_id = v_rotina.id and t.dia is null;

  return v_id;
end $$;

revoke execute on function ops.iniciar_aquecimento(text, uuid, uuid, date) from public, anon;
grant execute on function ops.iniciar_aquecimento(text, uuid, uuid, date) to authenticated;

-- 4. Histórico: separar o que veio das importações -----------------------
alter table ops.ativos_status_log add column importacao boolean not null default false;
update ops.ativos_status_log set importacao = true
where motivo in (
  'Situação quando o inventário começou',
  'Inventário de 10/11/2026 (documento Ativos de contingência)',
  'Acesso perdido (inventário de 10/11/2026)',
  'Planilha Organização-contas-Facebook (10/11/2026)'
);

-- Conferência: tabelas novas vazias, reserva com 3 tipos e quantas linhas
-- do histórico ficaram marcadas como importação.
select
  (select count(*) from ops.rotinas_aquecimento) as rotinas,
  (select count(*) from ops.aquecimentos) as aquecimentos,
  (select count(*) from ops.reserva_minima) as tipos_na_reserva,
  (select count(*) from ops.ativos_status_log where importacao) as historico_de_importacao,
  (select count(*) from ops.ativos_status_log where not importacao) as historico_real;
