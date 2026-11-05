-- =====================================================================
-- Operação Capi — Migration 014: rejeição fica salva nos comentários
-- Rodar UMA vez no SQL Editor do Supabase. Só mexe no schema ops.
-- Quando uma veiculação sai de "Rejeitado" (voltou para análise, rodando...)
-- ou é removida do card estando rejeitada, o app escreve um comentário no card
-- com a conta, a data, a categoria e o motivo. O motivo e a categoria da
-- veiculação ficam limpos para a próxima rejeição. Rejeição definitiva = mover
-- o card para a lista "Rejeitado".
-- =====================================================================

create or replace function ops.categoria_rejeicao_nome(p text) returns text
language sql immutable set search_path = '' as $$
  select case p
    when 'adulto' then 'Conteúdo adulto/sexual'
    when 'saude_corpo' then 'Saúde e corpo'
    when 'promessa_resultado' then 'Promessa de resultado'
    when 'atributos_pessoais' then 'Atributos pessoais'
    when 'sensacionalismo' then 'Sensacionalismo'
    when 'antes_depois' then 'Antes e depois'
    when 'outro' then 'Outro'
    else p end;
$$;

-- Texto do comentário de uma rejeição.
create or replace function ops.texto_rejeicao(
  p_conta uuid, p_quando timestamptz, p_meta_ad_id text, p_categoria text, p_motivo text
) returns text
language sql stable set search_path = '' as $$
  select '**🚫 Rejeição na ' || coalesce(c.apelido, 'conta') || '**'
      || coalesce(' (' || c.nome || coalesce(' · ' || c.bm_nome, '') || ')', '')
      || E'\nRejeitado em ' || coalesce(to_char(p_quando at time zone 'America/Sao_Paulo', 'DD/MM/YYYY'), 'data não registrada')
      || coalesce(' · anúncio ' || p_meta_ad_id, '')
      || E'\nCategoria: ' || coalesce(ops.categoria_rejeicao_nome(p_categoria), 'não informada')
      || E'\nMotivo: ' || coalesce(nullif(trim(p_motivo), ''), 'não informado')
  from (select 1) x
  left join ops.contas_anuncio c on c.id = p_conta;
$$;

create or replace function ops.veiculacoes_guardar_rejeicao() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if old.status <> 'rejeitado' then
    return case when tg_op = 'DELETE' then old else new end;
  end if;

  if tg_op = 'UPDATE' then
    if new.status = 'rejeitado' then
      return new;
    end if;
    insert into ops.comentarios (card_id, autor_id, texto)
    values (old.card_id, (select user_id from ops.membros where user_id = auth.uid()),
            ops.texto_rejeicao(old.conta_id, old.data_status, old.meta_ad_id, old.categoria_rejeicao, old.motivo_rejeicao));
    new.motivo_rejeicao := null;
    new.categoria_rejeicao := null;
    return new;
  end if;

  -- DELETE: só quando a conta é removida do card (se o card inteiro está sendo apagado, não há onde comentar)
  if exists (select 1 from ops.cards where id = old.card_id) then
    insert into ops.comentarios (card_id, autor_id, texto)
    values (old.card_id, (select user_id from ops.membros where user_id = auth.uid()),
            ops.texto_rejeicao(old.conta_id, old.data_status, old.meta_ad_id, old.categoria_rejeicao, old.motivo_rejeicao));
  end if;
  return old;
end $$;

create trigger veiculacoes_guardar_rejeicao before update of status or delete on ops.veiculacoes
  for each row execute function ops.veiculacoes_guardar_rejeicao();

revoke execute on function ops.veiculacoes_guardar_rejeicao() from public, anon, authenticated;
grant execute on function ops.categoria_rejeicao_nome(text) to authenticated;
grant execute on function ops.texto_rejeicao(uuid, timestamptz, text, text, text) to authenticated;

-- Rejeições que já saíram do "Rejeitado" mas ainda guardavam motivo/categoria
-- (ex.: GE AD9): vira comentário agora, com a data da última rejeição registrada.
do $$
declare
  v record;
begin
  for v in
    select x.*, (select max(r.criado_em) from ops.v_rejeicoes r where r.veiculacao_id = x.id) as quando
    from ops.veiculacoes x
    where x.status <> 'rejeitado' and (nullif(trim(x.motivo_rejeicao), '') is not null or x.categoria_rejeicao is not null)
  loop
    insert into ops.comentarios (card_id, autor_id, texto)
    values (v.card_id, null, ops.texto_rejeicao(v.conta_id, v.quando, v.meta_ad_id, v.categoria_rejeicao, v.motivo_rejeicao));
    update ops.veiculacoes set motivo_rejeicao = null, categoria_rejeicao = null where id = v.id;
  end loop;
end $$;

-- Conferência: deve aparecer "veiculacoes_guardar_rejeicao".
select tgname from pg_trigger where tgrelid = 'ops.veiculacoes'::regclass and tgname = 'veiculacoes_guardar_rejeicao';
