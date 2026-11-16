-- =====================================================================
-- Operação Capi — Migration 037: PC-EN "Em veiculação" → Rodando
-- Rodar UMA vez no SQL Editor do Supabase. Só mexe no schema ops.
--
-- Pedido da usuária (16/11/2026): todas as veiculações dos cards da lista
-- "Em veiculação" da oferta Pontos de Comando em inglês (PC-EN) passam a
-- "Rodando". Cards arquivados ficam de fora.
-- Os gatilhos registram a mudança no histórico de cada card, a data do
-- status fica como hoje e quem não tinha início de fase ganha hoje como D1.
-- =====================================================================

do $$
declare
  v_oferta uuid;
  v_lista uuid;
  n int;
begin
  select id into v_oferta from ops.ofertas where codigo = 'PC' and idioma = 'EN';
  if v_oferta is null then raise exception 'Oferta PC-EN não encontrada.'; end if;
  select id into v_lista from ops.listas where nome = 'Em veiculação';
  if v_lista is null then raise exception 'Lista "Em veiculação" não encontrada.'; end if;

  update ops.veiculacoes v
     set status = 'rodando'
    from ops.cards c
   where c.id = v.card_id
     and c.oferta_id = v_oferta
     and c.lista_id = v_lista
     and not c.arquivado
     and v.status <> 'rodando';
  get diagnostics n = row_count;
  raise notice 'Veiculações mudadas para Rodando: %', n;
end $$;

-- Conferência: cards de PC-EN em "Em veiculação" e o status das veiculações.
select v.status, count(*) as veiculacoes, count(distinct c.id) as cards
from ops.cards c
join ops.ofertas o on o.id = c.oferta_id
join ops.listas l on l.id = c.lista_id
join ops.veiculacoes v on v.card_id = c.id
where o.codigo = 'PC' and o.idioma = 'EN' and l.nome = 'Em veiculação' and not c.arquivado
group by v.status
order by v.status;
