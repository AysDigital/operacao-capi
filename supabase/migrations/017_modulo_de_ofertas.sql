-- =====================================================================
-- Operação Capi — Migration 017: módulo de ofertas (etapa 10)
-- Rodar UMA vez no SQL Editor do Supabase.
-- Só mexe no schema ops. A única leitura de fora é a de public.purchases em
-- ops.vendas_por_dia (só totais por dia, nunca dados do comprador), pedida na etapa 10
-- para o gráfico diário de faturamento.
--
--   1. Oferta: anotações e links (página, checkout, Drive, área de membros, outros)
--   2. Histórico da oferta (ops.atividades com card_id vazio) + ops.registrar_oferta
--   3. Checklist de lançamento: modelo preenchido, cópia automática em toda oferta nova,
--      prazo e anotação por item, histórico ao marcar/desmarcar
--   4. Testes da oferta (ops.testes_oferta) com histórico de status e resultado
--   5. Rejeições: categoria e motivo escritos depois entram no histórico da rejeição
--   6. Métricas da oferta: vendas por dia e cobertura (gasto sem card)
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Anotações e links da oferta
-- ---------------------------------------------------------------------
alter table ops.ofertas add column anotacoes text;

create table ops.ofertas_links (
  id uuid primary key default gen_random_uuid(),
  oferta_id uuid not null references ops.ofertas on delete cascade,
  tipo text not null default 'outro' check (tipo in ('vendas', 'checkout', 'drive', 'membros', 'outro')),
  titulo text not null check (length(trim(titulo)) > 0),
  url text not null check (length(trim(url)) > 0),
  ordem int not null default 0,
  criado_em timestamptz not null default now()
);
create index on ops.ofertas_links (oferta_id);
alter table ops.ofertas_links enable row level security;
create policy membros_tudo on ops.ofertas_links for all to authenticated using (ops.is_membro()) with check (ops.is_membro());

-- ---------------------------------------------------------------------
-- 2. Histórico da oferta
-- ---------------------------------------------------------------------
-- Linhas de ops.atividades com oferta_id e card_id vazio. Respeita ops.silencio.
create or replace function ops.registrar_oferta(p_oferta uuid, p_tipo text, p_texto text, p_dados jsonb default '{}')
returns void language plpgsql security definer set search_path = '' as $$
begin
  if current_setting('ops.silencio', true) = '1' then
    return;
  end if;
  insert into ops.atividades (card_id, oferta_id, autor_id, tipo, texto, dados)
  select null, o.id, (select user_id from ops.membros where user_id = auth.uid()), p_tipo, p_texto, coalesce(p_dados, '{}')
  from ops.ofertas o where o.id = p_oferta;
end $$;

-- ---------------------------------------------------------------------
-- 3. Checklist de lançamento
-- ---------------------------------------------------------------------
-- Seções = ops.checklists com oferta_id; itens = ops.checklist_itens.
alter table ops.checklist_itens
  add column prazo date,
  add column nota text;   -- anotação ou link

update ops.modelos_checklist_oferta
set secoes = $json$[
  {"titulo": "1 Mineração", "itens": ["Minerar oferta de referência", "Analisar VSL e funil da referência", "Definir mercado e idioma"]},
  {"titulo": "2 Copy", "itens": ["Copy da VSL/Quiz/TSL", "Copy da página", "Copy dos upsells e downsells"]},
  {"titulo": "3 Tradução", "itens": ["Traduzir VSL", "Traduzir página e checkout", "Traduzir entregáveis"]},
  {"titulo": "4 Edição", "itens": ["Editar VSL", "Revisar edição da VSL"]},
  {"titulo": "5 Página e entregáveis", "itens": ["Criar página", "Configurar página e domínio", "Criar ebook", "Criar aulas"]},
  {"titulo": "6.1 Produto", "itens": ["Configurar produto na plataforma de vendas", "Configurar opções de pagamentos na plataforma de vendas", "Criar aplicativo", "Configurar módulos e conteúdos no aplicativo"]},
  {"titulo": "6.2 Checkout", "itens": ["Criar banner do checkout", "Criar depoimentos", "Criar elementos com gatilhos de PROVA/ESCASSEZ"]},
  {"titulo": "6.3 Tráfego", "itens": ["Aquecer conta no Facebook", "Aquecer página do Facebook", "Criar PIXEL para produto"]},
  {"titulo": "6.4.1 Pixel", "itens": ["Configurar PIXEL na plataforma de vendas (produto principal e os do funil)", "Configurar PIXEL no Quiz/VSL/TSL", "Configurar PIXEL nas páginas de upsell e downsell", "Configurar PIXEL na UTMify"]},
  {"titulo": "6.4.2 Trackeamento", "itens": ["GTM", "Server", "Código do GTM nas páginas", "Begin checkout nos botões", "Webhook na plataforma de vendas", "Retirar pixel da página de vendas/quiz e checkout de pagamento"]},
  {"titulo": "6.5 Funil", "itens": ["Configurar funil de upsell na plataforma de vendas"]}
]$json$::jsonb,
    atualizado_em = now()
