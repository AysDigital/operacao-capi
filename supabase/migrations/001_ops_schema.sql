-- =====================================================================
-- Operação Capi — Migration 001: schema ops, tabelas, gatilhos, dados iniciais e segurança
-- Rodar UMA vez no SQL Editor do Supabase (o mesmo projeto do financeiro e do dashboard).
-- Não altera nada fora do schema ops.
-- DEPOIS DE RODAR: cadastre os membros manualmente no SQL Editor (ver seção 12).
-- =====================================================================

create schema if not exists ops;

-- ---------------------------------------------------------------------
-- 1. Membros da equipe (quem pode usar o app)
-- ---------------------------------------------------------------------
-- O projeto Supabase é compartilhado com o dashboard: estar logado não basta,
-- o usuário precisa estar nesta lista. Também guarda o nome que aparece nos cards.
create table ops.membros (
  user_id uuid primary key references auth.users on delete cascade,
  nome text not null,
  cor text,
  ativo boolean not null default true,
  criado_em timestamptz not null default now()
);

create or replace function ops.is_membro() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from ops.membros where user_id = auth.uid() and ativo);
$$;

-- ---------------------------------------------------------------------
-- 2. Ofertas e contas de anúncio
-- ---------------------------------------------------------------------
create table ops.ofertas (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  codigo text not null check (codigo ~ '^[A-Z0-9]{1,8}$'),   -- sigla curta, ex.: PC
  idioma text not null check (idioma in ('EN','ES','FR','IT','PT')),
  cor text,
  status text not null default 'em_producao'
    check (status in ('em_producao','testando','validada','escalando','saturando','pausada')),
  criado_em timestamptz not null default now(),
  unique (codigo, idioma)
);

