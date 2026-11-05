-- =====================================================================
-- Operação Capi — Migration 016: modelos de card (etapa 9)
-- Rodar UMA vez no SQL Editor do Supabase. Só mexe no schema ops.
--
-- ops.modelos_card (da 001) ganha: oferta (vazia = todas), lista padrão,
-- prazo relativo e data de atualização. Formato dos campos jsonb:
--   anexos:     [{"titulo": "Script", "url": "https://..."}]   (url vazia = não cria no card)
--   checklists: [{"titulo": "Edição", "itens": ["Legendas", "Trilha"]}]
--
-- Funções (rodam com as permissões de quem chama; RLS vale normalmente):
--   ops.criar_de_modelo     cria 1 a 10 cards a partir de um modelo, numa transação só
--   ops.salvar_como_modelo  cria um modelo a partir de um card
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Colunas novas
-- ---------------------------------------------------------------------
alter table ops.modelos_card
  add column oferta_id uuid references ops.ofertas on delete cascade,     -- null = vale para todas
  add column lista_id uuid references ops.listas on delete set null,      -- lista padrão onde o card nasce
  add column prazo_dias int check (prazo_dias between 0 and 365),         -- prazo = dia da criação + N
  add column atualizado_em timestamptz not null default now();

alter table ops.modelos_card add constraint modelos_card_nome check (length(trim(nome)) > 0);
create index on ops.modelos_card (oferta_id);

create or replace function ops.modelos_card_atualizado() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.atualizado_em := now();
  return new;
end $$;

create trigger modelos_card_atualizado before update on ops.modelos_card
  for each row execute function ops.modelos_card_atualizado();

-- ---------------------------------------------------------------------
-- 2. Criar cards a partir de um modelo
-- ---------------------------------------------------------------------
-- Ad: p_ad informado (só com quantidade 1) usa AD/H/M dados; sem p_ad, usa os
-- próximos AD livres da oferta (contando arquivados), cada um com H1-M1, com a
-- mesma trava por oferta do "Duplicar" (etapa 5): duas pessoas não colidem.
-- VSL/Outro: p_nome é o título (obrigatório); quantidade sempre 1.
-- O histórico do card novo fica com uma linha só: "criou o card em X a partir do modelo Y".
create or replace function ops.criar_de_modelo(
  p_modelo uuid, p_oferta uuid, p_lista uuid, p_quantidade int default 1,
  p_ad int default null, p_hook int default null, p_var int default null, p_nome text default null
) returns setof uuid language plpgsql set search_path = '' as $$
declare
  md record;
  a int;
  novo uuid;
  v_lista uuid;
  v_prazo date;
  v_lista_nome text;
  ch jsonb;
  nova_ch uuid;
