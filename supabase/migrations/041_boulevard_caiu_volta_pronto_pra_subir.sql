-- =====================================================================
-- Operação Capi — Migration 041: página caiu, ads saem da AC02BOU
-- Rodar UMA vez no SQL Editor do Supabase. Só mexe no schema ops.
--
-- Pedido da usuária (16/11/2026): a página usada nos ads caiu e todos os
-- anúncios da AC02BOU pararam. Eles vão ser subidos de novo na AC03BOU.
-- Só cards não arquivados:
--   1. Toda veiculação na AC02BOU vira "Não subido" (sem início de fase).
--   2. Cards em "Em veiculação" com a AC02BOU vão para o fim de
--      "Pronto pra subir".
--   3. Esses cards ganham a AC03BOU como "Não subido" (quando subir, é só
--      mudar para "Rodando" e usar "Preencher IDs da Meta").
-- A AC01NIN continua como estava (pausada).
-- =====================================================================

do $$
declare
  v_bou2 uuid;
  v_bou3 uuid;
  v_em uuid;
  v_pronto uuid;
  n_status int;
  n_movidos int;
  n_bou3 int;
  v_saem uuid[];
begin
  select id into v_bou2 from ops.contas_anuncio where apelido = 'AC02BOU';
  select id into v_bou3 from ops.contas_anuncio where apelido = 'AC03BOU';
  select id into v_em from ops.listas where nome = 'Em veiculação';
  select id into v_pronto from ops.listas where nome = 'Pronto pra subir';
  if v_bou2 is null then raise exception 'Conta AC02BOU não encontrada.'; end if;
  if v_bou3 is null then raise exception 'Conta AC03BOU não encontrada: confira o apelido em Ativos → Contas.'; end if;
  if v_em is null or v_pronto is null then raise exception 'Listas não encontradas.'; end if;

  -- cards que saem de "Em veiculação" (guardados antes de mexer nos status)
  select coalesce(array_agg(c.id), '{}') into v_saem
  from ops.cards c
  where not c.arquivado and c.lista_id = v_em
    and exists (select 1 from ops.veiculacoes v where v.card_id = c.id and v.conta_id = v_bou2);

  -- 1. AC02BOU parada
  update ops.veiculacoes v
     set status = 'nao_subido', rodando_desde = null
    from ops.cards c
   where c.id = v.card_id and not c.arquivado and v.conta_id = v_bou2
     and (v.status <> 'nao_subido' or v.rodando_desde is not null);
  get diagnostics n_status = row_count;

  -- 2. para o fim de "Pronto pra subir" (por oferta, na ordem do nome)
  with alvo as (
    select s.id, s.oferta_id, row_number() over (partition by s.oferta_id order by s.ad_num, s.hook_num, s.var_num, s.nome) as n
    from ops.cards s
    where s.id = any (v_saem)
  ),
  fim as (
    select a.oferta_id, coalesce(max(c.posicao), 0) as p
    from (select distinct oferta_id from alvo) a
    left join ops.cards c on c.oferta_id = a.oferta_id and c.lista_id = v_pronto
    group by a.oferta_id
  )
  update ops.cards c
     set lista_id = v_pronto, posicao = fim.p + alvo.n * 1024
    from alvo join fim on fim.oferta_id = alvo.oferta_id
   where c.id = alvo.id;
  get diagnostics n_movidos = row_count;

  -- 3. AC03BOU como "Não subido"
  insert into ops.veiculacoes (card_id, conta_id, status)
  select s.id, v_bou3, 'nao_subido' from unnest(v_saem) as s(id)
  on conflict (card_id, conta_id) do nothing;
  get diagnostics n_bou3 = row_count;

  raise notice 'AC02BOU parada: %, cards em Pronto pra subir: %, AC03BOU adicionada: %', n_status, n_movidos, n_bou3;
end $$;

-- Conferência: status das contas AC02BOU e AC03BOU (cards não arquivados) e a lista.
select ca.apelido as conta, l.nome as lista, v.status, count(*) as veiculacoes
from ops.veiculacoes v
join ops.cards c on c.id = v.card_id
join ops.listas l on l.id = c.lista_id
join ops.contas_anuncio ca on ca.id = v.conta_id
where not c.arquivado and ca.apelido in ('AC02BOU', 'AC03BOU')
group by ca.apelido, l.nome, v.status
order by ca.apelido, l.nome, v.status;
