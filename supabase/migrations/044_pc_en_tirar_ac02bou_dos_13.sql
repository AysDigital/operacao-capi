-- =====================================================================
-- Operação Capi — Migration 044: tirar a AC02BOU de 13 ads de PC-EN
-- Rodar UMA vez no SQL Editor do Supabase. Só mexe no schema ops.
--
-- Pedido da usuária (16/11/2026): estes ads nunca foram subidos na AC02BOU
-- ("Preencher IDs da Meta" não achou nenhum) e a página dessa conta caiu.
-- A veiculação na AC02BOU sai do card (fica no histórico "removida"):
--   AD12, AD25, AD26, AD27, AD47, AD53, AD77, AD79, AD80, AD95, AD96, AD97 e
--   AD98 (todos H1-M1-VD).
-- Por segurança, só sai a veiculação que está "Não subido" e sem ID da Meta.
-- =====================================================================

do $$
declare
  v_oferta uuid;
  v_bou uuid;
  v_ads int[] := array[12, 25, 26, 27, 47, 53, 77, 79, 80, 95, 96, 97, 98];
  n int;
begin
  select id into v_oferta from ops.ofertas where codigo = 'PC' and idioma = 'EN';
  select id into v_bou from ops.contas_anuncio where apelido = 'AC02BOU';
  if v_oferta is null or v_bou is null then raise exception 'Oferta PC-EN ou conta AC02BOU não encontrada.'; end if;

  delete from ops.veiculacoes v
   using ops.cards c
   where c.id = v.card_id and v.conta_id = v_bou
     and c.oferta_id = v_oferta and c.tipo = 'ad' and not c.arquivado
     and c.ad_num = any (v_ads) and c.hook_num = 1 and c.var_num = 1 and c.formato = 'VD'
     and v.status = 'nao_subido' and v.meta_ad_id is null
     and not exists (select 1 from ops.veiculacoes_ids_extras e where e.veiculacao_id = v.id);
  get diagnostics n = row_count;
  raise notice 'Veiculações na AC02BOU removidas: %', n;
end $$;

-- Conferência: os 13 cards e as contas que sobraram em cada um.
select c.nome, l.nome as lista,
       coalesce(string_agg(ca.apelido || ': ' || v.status, ', ' order by ca.apelido), '(sem contas)') as contas
from ops.cards c
join ops.ofertas o on o.id = c.oferta_id
join ops.listas l on l.id = c.lista_id
left join ops.veiculacoes v on v.card_id = c.id
left join ops.contas_anuncio ca on ca.id = v.conta_id
where o.codigo = 'PC' and o.idioma = 'EN' and c.tipo = 'ad' and not c.arquivado
  and c.ad_num in (12, 25, 26, 27, 47, 53, 77, 79, 80, 95, 96, 97, 98) and c.hook_num = 1 and c.var_num = 1 and c.formato = 'VD'
group by c.nome, c.ad_num, l.nome
order by c.ad_num;
