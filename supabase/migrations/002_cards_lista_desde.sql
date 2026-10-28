-- =====================================================================
-- Operação Capi — Migration 002: desde quando o card está na lista atual
-- Rodar UMA vez no SQL Editor do Supabase. Não altera nada fora do schema ops.
-- Usada no quadro para mostrar o tempo na lista ("3d") e destacar cards parados.
-- =====================================================================

alter table ops.cards add column lista_desde timestamptz;

-- Cards existentes: a última mudança de lista registrada no histórico; sem nenhuma, a criação.
-- Os gatilhos ficam desligados só nesta atualização, para não mexer em atualizado_em.
alter table ops.cards disable trigger cards_preparar;
alter table ops.cards disable trigger cards_log;

update ops.cards c set lista_desde = coalesce(
  (select max(a.criado_em) from ops.atividades a where a.card_id = c.id and a.tipo = 'card_movido'),
  c.criado_em
);

alter table ops.cards enable trigger cards_preparar;
alter table ops.cards enable trigger cards_log;

alter table ops.cards
  alter column lista_desde set default now(),
  alter column lista_desde set not null;

-- Sempre que o card muda de lista, o relógio recomeça.
create or replace function ops.cards_lista_desde() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.lista_desde := now();
  return new;
end $$;

create trigger cards_lista_desde before update of lista_id on ops.cards
  for each row when (old.lista_id is distinct from new.lista_id)
  execute function ops.cards_lista_desde();

revoke execute on function ops.cards_lista_desde() from public, anon, authenticated;
