-- =====================================================================
-- 025: apagar ativos antigos + nomes e IDs da planilha de contas
-- =====================================================================
-- Pedido da usuária (10/11/2026):
--   1. Apagar 5 páginas e 36 pixels antigos que não serão mais usados
--      (com os acessos e as ligações com ofertas deles).
--   2. As contas C27–C34 ganham nome, ID da Meta e moeda da planilha
--      "Organização-contas-Facebook" (docs/, fora do Git). As da Mayarah
--      estão desabilitadas na planilha.
--   3. As BMs ganham o ID da Meta da mesma planilha.
-- Tudo dentro do schema ops. Tudo num bloco só: se algo não bater, nada é gravado.
-- =====================================================================

do $do$
declare
  v_paginas text[] := array['Chef. Antonio', 'Viewy', 'O Protocolo Inteligente', 'Criativos para Enriquecer', 'Dra. Regina García'];
  v_pixels text[] := array[
    'XPower', 'Gelatina Latam 1', '[DESATIVADO]', '[DESATIVADO] 2', '[DESATIVADO] 3', 'Avalanche de Seguidores',
    'Insta Magnético', 'Quiz', 'Quiz 2', 'Quiz 3', 'Quiz 4', 'Quiz 5', 'Rico Boost', 'Rico Boost 2', 'Sem Crise',
    'Sem Crise 2', 'Sem Crise 3', 'ToroApp', 'Toro App 2', 'Oração', 'Oração 2', 'Gestor Inteligente',
    '[DESATIVADO] (BM 02 Mayarah)', 'Adesivo emagrecedor', 'Adesivo emagrecedor (2)', 'Doces dos Sonhos',
    'Criativos para Enriquecer', 'Rico Boost (BM 02 Mayarah)', 'Mestre do Prazerr', 'Arcan. Gabriel Latam',
    'Nossa Senhora', 'Pedido [Inglês]', 'Gestação Ativa', 'Chá bariátrico', 'Gelatina bariátrica', 'teste'];
  n int;
  r record;
begin
  -- 1. Ativos antigos.
  if (select count(*) from ops.paginas where nome = any(v_paginas)) <> 5 then
    raise exception 'Esperava achar as 5 páginas antigas.';
  end if;
  if (select count(*) from ops.pixels where nome = any(v_pixels)) <> 36 then
    raise exception 'Esperava achar os 36 pixels antigos.';
  end if;

  delete from ops.acessos
  where pagina_id in (select id from ops.paginas where nome = any(v_paginas))
     or pixel_id in (select id from ops.pixels where nome = any(v_pixels));
  delete from ops.ofertas_ativos
  where pagina_id in (select id from ops.paginas where nome = any(v_paginas))
     or pixel_id in (select id from ops.pixels where nome = any(v_pixels));
  delete from ops.paginas where nome = any(v_paginas);
  delete from ops.pixels where nome = any(v_pixels);

  -- 2. Contas C27–C34 (status das desabilitadas vai para o histórico).
  perform set_config('ops.status_motivo', 'Planilha Organização-contas-Facebook (10/11/2026)', true);
  for r in
    select * from (values
      ('C27', 'CONTA 02 - BM 01 - Maria Eduarda [Dólar]', '1450004346478634', 'USD', 'ativa'),
      ('C28', 'CONTA 03 - BM 01 - Maria Eduarda [Dólar]', '1163323289408597', 'USD', 'ativa'),
      ('C29', 'CONTA 01 - BM 02 - Mayarah Laysla', '3403488873277142', null, 'desativada'),
      ('C30', 'CONTA 02', '889234596497322', null, 'desativada'),
      ('C31', 'CONTA 03 - BM 02 - Mayarah Laysla', '1987401022133619', null, 'desativada'),
      ('C32', 'CONTA 01 - BM 03 - Mayarah Laysla', '1391034329668685', null, 'desativada'),
      ('C33', 'CONTA 02 - BM 03 - Mayarah Laysla', '586010964607537', null, 'desativada'),
      ('C34', 'CONTA 03 - BM 03 - Mayarah Laysla', '25896556346623026', null, 'desativada')
    ) v(apelido, nome, meta_id, moeda, status)
  loop
    if exists (select 1 from ops.contas_anuncio where meta_ad_account_id = r.meta_id and apelido <> r.apelido) then
      raise exception 'O ID % já está em outra conta (era para a %).', r.meta_id, r.apelido;
    end if;
    update ops.contas_anuncio
    set nome = r.nome, meta_ad_account_id = r.meta_id, moeda = coalesce(r.moeda, moeda), status = r.status
    where apelido = r.apelido;
    get diagnostics n = row_count;
    if n <> 1 then raise exception 'Não achei a conta %.', r.apelido; end if;
  end loop;
  perform set_config('ops.status_motivo', '', true);

  -- 3. ID da Meta das BMs.
  for r in
    select * from (values
      ('BM 01 - Luciano Peters', '433120173055287'),
      ('BM 01 - Mayarah Laysla', '3390940594542905'),
      ('BM 02 - Mayarah Laysla', '883992416973017'),
      ('BM 03 - Mayarah Laysla', '979815696078488'),
      ('BM 01 - Viewy', '1159055686318551'),
      ('BM 02 - Viewy', '3977142442508961'),
      ('BM 01 - Henrique', '937486745795106'),
      ('BM 01 - Maneca', '976553810562221'),
      ('BM 01 - Nicoly', '1130926768321218'),
      ('BM 01 - Maria Eduarda', '1893620788081599'),
      ('BM 01 - Cecília', '969904836140200'),
      ('BM 01 - Nina', '1061859983409994'),
      ('BM 01 - Boulevard', '1117081300893818')
    ) v(nome, meta_id)
  loop
    update ops.bms set meta_id = r.meta_id where nome = r.nome;
    get diagnostics n = row_count;
    if n <> 1 then raise exception 'Não achei a BM %.', r.nome; end if;
  end loop;
end
$do$;

-- Conferência: esperado 16 páginas, 15 pixels, 0 contas sem ID e 13 BMs com ID.
select
  (select count(*) from ops.paginas) as paginas,
  (select count(*) from ops.pixels) as pixels,
  (select count(*) from ops.contas_anuncio where meta_ad_account_id is null) as contas_sem_id,
  (select count(*) from ops.bms where meta_id is not null) as bms_com_id;
