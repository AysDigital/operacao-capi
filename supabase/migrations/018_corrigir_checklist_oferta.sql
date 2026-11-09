-- =====================================================================
-- Operação Capi — Migration 018: corrige "Criar checklist a partir do modelo"
-- Rodar UMA vez no SQL Editor do Supabase. Só mexe no schema ops.
-- Na 017, ops.criar_checklist_oferta rodava com as permissões de quem chama e
-- chamava ops.registrar_oferta, que é fechada para o app → "Sem permissão".
-- Agora ela roda com as permissões do banco (como as outras funções que escrevem
-- histórico), conferindo antes que quem chama é da equipe (ops.is_membro).
-- O mesmo conserta a cópia automática do checklist ao criar uma oferta nova.
-- =====================================================================

create or replace function ops.criar_checklist_oferta(p_oferta uuid) returns int
language plpgsql security definer set search_path = '' as $$
declare
  v_secoes jsonb;
  s jsonb;
  n_secao int := 0;
  nova uuid;
  total int := 0;
  n int;
begin
  -- no app, só membros; no SQL Editor (sem login) também pode
  if not ops.is_membro() and coalesce(auth.jwt() ->> 'role', '') <> '' then
    raise exception 'acesso negado' using errcode = '42501';
  end if;
  if not exists (select 1 from ops.ofertas where id = p_oferta) then
    raise exception 'Oferta não encontrada.';
  end if;

  select secoes into v_secoes from ops.modelos_checklist_oferta where ativo order by criado_em limit 1;
  if v_secoes is null then return 0; end if;
  perform set_config('ops.silencio', '1', true);
  n_secao := coalesce((select max(ordem) from ops.checklists where oferta_id = p_oferta), 0);
  for s in select value from jsonb_array_elements(v_secoes) loop
    n_secao := n_secao + 1;
    insert into ops.checklists (oferta_id, titulo, ordem)
    values (p_oferta, coalesce(nullif(trim(s ->> 'titulo'), ''), 'Seção'), n_secao)
    returning id into nova;
    insert into ops.checklist_itens (checklist_id, texto, ordem, feito)
      select nova, trim(it), k::int, false
      from jsonb_array_elements_text(coalesce(s -> 'itens', '[]')) with ordinality as t(it, k)
      where nullif(trim(it), '') is not null;
    get diagnostics n = row_count;
    total := total + n;
  end loop;
  perform set_config('ops.silencio', '0', true);
  perform ops.registrar_oferta(p_oferta, 'checklist_criado', 'criou o checklist de lançamento a partir do modelo');
  return total;
end $$;

revoke execute on function ops.criar_checklist_oferta(uuid) from public, anon;
grant execute on function ops.criar_checklist_oferta(uuid) to authenticated;

-- Conferência: deve mostrar "true" (a função agora roda com as permissões do banco).
select prosecdef as corrigida from pg_proc where oid = 'ops.criar_checklist_oferta(uuid)'::regprocedure;
