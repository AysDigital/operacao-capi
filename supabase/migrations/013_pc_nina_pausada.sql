-- =====================================================================
-- Operação Capi — Migration 013: Pontos de Comando depois da pausa na Nina (04/11/2026)
-- Rodar UMA vez no SQL Editor do Supabase. Só mexe no schema ops.
--   1. Contas Nina (C01), Boulevard (C02) e Cecilia (C01) ficam ativas, para
--      aparecerem em "+ Subir em outra conta".
--   2. Todas as veiculações de PC na Conta 01 - BM 01 - Nina → Pausado
--      (a veiculação fica no card: métricas e histórico continuam contando).
--   3. Veiculações na Nina que faltavam (IDs tirados da Meta):
--      AD12-H1-M1 rejeitado; AD6-H1-M2 e AD31-H1-M1 pausados.
--   4. Cards de PC em "Em veiculação" que NÃO estão na Conta 02 - BM 01 - Boulevard
--      → "Pronto pra subir" (os que estão na Boulevard continuam em veiculação).
-- Pode rodar de novo sem estragar nada.
-- =====================================================================

do $$
declare
  v_pc uuid;
  v_nina uuid;
  v_boulevard uuid;
  v_veiculacao uuid;
  v_pronto uuid;
  v_ids uuid[];
  r record;
  v_card uuid;
begin
  perform set_config('ops.silencio', '1', true);

  select id into v_pc from ops.ofertas
   where idioma = 'EN' and (codigo = 'PC' or nome ilike '%pontos de comando%')
   order by (codigo = 'PC') desc limit 1;
  select id into v_nina from ops.contas_anuncio where meta_ad_account_id = '28803980532621652';
  select id into v_boulevard from ops.contas_anuncio where meta_ad_account_id = '1033394309762444';
  select id into v_veiculacao from ops.listas where nome ilike 'em veicula%' order by arquivada, ordem limit 1;
  select id into v_pronto from ops.listas where nome ilike 'pronto%subir%' order by arquivada, ordem limit 1;
  if v_pc is null or v_nina is null or v_boulevard is null or v_veiculacao is null or v_pronto is null then
    raise exception 'Oferta, conta ou lista não encontrada (rode a 011 antes).';
  end if;

  -- 1. Contas em uso ficam ativas
  update ops.contas_anuncio set ativa = true
   where meta_ad_account_id in ('28803980532621652', '1033394309762444', '1389824603342036') and not ativa;

  -- 2. PC na Nina: pausado
  update ops.veiculacoes v set status = 'pausado'
    from ops.cards c
   where c.id = v.card_id and c.oferta_id = v_pc and v.conta_id = v_nina and v.status <> 'pausado';

  -- 3. Veiculações que faltavam na Nina
  for r in
    select * from (values
      (12, 1, 1, '52544473245945', 'ad12-h1-m1', 'rejeitado'),
      (6,  1, 2, '52544474620745', 'ad6-h1-m2',  'pausado'),
      (31, 1, 1, '52544474348345', 'ad31-h1-m1', 'pausado')
    ) as t(ad, h, m, meta_ad_id, nome_meta, status)
  loop
    select id into v_card from ops.cards
     where oferta_id = v_pc and tipo = 'ad' and ad_num = r.ad and hook_num = r.h and var_num = r.m;
    if v_card is not null and not exists (select 1 from ops.veiculacoes where meta_ad_id = r.meta_ad_id) then
      insert into ops.veiculacoes (card_id, conta_id, status, meta_ad_id, nome_no_meta)
      values (v_card, v_nina, r.status, r.meta_ad_id, r.nome_meta)
      on conflict (card_id, conta_id) do update
        set meta_ad_id = excluded.meta_ad_id, nome_no_meta = excluded.nome_no_meta, status = excluded.status;
    end if;
  end loop;

  -- 4. PC em veiculação sem a Boulevard → Pronto pra subir (no fim da lista, na ordem atual)
  select array_agg(c.id) into v_ids
    from ops.cards c
   where c.oferta_id = v_pc and c.tipo = 'ad' and not c.arquivado and c.lista_id = v_veiculacao
     and not exists (select 1 from ops.veiculacoes v where v.card_id = c.id and v.conta_id = v_boulevard);
  if v_ids is not null then
    perform ops.mover_cards(v_ids, v_pronto);
  end if;
end $$;

-- Conferência 1: PC por lista. Deve dar 10 em "Em veiculação" e 9 em "Pronto pra subir".
select l.nome as lista, count(*) as cards, string_agg(c.nome, ', ' order by c.ad_num, c.hook_num, c.var_num) as quais
from ops.cards c
join ops.listas l on l.id = c.lista_id
where c.oferta_id = (select id from ops.ofertas where idioma = 'EN' and (codigo = 'PC' or nome ilike '%pontos de comando%')
                     order by (codigo = 'PC') desc limit 1)
  and c.tipo = 'ad' and not c.arquivado and l.nome ilike any (array['em veicula%', 'pronto%'])
group by l.nome order by l.nome;

-- Conferência 2: as três contas (todas devem estar ativa = true).
select apelido, nome, bm_nome, ativa from ops.contas_anuncio
where meta_ad_account_id in ('28803980532621652', '1033394309762444', '1389824603342036')
order by apelido;