create table ops.contas_anuncio (
  id uuid primary key default gen_random_uuid(),
  nome text not null,                          -- ex.: Conta 01
  apelido text not null unique,                -- ex.: C1
  bm_nome text,                                -- ex.: BM Mayarah
  meta_ad_account_id text unique,              -- só os números (sem "act_")
  ativa boolean not null default true,
  criado_em timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 3. Listas (as mesmas colunas em todos os quadros)
-- ---------------------------------------------------------------------
create table ops.listas (
  id uuid primary key default gen_random_uuid(),
  nome text not null unique,
  ordem int not null,
  cor text
);

insert into ops.listas (nome, ordem, cor) values
  ('Standby',              1, '#a9a49a'),
  ('Criação',              2, '#3d8fdb'),
  ('Revisão [Copy]',       3, '#6a5acd'),
  ('Aguardando edição',    4, '#ffd23f'),
  ('Em edição',            5, '#b07a3e'),
  ('Em ajuste [Edição]',   6, '#d55181'),
  ('Revisão [Edição]',     7, '#6a5acd'),
  ('Pronto pra subir',     8, '#17b890'),
  ('Em veiculação',        9, '#0e8a6b'),
  ('Rejeitado',           10, '#c0352b');

-- ---------------------------------------------------------------------
-- 4. Cards
-- ---------------------------------------------------------------------
-- Ads: o nome é gerado sozinho no padrão CODIGO-IDIOMA-AD{n}-H{n}-M{n}-FORMATO
-- (ex.: PC-FR-AD1-H1-M2-VD). Essa nomenclatura é só interna, para organizar as
-- versões; as métricas casam pelo meta_ad_id das veiculações (seção 7).
-- VSL e outro: título livre.
create table ops.cards (
  id uuid primary key default gen_random_uuid(),
  oferta_id uuid not null references ops.ofertas on delete restrict,
  lista_id uuid not null references ops.listas on delete restrict,
  posicao double precision not null,           -- ordem dentro da lista; preenchida sozinha no fim se vier vazia
  tipo text not null default 'ad' check (tipo in ('ad','vsl','outro')),
  formato text check (formato ~ '^[A-Z0-9]{1,8}$'),   -- VD, IMG, CAR...
  ad_num int check (ad_num > 0),
  hook_num int check (hook_num > 0),
  var_num int check (var_num > 0),
  nome text not null check (length(nome) > 0),
  descricao text,
  parent_card_id uuid references ops.cards on delete set null,   -- versão de origem
  motivo_versao text,
  vencedor boolean not null default false,
  arquivado boolean not null default false,
  criado_por uuid references ops.membros on delete set null default auth.uid(),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  constraint cards_ad_completo check (
    tipo <> 'ad' or (ad_num is not null and hook_num is not null and var_num is not null and formato is not null)
  ),
  constraint cards_versao_de_si_mesmo check (parent_card_id is null or parent_card_id <> id)
);

-- Nunca dois ads com o mesmo AD/H/M na mesma oferta (arquivados também contam).
create unique index cards_ad_unico on ops.cards (oferta_id, ad_num, hook_num, var_num) where tipo = 'ad';
create index on ops.cards (oferta_id, lista_id, posicao);
create index on ops.cards (parent_card_id);

create or replace function ops.cards_preparar() returns trigger
language plpgsql set search_path = '' as $$
declare
  o record;
begin
  new.formato := upper(nullif(trim(new.formato), ''));

  if new.tipo = 'ad' then
    select codigo, idioma into o from ops.ofertas where id = new.oferta_id;
    new.nome := o.codigo || '-' || o.idioma
      || '-AD' || new.ad_num || '-H' || new.hook_num || '-M' || new.var_num
      || '-' || new.formato;
  else
    new.nome := trim(new.nome);
  end if;

  if new.parent_card_id is not null
     and not exists (select 1 from ops.cards where id = new.parent_card_id and oferta_id = new.oferta_id) then
    raise exception 'A versão de origem precisa ser um card da mesma oferta.';
  end if;

  if tg_op = 'INSERT' then
    if new.posicao is null then
      select coalesce(max(posicao), 0) + 1024 into new.posicao
      from ops.cards where oferta_id = new.oferta_id and lista_id = new.lista_id;
    end if;
  else
    new.atualizado_em := now();
  end if;
  return new;
end $$;

create trigger cards_preparar before insert or update on ops.cards
  for each row execute function ops.cards_preparar();

-- Se a sigla ou o idioma da oferta mudar, os nomes dos ads acompanham.
create or replace function ops.ofertas_renomear_cards() returns trigger
language plpgsql set search_path = '' as $$
begin
  update ops.cards set nome = nome where oferta_id = new.id and tipo = 'ad';
  return null;
end $$;

create trigger ofertas_renomear_cards after update of codigo, idioma on ops.ofertas
  for each row when (old.codigo is distinct from new.codigo or old.idioma is distinct from new.idioma)
  execute function ops.ofertas_renomear_cards();

-- ---------------------------------------------------------------------
-- 5. Membros, etiquetas, anexos e comentários dos cards
-- ---------------------------------------------------------------------
create table ops.card_membros (
  card_id uuid not null references ops.cards on delete cascade,
  user_id uuid not null references ops.membros on delete cascade,
  primary key (card_id, user_id)
);

create table ops.etiquetas (
  id uuid primary key default gen_random_uuid(),
  nome text not null unique,
  cor text
);

create table ops.card_etiquetas (
  card_id uuid not null references ops.cards on delete cascade,
  etiqueta_id uuid not null references ops.etiquetas on delete cascade,
  primary key (card_id, etiqueta_id)
);

-- Links como "Script" e "AD Finalizado".
create table ops.anexos (
  id uuid primary key default gen_random_uuid(),
  card_id uuid not null references ops.cards on delete cascade,
  titulo text not null,
  url text not null,
  ordem int not null default 0,
  criado_em timestamptz not null default now()
);
create index on ops.anexos (card_id);

-- @menções ficam para depois (dá para extrair do texto ou ganhar uma coluna nova).
create table ops.comentarios (
  id uuid primary key default gen_random_uuid(),
  card_id uuid not null references ops.cards on delete cascade,
  autor_id uuid references ops.membros on delete set null default auth.uid(),
  texto text not null check (length(trim(texto)) > 0),
  criado_em timestamptz not null default now(),
  editado_em timestamptz
);
create index on ops.comentarios (card_id, criado_em);

-- ---------------------------------------------------------------------
-- 6. Atividades (histórico automático)
-- ---------------------------------------------------------------------
-- Escritas só pelos gatilhos abaixo; o app só lê. `texto` já vem pronto para
-- mostrar (com os nomes da época); `dados` guarda os ids e valores para filtros.
create table ops.atividades (
  id uuid primary key default gen_random_uuid(),
  card_id uuid references ops.cards on delete cascade,
  oferta_id uuid references ops.ofertas on delete cascade,
  autor_id uuid references ops.membros on delete set null,
  tipo text not null,
  texto text not null,
  dados jsonb not null default '{}',
  criado_em timestamptz not null default now()
);
create index on ops.atividades (card_id, criado_em desc);
create index on ops.atividades (oferta_id, criado_em desc);
create index on ops.atividades (tipo);

create or replace function ops.registrar(p_card uuid, p_tipo text, p_texto text, p_dados jsonb default '{}')
returns void language sql security definer set search_path = '' as $$
  insert into ops.atividades (card_id, oferta_id, autor_id, tipo, texto, dados)
  select c.id, c.oferta_id, (select user_id from ops.membros where user_id = auth.uid()),
         p_tipo, p_texto, coalesce(p_dados, '{}')
  from ops.cards c where c.id = p_card;   -- card apagado: não registra nada
$$;

-- Cards: criado, versão criada, movido, renomeado, arquivado, vencedor.
create or replace function ops.cards_log() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  de text;
  para text;
begin
  if tg_op = 'INSERT' then
    select nome into para from ops.listas where id = new.lista_id;
    perform ops.registrar(new.id, 'card_criado', 'criou o card em ' || para, jsonb_build_object('lista_id', new.lista_id));
    if new.parent_card_id is not null then
      select nome into de from ops.cards where id = new.parent_card_id;
      perform ops.registrar(new.id, 'versao_criada',
        'criou esta versão a partir de ' || de || coalesce(' (' || nullif(trim(new.motivo_versao), '') || ')', ''),
        jsonb_build_object('parent_card_id', new.parent_card_id, 'motivo', new.motivo_versao));
      perform ops.registrar(new.parent_card_id, 'versao_derivada', 'nova versão: ' || new.nome,
        jsonb_build_object('card_id', new.id, 'motivo', new.motivo_versao));
    end if;
    return null;
  end if;

  if new.lista_id is distinct from old.lista_id then
    select nome into de from ops.listas where id = old.lista_id;
    select nome into para from ops.listas where id = new.lista_id;
    perform ops.registrar(new.id, 'card_movido', 'moveu de ' || de || ' para ' || para,
      jsonb_build_object('de_lista_id', old.lista_id, 'para_lista_id', new.lista_id));
  end if;
  if new.nome is distinct from old.nome then
    perform ops.registrar(new.id, 'card_renomeado', 'renomeou de ' || old.nome || ' para ' || new.nome,
      jsonb_build_object('de', old.nome, 'para', new.nome));
  end if;
  if new.oferta_id is distinct from old.oferta_id then
    perform ops.registrar(new.id, 'oferta_alterada', 'mudou a oferta do card',
      jsonb_build_object('de_oferta_id', old.oferta_id, 'para_oferta_id', new.oferta_id));
  end if;
  if new.arquivado is distinct from old.arquivado then
    perform ops.registrar(new.id, case when new.arquivado then 'card_arquivado' else 'card_restaurado' end,
      case when new.arquivado then 'arquivou o card' else 'restaurou o card' end);
  end if;
  if new.vencedor is distinct from old.vencedor then
    perform ops.registrar(new.id, case when new.vencedor then 'vencedor_marcado' else 'vencedor_desmarcado' end,
      case when new.vencedor then 'marcou como vencedor' else 'desmarcou como vencedor' end);
  end if;
  return null;
end $$;

create trigger cards_log after insert or update on ops.cards
  for each row execute function ops.cards_log();

-- Membros do card
create or replace function ops.card_membros_log() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  r record;
  quem text;
begin
  if tg_op = 'DELETE' then r := old; else r := new; end if;
  select nome into quem from ops.membros where user_id = r.user_id;
  perform ops.registrar(r.card_id,
    case when tg_op = 'INSERT' then 'membro_adicionado' else 'membro_removido' end,
    case when tg_op = 'INSERT' then 'adicionou ' else 'removeu ' end || coalesce(quem, 'um membro'),
    jsonb_build_object('user_id', r.user_id));
  return null;
end $$;

create trigger card_membros_log after insert or delete on ops.card_membros
  for each row execute function ops.card_membros_log();

-- Etiquetas do card
create or replace function ops.card_etiquetas_log() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  r record;
  etiqueta text;
begin
  if tg_op = 'DELETE' then r := old; else r := new; end if;
  select nome into etiqueta from ops.etiquetas where id = r.etiqueta_id;
  perform ops.registrar(r.card_id,
    case when tg_op = 'INSERT' then 'etiqueta_adicionada' else 'etiqueta_removida' end,
    case when tg_op = 'INSERT' then 'adicionou a etiqueta ' else 'removeu a etiqueta ' end || coalesce(etiqueta, ''),
    jsonb_build_object('etiqueta_id', r.etiqueta_id));
  return null;
end $$;

create trigger card_etiquetas_log after insert or delete on ops.card_etiquetas
  for each row execute function ops.card_etiquetas_log();

-- Anexos
create or replace function ops.anexos_log() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  r record;
begin
  if tg_op = 'DELETE' then r := old; else r := new; end if;
  perform ops.registrar(r.card_id,
    case when tg_op = 'INSERT' then 'anexo_adicionado' else 'anexo_removido' end,
    case when tg_op = 'INSERT' then 'anexou ' else 'removeu o anexo ' end || r.titulo,
    jsonb_build_object('anexo_id', r.id, 'titulo', r.titulo, 'url', r.url));
  return null;
end $$;

create trigger anexos_log after insert or delete on ops.anexos
  for each row execute function ops.anexos_log();

-- Comentários
create or replace function ops.comentarios_log() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform ops.registrar(new.card_id, 'comentario', 'comentou', jsonb_build_object('comentario_id', new.id));
  return null;
end $$;

create trigger comentarios_log after insert on ops.comentarios
  for each row execute function ops.comentarios_log();

-- ---------------------------------------------------------------------
-- 7. Veiculações (o card em cada conta de anúncio)
-- ---------------------------------------------------------------------
-- meta_ad_id é a chave para casar métricas da Meta e vendas (utm_content = ID do anúncio).
-- O mesmo card pode ter um ID diferente em cada conta; as métricas do card são a
-- soma das suas veiculações. Toda mudança de status vai para ops.atividades.
create table ops.veiculacoes (
  id uuid primary key default gen_random_uuid(),
  card_id uuid not null references ops.cards on delete cascade,
  conta_id uuid not null references ops.contas_anuncio on delete restrict,
  status text not null default 'nao_subido'
    check (status in ('nao_subido','em_analise','rodando','rejeitado','pausado')),
  meta_ad_id text unique check (meta_ad_id ~ '^[0-9]+$'),
  nome_no_meta text,                           -- só referência
  data_status timestamptz not null default now(),
  motivo_rejeicao text,
  categoria_rejeicao text,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  unique (card_id, conta_id)
);
create index on ops.veiculacoes (conta_id);

create or replace function ops.status_veiculacao_nome(p text) returns text
language sql immutable set search_path = '' as $$
  select case p
    when 'nao_subido' then 'Não subido'
    when 'em_analise' then 'Em análise'
    when 'rodando' then 'Rodando'
    when 'rejeitado' then 'Rejeitado'
    when 'pausado' then 'Pausado'
    else p end;
$$;

create or replace function ops.veiculacoes_preparar() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.meta_ad_id := nullif(trim(new.meta_ad_id), '');
  if tg_op = 'UPDATE' then
    new.atualizado_em := now();
    -- data do status: agora, a menos que o app tenha informado outra
    if new.status is distinct from old.status and new.data_status is not distinct from old.data_status then
      new.data_status := now();
    end if;
  end if;
  return new;
end $$;

create trigger veiculacoes_preparar before insert or update on ops.veiculacoes
  for each row execute function ops.veiculacoes_preparar();

create or replace function ops.veiculacoes_log() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  r record;
  conta text;
  base jsonb;
begin
  if tg_op = 'DELETE' then r := old; else r := new; end if;
  select apelido into conta from ops.contas_anuncio where id = r.conta_id;
  base := jsonb_build_object('veiculacao_id', r.id, 'conta_id', r.conta_id, 'meta_ad_id', r.meta_ad_id);

  if tg_op = 'INSERT' then
    perform ops.registrar(r.card_id, 'veiculacao_criada',
      conta || ': adicionada (' || ops.status_veiculacao_nome(r.status) || ')',
      base || jsonb_build_object('de', null, 'para', r.status,
        'motivo_rejeicao', r.motivo_rejeicao, 'categoria_rejeicao', r.categoria_rejeicao));
  elsif tg_op = 'DELETE' then
    perform ops.registrar(r.card_id, 'veiculacao_removida', conta || ': removida', base);
  else
    if new.status is distinct from old.status then
      perform ops.registrar(r.card_id, 'veiculacao_status',
        conta || ': ' || ops.status_veiculacao_nome(old.status) || ' → ' || ops.status_veiculacao_nome(new.status)
          || case when new.status = 'rejeitado' then coalesce(' — ' || nullif(trim(new.motivo_rejeicao), ''), '') else '' end,
        base || jsonb_build_object('de', old.status, 'para', new.status,
          'motivo_rejeicao', new.motivo_rejeicao, 'categoria_rejeicao', new.categoria_rejeicao));
    end if;
    if new.meta_ad_id is distinct from old.meta_ad_id then
      perform ops.registrar(r.card_id, 'veiculacao_id',
        conta || ': ID do anúncio ' || coalesce(new.meta_ad_id, 'removido'),
        base || jsonb_build_object('de_meta_ad_id', old.meta_ad_id));
    end if;
  end if;
  return null;
end $$;

create trigger veiculacoes_log after insert or update or delete on ops.veiculacoes
  for each row execute function ops.veiculacoes_log();

-- Histórico de rejeições (a partir das atividades)
create view ops.v_rejeicoes with (security_invoker = true) as
select
  a.criado_em,
  a.card_id,
  c.nome as card_nome,
  c.oferta_id,
  (a.dados ->> 'veiculacao_id')::uuid as veiculacao_id,
  (a.dados ->> 'conta_id')::uuid as conta_id,
  ca.apelido as conta_apelido,
  a.dados ->> 'meta_ad_id' as meta_ad_id,
  a.dados ->> 'motivo_rejeicao' as motivo_rejeicao,
  a.dados ->> 'categoria_rejeicao' as categoria_rejeicao,
  a.autor_id
from ops.atividades a
join ops.cards c on c.id = a.card_id
left join ops.contas_anuncio ca on ca.id = (a.dados ->> 'conta_id')::uuid
where a.tipo in ('veiculacao_status', 'veiculacao_criada')
  and a.dados ->> 'para' = 'rejeitado';

-- ---------------------------------------------------------------------
-- 8. Checklists (de um card OU de uma oferta)
-- ---------------------------------------------------------------------
create table ops.checklists (
  id uuid primary key default gen_random_uuid(),
  card_id uuid references ops.cards on delete cascade,
  oferta_id uuid references ops.ofertas on delete cascade,
  titulo text not null,
  ordem int not null default 0,
  criado_em timestamptz not null default now(),
  constraint checklists_dono check (num_nonnulls(card_id, oferta_id) = 1)
);
create index on ops.checklists (card_id);
create index on ops.checklists (oferta_id);

create table ops.checklist_itens (
  id uuid primary key default gen_random_uuid(),
  checklist_id uuid not null references ops.checklists on delete cascade,
  texto text not null,
  feito boolean not null default false,
  ordem int not null default 0,
  feito_em timestamptz,
  feito_por uuid references ops.membros on delete set null
);
create index on ops.checklist_itens (checklist_id);

create or replace function ops.checklist_itens_feito() returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_op = 'INSERT' or new.feito is distinct from old.feito then
    new.feito_em := case when new.feito then now() end;
    new.feito_por := case when new.feito then (select user_id from ops.membros where user_id = auth.uid()) end;
  end if;
  return new;
end $$;

create trigger checklist_itens_feito before insert or update on ops.checklist_itens
  for each row execute function ops.checklist_itens_feito();

-- ---------------------------------------------------------------------
-- 9. Modelos
-- ---------------------------------------------------------------------
-- Modelos de card (substituem a lista "Em planejamento").
--   anexos:     [{"titulo": "Script", "url": ""}, ...]
--   checklists: [{"titulo": "Edição", "itens": ["Legendas", "Trilha"]}, ...]
create table ops.modelos_card (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  tipo text not null default 'ad' check (tipo in ('ad','vsl','outro')),
  formato text check (formato ~ '^[A-Z0-9]{1,8}$'),
  descricao text,
  anexos jsonb not null default '[]' check (jsonb_typeof(anexos) = 'array'),
  checklists jsonb not null default '[]' check (jsonb_typeof(checklists) = 'array'),
  ordem int not null default 0,
  ativo boolean not null default true,
  criado_em timestamptz not null default now()
);

create table ops.modelos_card_etiquetas (
  modelo_id uuid not null references ops.modelos_card on delete cascade,
  etiqueta_id uuid not null references ops.etiquetas on delete cascade,
  primary key (modelo_id, etiqueta_id)
);

-- Checklist de lançamento de oferta (seções e itens), editável.
--   secoes: [{"titulo": "Página", "itens": ["Pixel instalado", "Checkout testado"]}, ...]
create table ops.modelos_checklist_oferta (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  secoes jsonb not null default '[]' check (jsonb_typeof(secoes) = 'array'),
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

insert into ops.modelos_checklist_oferta (nome) values ('Lançamento de oferta');

-- ---------------------------------------------------------------------
-- 10. Permissões
-- ---------------------------------------------------------------------
grant usage on schema ops to authenticated, service_role;
grant select, insert, update, delete on all tables in schema ops to authenticated;
grant all on all tables in schema ops to service_role;
alter default privileges in schema ops grant select, insert, update, delete on tables to authenticated;
alter default privileges in schema ops grant all on tables to service_role;

-- Funções: o app só chama is_membro(). O resto roda pelos gatilhos.
revoke execute on all functions in schema ops from public, anon, authenticated;
grant execute on function ops.is_membro() to authenticated;
grant execute on function ops.status_veiculacao_nome(text) to authenticated;

-- ---------------------------------------------------------------------
-- 11. RLS: só membros ativos leem e escrevem
-- ---------------------------------------------------------------------
do $$
declare t text;
begin
  for t in select tablename from pg_tables where schemaname = 'ops' loop
    execute format('alter table ops.%I enable row level security', t);
    if t in ('atividades', 'membros') then
      -- histórico e equipe: o app só lê
      execute format('create policy membros_leem on ops.%I for select to authenticated using (ops.is_membro())', t);
    else
      execute format('create policy membros_tudo on ops.%I for all to authenticated using (ops.is_membro()) with check (ops.is_membro())', t);
    end if;
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- 12. MEMBROS — cadastrados manualmente no SQL Editor (e-mails não ficam no código)
-- ---------------------------------------------------------------------
-- Depois de criar os usuários em Authentication → Users, rode (trocando os e-mails):
--   insert into ops.membros (user_id, nome)
--   select id, 'May' from auth.users where email = '<email-da-may>';
--   insert into ops.membros (user_id, nome)
--   select id, 'Luciano' from auth.users where email = '<email-do-luciano>';