begin
  select * into md from ops.modelos_card where id = p_modelo;
  if not found then raise exception 'Modelo não encontrado.'; end if;
  if md.oferta_id is not null and md.oferta_id <> p_oferta then
    raise exception 'Este modelo é de outra oferta.';
  end if;
  if coalesce(p_quantidade, 0) < 1 or p_quantidade > 10 then raise exception 'Quantidade deve ficar entre 1 e 10.'; end if;
  if md.tipo <> 'ad' and p_quantidade <> 1 then raise exception 'Quantidade maior que 1 só para Ad.'; end if;
  if md.tipo <> 'ad' and nullif(trim(p_nome), '') is null then raise exception 'Informe o título do card.'; end if;
  if md.tipo = 'ad' and md.formato is null then raise exception 'O modelo de Ad precisa de um formato.'; end if;
  if p_ad is not null and p_quantidade <> 1 then raise exception 'AD informado só vale para um card.'; end if;

  v_lista := coalesce(p_lista, md.lista_id);
  if v_lista is null then raise exception 'Escolha a lista.'; end if;
  select nome into v_lista_nome from ops.listas where id = v_lista;
  if md.prazo_dias is not null then
    v_prazo := (now() at time zone 'America/Sao_Paulo')::date + md.prazo_dias;
  end if;

  if md.tipo = 'ad' then
    if p_ad is null then
      perform pg_advisory_xact_lock(hashtextextended('ops.oferta:' || p_oferta::text, 0));
    else
      perform ops.travar_familia(p_oferta, p_ad);
    end if;
  end if;

  for i in 1..p_quantidade loop
    perform set_config('ops.silencio', '1', true);

    if md.tipo = 'ad' then
      if p_ad is null then
        select coalesce(max(ad_num), 0) + 1 into a from ops.cards where oferta_id = p_oferta and tipo = 'ad';
      else
        a := p_ad;
      end if;
      insert into ops.cards (oferta_id, lista_id, tipo, formato, ad_num, hook_num, var_num, nome, descricao, prazo)
      values (p_oferta, v_lista, 'ad', md.formato, a,
              case when p_ad is null then 1 else coalesce(p_hook, 1) end,
              case when p_ad is null then 1 else coalesce(p_var, 1) end,
              '-', md.descricao, v_prazo)
      returning id into novo;
    else
      insert into ops.cards (oferta_id, lista_id, tipo, formato, nome, descricao, prazo)
      values (p_oferta, v_lista, md.tipo, md.formato, trim(p_nome), md.descricao, v_prazo)
      returning id into novo;
    end if;

    insert into ops.card_etiquetas (card_id, etiqueta_id)
      select novo, etiqueta_id from ops.modelos_card_etiquetas where modelo_id = md.id;

    insert into ops.anexos (card_id, titulo, url, ordem)
      select novo, coalesce(nullif(trim(x ->> 'titulo'), ''), 'Link'), trim(x ->> 'url'), (n - 1)::int
      from jsonb_array_elements(md.anexos) with ordinality as t(x, n)
      where nullif(trim(x ->> 'url'), '') is not null;

    for ch in select value from jsonb_array_elements(md.checklists) loop
      insert into ops.checklists (card_id, titulo, ordem)
      values (novo, coalesce(nullif(trim(ch ->> 'titulo'), ''), 'Checklist'),
              (select count(*) from ops.checklists where card_id = novo))
      returning id into nova_ch;
      insert into ops.checklist_itens (checklist_id, texto, ordem, feito)
        select nova_ch, trim(it), (n - 1)::int, false
        from jsonb_array_elements_text(coalesce(ch -> 'itens', '[]')) with ordinality as t(it, n)
        where nullif(trim(it), '') is not null;
    end loop;

    perform set_config('ops.silencio', '0', true);
    perform ops.registrar(novo, 'card_criado',
      'criou o card em ' || coalesce(v_lista_nome, '?') || ' a partir do modelo ' || md.nome,
      jsonb_build_object('lista_id', v_lista, 'modelo_id', md.id));
    return next novo;
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- 3. Salvar um card como modelo
-- ---------------------------------------------------------------------
-- Leva tipo, formato, lista atual (como lista padrão), etiquetas, descrição,
-- anexos de link (os arquivos guardados no card ficam de fora) e checklists
-- com os itens (no card novo eles nascem desmarcados).
create or replace function ops.salvar_como_modelo(p_card uuid, p_nome text, p_so_oferta boolean)
returns uuid language plpgsql set search_path = '' as $$
declare
  c record;
  novo uuid;
begin
  if nullif(trim(p_nome), '') is null then raise exception 'Informe o nome do modelo.'; end if;
  select * into c from ops.cards where id = p_card;
  if not found then raise exception 'Card não encontrado.'; end if;

  insert into ops.modelos_card (nome, oferta_id, tipo, formato, lista_id, descricao, anexos, checklists)
  values (
    trim(p_nome),
    case when p_so_oferta then c.oferta_id end,
    c.tipo,
    coalesce(c.formato, case when c.tipo = 'ad' then 'VD' end),
    c.lista_id,
    c.descricao,
    coalesce((select jsonb_agg(jsonb_build_object('titulo', a.titulo, 'url', a.url) order by a.ordem)
              from ops.anexos a where a.card_id = c.id and a.url not like 'storage:%'), '[]'),
    coalesce((select jsonb_agg(jsonb_build_object(
                'titulo', l.titulo,
                'itens', coalesce((select jsonb_agg(i.texto order by i.ordem) from ops.checklist_itens i where i.checklist_id = l.id), '[]'))
              order by l.ordem)
              from ops.checklists l where l.card_id = c.id), '[]')
  )
  returning id into novo;

  insert into ops.modelos_card_etiquetas (modelo_id, etiqueta_id)
    select novo, etiqueta_id from ops.card_etiquetas where card_id = c.id;
  return novo;
end $$;

-- ---------------------------------------------------------------------
-- 4. Permissões
-- ---------------------------------------------------------------------
revoke execute on function ops.modelos_card_atualizado() from public, anon, authenticated;
revoke execute on function ops.criar_de_modelo(uuid, uuid, uuid, int, int, int, int, text) from public, anon;
revoke execute on function ops.salvar_como_modelo(uuid, text, boolean) from public, anon;
grant execute on function ops.criar_de_modelo(uuid, uuid, uuid, int, int, int, int, text) to authenticated;
grant execute on function ops.salvar_como_modelo(uuid, text, boolean) to authenticated;

-- Conferência: deve listar oferta_id, lista_id, prazo_dias e atualizado_em.
select column_name from information_schema.columns
where table_schema = 'ops' and table_name = 'modelos_card'
  and column_name in ('oferta_id', 'lista_id', 'prazo_dias', 'atualizado_em')
order by column_name;
