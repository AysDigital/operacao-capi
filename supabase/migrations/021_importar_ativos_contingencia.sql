-- =====================================================================
-- 021: importar o inventário de ativos (documento "Ativos de contingência
--      Facebook", levantado em 10/11/2026 pelo perfil do Luciano)
-- =====================================================================
-- 1. Arruma as BMs criadas pela 019 a partir do campo "BM" das contas:
--    - "BM 01 - Celilia" e "BM Cecilia" juntam-se em "BM 01 - Cecília";
--    - "ED" não é BM: a Conta 00 (C1) é da "BM 01 - Luciano Peters";
--    - "[Dólar]" sai do nome das BMs Nicoly e Viewy e vira moeda USD nas contas.
-- 2. Cria as BMs que faltavam (Mayarah 01, 02 e 03) e marca as perdidas
--    (BM 01 e 03 - Mayarah, BM 02 - Viewy) como desativadas.
-- 3. Status das contas conforme o documento (❌ = desativada) e cria as 8
--    contas que não estavam no banco (sem ID da Meta: preencha em Editar).
-- 4. Perfis (bloqueados = restrito), páginas e pixels.
-- 5. Acessos: dona e compartilhamentos de BMs, contas, páginas e pixels.
--
-- Nenhum e-mail, senha ou dado pessoal é gravado. Tudo dentro do schema ops.
-- Tudo roda num bloco só: se algum nome não bater, nada é gravado.
-- =====================================================================

do $do$
declare
  v_cec uuid;
  v_luc uuid;
  v_faltam text;
  n int;
  -- ativo_tipo | ativo (nome; contas pelo apelido) | titular_tipo | titular | papel (vazio = compartilhado)
  v_rel text := $r$
bm|BM 01 - Luciano Peters|perfil|Luciano|dona
bm|BM 01 - Luciano Peters|perfil|Henrique|
bm|BM 01 - Luciano Peters|perfil|Maneca|
bm|BM 01 - Boulevard|perfil|Luciano|
bm|BM 01 - Boulevard|perfil|Grupo Capi|
bm|BM 01 - Cecília|perfil|Cecília|dona
bm|BM 01 - Cecília|perfil|Luciano|
bm|BM 01 - Cecília|perfil|Viewy Finanças|
bm|BM 01 - Cecília|perfil|Nicoly|
bm|BM 01 - Cecília|perfil|Maria Eduarda|
bm|BM 01 - Cecília|perfil|Grupo Capi|
bm|BM 01 - Nicoly|perfil|Nicoly|dona
bm|BM 01 - Nicoly|perfil|Luciano|
bm|BM 01 - Nicoly|perfil|Maria Eduarda|
bm|BM 01 - Nicoly|perfil|Maneca|
bm|BM 01 - Maneca|perfil|Maneca|dona
bm|BM 01 - Maneca|perfil|Luciano|
bm|BM 01 - Nina|perfil|Nina|dona
bm|BM 01 - Nina|perfil|Luciano|
bm|BM 01 - Nina|perfil|Viewy Finanças|
bm|BM 01 - Nina|perfil|Nicoly|
bm|BM 01 - Nina|perfil|Grupo Capi|
bm|BM 01 - Henrique|perfil|Henrique|dona
bm|BM 01 - Henrique|perfil|Luciano|
bm|BM 01 - Henrique|perfil|Maneca|
bm|BM 01 - Maria Eduarda|perfil|Maria Eduarda|dona
bm|BM 01 - Maria Eduarda|perfil|Luciano|
bm|BM 01 - Maria Eduarda|perfil|Maneca|
bm|BM 01 - Viewy|perfil|Viewy Finanças|dona
bm|BM 01 - Viewy|perfil|Luciano|
bm|BM 01 - Viewy|perfil|Grupo Capi|
bm|BM 01 - Viewy|perfil|Henrique|
bm|BM 01 - Viewy|perfil|Maneca|
bm|BM 01 - Mayarah Laysla|perfil|Mayarah|dona
bm|BM 02 - Mayarah Laysla|perfil|Mayarah|dona
bm|BM 03 - Mayarah Laysla|perfil|Mayarah|dona
conta|C27|bm|BM 01 - Maria Eduarda|dona
conta|C28|bm|BM 01 - Maria Eduarda|dona
conta|C29|bm|BM 02 - Mayarah Laysla|dona
conta|C30|bm|BM 02 - Mayarah Laysla|dona
conta|C31|bm|BM 02 - Mayarah Laysla|dona
conta|C32|bm|BM 03 - Mayarah Laysla|dona
conta|C33|bm|BM 03 - Mayarah Laysla|dona
conta|C34|bm|BM 03 - Mayarah Laysla|dona
conta|C2|bm|BM 01 - Luciano Peters|
conta|C23|bm|BM 01 - Luciano Peters|
conta|C25|bm|BM 01 - Luciano Peters|
conta|C3|bm|BM 01 - Luciano Peters|
conta|C11|bm|BM 01 - Luciano Peters|
conta|AC03CE|bm|BM 01 - Luciano Peters|
conta|C22|bm|BM 01 - Luciano Peters|
conta|C24|bm|BM 01 - Luciano Peters|
conta|C26|bm|BM 01 - Luciano Peters|
conta|C6|bm|BM 01 - Luciano Peters|
conta|C14|bm|BM 01 - Luciano Peters|
conta|C18|bm|BM 01 - Luciano Peters|
conta|C7|bm|BM 01 - Luciano Peters|
conta|C4|bm|BM 01 - Luciano Peters|
conta|C12|bm|BM 01 - Luciano Peters|
conta|C17|bm|BM 01 - Luciano Peters|
conta|C20|bm|BM 01 - Luciano Peters|
conta|C21|bm|BM 01 - Luciano Peters|
conta|C8|bm|BM 01 - Luciano Peters|
conta|C15|bm|BM 01 - Luciano Peters|
conta|C9|bm|BM 01 - Luciano Peters|
conta|C10|bm|BM 01 - Luciano Peters|
conta|C16|bm|BM 01 - Luciano Peters|
conta|C19|bm|BM 01 - Luciano Peters|
conta|C22|bm|BM 01 - Boulevard|
conta|C24|bm|BM 01 - Boulevard|
conta|C26|bm|BM 01 - Boulevard|
conta|C11|bm|BM 01 - Boulevard|
conta|C13|bm|BM 01 - Boulevard|
conta|C6|bm|BM 01 - Cecília|
conta|C9|bm|BM 01 - Cecília|
conta|C22|bm|BM 01 - Nicoly|
conta|C24|bm|BM 01 - Nicoly|
conta|C26|bm|BM 01 - Nicoly|
conta|C11|bm|BM 01 - Nicoly|
conta|AC03CE|bm|BM 01 - Nicoly|
conta|C2|bm|BM 01 - Nicoly|
conta|C4|bm|BM 01 - Nicoly|
conta|C11|bm|BM 01 - Maneca|
conta|AC03CE|bm|BM 01 - Maneca|
conta|C22|bm|BM 01 - Maneca|
conta|C9|bm|BM 01 - Maneca|
conta|C8|bm|BM 01 - Maneca|
conta|C15|bm|BM 01 - Maneca|
conta|C8|bm|BM 01 - Nina|
conta|C22|bm|BM 01 - Henrique|
conta|C7|bm|BM 01 - Henrique|
conta|C9|bm|BM 01 - Maria Eduarda|
conta|C2|bm|BM 01 - Maria Eduarda|
conta|C3|bm|BM 01 - Viewy|
conta|C11|bm|BM 01 - Viewy|
conta|AC03CE|bm|BM 01 - Viewy|
conta|C22|bm|BM 01 - Viewy|
conta|C4|bm|BM 01 - Viewy|
conta|C32|bm|BM 02 - Mayarah Laysla|
conta|C33|bm|BM 02 - Mayarah Laysla|
conta|C34|bm|BM 02 - Mayarah Laysla|
pagina|Sophia Woods|bm|BM 01 - Luciano Peters|dona
pagina|Regina Garcia|bm|BM 01 - Luciano Peters|dona
pagina|Sofia Woods|bm|BM 01 - Luciano Peters|dona
pagina|Chloe Williams|bm|BM 01 - Viewy|dona
pagina|W. Emma|bm|BM 01 - Viewy|dona
pagina|Emma Williams|bm|BM 01 - Viewy|dona
pagina|Luna Brown|bm|BM 01 - Viewy|dona
pagina|Gabriel Ignacio|bm|BM 01 - Viewy|dona
pagina|Jesus - Hear Our Prayer|bm|BM 01 - Viewy|dona
pagina|Mariano Espinosa de los Monteros|bm|BM 01 - Viewy|dona
pagina|Lucia Garcia|bm|BM 02 - Viewy|dona
pagina|Chef. Antonio|bm|BM 02 - Viewy|dona
pagina|Viewy|bm|BM 02 - Viewy|dona
pagina|Williams Emma|bm|BM 01 - Nina|dona
pagina|Emma W.|bm|BM 01 - Henrique|dona
pagina|Hcastro|bm|BM 01 - Henrique|dona
pagina|O Protocolo Inteligente|bm|BM 01 - Maneca|dona
pagina|Criativos para Enriquecer|bm|BM 02 - Mayarah Laysla|dona
pagina|Sofia Ferri|bm|BM 03 - Mayarah Laysla|dona
pagina|Dra. Regina García|bm|BM 03 - Mayarah Laysla|dona
pagina|Emma|bm|BM 01 - Luciano Peters|
pagina|Chloe Williams|bm|BM 01 - Luciano Peters|
pagina|W. Emma|bm|BM 01 - Luciano Peters|
pagina|Emma Williams|bm|BM 01 - Luciano Peters|
pagina|Luna Brown|bm|BM 01 - Luciano Peters|
pagina|Gabriel Ignacio|bm|BM 01 - Luciano Peters|
pagina|Lucia Garcia|bm|BM 01 - Luciano Peters|
pagina|Chef. Antonio|bm|BM 01 - Luciano Peters|
pagina|Viewy|bm|BM 01 - Luciano Peters|
pagina|Williams Emma|bm|BM 01 - Luciano Peters|
pagina|Emma W.|bm|BM 01 - Luciano Peters|
pagina|Sofia Ferri|bm|BM 01 - Luciano Peters|
pagina|Regina Garcia|bm|BM 01 - Boulevard|
pagina|Sofia Woods|bm|BM 01 - Boulevard|
pagina|Sophia Woods|bm|BM 01 - Boulevard|
pagina|Emma Williams|bm|BM 01 - Boulevard|
pagina|W. Emma|bm|BM 01 - Boulevard|
pagina|Luna Brown|bm|BM 01 - Boulevard|
pagina|Chloe Williams|bm|BM 01 - Boulevard|
pagina|Gabriel Ignacio|bm|BM 01 - Boulevard|
pagina|Williams Emma|bm|BM 01 - Boulevard|
pagina|Emma W.|bm|BM 01 - Boulevard|
pagina|Emma|bm|BM 01 - Boulevard|
pagina|Sofia Woods|bm|BM 01 - Cecília|
pagina|Sophia Woods|bm|BM 01 - Cecília|
pagina|Regina Garcia|bm|BM 01 - Cecília|
pagina|Chloe Williams|bm|BM 01 - Cecília|
pagina|Emma Williams|bm|BM 01 - Cecília|
pagina|Gabriel Ignacio|bm|BM 01 - Cecília|
pagina|Luna Brown|bm|BM 01 - Cecília|
pagina|Emma|bm|BM 01 - Cecília|
pagina|Chloe Williams|bm|BM 01 - Nicoly|
pagina|Luna Brown|bm|BM 01 - Nicoly|
pagina|Jesus - Hear Our Prayer|bm|BM 01 - Nicoly|
pagina|Sophia Woods|bm|BM 01 - Maneca|
pagina|Sofia Woods|bm|BM 01 - Maneca|
pagina|Regina Garcia|bm|BM 01 - Maneca|
pagina|Chloe Williams|bm|BM 01 - Maneca|
pagina|Luna Brown|bm|BM 01 - Maneca|
pagina|W. Emma|bm|BM 01 - Maneca|
pagina|Emma Williams|bm|BM 01 - Maneca|
pagina|Gabriel Ignacio|bm|BM 01 - Maneca|
pagina|Emma W.|bm|BM 01 - Maneca|
pagina|Hcastro|bm|BM 01 - Maneca|
pagina|Williams Emma|bm|BM 01 - Maneca|
pagina|Sophia Woods|bm|BM 01 - Nina|
pagina|Regina Garcia|bm|BM 01 - Nina|
pagina|Sofia Woods|bm|BM 01 - Nina|
pagina|Chloe Williams|bm|BM 01 - Nina|
pagina|W. Emma|bm|BM 01 - Nina|
pagina|Gabriel Ignacio|bm|BM 01 - Nina|
pagina|Emma Williams|bm|BM 01 - Nina|
pagina|Hcastro|bm|BM 01 - Nina|
pagina|Emma|bm|BM 01 - Nina|
pagina|Chloe Williams|bm|BM 01 - Henrique|
pagina|W. Emma|bm|BM 01 - Henrique|
pagina|Emma Williams|bm|BM 01 - Henrique|
pagina|Jesus - Hear Our Prayer|bm|BM 01 - Henrique|
pagina|Gabriel Ignacio|bm|BM 01 - Henrique|
pagina|Williams Emma|bm|BM 01 - Henrique|
pagina|Luna Brown|bm|BM 01 - Maria Eduarda|
pagina|Gabriel Ignacio|bm|BM 01 - Maria Eduarda|
pagina|W. Emma|bm|BM 01 - Maria Eduarda|
pagina|Chloe Williams|bm|BM 01 - Maria Eduarda|
pagina|Emma Williams|bm|BM 01 - Maria Eduarda|
pagina|Regina Garcia|bm|BM 01 - Viewy|
pagina|Sophia Woods|bm|BM 01 - Viewy|
pagina|Sofia Woods|bm|BM 01 - Viewy|
pagina|Hcastro|bm|BM 01 - Viewy|
pagina|Emma|bm|BM 01 - Viewy|
pagina|Dra. Regina García|bm|BM 02 - Mayarah Laysla|
pagina|Sofia Ferri|bm|BM 02 - Mayarah Laysla|
pagina|Lucia Garcia|bm|BM 02 - Mayarah Laysla|
pagina|Regina Garcia|bm|BM 02 - Mayarah Laysla|
pixel|GE|bm|BM 01 - Nicoly|dona
pixel|Pontos de Comando|bm|BM 01 - Nicoly|dona
pixel|Atividades Infantis|bm|BM 01 - Nicoly|dona
pixel|Pedido de Oração [Port]|bm|BM 01 - Nicoly|dona
pixel|+1000 receitas|bm|BM 01 - Nicoly|dona
pixel|Western Wall Quiz [Inglês]|bm|BM 01 - Nicoly|dona
pixel|Western Wall [Inglês]|bm|BM 01 - Nicoly|dona
pixel|Gatilhos|bm|BM 01 - Nicoly|dona
pixel|Gatilhos 2|bm|BM 01 - Nicoly|dona
pixel|Gatilhos 3|bm|BM 01 - Nicoly|dona
pixel|Protocolo Natural|bm|BM 01 - Luciano Peters|dona
pixel|XPower|bm|BM 01 - Luciano Peters|dona
pixel|Gelatina Latam 1|bm|BM 01 - Luciano Peters|dona
pixel|[DESATIVADO]|bm|BM 01 - Luciano Peters|dona
pixel|[DESATIVADO] 2|bm|BM 01 - Luciano Peters|dona
pixel|[DESATIVADO] 3|bm|BM 01 - Luciano Peters|dona
pixel|Avalanche de Seguidores|bm|BM 01 - Luciano Peters|dona
pixel|Insta Magnético|bm|BM 01 - Luciano Peters|dona
pixel|Quiz|bm|BM 01 - Luciano Peters|dona
pixel|Quiz 2|bm|BM 01 - Luciano Peters|dona
pixel|Quiz 3|bm|BM 01 - Luciano Peters|dona
pixel|Quiz 4|bm|BM 01 - Luciano Peters|dona
pixel|Quiz 5|bm|BM 01 - Luciano Peters|dona
pixel|Rico Boost|bm|BM 01 - Luciano Peters|dona
pixel|Rico Boost 2|bm|BM 01 - Luciano Peters|dona
pixel|Sem Crise|bm|BM 01 - Luciano Peters|dona
pixel|Sem Crise 2|bm|BM 01 - Luciano Peters|dona
pixel|Sem Crise 3|bm|BM 01 - Luciano Peters|dona
pixel|ToroApp|bm|BM 01 - Luciano Peters|dona
pixel|Toro App 2|bm|BM 01 - Luciano Peters|dona
pixel|Oração|bm|BM 01 - Maneca|dona
pixel|Oração 2|bm|BM 01 - Henrique|dona
pixel|Gestor Inteligente|bm|BM 01 - Viewy|dona
pixel|[DESATIVADO] (BM 02 Mayarah)|bm|BM 02 - Mayarah Laysla|dona
pixel|Adesivo emagrecedor|bm|BM 02 - Mayarah Laysla|dona
pixel|Adesivo emagrecedor (2)|bm|BM 02 - Mayarah Laysla|dona
pixel|Doces dos Sonhos|bm|BM 02 - Mayarah Laysla|dona
pixel|Criativos para Enriquecer|bm|BM 02 - Mayarah Laysla|dona
pixel|Rico Boost (BM 02 Mayarah)|bm|BM 02 - Mayarah Laysla|dona
pixel|Mestre do Prazerr|bm|BM 02 - Mayarah Laysla|dona
pixel|Arcan. Gabriel Latam|bm|BM 01 - Luciano Peters|
pixel|Atividades Infantis|bm|BM 01 - Luciano Peters|
pixel|GE|bm|BM 01 - Luciano Peters|
pixel|Gelatina Latam|bm|BM 01 - Luciano Peters|
pixel|Nossa Senhora|bm|BM 01 - Luciano Peters|
pixel|Parche Latam|bm|BM 01 - Luciano Peters|
pixel|Pontos de Comando|bm|BM 01 - Luciano Peters|
pixel|Western Wall Quiz [Inglês]|bm|BM 01 - Luciano Peters|
pixel|Gatilhos|bm|BM 01 - Luciano Peters|
pixel|Gatilhos 2|bm|BM 01 - Luciano Peters|
pixel|Gatilhos 3|bm|BM 01 - Luciano Peters|
pixel|GE|bm|BM 01 - Boulevard|
pixel|Pontos de Comando|bm|BM 01 - Boulevard|
pixel|Pontos de Comando|bm|BM 01 - Cecília|
pixel|GE|bm|BM 01 - Cecília|
pixel|Gatilhos|bm|BM 01 - Cecília|
pixel|Gatilhos 2|bm|BM 01 - Cecília|
pixel|Gatilhos 3|bm|BM 01 - Cecília|
pixel|Oração Latam|bm|BM 01 - Cecília|
pixel|Carlo teste|bm|BM 01 - Cecília|
pixel|GE|bm|BM 01 - Maneca|
pixel|Pontos de Comando|bm|BM 01 - Maneca|
pixel|+1000 receitas|bm|BM 01 - Maneca|
pixel|Gelatina Latam|bm|BM 01 - Maneca|
pixel|Parche Latam|bm|BM 01 - Maneca|
pixel|Oração Latam|bm|BM 01 - Maneca|
pixel|Gatilhos 3|bm|BM 01 - Nina|
pixel|Pontos de Comando|bm|BM 01 - Nina|
pixel|GE|bm|BM 01 - Nina|
pixel|Carlo teste|bm|BM 01 - Nina|
pixel|teste|bm|BM 01 - Nina|
pixel|Oração Latam|bm|BM 01 - Nina|
pixel|GE|bm|BM 01 - Henrique|
pixel|Pontos de Comando|bm|BM 01 - Henrique|
pixel|Pedido de Oração [Port]|bm|BM 01 - Henrique|
pixel|Western Wall Quiz [Inglês]|bm|BM 01 - Henrique|
pixel|Gatilhos|bm|BM 01 - Henrique|
pixel|Gatilhos 3|bm|BM 01 - Henrique|
pixel|Western Wall [Inglês]|bm|BM 01 - Henrique|
pixel|Gelatina Latam|bm|BM 01 - Henrique|
pixel|Oração Latam|bm|BM 01 - Henrique|
pixel|Pedido [Inglês]|bm|BM 01 - Henrique|
pixel|Protocolo Natural|bm|BM 02 - Mayarah Laysla|
pixel|Gestação Ativa|bm|BM 02 - Mayarah Laysla|
pixel|Chá bariátrico|bm|BM 02 - Mayarah Laysla|
pixel|Gelatina bariátrica|bm|BM 02 - Mayarah Laysla|
$r$;
begin
  -- Trava: a importação foi feita para o inventário ainda vazio.
  if exists (select 1 from ops.perfis) or exists (select 1 from ops.paginas) or exists (select 1 from ops.pixels) then
    raise exception 'Já existem perfis, páginas ou pixels cadastrados. Esta importação é só para o inventário vazio.';
  end if;

  -- Motivo e data que vão para o histórico de status.
  perform set_config('ops.status_motivo', 'Inventário de 10/11/2026 (documento Ativos de contingência)', true);
  perform set_config('ops.status_data', '2026-11-10', true);

  -- 1. BMs: juntar as três Cecílias, tirar a "ED", tirar "[Dólar]" do nome.
  select id into v_cec from ops.bms where nome = 'BM 01 - Cecilia';
  select id into v_luc from ops.bms where nome = 'BM 01 - Luciano Peters';
  if v_cec is null or v_luc is null then raise exception 'Não achei a BM 01 - Cecilia ou a BM 01 - Luciano Peters.'; end if;

  update ops.acessos set por_bm_id = v_cec
  where por_bm_id in (select id from ops.bms where nome in ('BM 01 - Celilia', 'BM Cecilia'));
  update ops.acessos set por_bm_id = v_luc
  where por_bm_id in (select id from ops.bms where nome = 'ED');
  delete from ops.bms where nome in ('BM 01 - Celilia', 'BM Cecilia', 'ED');
  get diagnostics n = row_count;
  if n <> 3 then raise exception 'Esperava apagar 3 BMs repetidas, apaguei %.', n; end if;

  update ops.bms set nome = 'BM 01 - Cecília' where id = v_cec;
  update ops.bms set nome = 'BM 01 - Nicoly' where nome = 'BM 01 - Nicoly [Dólar]';
  update ops.bms set nome = 'BM 01 - Viewy' where nome = 'BM 01 - Viewy [Dólar]';

  -- 2. BMs novas e perdidas.
  insert into ops.bms (nome, status, observacoes) values
    ('BM 02 - Mayarah Laysla', 'ativa', 'Perfil da Mayarah bloqueado; é a única das 3 BMs dela que ainda tem acesso.'),
    ('BM 01 - Mayarah Laysla', 'desativada', 'Acesso perdido junto com o perfil da Mayarah. Nenhum ativo visível.'),
    ('BM 03 - Mayarah Laysla', 'desativada', 'Acesso perdido junto com o perfil da Mayarah. Contas e páginas aparecem compartilhadas na BM 02 - Mayarah.');
  update ops.bms set observacoes = 'Acesso perdido. Contas e páginas aparecem compartilhadas em outras BMs.'
  where nome = 'BM 02 - Viewy';
  perform set_config('ops.status_motivo', 'Acesso perdido (inventário de 10/11/2026)', true);
  update ops.bms set status = 'desativada' where nome = 'BM 02 - Viewy';
  perform set_config('ops.status_motivo', 'Inventário de 10/11/2026 (documento Ativos de contingência)', true);
  update ops.bms set observacoes = 'BM comprada avulsa, sem perfil próprio.' where nome = 'BM 01 - Boulevard';

  -- 3. Contas: desativadas (❌ no documento), moeda e as 8 que faltavam.
  update ops.contas_anuncio set status = 'desativada'
  where apelido in ('C1', 'C5', 'C13', 'C14', 'C4', 'C12', 'C17', 'C21', 'C15');
  get diagnostics n = row_count;
  if n <> 9 then raise exception 'Esperava 9 contas desativadas, achei %.', n; end if;
  update ops.contas_anuncio set moeda = 'USD' where apelido in ('C8', 'C15', 'C9');

  insert into ops.contas_anuncio (apelido, nome, bm_nome, status) values
    ('C27', 'Conta 02', 'BM 01 - Maria Eduarda', 'ativa'),
    ('C28', 'Conta 03', 'BM 01 - Maria Eduarda', 'ativa'),
    ('C29', 'Conta 01', 'BM 02 - Mayarah Laysla', 'desativada'),
    ('C30', 'Conta 02', 'BM 02 - Mayarah Laysla', 'desativada'),
    ('C31', 'Conta 03', 'BM 02 - Mayarah Laysla', 'ativa'),
    ('C32', 'Conta 01', 'BM 03 - Mayarah Laysla', 'desativada'),
    ('C33', 'Conta 02', 'BM 03 - Mayarah Laysla', 'ativa'),
    ('C34', 'Conta 03', 'BM 03 - Mayarah Laysla', 'ativa');

  -- 4. Perfis, páginas e pixels.
  insert into ops.perfis (nome, status, observacoes) values
    ('Luciano', 'em_uso', 'Perfil principal: acessa todas as BMs com acesso.'),
    ('Cecília', 'restrito', 'Perfil bloqueado.'),
    ('Maneca', 'restrito', 'Perfil bloqueado (aparece como Maneca Leite).'),
    ('Nina', 'restrito', 'Perfil bloqueado.'),
    ('Henrique', 'restrito', 'Perfil bloqueado (aparece como Henrique Castro).'),
    ('Mayarah', 'restrito', 'Perfil bloqueado. Levou junto as BMs 01 e 03 - Mayarah Laysla.'),
    ('Nicoly', 'em_uso', 'Aparece como Nicoly Souza.'),
    ('Maria Eduarda', 'em_uso', null),
    ('Viewy Finanças', 'em_uso', null),
    ('Grupo Capi', 'em_uso', 'Um só perfil que aparece com nomes diferentes: Nicoly Souza (Boulevard), Bilie Powell (Cecília), Eli Jordan (Nina) e Nina Almeida (Viewy).');

  insert into ops.paginas (nome, status, observacoes) values
    ('Sophia Woods', 'restrita', 'Requer análise.'),
    ('Regina Garcia', 'ativa', null),
    ('Sofia Woods', 'ativa', null),
    ('Emma', 'ativa', 'Página de perfil pessoal (não é de BM).'),
    ('Chloe Williams', 'ativa', null),
    ('W. Emma', 'ativa', null),
    ('Emma Williams', 'ativa', null),
    ('Luna Brown', 'ativa', null),
    ('Gabriel Ignacio', 'ativa', null),
    ('Jesus - Hear Our Prayer', 'restrita', 'Requer análise.'),
    ('Mariano Espinosa de los Monteros', 'desativada', null),
    ('Lucia Garcia', 'ativa', null),
    ('Chef. Antonio', 'ativa', null),
    ('Viewy', 'ativa', null),
    ('Williams Emma', 'ativa', null),
    ('Emma W.', 'ativa', null),
    ('Hcastro', 'ativa', null),
    ('O Protocolo Inteligente', 'ativa', null),
    ('Criativos para Enriquecer', 'ativa', null),
    ('Sofia Ferri', 'ativa', null),
    ('Dra. Regina García', 'ativa', null);

  insert into ops.pixels (nome, observacoes) values
    ('GE', 'Pixel + CAPI.'),
    ('Pontos de Comando', 'Pixel + CAPI.'),
    ('Atividades Infantis', 'Pixel + CAPI.'),
    ('Pedido de Oração [Port]', null),
    ('+1000 receitas', null),
    ('Western Wall Quiz [Inglês]', null),
    ('Western Wall [Inglês]', 'Desativado no Meta.'),
    ('Gatilhos', 'Desativado no Meta. Pixel + CAPI.'),
    ('Gatilhos 2', 'Desativado no Meta. Pixel + CAPI.'),
    ('Gatilhos 3', 'Desativado no Meta. Pixel + CAPI (ainda recebendo eventos).'),
    ('Protocolo Natural', 'Sem dados conectados.'),
    ('XPower', 'Sem dados conectados.'),
    ('Gelatina Latam 1', 'Sem dados conectados. Compartilhamento com a BM 01 - Cecília pendente.'),
    ('[DESATIVADO]', 'Desativado no Meta.'),
    ('[DESATIVADO] 2', 'Desativado no Meta.'),
    ('[DESATIVADO] 3', 'Desativado no Meta.'),
    ('Avalanche de Seguidores', 'Desativado no Meta. Compartilhamento com a BM 01 - Cecília pendente.'),
    ('Insta Magnético', 'Desativado no Meta.'),
    ('Quiz', 'Desativado no Meta.'),
    ('Quiz 2', 'Desativado no Meta.'),
    ('Quiz 3', 'Desativado no Meta.'),
    ('Quiz 4', 'Desativado no Meta.'),
    ('Quiz 5', 'Desativado no Meta.'),
    ('Rico Boost', 'Desativado no Meta.'),
    ('Rico Boost 2', 'Desativado no Meta.'),
    ('Sem Crise', 'Desativado no Meta.'),
    ('Sem Crise 2', 'Desativado no Meta.'),
    ('Sem Crise 3', 'Desativado no Meta.'),
    ('ToroApp', 'Desativado no Meta.'),
    ('Toro App 2', 'Desativado no Meta. Compartilhamento com a BM 01 - Cecília pendente.'),
    ('Oração', 'Sem dados conectados.'),
    ('Oração 2', 'Sem dados conectados.'),
    ('Gestor Inteligente', 'Sem dados conectados.'),
    ('[DESATIVADO] (BM 02 Mayarah)', 'Desativado no Meta. No Meta o nome é só "[DESATIVADO]".'),
    ('Adesivo emagrecedor', 'Desativado no Meta.'),
    ('Adesivo emagrecedor (2)', 'Desativado no Meta. Aparece duas vezes, uma com ícone diferente.'),
    ('Doces dos Sonhos', 'Desativado no Meta.'),
    ('Criativos para Enriquecer', 'Desativado no Meta.'),
    ('Rico Boost (BM 02 Mayarah)', 'Desativado no Meta. No Meta o nome é só "Rico Boost".'),
    ('Mestre do Prazerr', 'Desativado no Meta.'),
    ('Arcan. Gabriel Latam', 'Dona não identificada.'),
    ('Gelatina Latam', 'Dona não identificada.'),
    ('Parche Latam', 'Dona não identificada.'),
    ('Nossa Senhora', 'Dona não identificada.'),
    ('Oração Latam', 'Dona não identificada. Desativado no Meta.'),
    ('Pedido [Inglês]', 'Dona não identificada. Desativado no Meta.'),
    ('Gestação Ativa', 'Dona não identificada.'),
    ('Chá bariátrico', 'Dona não identificada.'),
    ('Gelatina bariátrica', 'Dona não identificada.'),
    ('Carlo teste', 'Dona não identificada.'),
    ('teste', 'Dona não identificada.');

  -- 5. Acessos. Primeiro confere se todos os nomes existem.
  with v as (
    select btrim(split_part(l, '|', 1)) as a_tipo, btrim(split_part(l, '|', 2)) as a_nome, btrim(split_part(l, '|', 3)) as t_tipo, btrim(split_part(l, '|', 4)) as t_nome,
           coalesce(nullif(btrim(split_part(l, '|', 5)), ''), 'compartilhado') as papel
    from regexp_split_to_table(v_rel, E'\r?\n') as l where btrim(l) <> ''
  ), r as (
    select v.*,
      case a_tipo when 'bm' then (select id from ops.bms where nome = a_nome)
              when 'conta' then (select id from ops.contas_anuncio where apelido = a_nome)
              when 'pagina' then (select id from ops.paginas where nome = a_nome)
              when 'pixel' then (select id from ops.pixels where nome = a_nome) end as aid,
      case t_tipo when 'bm' then (select id from ops.bms where nome = t_nome)
              when 'perfil' then (select id from ops.perfis where nome = t_nome) end as tid
    from v
  )
  select string_agg(a_nome || ' / ' || t_nome, '; ') into v_faltam from r where aid is null or tid is null;
  if v_faltam is not null then raise exception 'Não encontrei: %', v_faltam; end if;

  with v as (
    select btrim(split_part(l, '|', 1)) as a_tipo, btrim(split_part(l, '|', 2)) as a_nome, btrim(split_part(l, '|', 3)) as t_tipo, btrim(split_part(l, '|', 4)) as t_nome,
           coalesce(nullif(btrim(split_part(l, '|', 5)), ''), 'compartilhado') as papel
    from regexp_split_to_table(v_rel, E'\r?\n') as l where btrim(l) <> ''
  ), r as (
    select v.*,
      case a_tipo when 'bm' then (select id from ops.bms where nome = a_nome)
              when 'conta' then (select id from ops.contas_anuncio where apelido = a_nome)
              when 'pagina' then (select id from ops.paginas where nome = a_nome)
              when 'pixel' then (select id from ops.pixels where nome = a_nome) end as aid,
      case t_tipo when 'bm' then (select id from ops.bms where nome = t_nome)
              when 'perfil' then (select id from ops.perfis where nome = t_nome) end as tid
    from v
  )
  insert into ops.acessos (bm_id, conta_id, pagina_id, pixel_id, por_bm_id, por_perfil_id, papel, nivel, desde)
  select case when a_tipo = 'bm' then aid end, case when a_tipo = 'conta' then aid end,
         case when a_tipo = 'pagina' then aid end, case when a_tipo = 'pixel' then aid end,
         case when t_tipo = 'bm' then tid end, case when t_tipo = 'perfil' then tid end,
         papel, 'admin', date '2026-11-10'
  from r
  on conflict do nothing;

  perform set_config('ops.status_motivo', '', true);
  perform set_config('ops.status_data', '', true);
end
$do$;

-- Conferência: esperado 10 perfis, 13 BMs, 35 contas (35 com dona), 21 páginas, 51 pixels.
select
  (select count(*) from ops.perfis) as perfis,
  (select count(*) from ops.bms) as bms,
  (select count(*) from ops.contas_anuncio) as contas,
  (select count(*) from ops.acessos where papel = 'dona' and ativo and conta_id is not null) as contas_com_dona,
  (select count(*) from ops.paginas) as paginas,
  (select count(*) from ops.pixels) as pixels,
  (select count(*) from ops.acessos where ativo) as acessos;
