-- =====================================================================
-- Operação Capi — Migration 004: card detalhado (prazo, comentários) e exclusões
-- Rodar UMA vez no SQL Editor do Supabase. Não altera nada fora do schema ops.
--
-- Exclusão de card (já coberta pela 001, conferido):
--   anexos, comentários, atividades, veiculações, checklists, etiquetas e membros
--   do card são apagados junto (on delete cascade); as versões criadas a partir
--   dele continuam e só perdem a ligação (parent_card_id on delete set null).
-- Exclusão de lista: o banco só deixa apagar lista sem nenhum card
--   (cards.lista_id on delete restrict); esvaziar_lista() move os cards antes.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Prazo do card
-- ---------------------------------------------------------------------
alter table ops.cards add column prazo date;

-- ---------------------------------------------------------------------
-- 2. Histórico: prazo e versão de origem excluída (o resto igual à 001)
-- ---------------------------------------------------------------------
create or replace function ops.cards_log() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  de text;
  para text;
begin
  if tg_op = 'INSERT' then
    select nome into para from ops.listas where id = new.lista_id;
    perform ops.registrar(new.id, 'card_criado', 'criou o card em ' || para, jsonb_build_object('lista_id', new.lista_id));
    if new.parent_card_id is not null then
      select nome into de from ops.cards where id = new.parent_card_id;
      perform ops.registrar(new.id, 'versao_criada',
        'criou esta versão a partir de ' || de || coalesce(' (' || nullif(trim(new.motivo_versao), '') || ')', ''),
        jsonb_build_object('parent_card_id', new.parent_card_id, 'motivo', new.motivo_versao));
      perform ops.registrar(new.parent_card_id, 'versao_derivada', 'nova versão: ' || new.nome,
        jsonb_build_object('card_id', new.id, 'motivo', new.motivo_versao));
    end if;
    return null;
  end if;

  if new.lista_id is distinct from old.lista_id then
    select nome into de from ops.listas where id = old.lista_id;
    select nome into para from ops.listas where id = new.lista_id;
    perform ops.registrar(new.id, 'card_movido', 'moveu de ' || de || ' para ' || para,
      jsonb_build_object('de_lista_id', old.lista_id, 'para_lista_id', new.lista_id));
  end if;
  if new.nome is distinct from old.nome then
    perform ops.registrar(new.id, 'card_renomeado', 'renomeou de ' || old.nome || ' para ' || new.nome,
      jsonb_build_object('de', old.nome, 'para', new.nome));
  end if;
  if new.oferta_id is distinct from old.oferta_id then
    perform ops.registrar(new.id, 'oferta_alterada', 'mudou a oferta do card',
      jsonb_build_object('de_oferta_id', old.oferta_id, 'para_oferta_id', new.oferta_id));
  end if;
  if new.arquivado is distinct from old.arquivado then
    perform ops.registrar(new.id, case when new.arquivado then 'card_arquivado' else 'card_restaurado' end,
      case when new.arquivado then 'arquivou o card' else 'restaurou o card' end);
  end if;
  if new.vencedor is distinct from old.vencedor then
    perform ops.registrar(new.id, case when new.vencedor then 'vencedor_marcado' else 'vencedor_desmarcado' end,
      case when new.vencedor then 'marcou como vencedor' else 'desmarcou como vencedor' end);
  end if;
  if new.prazo is distinct from old.prazo then
    perform ops.registrar(new.id, 'prazo',
      case when new.prazo is null then 'removeu o prazo' else 'definiu o prazo para ' || to_char(new.prazo, 'DD/MM/YYYY') end,
      jsonb_build_object('de', old.prazo, 'para', new.prazo));
  end if;
  if old.parent_card_id is not null and new.parent_card_id is null then
    perform ops.registrar(new.id, 'origem_removida', 'perdeu a ligação com a versão de origem (excluída)',
      jsonb_build_object('parent_card_id', old.parent_card_id));
  end if;
  return null;
end $$;

-- ---------------------------------------------------------------------
-- 3. Categorias de rejeição
-- ---------------------------------------------------------------------
-- "not valid": vale para o que for gravado daqui em diante, sem travar a migration
-- se já existir algum texto antigo.
alter table ops.veiculacoes add constraint veiculacoes_categoria_rejeicao check (
  categoria_rejeicao is null or categoria_rejeicao in
    ('adulto', 'saude_corpo', 'promessa_resultado', 'atributos_pessoais', 'sensacionalismo', 'antes_depois', 'outro')
) not valid;

-- ---------------------------------------------------------------------
-- 4. Comentários: todos os membros leem; só o autor edita e apaga
-- ---------------------------------------------------------------------
drop policy membros_tudo on ops.comentarios;
create policy membros_leem on ops.comentarios for select to authenticated using (ops.is_membro());
create policy autor_cria on ops.comentarios for insert to authenticated
  with check (ops.is_membro() and autor_id = auth.uid());
create policy autor_edita on ops.comentarios for update to authenticated
  using (ops.is_membro() and autor_id = auth.uid()) with check (autor_id = auth.uid());
create policy autor_apaga on ops.comentarios for delete to authenticated
  using (ops.is_membro() and autor_id = auth.uid());

create or replace function ops.comentarios_editado() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.texto is distinct from old.texto then
    new.editado_em := now();
  end if;
  return new;
end $$;

create trigger comentarios_editado before update on ops.comentarios
  for each row execute function ops.comentarios_editado();

-- ---------------------------------------------------------------------
-- 5. Esvaziar uma lista (todos os quadros, inclusive arquivados) antes de excluí-la
-- ---------------------------------------------------------------------
create or replace function ops.esvaziar_lista(p_de uuid, p_para uuid) returns void
language sql set search_path = '' as $$
  select ops.mover_cards(array(select id from ops.cards where lista_id = p_de), p_para);
$$;

revoke execute on function ops.comentarios_editado() from public, anon, authenticated;
revoke execute on function ops.esvaziar_lista(uuid, uuid) from public, anon;
grant execute on function ops.esvaziar_lista(uuid, uuid) to authenticated;
