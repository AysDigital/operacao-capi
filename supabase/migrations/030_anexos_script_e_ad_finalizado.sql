-- =====================================================================
-- 030: anexos "Script" e "AD Finalizado" em todos os cards de
--      Pontos de Comando (PC) e Gatilhos (GE), em todos os idiomas
-- =====================================================================
-- Pedido da usuária (12/11/2026): todo card dessas ofertas tem os dois
-- anexos com os links abaixo. Os anexos que já se chamavam "Script" ou
-- "AD Finalizado" são trocados; os outros anexos do card ficam como estão.
-- Roda em silêncio (ops.silencio) para não encher o histórico dos cards.
-- Tudo dentro do schema ops. Pode rodar de novo sem duplicar.
-- =====================================================================

do $do$
declare
  n_cards int;
begin
  perform set_config('ops.silencio', '1', true);

  delete from ops.anexos a
  using ops.cards c, ops.ofertas o
  where a.card_id = c.id and o.id = c.oferta_id and o.codigo in ('PC', 'GE')
    and lower(btrim(a.titulo)) in ('script', 'ad finalizado');

  insert into ops.anexos (card_id, titulo, url, ordem)
  select c.id, l.titulo, l.url, l.ordem
  from ops.cards c
  join ops.ofertas o on o.id = c.oferta_id
  join (values
    ('PC', 'Script', 'https://drive.google.com/drive/folders/1BJTYXUxNW0zaFWg8GZZXGnI5DRJjkTsG?usp=drive_link', -2),
    ('PC', 'AD Finalizado', 'https://drive.google.com/drive/folders/1m8t_R2iT4sGxkNsDYn-R2BNPhxILaCDB?usp=drive_link', -1),
    ('GE', 'Script', 'https://drive.google.com/drive/folders/14ANcD4MrKzczkNMAZo_52HIr95-T_Yu4?usp=drive_link', -2),
    ('GE', 'AD Finalizado', 'https://drive.google.com/drive/folders/1flWLHxdtsU9zSQl7-I8ZpwVKklfrOgyy?usp=drive_link', -1)
  ) as l(codigo, titulo, url, ordem) on l.codigo = o.codigo;

  select count(distinct c.id) into n_cards
  from ops.cards c join ops.ofertas o on o.id = c.oferta_id where o.codigo in ('PC', 'GE');
  if n_cards = 0 then raise exception 'Não achei cards das ofertas PC e GE.'; end if;

  perform set_config('ops.silencio', '0', true);
end
$do$;

-- Conferência: por oferta, quantos cards e quantos têm os dois anexos.
select o.codigo || '-' || o.idioma as oferta,
  count(*) as cards,
  count(*) filter (where exists (select 1 from ops.anexos a where a.card_id = c.id and a.titulo = 'Script')
                     and exists (select 1 from ops.anexos a where a.card_id = c.id and a.titulo = 'AD Finalizado')) as com_os_dois
from ops.cards c
join ops.ofertas o on o.id = c.oferta_id
where o.codigo in ('PC', 'GE')
group by 1 order by 1;
