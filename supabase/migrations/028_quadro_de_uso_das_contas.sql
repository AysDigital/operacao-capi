-- =====================================================================
-- 028: quadro de uso das contas (manual)
-- =====================================================================
-- Pedido da usuária (10/11/2026): um quadro tipo kanban, controlado à mão,
-- mostrando quais contas estão veiculando ads, quais estão só em campanha
-- de aquecimento e quais estão sem uso.
--   uso         veiculando | aquecimento | parada (sem uso)
--   uso_oferta  oferta que a conta está rodando (opcional)
--   uso_nota    anotação livre (opcional)
--   uso_desde   desde quando está nessa coluna
--   uso_posicao ordem dentro da coluna
-- Todas começam em "parada": quem organiza é a usuária.
-- Tudo dentro do schema ops.
-- =====================================================================

alter table ops.contas_anuncio
  add column uso text not null default 'parada' check (uso in ('veiculando', 'aquecimento', 'parada')),
  add column uso_oferta_id uuid references ops.ofertas on delete set null,
  add column uso_nota text,
  add column uso_desde date,
  add column uso_posicao double precision not null default 0;

-- Ordem inicial: pelo apelido.
update ops.contas_anuncio c set uso_posicao = o.n * 1024
from (select id, row_number() over (order by apelido) as n from ops.contas_anuncio) o
where o.id = c.id;

-- Conferência: esperado 35 contas, todas "parada".
select uso, count(*) from ops.contas_anuncio group by uso;
