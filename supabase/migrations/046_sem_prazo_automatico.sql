-- =====================================================================
-- Operação Capi — Migration 046: sem prazo automático nos cards
-- Rodar UMA vez no SQL Editor do Supabase. Só mexe no schema ops.
--
-- Pedido da usuária (19/11/2026): os cards criados a partir de modelo
-- ganhavam prazo sozinhos (campo "prazo em dias" do modelo). Por enquanto
-- ela não quer prazo:
--   1. Todos os modelos ficam sem prazo (o campo continua no modelo, vazio;
--      dá para voltar a usar editando o modelo em Modelos).
--   2. Os cards de Gatilhos (GE, todos os idiomas) na lista "Criação" ficam
--      sem prazo (cada remoção entra no histórico do card).
-- =====================================================================

do $$
declare
  v_modelos text;
  n_modelos int;
  n_cards int;
begin
  select string_agg(nome || ' (' || prazo_dias || ' dias)', ', ' order by nome) into v_modelos
  from ops.modelos_card where prazo_dias is not null;

  update ops.modelos_card set prazo_dias = null where prazo_dias is not null;
  get diagnostics n_modelos = row_count;

  update ops.cards c
     set prazo = null
    from ops.ofertas o, ops.listas l
   where o.id = c.oferta_id and l.id = c.lista_id
     and o.codigo = 'GE' and l.nome = 'Criação'
     and not c.arquivado and c.prazo is not null;
  get diagnostics n_cards = row_count;

  raise notice 'Modelos sem prazo: % (antes: %). Cards de GE em Criação sem prazo: %', n_modelos, coalesce(v_modelos, 'nenhum'), n_cards;
end $$;

-- Conferência: modelos com prazo (deve ser 0) e cards de GE em Criação com prazo (deve ser 0).
select (select count(*) from ops.modelos_card where prazo_dias is not null) as modelos_com_prazo,
       (select count(*) from ops.cards c join ops.ofertas o on o.id = c.oferta_id join ops.listas l on l.id = c.lista_id
         where o.codigo = 'GE' and l.nome = 'Criação' and not c.arquivado and c.prazo is not null) as cards_ge_criacao_com_prazo,
       (select count(*) from ops.cards c join ops.ofertas o on o.id = c.oferta_id join ops.listas l on l.id = c.lista_id
         where o.codigo = 'GE' and l.nome = 'Criação' and not c.arquivado) as cards_ge_em_criacao;
