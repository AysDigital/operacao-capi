-- =====================================================================
-- 022: tirar o perfil "Grupo Capi" criado pela 021
-- =====================================================================
-- Ele foi deduzido só por um e-mail que aparecia com 4 nomes diferentes.
-- A usuária pediu para desconsiderar (10/11/2026). Como foi um erro de
-- importação (e não um acesso que existiu e acabou), os acessos dele são
-- apagados em vez de ficarem inativos no histórico.
-- Tudo dentro do schema ops.
-- =====================================================================

delete from ops.acessos
where por_perfil_id in (select id from ops.perfis where nome = 'Grupo Capi')
   or perfil_id in (select id from ops.perfis where nome = 'Grupo Capi');

delete from ops.perfis where nome = 'Grupo Capi';

-- Conferência: esperado 9 perfis e 304 acessos ativos.
select
  (select count(*) from ops.perfis) as perfis,
  (select count(*) from ops.acessos where ativo) as acessos;
