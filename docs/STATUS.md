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

**Configuração manual (feita pela usuária em 27/10/2026):**
- Migration 001 rodada no SQL Editor (sem erros). Próxima migration: 002.
- Schema `ops` adicionado em Project Settings → Data API → Exposed schemas (junto com `public`, `graphql_public` e `fin`).
- Membros: **um login só para May e Luciano** (o mesmo do financeiro), cadastrado em `ops.membros` com o nome "May e Luciano". Consequência: o histórico não distingue quem fez o quê, e membros do card e @menções têm pouco uso. Para separar depois, basta criar outro login e cadastrá-lo como membro, sem migration.
- Login testado localmente (porta 5180) e em produção.

**Publicação:**
- GitHub: https://github.com/AysDigital/operacao-capi (privado, branch `main`; cada push publica sozinho).
- Vercel: projeto `operacao-capi`, com as variáveis `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`.
- Endereços: https://ops.capimarketing.online (CNAME para o Vercel, HTTPS ok) e https://operacao-capi.vercel.app.
- Supabase Auth: Site URL e Redirect URLs não foram alteradas (são compartilhadas com o dashboard). Não há recuperação de senha no app; troca de senha é pelo painel do Supabase.

**Próximas etapas (não feitas):** card detalhado; modelos; métricas por `meta_ad_id`.

## Etapa 2: telas de cadastro (27/10/2026)

Sem migration nova: as contagens e os bloqueios de exclusão usam o que a 001 já criou. Próxima migration continua sendo a 002.

**Ofertas (`/ofertas`, `src/pages/Ofertas.tsx`):**
- Tabela com cor, nome, sigla, idioma, status (selo com ícone e texto) e quantidade de cards (`cards(count)`, inclui arquivados).
- Modal de criar/editar: nome, sigla (só maiúsculas e números, até 8), idioma, status e cor (paleta de 12 cores em `PALETA`, sem o coral).
- Prévia do nome dos ads (`PC-FR-AD1-H1-M1-VD`).
- Trocar sigla ou idioma de uma oferta com cards mostra o aviso de que os nomes dos ads serão atualizados (quem renomeia é o gatilho do banco).
- Excluir: com cards, não deixa e oferece "Mudar para pausada"; sem cards, pede confirmação. O banco também bloqueia (FK `restrict`).

**Configurações (`/config`, com abas):**
- **Contas de anúncio** (`/config/contas`):
  - tabela com apelido (pílula), nome, BM, ID no Meta e interruptor Ativa/Inativa direto na linha;
  - inativas ficam acinzentadas e no fim, e a ordem é por apelido, com número natural (C2 antes de C10);
  - apelido em maiúsculas, até 6 caracteres, único;
  - o ID aceita `act_` e salva só o número;
  - excluir: com veiculações, só deixa desativar.
- **Etiquetas** (`/config/etiquetas`):
  - lista com prévia da pílula e número de cards;
  - criar e editar com nome e cor;
  - excluir com confirmação dizendo em quantos cards ela está. A etiqueta sai dos cards antes de ser apagada, para o histórico de cada card registrar o nome dela.

**Componentes novos:**
- `ds.tsx`: `Modal`, `Interruptor`, `BolinhaCor`, `SeletorCor`.
- `ui.tsx`: `Campo`, `entrada`, `BotaoExcluir`, `acoes` no `TituloPagina`.
- `Toast.tsx`: `useToast()` para sucesso e erro.
- `lib/cadastros.ts`: tipos, status das ofertas, paleta e tradução dos erros do banco (`mensagemErro`).
- `lib/useCarregar.ts`: carregar listas.

## Etapa 3: o quadro (27/10/2026)

**Migration 002 (`002_cards_lista_desde.sql`):** coluna `cards.lista_desde`. Para os cards existentes, usa a última mudança de lista registrada em `atividades` e, se não houver, a data de criação (os gatilhos ficam desligados nesse preenchimento, para não mexer em `atualizado_em`). Gatilho `cards_lista_desde` reinicia a data quando o card muda de lista. Próxima migration: 003.

**Tempo real:** `ops.cards` e `ops.veiculacoes` precisam estar na publicação `supabase_realtime` (ativado pela usuária no painel). Qualquer mudança recarrega o quadro (rajadas agrupadas em 400 ms; durante um arrasto, espera soltar). Voltar para a aba também recarrega. A barra mostra "Ao vivo" quando o canal está conectado.

**Navegação (`src/pages/quadro/Quadros.tsx`):**
- `/quadros/todas` e `/quadros/{id da oferta}`; `/` e `/quadros` abrem o último quadro (`localStorage` `ultimo_quadro`).
- Abas: "Todas as ofertas" + uma por oferta não pausada (cor, sigla, nome); as pausadas ficam no menu "Pausadas (n)".
- Os filtros ficam na URL e acompanham a troca de quadro.
- O quadro usa a largura toda da tela (o `Layout` tira o limite de largura em `/quadros`).

**Quadro (`Quadro.tsx`):**
- 10 listas lado a lado com rolagem horizontal; cada lista rola por dentro.
- Cabeçalho com cor, nome, número de cards visíveis e o botão de recolher (lembrado em `listas_recolhidas`). Lista recolhida vira uma coluna estreita que ainda aceita cards soltos.
- Os cards vêm em páginas de 1000 (`buscarCards`). Os arquivados só são buscados com o filtro ligado.
- Clicar no card abre um modal provisório ("Detalhes na próxima etapa").

**Frente do card (`Cartao.tsx`):**
- Pílula da oferta (só em "Todas"), etiquetas, nome (ads em fonte mono).
- Pílulas das contas por apelido, com ícone e cor do status: rodando verde, em análise amarelo, rejeitado vermelho, pausado cinza. "Não subido" não aparece. Passando o mouse: "Conta 02 – BM Nicoly · Rejeitado em 24/10".
- Rodapé:
  - tempo na lista ("agora", "5h", "3d"), amarelo depois de 2 dias e vermelho depois de 5, exceto em Standby, Em veiculação e Rejeitado;
  - quando houver: anexos, comentários, checklist feitos/total (verde quando completo) e troféu de vencedor.

**Arrastar e soltar (@dnd-kit):**
- Mouse (depois de 6 px, para o clique continuar abrindo o card), toque (segurar 200 ms) e teclado.
- Atualização otimista; se o banco recusar, o card volta e aparece o erro.
- Posição = meio entre os vizinhos (`posicaoEntre`), então só o card movido é gravado. Se o intervalo esgotar, a lista é renumerada.

**Criar card rápido (`NovoCard.tsx`):**
- "+ Adicionar card" no fim de cada lista. Tipo Ad/VSL/Outro.
- No Ad: oferta (só em "Todas", entre as não pausadas), AD/H/M e formato (sugestões VD, IMG, CAR, GIF).
- Sugere o próximo AD livre da oferta (maior AD + 1, contando arquivados) com H1 e M1, e mostra a prévia do nome.
- Enter cria e deixa aberto; depois de criar, sugere de novo o próximo AD livre.
- AD/H/M repetido: "Já existe o AD1-H1-M2 nesta oferta.".
- Lembra o último tipo, formato e oferta usados.

**Filtros (`BarraFiltros.tsx`, na URL):** busca por nome, etiqueta, tipo, status da veiculação + conta ("Rejeitado na C2"), só vencedores, mostrar arquivados, limpar filtros e contador de cards visíveis.