where nome = 'Lançamento de oferta';

-- Copia o modelo ativo (o mais antigo) para a oferta. Devolve quantos itens criou.
create or replace function ops.criar_checklist_oferta(p_oferta uuid) returns int
language plpgsql set search_path = '' as $$
declare
  v_secoes jsonb;
  s jsonb;
  n_secao int := 0;
  nova uuid;
  total int := 0;
  n int;
begin
  select secoes into v_secoes from ops.modelos_checklist_oferta where ativo order by criado_em limit 1;
  if v_secoes is null then return 0; end if;
  perform set_config('ops.silencio', '1', true);
  n_secao := coalesce((select max(ordem) from ops.checklists where oferta_id = p_oferta), 0);
  for s in select value from jsonb_array_elements(v_secoes) loop
    n_secao := n_secao + 1;
    insert into ops.checklists (oferta_id, titulo, ordem)
    values (p_oferta, coalesce(nullif(trim(s ->> 'titulo'), ''), 'Seção'), n_secao)
    returning id into nova;
    insert into ops.checklist_itens (checklist_id, texto, ordem, feito)
      select nova, trim(it), k::int, false
      from jsonb_array_elements_text(coalesce(s -> 'itens', '[]')) with ordinality as t(it, k)
      where nullif(trim(it), '') is not null;
    get diagnostics n = row_count;
    total := total + n;
  end loop;
  perform set_config('ops.silencio', '0', true);
  perform ops.registrar_oferta(p_oferta, 'checklist_criado', 'criou o checklist de lançamento a partir do modelo');
  return total;
end $$;

-- Toda oferta nova nasce com o checklist do modelo.
create or replace function ops.ofertas_checklist_inicial() returns trigger
language plpgsql set search_path = '' as $$
begin
  perform ops.criar_checklist_oferta(new.id);
  return null;
end $$;

create trigger ofertas_checklist_inicial after insert on ops.ofertas
  for each row execute function ops.ofertas_checklist_inicial();

-- Marcar/desmarcar item do checklist da oferta vai para o histórico da oferta.
create or replace function ops.checklist_itens_log_oferta() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  l record;
begin
  if new.feito is not distinct from old.feito then return null; end if;
  select oferta_id, titulo into l from ops.checklists where id = new.checklist_id;
  if l.oferta_id is null then return null; end if;
  perform ops.registrar_oferta(l.oferta_id, 'checklist_item',
    case when new.feito then 'marcou' else 'desmarcou' end || ' “' || new.texto || '” (' || l.titulo || ')',
    jsonb_build_object('item_id', new.id, 'feito', new.feito));
  return null;
end $$;

create trigger checklist_itens_log_oferta after update of feito on ops.checklist_itens
  for each row execute function ops.checklist_itens_log_oferta();

