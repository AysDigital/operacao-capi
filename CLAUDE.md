# Operação Capi — regras permanentes do projeto

Sistema de produção e organização da operação de Direct Response (substitui o Trello).
Usuários: May e Luciano.

## Banco de dados (Supabase compartilhado)
- O banco é o MESMO projeto Supabase do dashboard de vendas (em produção) e do financeiro (schema `fin`).
- Todo o sistema da operação vive no schema `ops`.
- Nunca criar, alterar, apagar ou escrever nada fora do schema `ops` (tabelas, views, funções, triggers, políticas, publicações, jobs).
- Os schemas `public` e `fin` não são usados por este app. Qualquer leitura deles precisa de autorização.
- **Exceções autorizadas pela usuária (fora do schema `ops`):**
  - publicação `supabase_realtime`: tabelas `ops.cards` e `ops.veiculacoes` (ativadas por ela no painel em 28/10/2026, etapa 3);
  - Storage (autorizado em 28/10/2026, migration 005): bucket privado `operacao` e as políticas `operacao_*` em `storage.objects`, todas restritas a esse bucket. Imagens ficam em `cards/{id do card}/` e são guardadas no banco como `storage:{caminho}`;
  - qualquer outro objeto fora do `ops` precisa de nova autorização.
- Acesso: só quem está em `ops.membros` (ativo) lê e escreve (`ops.is_membro()`). Estar logado não basta, porque o Auth é compartilhado com o dashboard.

## Migrations
- Nunca executar SQL diretamente no Supabase.
- Mudanças de banco são sempre arquivos novos e numerados em `supabase/migrations/` (`002_...`, `003_...`), que a usuária roda manualmente no SQL Editor.
- Nunca editar uma migration que já foi rodada.

## Regras do domínio
- Nome dos ads é gerado pelo banco: `CODIGO-IDIOMA-AD{n}-H{n}-M{n}-FORMATO` (ex.: `PC-FR-AD1-H1-M2-VD`). É só organização interna.
- Métricas da Meta e vendas casam pelo `meta_ad_id` de `ops.veiculacoes` (vendas chegam com `utm_content` = ID do anúncio), nunca pelo nome.
- Um card tem uma veiculação por conta de anúncio; métricas do card = soma das veiculações.
- `ops.atividades` é escrita só pelos gatilhos do banco; o app só lê.

## Datas
- Datas guardadas em UTC e exibidas em `America/Sao_Paulo`.

## Segredos
- Nunca colocar chaves, senhas ou e-mails pessoais no código.
- Segredos ficam em variáveis de ambiente (`.env.local`, que não vai para o Git).

## Visual
- Mesma identidade Capi do financeiro: tokens em `src/index.css`, componentes em `src/components/ds.tsx` e `ui.tsx`.
- Nada de descrição escrita embaixo de títulos: a explicação vai para a `Dica`. Status sempre com ícone e texto.

## Stack
- React + Vite + TypeScript + Tailwind.
- Supabase (auth + banco). Sempre `ops()` de `src/lib/supabase.ts`.
- Deploy no Vercel; código no GitHub (`operacao-capi`). Domínio: ops.capimarketing.online.
