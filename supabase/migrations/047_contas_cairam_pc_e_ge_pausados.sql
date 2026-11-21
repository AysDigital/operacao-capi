-- =====================================================================
-- Operação Capi — Migration 047: contas caíram, PC e GE pausados
-- Rodar UMA vez no SQL Editor do Supabase. Só mexe no schema ops.
--
-- Pedido da usuária (21/11/2026): as contas de anúncio que rodavam as duas
-- ofertas caíram. Nos cards (não arquivados) de Pontos de Comando (PC) e
-- Gatilhos (GE), todos os idiomas, nas listas "Em veiculação" e
-- "Revisão [Edição]":
--   1. Toda conta do card vira "Pausado" (as já pausadas e as rejeitadas
--      ficam como estão).
--   2. A fase dessas contas é zerada (rodando_desde = null). Quando ela
--      subir de novo em contas novas, cada conta nova conta do D1 a partir
--      do dia em que virar "Rodando".
-- =====================================================================

do $$
declare
  n_pausa int;
  n_fase int;
begin
  if (select count(*) from ops.listas where nome in ('Em veiculação', 'Revisão [Edição]')) <> 2 then
    raise exception 'Listas "Em veiculação" ou "Revisão [Edição]" não encontradas.';
  end if;

  update ops.veiculacoes v
     set status = 'pausado'
    from ops.cards c, ops.ofertas o, ops.listas l
   where c.id = v.card_id and o.id = c.oferta_id and l.id = c.lista_id
     and not c.arquivado
     and o.codigo in ('PC', 'GE')
     and l.nome in ('Em veiculação', 'Revisão [Edição]')
     and v.status not in ('pausado', 'rejeitado');
  get diagnostics n_pausa = row_count;

  update ops.veiculacoes v
     set rodando_desde = null
    from ops.cards c, ops.ofertas o, ops.listas l
   where c.id = v.card_id and o.id = c.oferta_id and l.id = c.lista_id
     and not c.arquivado
     and o.codigo in ('PC', 'GE')
     and l.nome in ('Em veiculação', 'Revisão [Edição]')
     and v.rodando_desde is not null;
  get diagnostics n_fase = row_count;

  raise notice 'Contas pausadas: %, fases zeradas: %', n_pausa, n_fase;
end $$;

-- Conferência: por oferta e lista, quantos cards e veiculações; "nao_pausadas"
-- e "com_fase" devem ser 0 (só sobram nao_pausadas se houver alguma rejeitada).
select o.codigo || '-' || o.idioma as oferta, l.nome as lista,
       count(distinct c.id) as cards,
       count(v.id) as veiculacoes,
       count(v.id) filter (where v.status <> 'pausado') as nao_pausadas,
       count(v.rodando_desde) as com_fase
from ops.cards c
join ops.ofertas o on o.id = c.oferta_id
join ops.listas l on l.id = c.lista_id
left join ops.veiculacoes v on v.card_id = c.id
where not c.arquivado and o.codigo in ('PC', 'GE')
  and l.nome in ('Em veiculação', 'Revisão [Edição]')
group by o.codigo, o.idioma, l.nome
order by 1, 2;
