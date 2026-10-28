-- =====================================================================
-- Operação Capi — Migration 005: pasta de imagens (Supabase Storage)
-- Rodar UMA vez no SQL Editor do Supabase.
--
-- EXCEÇÃO AUTORIZADA pela usuária em 28/10/2026: cria objetos FORA do schema ops
--   - o bucket privado "operacao" em storage.buckets;
--   - quatro políticas em storage.objects, todas restritas a esse bucket.
-- Nada dos outros buckets (dashboard, financeiro) é tocado.
--
-- Uso: imagens coladas em comentários/descrição e imagens anexadas aos cards,
-- guardadas em cards/{id do card}/... Só membros da operação veem e enviam.
-- =====================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('operacao', 'operacao', false, 10485760, array['image/png', 'image/jpeg', 'image/gif', 'image/webp'])
on conflict (id) do nothing;

create policy operacao_membros_leem on storage.objects for select to authenticated
  using (bucket_id = 'operacao' and ops.is_membro());

create policy operacao_membros_enviam on storage.objects for insert to authenticated
  with check (bucket_id = 'operacao' and ops.is_membro());

create policy operacao_membros_alteram on storage.objects for update to authenticated
  using (bucket_id = 'operacao' and ops.is_membro())
  with check (bucket_id = 'operacao' and ops.is_membro());

create policy operacao_membros_apagam on storage.objects for delete to authenticated
  using (bucket_id = 'operacao' and ops.is_membro());
