-- =====================================================================
-- Operação Capi — Migration 035: criar card a partir de modelo
-- Rodar UMA vez no SQL Editor do Supabase. Só mexe no schema ops.
--
-- Erro "Sem permissão para esta ação" ao criar card com modelo (12/11/2026):
-- ops.criar_de_modelo roda com a permissão de quem chama e grava o histórico
-- com ops.registrar, que é fechada para os usuários (001). Mesma lição da 018:
-- passa a ser security definer, conferindo ops.is_membro() antes de tudo.
-- O resto da função é igual à 016.
-- =====================================================================

create or replace function ops.criar_de_modelo(
  p_modelo uuid, p_oferta uuid, p_lista uuid, p_quantidade int default 1,
  p_ad int default null, p_hook int default null, p_var int default null, p_nome text default null
) returns setof uuid language plpgsql security definer set search_path = '' as $$
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
  if not ops.is_membro() then
    raise exception 'acesso negado' using errcode = '42501';
  end if;
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

revoke execute on function ops.criar_de_modelo(uuid, uuid, uuid, int, int, int, int, text) from public, anon;
grant execute on function ops.criar_de_modelo(uuid, uuid, uuid, int, int, int, int, text) to authenticated;

-- Conferência: deve mostrar security_definer = true.
select p.proname, p.prosecdef as security_definer
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'ops' and p.proname = 'criar_de_modelo';
