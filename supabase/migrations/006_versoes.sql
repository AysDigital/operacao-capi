-- =====================================================================
-- Operação Capi — Migration 006: versões dos ads (família AD → H → M) e duplicar
-- Rodar UMA vez no SQL Editor do Supabase. Não altera nada fora do schema ops.
--
-- Todas as funções rodam com as permissões de quem chama (RLS vale normalmente).
-- Os números novos são calculados aqui dentro, contando arquivados, com uma trava
-- por família (oferta + AD): duas pessoas criando ao mesmo tempo não colidem.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Histórico em silêncio durante a cópia
-- ---------------------------------------------------------------------
-- Copiar etiquetas, anexos etc. para o card novo não deve encher o histórico dele
-- de "adicionou…". A cópia liga ops.silencio só dentro da transação.
create or replace function ops.registrar(p_card uuid, p_tipo text, p_texto text, p_dados jsonb default '{}')
returns void language plpgsql security definer set search_path = '' as $$
begin
  if current_setting('ops.silencio', true) = '1' then
    return;
  end if;
  insert into ops.atividades (card_id, oferta_id, autor_id, tipo, texto, dados)
  select c.id, c.oferta_id, (select user_id from ops.membros where user_id = auth.uid()),
         p_tipo, p_texto, coalesce(p_dados, '{}')
  from ops.cards c where c.id = p_card;   -- card apagado: não registra nada
end $$;

-- ---------------------------------------------------------------------
-- 2. Copiar o conteúdo de um card para outro
-- ---------------------------------------------------------------------
-- Copia etiquetas, membros, anexos e checklists (itens desmarcados).
-- NÃO copia comentários, veiculações, vencedor e prazo.
-- Anexos de imagem (storage:…) saem apontando para o arquivo da origem; o app
-- copia o arquivo para a pasta do card novo logo em seguida e troca o caminho.
create or replace function ops.copiar_conteudo(p_de uuid, p_para uuid) returns void
language plpgsql set search_path = '' as $$
declare
  l record;
  nova uuid;
begin
  perform set_config('ops.silencio', '1', true);

  insert into ops.card_etiquetas (card_id, etiqueta_id)
    select p_para, etiqueta_id from ops.card_etiquetas where card_id = p_de;
  insert into ops.card_membros (card_id, user_id)
    select p_para, user_id from ops.card_membros where card_id = p_de;
  insert into ops.anexos (card_id, titulo, url, ordem)
    select p_para, titulo, url, ordem from ops.anexos where card_id = p_de;

  for l in select id, titulo, ordem from ops.checklists where card_id = p_de order by ordem loop
    insert into ops.checklists (card_id, titulo, ordem) values (p_para, l.titulo, l.ordem) returning id into nova;
    insert into ops.checklist_itens (checklist_id, texto, ordem, feito)
      select nova, texto, ordem, false from ops.checklist_itens where checklist_id = l.id;
  end loop;

  perform set_config('ops.silencio', '0', true);
end $$;

-- Trava da família (oferta + AD) até o fim da transação.
create or replace function ops.travar_familia(p_oferta uuid, p_ad int) returns void
language sql set search_path = '' as $$
  select pg_advisory_xact_lock(hashtextextended('ops.familia:' || p_oferta::text || ':' || p_ad::text, 0));
$$;

-- ---------------------------------------------------------------------
-- 3. Criar versões
-- ---------------------------------------------------------------------
-- p_tipo 'variacao': mesmo AD e H, próximo M livre.
-- p_tipo 'hook':     mesmo AD, próximo H livre, M1.
-- O histórico "criou esta versão a partir de…" (na nova) e "nova versão: …" (na origem)
-- vem do gatilho cards_log, por causa do parent_card_id.
create or replace function ops.criar_versoes(p_origem uuid, p_tipo text, p_quantidade int, p_lista uuid, p_motivo text)
returns setof uuid language plpgsql set search_path = '' as $$
declare
  o record;
  h int;
  m int;
  novo uuid;