-- ---------------------------------------------------------------------
-- 4. Testes da oferta
-- ---------------------------------------------------------------------
create table ops.testes_oferta (
  id uuid primary key default gen_random_uuid(),
  oferta_id uuid not null references ops.ofertas on delete cascade,
  titulo text not null check (length(trim(titulo)) > 0),
  tipo text not null default 'outro'
    check (tipo in ('lead_vsl', 'micro_lead', 'headline', 'preco', 'checkout', 'upsell_downsell', 'pagina', 'outro')),
  hipotese text,
  status text not null default 'ideia' check (status in ('ideia', 'em_producao', 'rodando', 'concluido')),
  inicio date,
  fim date,
  resultado text check (resultado in ('venceu', 'perdeu', 'inconclusivo')),
  aprendizado text,
  card_id uuid references ops.cards on delete set null,
  posicao double precision not null default 0,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create index on ops.testes_oferta (oferta_id);
create index on ops.testes_oferta (card_id);
alter table ops.testes_oferta enable row level security;
create policy membros_tudo on ops.testes_oferta for all to authenticated using (ops.is_membro()) with check (ops.is_membro());

create or replace function ops.status_teste_nome(p text) returns text
language sql immutable set search_path = '' as $$
  select case p when 'ideia' then 'Ideia' when 'em_producao' then 'Em produção'
                when 'rodando' then 'Rodando' when 'concluido' then 'Concluído' else p end;
$$;

-- Datas automáticas: começou a rodar = início; concluiu = fim (se ainda vazias).
create or replace function ops.testes_oferta_preparar() returns trigger
language plpgsql set search_path = '' as $$
declare
  hoje date := (now() at time zone 'America/Sao_Paulo')::date;
begin
  if tg_op = 'UPDATE' then new.atualizado_em := now(); end if;
  if new.status = 'rodando' and new.inicio is null then new.inicio := hoje; end if;
  if new.status = 'concluido' and new.fim is null then new.fim := hoje; end if;
  if new.posicao = 0 then
    select coalesce(max(posicao), 0) + 1024 into new.posicao
    from ops.testes_oferta where oferta_id = new.oferta_id and status = new.status and id <> new.id;
  end if;
  return new;
end $$;

create trigger testes_oferta_preparar before insert or update on ops.testes_oferta
  for each row execute function ops.testes_oferta_preparar();

create or replace function ops.testes_oferta_log() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    perform ops.registrar_oferta(new.oferta_id, 'teste_criado', 'criou o teste “' || new.titulo || '”',
      jsonb_build_object('teste_id', new.id));
  elsif tg_op = 'DELETE' then
    perform ops.registrar_oferta(old.oferta_id, 'teste_excluido', 'excluiu o teste “' || old.titulo || '”',
      jsonb_build_object('teste_id', old.id));
    return null;
  else
    if new.status is distinct from old.status then
      perform ops.registrar_oferta(new.oferta_id, 'teste_status',
        'teste “' || new.titulo || '”: ' || ops.status_teste_nome(old.status) || ' → ' || ops.status_teste_nome(new.status),
        jsonb_build_object('teste_id', new.id, 'de', old.status, 'para', new.status));
    end if;
    if new.resultado is distinct from old.resultado and new.resultado is not null then
      perform ops.registrar_oferta(new.oferta_id, 'teste_resultado',
        'teste “' || new.titulo || '”: ' || case new.resultado when 'venceu' then 'venceu' when 'perdeu' then 'perdeu' else 'inconclusivo' end,
        jsonb_build_object('teste_id', new.id, 'resultado', new.resultado));
    end if;
  end if;
  return null;
end $$;

create trigger testes_oferta_log after insert or update or delete on ops.testes_oferta
  for each row execute function ops.testes_oferta_log();

-- ---------------------------------------------------------------------
-- 5. Rejeições: categoria e motivo escritos depois de rejeitar
-- ---------------------------------------------------------------------
-- O app muda o status para "Rejeitado" e só depois a pessoa escolhe a categoria e
-- escreve o motivo. Igual à 001, mais: enquanto estiver rejeitada, mudar motivo ou
-- categoria atualiza a última linha "rejeitado" desta veiculação no histórico
-- (é dela que a view ops.v_rejeicoes lê).
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
    elsif new.status = 'rejeitado'
          and (new.motivo_rejeicao is distinct from old.motivo_rejeicao
               or new.categoria_rejeicao is distinct from old.categoria_rejeicao) then
      update ops.atividades a
         set dados = a.dados || jsonb_build_object('motivo_rejeicao', new.motivo_rejeicao, 'categoria_rejeicao', new.categoria_rejeicao)
       where a.id = (select x.id from ops.atividades x
                      where x.card_id = r.card_id and x.tipo in ('veiculacao_status', 'veiculacao_criada')
                        and x.dados ->> 'para' = 'rejeitado' and x.dados ->> 'veiculacao_id' = r.id::text
                      order by x.criado_em desc limit 1);
    end if;
    if new.meta_ad_id is distinct from old.meta_ad_id then
      perform ops.registrar(r.card_id, 'veiculacao_id',
        conta || ': ID do anúncio ' || coalesce(new.meta_ad_id, 'removido'),
        base || jsonb_build_object('de_meta_ad_id', old.meta_ad_id));
    end if;
  end if;
  return null;
end $$;

-- Rejeições ainda abertas: grava agora a categoria e o motivo que já estão na veiculação.
update ops.atividades a
   set dados = a.dados || jsonb_build_object('motivo_rejeicao', v.motivo_rejeicao, 'categoria_rejeicao', v.categoria_rejeicao)
  from ops.veiculacoes v
 where v.status = 'rejeitado'
   and (v.motivo_rejeicao is not null or v.categoria_rejeicao is not null)
   and a.id = (select x.id from ops.atividades x
                where x.card_id = v.card_id and x.tipo in ('veiculacao_status', 'veiculacao_criada')
                  and x.dados ->> 'para' = 'rejeitado' and x.dados ->> 'veiculacao_id' = v.id::text
                order by x.criado_em desc limit 1);

-- ---------------------------------------------------------------------
-- 6. Métricas da oferta
-- ---------------------------------------------------------------------
-- Vendas por dia (Brasília) dos anúncios informados: só totais, sem dados do comprador.
create or replace function ops.vendas_por_dia(p_ids text[], p_desde date default null)
returns table (dia date, tipo_oferta text, status text, vendas bigint, valor numeric)
language plpgsql stable security definer set search_path = '' as $$
#variable_conflict use_column
begin
  if not ops.is_membro() then
    raise exception 'acesso negado' using errcode = '42501';
  end if;
  return query
  select x.dia, x.tipo_oferta, x.status, count(*)::bigint, coalesce(sum(x.valor), 0)
  from (
    select (coalesce(p.data_venda, p.created_at) at time zone 'America/Sao_Paulo')::date as dia,
           coalesce(p.tipo_oferta, 'principal') as tipo_oferta, p.status, p.valor::numeric as valor
    from public.purchases p
    where p.ad_id = any (p_ids) and p.status in ('approved', 'refunded', 'chargeback')
  ) x
  where p_desde is null or x.dia >= p_desde
  group by x.dia, x.tipo_oferta, x.status;
end $$;

-- Cobertura: gasto das contas da oferta (as que têm veiculação de algum card dela)
-- que não está ligado a nenhum card, no período.
create or replace function ops.cobertura_oferta(p_oferta uuid, p_desde date default null)
returns table (gasto_total numeric, gasto_sem_card numeric, anuncios_sem_card bigint)
language sql stable set search_path = '' as $$
  with contas as (
    select distinct v.conta_id from ops.veiculacoes v join ops.cards c on c.id = v.card_id where c.oferta_id = p_oferta
  ),
  ligados as (select meta_ad_id from ops.veiculacoes where meta_ad_id is not null),
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

-- ---------------------------------------------------------------------
-- 7. Permissões
-- ---------------------------------------------------------------------
revoke execute on function ops.registrar_oferta(uuid, text, text, jsonb) from public, anon, authenticated;
revoke execute on function ops.ofertas_checklist_inicial() from public, anon, authenticated;
revoke execute on function ops.checklist_itens_log_oferta() from public, anon, authenticated;
revoke execute on function ops.testes_oferta_preparar() from public, anon, authenticated;
revoke execute on function ops.testes_oferta_log() from public, anon, authenticated;
revoke execute on function ops.criar_checklist_oferta(uuid) from public, anon;
revoke execute on function ops.vendas_por_dia(text[], date) from public, anon;
revoke execute on function ops.cobertura_oferta(uuid, date) from public, anon;
grant execute on function ops.criar_checklist_oferta(uuid) to authenticated;
grant execute on function ops.vendas_por_dia(text[], date) to authenticated;
grant execute on function ops.cobertura_oferta(uuid, date) to authenticated;
grant execute on function ops.status_teste_nome(text) to authenticated;

-- Conferência: o modelo deve ter 11 seções e 36 itens.
select jsonb_array_length(secoes) as secoes,
       (select sum(jsonb_array_length(s -> 'itens')) from jsonb_array_elements(secoes) s) as itens
from ops.modelos_checklist_oferta where nome = 'Lançamento de oferta';
