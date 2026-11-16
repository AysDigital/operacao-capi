-- =====================================================================
-- Operação Capi — Migration 040: 13 ads de PC-EN ainda não subidos na Boulevard
-- Rodar UMA vez no SQL Editor do Supabase. Só mexe no schema ops.
--
-- Pedido da usuária (16/11/2026): estes ads ainda não estão subidos na
-- AC02BOU (por isso não têm ID da Meta):
--   AD25, AD26, AD27, AD47, AD53, AD77, AD79, AD80, AD12, AD95, AD96, AD97 e
--   AD98 (todos H1-M1-VD).
--   1. A veiculação na AC02BOU volta para "Não subido" (e sem início de fase:
--      o D1 começa quando ela voltar a "Rodando").
--   2. Os que estão na lista "Em veiculação" vão para "Pronto pra subir"
--      (no fim da lista). As outras contas do card não mudam.
-- =====================================================================

do $$
declare
  v_oferta uuid;
  v_bou uuid;
  v_em uuid;
  v_pronto uuid;
  v_ads int[] := array[25, 26, 27, 47, 53, 77, 79, 80, 12, 95, 96, 97, 98];
  v_achados int;
  n_status int;
  n_movidos int;
begin
  select id into v_oferta from ops.ofertas where codigo = 'PC' and idioma = 'EN';
  select id into v_bou from ops.contas_anuncio where apelido = 'AC02BOU';
  select id into v_em from ops.listas where nome = 'Em veiculação';
  select id into v_pronto from ops.listas where nome = 'Pronto pra subir';
  if v_oferta is null or v_bou is null or v_em is null or v_pronto is null then
    raise exception 'Oferta PC-EN, conta AC02BOU ou listas não encontradas.';
  end if;

  select count(*) into v_achados
  from ops.cards c
  where c.oferta_id = v_oferta and c.tipo = 'ad' and not c.arquivado
    and c.ad_num = any (v_ads) and c.hook_num = 1 and c.var_num = 1 and c.formato = 'VD';
  if v_achados <> 13 then
    raise exception 'Esperava 13 cards (AD25…AD98, H1-M1-VD) e achei %. Nada foi alterado.', v_achados;
  end if;

  -- 1. AC02BOU volta para "Não subido", sem início de fase
  update ops.veiculacoes v
     set status = 'nao_subido', rodando_desde = null
    from ops.cards c
   where c.id = v.card_id and v.conta_id = v_bou
     and c.oferta_id = v_oferta and c.tipo = 'ad' and not c.arquivado
     and c.ad_num = any (v_ads) and c.hook_num = 1 and c.var_num = 1 and c.formato = 'VD'
     and (v.status <> 'nao_subido' or v.rodando_desde is not null);
  get diagnostics n_status = row_count;

  -- 2. de "Em veiculação" para o fim de "Pronto pra subir", na ordem do AD
  with alvo as (
    select c.id, row_number() over (order by c.ad_num) as n
    from ops.cards c
    where c.oferta_id = v_oferta and c.tipo = 'ad' and not c.arquivado and c.lista_id = v_em
      and c.ad_num = any (v_ads) and c.hook_num = 1 and c.var_num = 1 and c.formato = 'VD'
  ),
  fim as (
    select coalesce(max(posicao), 0) as p from ops.cards where oferta_id = v_oferta and lista_id = v_pronto
  )
  update ops.cards c
     set lista_id = v_pronto, posicao = fim.p + alvo.n * 1024
    from alvo, fim
   where c.id = alvo.id;
  get diagnostics n_movidos = row_count;

  raise notice 'Boulevard voltou para Não subido: %, cards movidos para Pronto pra subir: %', n_status, n_movidos;
end $$;

-- Conferência: os 13 cards, a lista e o status de cada conta.
select c.nome, l.nome as lista, string_agg(ca.apelido || ': ' || v.status, ', ' order by ca.apelido) as contas
from ops.cards c
join ops.ofertas o on o.id = c.oferta_id
join ops.listas l on l.id = c.lista_id
left join ops.veiculacoes v on v.card_id = c.id
left join ops.contas_anuncio ca on ca.id = v.conta_id
where o.codigo = 'PC' and o.idioma = 'EN' and c.tipo = 'ad' and not c.arquivado
  and c.ad_num in (25, 26, 27, 47, 53, 77, 79, 80, 12, 95, 96, 97, 98) and c.hook_num = 1 and c.var_num = 1 and c.formato = 'VD'
group by c.nome, c.ad_num, l.nome
order by c.ad_num;
