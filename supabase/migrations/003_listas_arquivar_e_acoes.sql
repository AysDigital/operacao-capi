-- =====================================================================
-- Operação Capi — Migration 003: arquivar listas, mover e ordenar cards em lote
-- Rodar UMA vez no SQL Editor do Supabase. Não altera nada fora do schema ops.
-- =====================================================================

-- Listas arquivadas somem de todos os quadros (as listas são as mesmas em todas as ofertas).
-- Os cards continuam ligados a ela e voltam junto quando a lista é restaurada.
alter table ops.listas add column arquivada boolean not null default false;

-- Move os cards para o fim de outra lista, mantendo a ordem entre eles.
-- Roda com as permissões de quem chama (RLS vale normalmente); cada card
-- movido gera o seu "moveu de X para Y" no histórico pelos gatilhos.
create or replace function ops.mover_cards(p_ids uuid[], p_lista uuid) returns void
language sql set search_path = '' as $$
  with base as (
    select coalesce(max(posicao), 0) as fim
    from ops.cards
    where lista_id = p_lista and not (id = any (p_ids))
  ),
  ordem as (
    select id, row_number() over (order by posicao, id) as n
    from ops.cards
    where id = any (p_ids)
  )
  update ops.cards c
  set lista_id = p_lista, posicao = base.fim + ordem.n * 1024
  from ordem, base
  where c.id = ordem.id;
$$;

-- Grava a ordem informada (o primeiro id fica no topo).
create or replace function ops.ordenar_cards(p_ids uuid[]) returns void
language sql set search_path = '' as $$
  update ops.cards c
  set posicao = x.n * 1024
  from unnest(p_ids) with ordinality as x(id, n)
  where c.id = x.id;
$$;

revoke execute on function ops.mover_cards(uuid[], uuid) from public, anon;
revoke execute on function ops.ordenar_cards(uuid[]) from public, anon;
grant execute on function ops.mover_cards(uuid[], uuid) to authenticated;
grant execute on function ops.ordenar_cards(uuid[]) to authenticated;
