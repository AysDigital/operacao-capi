-- =====================================================================
-- Operação Capi — Migration 045: PC-EN "Em veiculação" com D1 hoje
-- Rodar UMA vez no SQL Editor do Supabase. Só mexe no schema ops.
--
-- Pedido da usuária (17/11/2026): todos os ads de PC-EN na lista
-- "Em veiculação" foram subidos hoje numa conta nova, então todos começam
-- no D1 hoje. Alguns apareciam como D2 porque a conta tinha sido marcada
-- "Rodando" ontem. Toda veiculação "Rodando" desses cards (não arquivados)
-- passa a contar a fase a partir de hoje.
-- =====================================================================

do $$
declare
  v_oferta uuid;
  v_lista uuid;
  n int;
begin
  select id into v_oferta from ops.ofertas where codigo = 'PC' and idioma = 'EN';
  select id into v_lista from ops.listas where nome = 'Em veiculação';
  if v_oferta is null or v_lista is null then raise exception 'Oferta PC-EN ou lista "Em veiculação" não encontrada.'; end if;

  update ops.veiculacoes v
     set rodando_desde = now()
    from ops.cards c
   where c.id = v.card_id and not c.arquivado
     and c.oferta_id = v_oferta and c.lista_id = v_lista
     and v.status = 'rodando';
  get diagnostics n = row_count;
  raise notice 'Veiculações com D1 hoje: %', n;
end $$;

-- Conferência: cards de PC-EN em "Em veiculação" e quantos têm conta rodando com D1 hoje.
select count(distinct c.id) as cards,
       count(distinct c.id) filter (where v.status = 'rodando'
         and (v.rodando_desde at time zone 'America/Sao_Paulo')::date = (now() at time zone 'America/Sao_Paulo')::date) as cards_com_d1_hoje,
       count(distinct c.id) filter (where not exists (
         select 1 from ops.veiculacoes x where x.card_id = c.id and x.status = 'rodando')) as cards_sem_conta_rodando
from ops.cards c
join ops.ofertas o on o.id = c.oferta_id
join ops.listas l on l.id = c.lista_id
left join ops.veiculacoes v on v.card_id = c.id
where o.codigo = 'PC' and o.idioma = 'EN' and l.nome = 'Em veiculação' and not c.arquivado;
