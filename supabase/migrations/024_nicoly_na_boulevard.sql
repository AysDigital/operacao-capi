-- =====================================================================
-- 024: Nicoly tem acesso à BM 01 - Boulevard
-- =====================================================================
-- No documento de ativos, a BM Boulevard tem a pessoa "Nicoly Souza" (ativa).
-- A 021 tinha ligado essa pessoa ao perfil "Grupo Capi" (pelo e-mail), que a
-- 022 apagou. Pelo nome, é o perfil da Nicoly (confirmado pela usuária em 10/11/2026).
-- Tudo dentro do schema ops. Pode rodar de novo sem duplicar.
-- =====================================================================

insert into ops.acessos (bm_id, por_perfil_id, papel, nivel, desde)
select b.id, p.id, 'compartilhado', 'admin', date '2026-11-10'
from ops.bms b, ops.perfis p
where b.nome = 'BM 01 - Boulevard' and p.nome = 'Nicoly'
on conflict do nothing;

-- Conferência: esperado 1 (Nicoly com acesso ativo à Boulevard) e 313 acessos.
select
  (select count(*) from ops.acessos a join ops.bms b on b.id = a.bm_id join ops.perfis p on p.id = a.por_perfil_id
   where b.nome = 'BM 01 - Boulevard' and p.nome = 'Nicoly' and a.ativo) as nicoly_na_boulevard,
  (select count(*) from ops.acessos where ativo) as acessos;
