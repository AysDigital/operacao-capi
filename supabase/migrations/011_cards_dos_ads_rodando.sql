-- =====================================================================
-- Operação Capi — Migration 011: cards dos ads que estão rodando (04/11/2026)
-- Rodar UMA vez no SQL Editor do Supabase. Só mexe no schema ops.
-- Ads ativos na Meta, conferidos com o quadro do Trello:
--   Pontos de Comando (EN): Conta 01 - BM 01 - Nina e Conta 02 - BM 01 - Boulevard
--   Gatilhos de Esguicho (ES): Conta 01 - BM 01 - Cecilia
-- Cria as ofertas e contas só se ainda não existirem. Cards vão para "Em veiculação",
-- com uma veiculação "Rodando" por conta, já ligada ao ID do anúncio na Meta.
-- Pode rodar de novo sem duplicar nada.
-- =====================================================================

do $$
declare
  v_lista uuid;
  v_pc uuid;
  v_ge uuid;
  v_conta record;
  v_n int;
  v_apelido text;
  r record;
  v_card uuid;
  v_oferta uuid;
  v_conta_id uuid;
begin
  perform set_config('ops.silencio', '1', true);

  select id into v_lista from ops.listas where nome ilike 'em veicula%' order by arquivada, ordem limit 1;
  if v_lista is null then
    raise exception 'Lista "Em veiculação" não encontrada.';
  end if;

  -- Ofertas (procura pela sigla ou pelo nome; cria se não houver)
  select id into v_pc from ops.ofertas
   where idioma = 'EN' and (codigo = 'PC' or nome ilike '%pontos de comando%')
   order by (codigo = 'PC') desc limit 1;
  if v_pc is null then
    insert into ops.ofertas (nome, codigo, idioma, status) values ('Pontos de Comando', 'PC', 'EN', 'testando')
    returning id into v_pc;
  end if;

  select id into v_ge from ops.ofertas
   where idioma = 'ES' and (codigo = 'GE' or nome ilike '%gatilhos%')
   order by (codigo = 'GE') desc limit 1;
  if v_ge is null then
    insert into ops.ofertas (nome, codigo, idioma, status) values ('Gatilhos de Esguicho', 'GE', 'ES', 'testando')
    returning id into v_ge;
  end if;

  -- Contas (procura pelo ID da Meta; cria com o próximo apelido livre se não houver)
  create temp table _contas (chave text primary key, conta_id uuid) on commit drop;
  for v_conta in
    select * from (values
      ('NINA1', '28803980532621652', 'Conta 01', 'BM 01 - Nina'),
      ('BOUL2', '1033394309762444',  'Conta 02', 'BM 01 - Boulevard'),
      ('CEC1',  '1389824603342036',  'Conta 01', 'BM 01 - Cecilia')
    ) as t(chave, meta_id, nome, bm)
  loop
    select id into v_conta_id from ops.contas_anuncio where meta_ad_account_id = v_conta.meta_id;
    if v_conta_id is null then
      v_n := 1;
      loop
        v_apelido := 'C' || v_n;
        exit when not exists (select 1 from ops.contas_anuncio where apelido = v_apelido);
        v_n := v_n + 1;
      end loop;
      insert into ops.contas_anuncio (nome, apelido, bm_nome, meta_ad_account_id, ativa)
      values (v_conta.nome, v_apelido, v_conta.bm, v_conta.meta_id, true)
      returning id into v_conta_id;
    end if;
    insert into _contas values (v_conta.chave, v_conta_id);
  end loop;

  -- Ads: oferta, AD, H, M, conta, ID do anúncio na Meta, nome na Meta
  for r in
    select * from (values
    ('GE', 1, 1, 1, 'CEC1', '52529648515232', 'ad1-h1-m1'),
    ('GE', 1, 1, 2, 'CEC1', '52529648513832', 'ad1-h1-m2'),
    ('GE', 2, 1, 1, 'CEC1', '52529648513232', 'ad2-h1-m1'),
    ('GE', 2, 1, 2, 'CEC1', '52529648512432', 'ad2-h1-m2'),
    ('GE', 2, 2, 1, 'CEC1', '52529648515632', 'ad2-h2-m1'),
    ('GE', 2, 2, 2, 'CEC1', '52529648513432', 'ad2-h2-m2'),
    ('GE', 3, 1, 1, 'CEC1', '52529648515432', 'ad3-h1-m1'),
    ('GE', 3, 2, 1, 'CEC1', '52529648513632', 'ad3-h2-m1'),
    ('GE', 3, 3, 1, 'CEC1', '52529648517032', 'ad3-h3-m1'),
    ('GE', 4, 1, 1, 'CEC1', '52529648515832', 'ad4-h1-m1'),
    ('GE', 5, 1, 1, 'CEC1', '52529648516832', 'ad5-h1-m1'),
    ('GE', 6, 1, 1, 'CEC1', '52529648516432', 'ad6-h1-m1'),
    ('GE', 7, 1, 1, 'CEC1', '52529648512632', 'ad7-h1-m1'),
    ('GE', 8, 1, 1, 'CEC1', '52529648516232', 'ad8-h1-m1'),
    ('GE', 10, 1, 1, 'CEC1', '52529648512232', 'ad10-h1-m1'),
    ('GE', 11, 1, 1, 'CEC1', '52529648512832', 'ad11-h1-m1'),
    ('GE', 12, 1, 1, 'CEC1', '52529648516632', 'ad12-h1-m1'),
    ('GE', 13, 1, 1, 'CEC1', '52529648511832', 'ad13-h1-m1'),
    ('GE', 14, 1, 1, 'CEC1', '52529648517232', 'ad14-h1-m1'),
    ('GE', 15, 1, 1, 'CEC1', '52529648513032', 'ad15-h1-m1'),
    ('PC', 13, 1, 1, 'NINA1', '52544474621745', 'ad13-h1-m1'),
    ('PC', 25, 1, 1, 'NINA1', '52544474347745', 'ad25-h1-m1'),
    ('PC', 26, 1, 1, 'NINA1', '52544474719745', 'ad26-h1-m1'),
    ('PC', 27, 1, 1, 'NINA1', '52544474347945', 'ad27-h1-m1'),
    ('PC', 29, 1, 1, 'BOUL2', '120248854909140772', 'ad29-h1-m1'),
    ('PC', 29, 1, 1, 'NINA1', '52544474348145', 'ad29-h1-m1'),
    ('PC', 29, 1, 2, 'BOUL2', '120248855053520772', 'ad29-h1-m2'),
    ('PC', 29, 1, 2, 'NINA1', '52544474719945', 'ad29-h1-m2'),
    ('PC', 36, 1, 1, 'BOUL2', '120248855053560772', 'ad36-h1-m1'),
    ('PC', 36, 1, 1, 'NINA1', '52544474621145', 'ad36-h1-m1'),
    ('PC', 47, 1, 1, 'NINA1', '52544474621345', 'ad47-h1-m1'),
    ('PC', 53, 1, 1, 'NINA1', '52544474719545', 'ad53-h1-m1'),
    ('PC', 59, 1, 1, 'BOUL2', '120248855053570772', 'ad59-h1-m1'),
    ('PC', 59, 1, 1, 'NINA1', '52544474621545', 'ad59-h1-m1'),
    ('PC', 75, 1, 1, 'BOUL2', '120248855053530772', 'ad75-h1-m1'),
    ('PC', 75, 1, 1, 'NINA1', '52544474720145', 'ad75-h1-m1'),
    ('PC', 76, 1, 1, 'BOUL2', '120248855053550772', 'ad76-h1-m1'),
    ('PC', 76, 1, 1, 'NINA1', '52544474720345', 'ad76-h1-m1'),
    ('PC', 77, 1, 1, 'NINA1', '52544758791345', 'ad77-h1-m1'),
    ('PC', 78, 1, 1, 'BOUL2', '120248855053580772', 'ad78-h1-m1'),
    ('PC', 78, 1, 1, 'NINA1', '52544474880745', 'ad78-h1-m1'),
    ('PC', 79, 1, 1, 'NINA1', '52544474880945', 'ad79-h1-m1'),
    ('PC', 80, 1, 1, 'NINA1', '52544474881145', 'ad80-h1-m1'),
    ('PC', 81, 1, 1, 'BOUL2', '120248855053590772', 'ad81-h1-m1'),
    ('PC', 81, 1, 1, 'NINA1', '52544705907945', 'ad81-h1-m1'),
    ('PC', 82, 1, 1, 'BOUL2', '120248855053600772', 'ad82-h1-m1'),
    ('PC', 82, 1, 1, 'NINA1', '52544705907545', 'ad82-h1-m1'),
    ('PC', 83, 1, 1, 'BOUL2', '120248855053540772', 'ad83-h1-m1'),
    ('PC', 83, 1, 1, 'NINA1', '52544705907745', 'ad83-h1-m1')
    ) as t(oferta, ad, h, m, conta, meta_ad_id, nome_meta)
  loop
    v_oferta := case r.oferta when 'PC' then v_pc else v_ge end;

    insert into ops.cards (oferta_id, lista_id, tipo, formato, ad_num, hook_num, var_num, nome)
    values (v_oferta, v_lista, 'ad', 'VD', r.ad, r.h, r.m, '-')
    on conflict (oferta_id, ad_num, hook_num, var_num) where tipo = 'ad' do nothing;

    select id into v_card from ops.cards
     where oferta_id = v_oferta and tipo = 'ad' and ad_num = r.ad and hook_num = r.h and var_num = r.m;

    select conta_id into v_conta_id from _contas where chave = r.conta;

    if not exists (select 1 from ops.veiculacoes where meta_ad_id = r.meta_ad_id) then
      insert into ops.veiculacoes (card_id, conta_id, status, meta_ad_id, nome_no_meta)
      values (v_card, v_conta_id, 'rodando', r.meta_ad_id, r.nome_meta)
      on conflict (card_id, conta_id) do update
        set meta_ad_id = excluded.meta_ad_id, nome_no_meta = excluded.nome_no_meta, status = 'rodando';
    end if;
  end loop;
end $$;

-- Conferência: deve mostrar 19 cards / 29 veiculações em PC-EN e 20 / 20 em GE-ES.
select o.codigo || '-' || o.idioma as oferta, count(distinct c.id) as cards, count(v.id) as veiculacoes
from ops.cards c
join ops.ofertas o on o.id = c.oferta_id
left join ops.veiculacoes v on v.card_id = c.id
where o.id in (
  select id from ops.ofertas where (idioma = 'EN' and (codigo = 'PC' or nome ilike '%pontos de comando%'))
                                 or (idioma = 'ES' and (codigo = 'GE' or nome ilike '%gatilhos%'))
) and c.tipo = 'ad' and not c.arquivado
group by 1 order by 1;
