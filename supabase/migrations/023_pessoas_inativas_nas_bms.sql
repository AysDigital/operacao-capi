-- =====================================================================
-- 023: pessoas "inativas" das BMs também contam como acesso
-- =====================================================================
-- Decisão da usuária (10/11/2026): no documento de ativos, quem aparece como
-- "Inativo (nunca entrou)" tem acesso de verdade. A 021 tinha deixado essas
-- pessoas de fora. Entram aqui só as que são perfis conhecidos pelo nome:
--   - Nicoly e Maria Eduarda (perfis que já existem);
--   - Ana Júlia (perfil novo; aparece com esse nome nas BMs Maneca e Maria Eduarda).
-- Ficam de fora contas de Instagram (Heitor Castro, O Protocolo Inteligente ig,
-- Ana Jlia Matoso, @grupoviewyoficial) e a pessoa "BM 02" da BM 02 - Mayarah
-- (só identificável por e-mail).
-- Tudo dentro do schema ops. Pode rodar de novo sem duplicar.
-- =====================================================================

insert into ops.perfis (nome, status, observacoes)
select 'Ana Júlia', 'em_uso', 'Aparece como inativa (nunca entrou) nas BMs 01 - Maneca e 01 - Maria Eduarda.'
where not exists (select 1 from ops.perfis where nome = 'Ana Júlia');

insert into ops.acessos (bm_id, por_perfil_id, papel, nivel, desde)
select b.id, p.id, 'compartilhado', 'admin', date '2026-11-10'
from (values
  ('BM 01 - Luciano Peters', 'Nicoly'),
  ('BM 01 - Luciano Peters', 'Maria Eduarda'),
  ('BM 01 - Maneca', 'Nicoly'),
  ('BM 01 - Maneca', 'Maria Eduarda'),
  ('BM 01 - Maneca', 'Ana Júlia'),
  ('BM 01 - Nina', 'Maria Eduarda'),
  ('BM 01 - Maria Eduarda', 'Nicoly'),
  ('BM 01 - Maria Eduarda', 'Ana Júlia')
) v(bm, perfil)
join ops.bms b on b.nome = v.bm
join ops.perfis p on p.nome = v.perfil
on conflict do nothing;

-- Conferência: esperado 10 perfis e 312 acessos ativos.
select
  (select count(*) from ops.perfis) as perfis,
  (select count(*) from ops.acessos where ativo) as acessos;
