-- =====================================================================
-- Operação Capi — Migration 038: Nina pausada, Boulevard e recomeço
-- Rodar UMA vez no SQL Editor do Supabase. Só mexe no schema ops.
--
-- Pedido da usuária (16/11/2026), só cards não arquivados:
--   1. Cards que estão SÓ na AC01NIN ganham a conta AC02BOU ("Não subido";
--      o "Preencher IDs da Meta" acha o anúncio e põe o status da Meta).
--   2. Toda veiculação na AC01NIN vira "Pausado" (as outras contas não mudam).
--   3. Os anúncios recomeçam o aprendizado: toda veiculação "Rodando" passa a
--      contar a fase a partir de hoje (D1 = 16/11). Com isso somem o
--      "Falhou" (veredito só sai depois da validação) e o "No-spend" (só
--      depois de 2 dias rodando).
--   4. Se existirem etiquetas manuais chamadas "Falhou" ou "No spend", saem
--      dos cards (a etiqueta continua cadastrada).
-- =====================================================================

do $$
declare
  v_nina uuid;
  v_bou uuid;
  n_add int;
  n_pausa int;
  n_fase int;
  n_etq int;
begin
  select id into v_nina from ops.contas_anuncio where apelido = 'AC01NIN';
  select id into v_bou from ops.contas_anuncio where apelido = 'AC02BOU';
  if v_nina is null then raise exception 'Conta AC01NIN não encontrada.'; end if;
  if v_bou is null then raise exception 'Conta AC02BOU não encontrada.'; end if;

  -- 1. só na Nina → ganha a Boulevard
  insert into ops.veiculacoes (card_id, conta_id, status)
  select c.id, v_bou, 'nao_subido'
  from ops.cards c
  where not c.arquivado
    and exists (select 1 from ops.veiculacoes v where v.card_id = c.id and v.conta_id = v_nina)
    and not exists (select 1 from ops.veiculacoes v where v.card_id = c.id and v.conta_id <> v_nina)
  on conflict (card_id, conta_id) do nothing;
  get diagnostics n_add = row_count;

  -- 2. Nina pausada
  update ops.veiculacoes v
     set status = 'pausado'
    from ops.cards c
   where c.id = v.card_id and not c.arquivado
     and v.conta_id = v_nina and v.status <> 'pausado';
  get diagnostics n_pausa = row_count;

  -- 3. recomeço do aprendizado
  update ops.veiculacoes v
     set rodando_desde = now()
    from ops.cards c
   where c.id = v.card_id and not c.arquivado
     and v.status = 'rodando';
  get diagnostics n_fase = row_count;

  -- 4. etiquetas manuais "Falhou" / "No spend"
  delete from ops.card_etiquetas ce
   using ops.etiquetas e
   where e.id = ce.etiqueta_id
     and (lower(e.nome) like '%falhou%' or lower(regexp_replace(e.nome, '[^a-zA-Z]', '', 'g')) like '%nospend%');
  get diagnostics n_etq = row_count;

  raise notice 'Boulevard adicionada: %, Nina pausada: %, fases recomeçadas: %, etiquetas tiradas: %', n_add, n_pausa, n_fase, n_etq;
end $$;

-- Conferência: veiculações na Nina e na Boulevard por status (cards não arquivados).
select ca.apelido as conta, v.status, count(*) as veiculacoes,
       count(*) filter (where v.status = 'rodando'
                          and (v.rodando_desde at time zone 'America/Sao_Paulo')::date = (now() at time zone 'America/Sao_Paulo')::date) as fase_recomecada_hoje
from ops.veiculacoes v
join ops.cards c on c.id = v.card_id
join ops.contas_anuncio ca on ca.id = v.conta_id
where not c.arquivado and ca.apelido in ('AC01NIN', 'AC02BOU')
group by ca.apelido, v.status
order by ca.apelido, v.status;
