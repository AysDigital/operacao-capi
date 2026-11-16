-- =====================================================================
-- Operação Capi — Migration 039: "Em veiculação" inteira rodando, D1 hoje
-- Rodar UMA vez no SQL Editor do Supabase. Só mexe no schema ops.
--
-- Pedido da usuária (16/11/2026): todos os cards da lista "Em veiculação"
-- são ads novos e recomeçam do D1 (Validação). A 038 deixou a AC02BOU como
-- "Não subido" nos cards que estavam só na Nina, e por isso eles ficaram sem
-- a pílula de fase. Agora, nos cards não arquivados dessa lista:
--   1. toda conta que não é a AC01NIN (pausada de propósito) e não está
--      "Rodando" passa a "Rodando";
--   2. toda conta "Rodando" conta a fase a partir de hoje (D1 = 16/11).
-- =====================================================================

do $$
declare
  v_nina uuid;
  v_lista uuid;
  n_rodando int;
  n_fase int;
begin
  select id into v_nina from ops.contas_anuncio where apelido = 'AC01NIN';
  select id into v_lista from ops.listas where nome = 'Em veiculação';
  if v_lista is null then raise exception 'Lista "Em veiculação" não encontrada.'; end if;

  update ops.veiculacoes v
     set status = 'rodando'
    from ops.cards c
   where c.id = v.card_id and not c.arquivado and c.lista_id = v_lista
     and v.conta_id is distinct from v_nina
     and v.status <> 'rodando';
  get diagnostics n_rodando = row_count;

  update ops.veiculacoes v
     set rodando_desde = now()
    from ops.cards c
   where c.id = v.card_id and not c.arquivado and c.lista_id = v_lista
     and v.status = 'rodando';
  get diagnostics n_fase = row_count;

  raise notice 'Passaram a Rodando: %, fase recomeçada hoje: %', n_rodando, n_fase;
end $$;

-- Conferência: cards da lista "Em veiculação" por oferta, e quantos têm conta rodando com D1 hoje.
select o.codigo || '-' || o.idioma as oferta,
       count(distinct c.id) as cards,
       count(distinct c.id) filter (where v.status = 'rodando'
         and (v.rodando_desde at time zone 'America/Sao_Paulo')::date = (now() at time zone 'America/Sao_Paulo')::date) as cards_com_d1_hoje
from ops.cards c
join ops.ofertas o on o.id = c.oferta_id
join ops.listas l on l.id = c.lista_id
left join ops.veiculacoes v on v.card_id = c.id
where l.nome = 'Em veiculação' and not c.arquivado
group by o.codigo, o.idioma
order by 1;
