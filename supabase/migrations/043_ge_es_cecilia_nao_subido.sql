-- =====================================================================
-- Operação Capi — Migration 043: GE-ES sai da AC01CEC
-- Rodar UMA vez no SQL Editor do Supabase. Só mexe no schema ops.
--
-- Mesmo pedido da 042 (16/11/2026), que foi feita para GE-EN e não achou
-- nada: os cards com a AC01CEC são de Gatilhos em espanhol (GE-ES).
-- Nos cards (não arquivados) de GE-ES das listas "Pronto pra subir" e
-- "Revisão [Edição]", a veiculação na AC01CEC volta para "Não subido" e perde
-- o início de fase (some a pílula "D1 · Validação"). Esses ads vão ser
-- subidos numa conta nova. As outras contas dos cards não mudam.
-- =====================================================================

do $$
declare
  v_oferta uuid;
  v_cec uuid;
  n int;
begin
  select id into v_oferta from ops.ofertas where codigo = 'GE' and idioma = 'ES';
  select id into v_cec from ops.contas_anuncio where apelido = 'AC01CEC';
  if v_oferta is null then raise exception 'Oferta GE-ES não encontrada.'; end if;
  if v_cec is null then raise exception 'Conta AC01CEC não encontrada.'; end if;

  update ops.veiculacoes v
     set status = 'nao_subido', rodando_desde = null
    from ops.cards c
    join ops.listas l on l.id = c.lista_id
   where c.id = v.card_id and not c.arquivado
     and c.oferta_id = v_oferta
     and l.nome in ('Pronto pra subir', 'Revisão [Edição]')
     and v.conta_id = v_cec
     and (v.status <> 'nao_subido' or v.rodando_desde is not null);
  get diagnostics n = row_count;
  raise notice 'Veiculações na AC01CEC voltaram para Não subido: %', n;
end $$;

-- Conferência: cards de GE-ES nessas listas, por conta e status.
-- Se aparecer alguma conta "rodando", o card ainda mostra a pílula de fase dela.
select l.nome as lista, ca.apelido as conta, v.status, count(*) as veiculacoes
from ops.cards c
join ops.ofertas o on o.id = c.oferta_id
join ops.listas l on l.id = c.lista_id
join ops.veiculacoes v on v.card_id = c.id
join ops.contas_anuncio ca on ca.id = v.conta_id
where o.codigo = 'GE' and o.idioma = 'ES' and not c.arquivado
  and l.nome in ('Pronto pra subir', 'Revisão [Edição]')
group by l.nome, ca.apelido, v.status
order by l.nome, ca.apelido, v.status;