begin
  select id, oferta_id, tipo, formato, ad_num, hook_num, descricao into o from ops.cards where id = p_origem;
  if not found then raise exception 'Card de origem não encontrado.'; end if;
  if o.tipo <> 'ad' then raise exception 'Versões existem só para cards do tipo Ad.'; end if;
  if p_tipo not in ('variacao', 'hook') then raise exception 'Tipo de versão inválido: %', p_tipo; end if;
  if coalesce(p_quantidade, 0) < 1 or p_quantidade > 20 then raise exception 'Quantidade deve ficar entre 1 e 20.'; end if;
  if nullif(trim(p_motivo), '') is null then raise exception 'Informe o motivo da versão.'; end if;

  perform ops.travar_familia(o.oferta_id, o.ad_num);

  for i in 1..p_quantidade loop
    if p_tipo = 'variacao' then
      h := o.hook_num;
      select coalesce(max(var_num), 0) + 1 into m from ops.cards
        where oferta_id = o.oferta_id and tipo = 'ad' and ad_num = o.ad_num and hook_num = o.hook_num;
    else
      select coalesce(max(hook_num), 0) + 1 into h from ops.cards
        where oferta_id = o.oferta_id and tipo = 'ad' and ad_num = o.ad_num;
      m := 1;
    end if;

    insert into ops.cards (oferta_id, lista_id, tipo, formato, ad_num, hook_num, var_num, nome, descricao, parent_card_id, motivo_versao)
    values (o.oferta_id, p_lista, 'ad', o.formato, o.ad_num, h, m, '-', o.descricao, o.id, trim(p_motivo))
    returning id into novo;

    perform ops.copiar_conteudo(o.id, novo);
    return next novo;
  end loop;
end $$;

-- "Gerar variações": hooks novos (M1) e variações novas do mesmo hook, numa transação só.
create or replace function ops.gerar_variacoes(p_origem uuid, p_hooks int, p_variacoes int, p_lista uuid, p_motivo text)
returns setof uuid language plpgsql set search_path = '' as $$
begin
  if coalesce(p_hooks, 0) + coalesce(p_variacoes, 0) < 1 then raise exception 'Escolha ao menos um hook ou uma variação.'; end if;
  if p_hooks > 10 or p_variacoes > 10 then raise exception 'No máximo 10 hooks e 10 variações por vez.'; end if;
  if coalesce(p_hooks, 0) > 0 then
    return query select * from ops.criar_versoes(p_origem, 'hook', p_hooks, p_lista, p_motivo);
  end if;
  if coalesce(p_variacoes, 0) > 0 then
    return query select * from ops.criar_versoes(p_origem, 'variacao', p_variacoes, p_lista, p_motivo);
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 4. Duplicar (qualquer tipo)
-- ---------------------------------------------------------------------
-- Ad: usa o AD/H/M informado (sem AD, o próximo AD livre com H1 M1). Não é versão:
-- fica sem parent_card_id. VSL/Outro: usa p_nome (sem nome, "… (cópia)").
create or replace function ops.duplicar_card(p_origem uuid, p_lista uuid, p_ad int, p_hook int, p_var int, p_nome text)
returns uuid language plpgsql set search_path = '' as $$
declare
  o record;
  a int := p_ad;
  novo uuid;
begin
  select id, oferta_id, tipo, formato, nome, descricao into o from ops.cards where id = p_origem;
  if not found then raise exception 'Card de origem não encontrado.'; end if;

  if o.tipo = 'ad' then
    if a is null then
      perform pg_advisory_xact_lock(hashtextextended('ops.oferta:' || o.oferta_id::text, 0));
      select coalesce(max(ad_num), 0) + 1 into a from ops.cards where oferta_id = o.oferta_id and tipo = 'ad';
    end if;
    insert into ops.cards (oferta_id, lista_id, tipo, formato, ad_num, hook_num, var_num, nome, descricao)
    values (o.oferta_id, p_lista, 'ad', o.formato, a, coalesce(p_hook, 1), coalesce(p_var, 1), '-', o.descricao)
    returning id into novo;
  else
    insert into ops.cards (oferta_id, lista_id, tipo, formato, nome, descricao)
    values (o.oferta_id, p_lista, o.tipo, o.formato, coalesce(nullif(trim(p_nome), ''), o.nome || ' (cópia)'), o.descricao)
    returning id into novo;
  end if;

  perform ops.copiar_conteudo(o.id, novo);
  return novo;
end $$;

-- ---------------------------------------------------------------------
-- 5. Permissões
-- ---------------------------------------------------------------------
revoke execute on function ops.copiar_conteudo(uuid, uuid) from public, anon;
revoke execute on function ops.travar_familia(uuid, int) from public, anon;
revoke execute on function ops.criar_versoes(uuid, text, int, uuid, text) from public, anon;
revoke execute on function ops.gerar_variacoes(uuid, int, int, uuid, text) from public, anon;
revoke execute on function ops.duplicar_card(uuid, uuid, int, int, int, text) from public, anon;
grant execute on function ops.copiar_conteudo(uuid, uuid) to authenticated;
grant execute on function ops.travar_familia(uuid, int) to authenticated;
grant execute on function ops.criar_versoes(uuid, text, int, uuid, text) to authenticated;
grant execute on function ops.gerar_variacoes(uuid, int, int, uuid, text) to authenticated;
grant execute on function ops.duplicar_card(uuid, uuid, int, int, int, text) to authenticated;
