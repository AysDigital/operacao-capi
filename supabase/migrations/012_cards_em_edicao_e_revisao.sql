-- =====================================================================
-- Operação Capi — Migration 012: cards em edição e revisão (quadro do Trello, 04/11/2026)
-- Rodar UMA vez no SQL Editor do Supabase. Só mexe no schema ops.
-- Traz do Trello os ads de Pontos de Comando (EN) e Gatilhos de Esguicho (ES) que estavam em:
--   Aguardando edição [GE] / [PC] e 🚨 Edição urgente  → "Aguardando edição"
--   Revisão [Edição] e 🚨 Revisão [Edição]             → "Revisão [Edição]"
-- Os que vinham das listas 🚨 ganham a etiqueta "Urgente" (criada se não existir).
-- Ainda sem veiculação. Card que já existe (ex.: PC AD13-H1-M1, que está rodando) fica como está.
-- Pode rodar de novo sem duplicar nada.
-- =====================================================================

do $$
declare
  v_aguardando uuid;
  v_revisao uuid;
  v_pc uuid;
  v_ge uuid;
  v_urgente uuid;
  v_oferta uuid;
  v_card uuid;
  r record;
begin
  perform set_config('ops.silencio', '1', true);

  select id into v_aguardando from ops.listas where nome ilike 'aguardando edi%' order by arquivada, ordem limit 1;
  select id into v_revisao from ops.listas where nome ilike 'revis%edi%' order by arquivada, ordem limit 1;
  if v_aguardando is null or v_revisao is null then
    raise exception 'Listas "Aguardando edição" ou "Revisão [Edição]" não encontradas.';
  end if;

  select id into v_pc from ops.ofertas
   where idioma = 'EN' and (codigo = 'PC' or nome ilike '%pontos de comando%')
   order by (codigo = 'PC') desc limit 1;
  select id into v_ge from ops.ofertas
   where idioma = 'ES' and (codigo = 'GE' or nome ilike '%gatilhos%')
   order by (codigo = 'GE') desc limit 1;
  if v_pc is null or v_ge is null then
    raise exception 'Ofertas PC-EN ou GE-ES não encontradas (rode a 011 antes).';
  end if;

  insert into ops.etiquetas (nome, cor) values ('Urgente', '#c0352b') on conflict (nome) do nothing;
  select id into v_urgente from ops.etiquetas where nome = 'Urgente';

  -- Na ordem do Trello: oferta, AD, H, M, lista (AG = aguardando edição, REV = revisão), urgente
  for r in
    select * from (values
    ('GE', 16, 1, 1, 'AG', false),
    ('GE', 17, 1, 1, 'AG', false),
    ('GE', 18, 1, 1, 'AG', false),
    ('GE', 19, 1, 1, 'AG', false),
    ('GE', 20, 1, 1, 'AG', false),
    ('GE', 21, 1, 1, 'AG', false),
    ('GE', 22, 1, 1, 'AG', false),
    ('GE', 23, 1, 1, 'AG', false),
    ('GE', 24, 1, 1, 'AG', false),
    ('GE', 25, 1, 1, 'AG', false),
    ('GE', 26, 1, 1, 'AG', false),
    ('PC', 84, 1, 1, 'AG', false),
    ('PC', 85, 1, 1, 'AG', false),
    ('PC', 86, 1, 1, 'AG', false),
    ('PC', 87, 1, 1, 'AG', false),
    ('PC', 88, 1, 1, 'AG', false),
    ('PC', 89, 1, 1, 'AG', false),
    ('PC', 36, 2, 1, 'AG', false),
    ('PC', 36, 3, 1, 'AG', false),
    ('PC', 29, 4, 1, 'AG', false),
    ('PC', 29, 5, 1, 'AG', false),
    ('PC', 90, 1, 1, 'AG', false),
    ('PC', 91, 1, 1, 'AG', false),
    ('PC', 92, 1, 1, 'AG', false),
    ('PC', 93, 1, 1, 'AG', false),
    ('PC', 94, 1, 1, 'AG', false),
    ('PC', 12, 1, 1, 'AG', true),
    ('GE', 9, 1, 1, 'REV', true),
    ('PC', 31, 1, 1, 'REV', true),
    ('PC', 6, 1, 2, 'REV', true),
    ('GE', 15, 3, 1, 'REV', false),
    ('GE', 15, 2, 1, 'REV', false),
    ('GE', 1, 2, 1, 'REV', false),
    ('GE', 1, 3, 1, 'REV', false)
    ) as t(oferta, ad, h, m, lista, urgente)
  loop
    v_oferta := case r.oferta when 'PC' then v_pc else v_ge end;
    v_card := null;

    insert into ops.cards (oferta_id, lista_id, tipo, formato, ad_num, hook_num, var_num, nome)
    values (v_oferta, case r.lista when 'AG' then v_aguardando else v_revisao end,
            'ad', 'VD', r.ad, r.h, r.m, '-')
    on conflict (oferta_id, ad_num, hook_num, var_num) where tipo = 'ad' do nothing
    returning id into v_card;

    if v_card is not null and r.urgente then
      insert into ops.card_etiquetas (card_id, etiqueta_id) values (v_card, v_urgente) on conflict do nothing;
    end if;
  end loop;
end $$;

-- Conferência: deve mostrar PC-EN com 16 em Aguardando edição e 2 em Revisão [Edição];
-- GE-ES com 11 em Aguardando edição e 5 em Revisão [Edição].
select o.codigo || '-' || o.idioma as oferta, l.nome as lista, count(*) as cards
from ops.cards c
join ops.ofertas o on o.id = c.oferta_id
join ops.listas l on l.id = c.lista_id
where o.id in (
  select id from ops.ofertas where (idioma = 'EN' and (codigo = 'PC' or nome ilike '%pontos de comando%'))
                                 or (idioma = 'ES' and (codigo = 'GE' or nome ilike '%gatilhos%'))
) and c.tipo = 'ad' and not c.arquivado
group by 1, 2 order by 1, 2;
