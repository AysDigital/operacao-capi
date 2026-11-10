-- =====================================================================
-- 027: manter só os pixels GE e Pontos de Comando
-- =====================================================================
-- Pedido da usuária (10/11/2026): os outros pixels são antigos e não são
-- mais usados. Saem junto os acessos e as ligações com ofertas deles
-- (o histórico de status sai pelo gatilho de exclusão).
-- Tudo dentro do schema ops. Tudo num bloco só: se algo não bater, nada é gravado.
-- =====================================================================

do $do$
declare
  v_manter text[] := array['GE', 'Pontos de Comando'];
  n int;
begin
  if (select count(*) from ops.pixels where nome = any(v_manter)) <> 2 then
    raise exception 'Não achei os pixels GE e Pontos de Comando.';
  end if;

  delete from ops.acessos where pixel_id in (select id from ops.pixels where not (nome = any(v_manter)));
  delete from ops.ofertas_ativos where pixel_id in (select id from ops.pixels where not (nome = any(v_manter)));
  delete from ops.pixels where not (nome = any(v_manter));
  get diagnostics n = row_count;
  if n <> 13 then raise exception 'Esperava apagar 13 pixels, apaguei %.', n; end if;
end
$do$;

-- Conferência: esperado 2 pixels (GE e Pontos de Comando).
select nome, status from ops.pixels order by nome;
