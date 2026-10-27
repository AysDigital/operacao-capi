# Operação Capi — Status do projeto

## Etapa 1: fundação (27/10/2026)

**App:** React + Vite + TS + Tailwind, mesma identidade do financeiro. Login por e-mail e senha (sem cadastro), verificação de acesso por `ops.is_membro()`, menu lateral recolhível com Quadros, Ofertas, Veiculações, Modelos e Configurações (todas "Em construção").

**Banco (`supabase/migrations/001_ops_schema.sql`, schema `ops`):**
- `membros` (quem acessa; cadastrado à mão), `ofertas`, `contas_anuncio`, `listas` (10 colunas fixas, com seed), `cards`, `card_membros`, `etiquetas`, `card_etiquetas`, `anexos`, `comentarios`, `atividades`, `veiculacoes`, `checklists`, `checklist_itens`, `modelos_card`, `modelos_card_etiquetas`, `modelos_checklist_oferta` (1 modelo vazio: "Lançamento de oferta").
- View `v_rejeicoes`: histórico de rejeições a partir das atividades.
- Gatilhos:
  - nome automático dos ads e renomeação quando a sigla/idioma da oferta muda;
  - posição automática no fim da lista quando o card é criado sem posição;
  - versão de origem precisa ser da mesma oferta;
  - `data_status` da veiculação atualizada quando o status muda;
  - quem marcou e quando, nos itens de checklist;
  - atividades: card criado, versão criada (no card novo e no de origem), movido, renomeado, arquivado/restaurado, vencedor, oferta alterada, membro, etiqueta, anexo, comentário, veiculação criada/removida, status e ID do anúncio.
- Unicidade: um ad por AD/H/M em cada oferta (arquivados contam); uma veiculação por card + conta; `meta_ad_id` único quando preenchido; sigla única por idioma.
- RLS: membros ativos leem e escrevem tudo; `atividades` e `membros` só leitura pelo app.

**Próximas etapas (não feitas):** quadro (kanban), cadastro de ofertas/contas/etiquetas, card detalhado, modelos, métricas por `meta_ad_id`.
