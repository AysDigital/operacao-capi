# Operação Capi — Status do projeto

## Situação atual (12/11/2026)

- **No ar:** https://ops.capimarketing.online (GitHub `AysDigital/operacao-capi`, Vercel `operacao-capi`).
- **Banco:** migrations 001 a 033 rodadas pela usuária (007: 21 contas importadas do dashboard; 009: dados de teste temporários, apagados pela 010). 011–013: cards importados do Trello e ajustes de 04/11; 014: rejeição vira comentário; 015: Standby e Criação do Trello; 016: modelos de card; 017: módulo de ofertas; 018: correção de permissão do checklist da oferta; 019: ativos (etapa 11, rodada em 09/11/2026: 27 contas, 13 BMs criadas do campo BM, 27 contas com dona); 020: queda manual (rodada em 10/11/2026); 021: importação do inventário de ativos (rodada em 10/11/2026: 10 perfis, 13 BMs, 35 contas, 21 páginas, 51 pixels, 308 acessos); 022: tira o perfil "Grupo Capi" (rodada em 10/11/2026: 9 perfis, 304 acessos); 023: pessoas "inativas" das BMs contam como acesso (rodada em 10/11/2026: 10 perfis, 312 acessos); 024: Nicoly na BM Boulevard (rodada em 10/11/2026: 313 acessos); 025: apaga ativos antigos e completa IDs pela planilha (rodada em 10/11/2026: 16 páginas, 15 pixels, todas as contas e BMs com ID). Onde a planilha e o documento discordam, vale o documento (decisão da usuária); 026: status dos pixels, fornecedor dos perfis e apelidos AC das contas (rodada em 10/11/2026: 35 contas com apelido novo); 027: só os pixels GE e Pontos de Comando ficam (rodada em 10/11/2026); 028: quadro de uso das contas (rodada em 10/11/2026); 029: Contingência (etapa 12, rodada em 10/11/2026: 78 linhas do histórico marcadas como importação, 11 reais); 030: anexos Script e AD Finalizado em todos os cards de PC e GE (rodada em 12/11/2026: 161 cards, todos com os dois); 031: vários IDs da Meta por veiculação (rodada em 12/11/2026: 83 IDs principais, 0 extras); 032: contingência padrão (rodada em 12/11/2026: 4 roteiros padrão; a classificar: 8 perfis, 13 BMs, 35 contas, 16 páginas); 033: fases do manual de tráfego (etapa 13, rodada em 12/11/2026: 29 veiculações rodando com data de início). **Próxima: 034.**
- **Fora do `ops` (autorizado, ver CLAUDE.md):** tempo real em `ops.cards` e `ops.veiculacoes`; bucket privado `operacao` no Storage; leitura do dashboard só agregada (contas: número e nome; vendas: somas por anúncio; data da última venda).
- **Vercel:** `META_ADS_TOKEN` cadastrada no projeto `operacao-capi`.
- **Testado e aprovado pela usuária:**
  - etapa 1: login e menu;
  - etapa 2: cadastros;
  - etapas 3 e 3b: quadro, arrastar, filtros, tempo real, ações de lista, arquivar;
  - etapa 4: card detalhado, exclusões e os ajustes de data;
  - etapa 4b: imagens;
  - etapa 5: versões, gerar variações, duplicar e família;
  - etapa 6: contas importadas, escolher o anúncio na lista da Meta, métricas no card e atualização automática;
  - etapa 7: regras por oferta, selos, linha de números, filtro e ordenação no quadro, ranking e alertas (testada com os dados falsos da 009);
  - etapa 8: importação do Trello;
  - etapa 9: modelos de card;
  - etapa 10: módulo de ofertas (página da oferta, checklist, testes);
  - etapa 11 (10/11/2026): ativos, com queda manual, inventário importado do documento de contingência (021–025), nomes das contas pela Meta, apelidos AC, grupos ativos/desativados, Possui/Acessa pela cadeia, só os pixels GE e Pontos de Comando (027) e o quadro manual de uso das contas (028).
  - etapa 12 refeita (12/11/2026, migration 032): Contingência padrão, com os ativos existentes já classificados pela usuária;
  - etapa 13 (12/11/2026, migration 033): fases do manual de tráfego, no-spend, mid-spender e No-Bid. Por enquanto todas as contas ficam "Sem papel" (decisão da usuária);
  - ajustes de 12/11/2026: Veicular em lote (várias listas e filtro de cards sem conta), Preencher IDs da Meta, página de Ajuda, Marcar todos no checklist da oferta e vários IDs da Meta por veiculação (031).
- **Inventário hoje:** 10 perfis, 13 BMs, 35 contas, 16 páginas, 2 pixels.
- **Próximas etapas:**
  - importação do Trello concluída (011–015); o resto do Trello foi descartado pela usuária;
  - modelos de card: feito na etapa 9 (016);
  - checklist de lançamento de oferta: feito na etapa 10 (017/018);
  - ativos: etapa 11 concluída (019–028);
  - Contingência (aquecimento, reserva, quedas e vida útil por fornecedor): etapa 12 (029), refeita como processo padrão na 032 (12/11/2026), testada e aprovada.
- **Vendas (encerrado em 12/11/2026):** o webhook grava normalmente. Em 26 e 27/10 não houve venda nenhuma na Mundpay (conferido pela usuária), então nada se perdeu. Ver "Vendas que não chegam ao dashboard", no fim.

## Etapa 1: fundação (27/10/2026)

**App:** React + Vite + TS + Tailwind, mesma identidade do financeiro. Login por e-mail e senha (sem cadastro), verificação de acesso por `ops.is_membro()`, menu lateral recolhível com Quadros, Ofertas, Veiculações, Modelos e Configurações (todas "Em construção"; a aba Veiculações foi removida em 12/11/2026, porque as veiculações vivem dentro dos cards).

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

## Etapa 3b: melhorias do quadro (28/10/2026)

Pedidas pela usuária depois de testar a etapa 3 (todos os 5 testes ok).

**Migration 003 (`003_listas_arquivar_e_acoes.sql`):**
- `listas.arquivada`.
- `ops.mover_cards(ids, lista)`: põe os cards no fim da lista de destino, mantendo a ordem entre eles.
- `ops.ordenar_cards(ids)`: grava a ordem informada.
- As duas rodam com as permissões de quem chama (RLS vale) e geram o histórico normal pelos gatilhos. Próxima migration: 004.

**O que mudou no quadro:**
- **Arrastar o quadro para o lado:** clicar e arrastar no fundo (fora dos cards e botões) rola o quadro na horizontal, só com mouse; no toque, a rolagem já é nativa.
- **"+ Adicionar card"** fecha ao clicar em qualquer lugar fora do formulário (também fecha no Esc).
- **Menu "⋯" de cada lista** (`MenuLista.tsx`, posicionado na tela para não ser cortado):
  - **Ordenar por:** nome (A–Z), mais novos primeiro, mais antigos primeiro, há mais tempo na lista. A ordem é gravada.
  - **Mover todos os cards** para outra lista.
  - **Arquivar todos os cards.**
  - **Arquivar esta lista.**
  - As ações valem para os cards não arquivados da lista **neste quadro** (num quadro de oferta, só os daquela oferta), ignorando os filtros. O menu mostra quantos são.
- **"+ Adicionar lista"** no fim do quadro (`NovaLista.tsx`). A lista vale para todos os quadros e entra no fim, com cor cinza.
- **Arquivar:**
  - o card se arquiva pelo modal do card ("Arquivar card" / "Restaurar card") ou em lote pelo menu da lista;
  - a lista arquivada some de todos os quadros, junto com os cards dela;
  - o botão **Arquivados** na barra abre um painel (`PainelArquivados.tsx`) com as listas e os cards arquivados do quadro atual, cada um com "Restaurar".
- As listas não estão no tempo real: uma lista criada ou arquivada no outro computador aparece ao recarregar a página.

## Etapa 4: card detalhado e exclusões (28/10/2026)

**Migration 004 (`004_card_detalhado_e_exclusoes.sql`):**
- `cards.prazo` (data).
- `cards_log` refeito igual ao da 001, mais: prazo definido ou removido, e "perdeu a ligação com a versão de origem (excluída)" no card-filho quando a origem é apagada.
- `veiculacoes.categoria_rejeicao` só aceita `adulto`, `saude_corpo`, `promessa_resultado`, `atributos_pessoais`, `sensacionalismo`, `antes_depois` e `outro` (`not valid`: não confere linhas antigas).
- Comentários: todos os membros leem; só o autor cria em seu nome, edita e apaga. `editado_em` é preenchido por gatilho.
- `ops.esvaziar_lista(de, para)`: move todos os cards da lista (todos os quadros, inclusive arquivados).
- Exclusão de card: nada a mudar. A 001 já apaga junto anexos, comentários, atividades, veiculações, checklists, etiquetas e membros, e os filhos ficam com `parent_card_id` nulo. Os gatilhos de histórico não gravam nada para card que não existe mais.
- Próxima migration: 005.

**Modal do card (`src/pages/quadro/card/`):**
- **Abertura:** abre pela URL (`?card={id}`), então o link pode ser copiado. Fecha no Esc ou clicando fora. Antes de fechar, o campo em edição é salvo. Esc dentro de um campo só sai do campo, e com duas janelas abertas o Esc fecha só a de cima.
- **Cabeçalho (`ModalCard.tsx`):**
  - a oferta (seletor no quadro "Todas"; pílula nos outros) e o seletor de lista (move pelo `mover_cards`, para o fim);
  - no Ad, AD/H/M/formato com prévia do nome, salvos ao sair do campo, com erro em português se repetir;
  - no VSL/Outro, título editável;
  - botão de vencedor.
- **Barra de ações (popovers):**
  - Etiquetas: marcar e criar nova com cor;
  - Membros;
  - Prazo: data e "Remover prazo";
  - Checklist: cria com título;
  - Anexo: abre o formulário de anexo.
- **Resumo** abaixo da barra: membros, etiquetas e prazo (amarelo hoje/amanhã, vermelho vencido).
- **Descrição (`Texto.tsx`):** formatação simples (`**negrito**`, listas com `-` ou `1.`, `[texto](link)` e links soltos), com botões B / Lista / Link. Salva ao sair do campo. O texto é desenhado como elementos React, sem HTML cru.
- **Checklists (`Checklists.tsx`):** vários por card, com barra de progresso, título editável e exclusão com confirmação. Nos itens: marcar, editar ao clicar, arrastar pela alça para reordenar e excluir. "Adicionar um item" com Enter mantém aberto.
- **Anexos (`Anexos.tsx`):**
  - ícone pelo domínio (Docs, Sheets, Slides, Drive, Figma, Canva, YouTube, Vimeo, Loom, Dropbox, Meta, Notion);
  - abrem em nova aba;
  - "+ Script" e "+ AD Finalizado" somem quando o card já tem um com esse título; "+ Outro anexo" tem título livre;
  - editar, arrastar para reordenar e remover.
- **Veiculação por conta (`Veiculacoes.tsx`):**
  - uma linha por conta, com status, ID do anúncio e data do status;
  - o ID aceita colar um link do Gerenciador: `selected_ad_ids`, `ad_id` etc., ignorando o `act=` da conta. Se o ID já estiver em outro card, avisa qual;
  - mudar o status sem mexer na data deixa o banco pôr a data de agora; mudar a data grava meio-dia de Brasília;
  - rejeitado mostra motivo e categoria;
  - "+ Subir em outra conta" lista só as contas ativas fora do card e entra como "Em análise";
  - remover pede confirmação.
- **Comentários e atividade (`Atividade.tsx`):**
  - caixa de comentário com a mesma formatação; Ctrl+Enter envia;
  - editar e excluir só os próprios;
  - "Mostrar detalhes" mistura o histórico em ordem cronológica e fica lembrado.
- **Rodapé:** Excluir e Arquivar/Restaurar.
- **Salvamento:** cada campo salva sozinho. Erro vira toast em português, e o card e o quadro recarregam (o quadro agrupa as recargas em 400 ms).

**Exclusões (`card/Exclusoes.tsx`):**
- **Card:** pelo modal, pelo clique-direito no quadro (Abrir / Arquivar / Excluir) e pelo painel Arquivados.
  - O aviso diz que é permanente e apaga anexos, comentários, histórico e veiculações (inclusive o histórico de rejeições). Também diz que os cards-filhos continuam, e oferece "Arquivar em vez disso".
  - Com ID de anúncio em alguma veiculação, é preciso digitar o nome do card.
- **Lista:** pelo menu "⋯" e pelo painel Arquivados.
  - Conta os cards em todos os quadros, inclusive arquivados. Se houver, oferece "Mover todos os cards" (`esvaziar_lista`) antes. Vazia, confirma avisando que some de todos os quadros.
  - O banco também impede excluir lista com cards.

**Quadro:** a frente do card mostra o prazo (amarelo hoje/amanhã, vermelho vencido). Os dados do quadro passaram a trazer `prazo` e o `meta_ad_id` das veiculações, usado na confirmação de exclusão.

**Ajustes depois do teste da usuária (28/10/2026, sem migration):**
- **Prazo:** começa na data de hoje, tem atalhos (Hoje, Amanhã, Em 3 dias, Em 1 semana) e só grava em "Definir prazo" ou com Enter. Antes gravava a cada tecla, e o ano saía errado.
- **Data do status da veiculação:** só grava ao sair do campo, pelo mesmo motivo. As duas datas aceitam apenas anos 20xx.
- **Editor de texto:** sem o botão "Link" (links colados continuam virando link).
- **ID do anúncio:** dica ⓘ explicando onde achar (link com `selected_ad_ids=` ou a coluna "ID do anúncio").

## Etapa 4b: imagens (28/10/2026)

**Migration 005 (`005_storage_imagens.sql`), exceção autorizada pela usuária, fora do `ops`:**
- bucket privado `operacao`: até 10 MB, só PNG, JPG, GIF e WEBP;
- quatro políticas `operacao_*` em `storage.objects` (ler, enviar, alterar, apagar), só nesse bucket e só para membros (`ops.is_membro()`). Registrado no CLAUDE.md.
- Próxima migration: 006.

**Como funciona (`src/lib/arquivos.ts`):**
- As imagens ficam em `cards/{id do card}/{uuid}.ext`.
- No banco ficam como `storage:{caminho}`: no texto como `![imagem](storage:…)`, nos anexos em `anexos.url`.
- O bucket é privado, então a tela usa links temporários de 1 hora, guardados por 50 minutos.

**Na tela:**
- **Comentários e descrição:** colar (Ctrl+V) ou arrastar imagem no editor insere a imagem no texto. Ela aparece no comentário e abre em tamanho real numa aba nova.
- **Anexos:**
  - "+ Imagem" (escolher arquivo), arrastar para a seção ou Ctrl+V com o card aberto, fora de um campo de texto;
  - o anexo de imagem mostra miniatura, e o título dele pode ser editado.
- **Limpeza:**
  - remover um anexo de imagem apaga o arquivo;
  - editar um comentário apaga as imagens que saíram do texto, e excluir o comentário apaga as dele;
  - excluir o card apaga a pasta inteira dele, depois que o card sai do banco.
  - Imagens coladas num comentário que nunca foi enviado, ou tiradas da descrição, ficam na pasta do card até ele ser excluído.

## Etapa 5: versões dos ads e variações (28/10/2026)

Família = cards Ad da mesma oferta com o mesmo AD. H = hook, M = variação do hook. `parent_card_id` guarda de qual card a versão veio.

**Migration 006 (`006_versoes.sql`), com tudo rodando nas permissões de quem chama (RLS vale):**
- `ops.criar_versoes(origem, tipo, quantidade, lista, motivo)`:
  - `variacao` = mesmo AD/H, próximo M livre; `hook` = próximo H livre, M1;
  - números calculados no banco contando arquivados, com trava por família (`ops.travar_familia`, advisory lock da transação), para não colidir com duas pessoas ao mesmo tempo;
  - preenche `parent_card_id` e `motivo_versao`. O histórico "criou esta versão a partir de…" (na nova) e "nova versão: …" (na origem) vem do `cards_log`.
- `ops.gerar_variacoes(origem, hooks, variacoes, lista, motivo)`: hooks novos e variações do mesmo H numa transação só (até 10 + 10).
- `ops.duplicar_card(origem, lista, ad, hook, var, nome)`:
  - qualquer tipo, sem ligação de versão;
  - no Ad, AD/H/M informados ou o próximo AD livre; no VSL/Outro, "… (cópia)".
- `ops.copiar_conteudo(de, para)`:
  - copia etiquetas, membros, anexos e checklists (itens desmarcados); a descrição é copiada no próprio insert;
  - não copia comentários, veiculações, vencedor e prazo;
  - roda com `ops.silencio = 1` na transação, então a cópia não gera "adicionou…" no histórico. `ops.registrar` foi refeita para respeitar isso.
- Próxima migration: 007.

**Imagens nas cópias (`copiarImagensParaCards` em `lib/arquivos.ts`):**
- O banco não copia arquivos do Storage. Logo depois de criar, o app copia cada imagem (anexos e descrição) para `cards/{card novo}/` e troca o caminho. Se a cópia falhar, o card novo continua apontando para o arquivo da origem.
- **Proteção:** remover anexo, editar ou excluir comentário só apaga arquivos da pasta do próprio card (`ehDoCard`). Assim nunca se apaga a imagem de outro card.

**Telas (`src/pages/quadro/card/Versoes.tsx`):**
- **Nova versão:** no modal do card Ad e no clique-direito.
  - O que criar: "Nova variação (M)" ou "Novo hook (H)", com a prévia do nome.
  - Motivo obrigatório: atalhos (Rejeitado, Ajuste de edição, Teste de variação, Escala de vencedor) + texto. Com veiculação rejeitada na origem, já vem "Rejeitado: C2: motivo (categoria)".
  - Lista de destino: "Em ajuste [Edição]" se o motivo é Rejeitado, senão "Criação". Escolher à mão fixa a escolha.
  - Origem: manter (padrão), mover para Rejeitado ou arquivar.
  - Depois de criar, abre o card novo.
- **Gerar variações:**
  - hooks novos (0–10) e variações do hook (0–10), com a lista dos nomes que vão nascer;
  - destino "Criação" e motivo "Escala de vencedor" se o card for vencedor;
  - toast "N cards criados em X".
- **Duplicar:** todos os tipos, no modal e no clique-direito. No Ad sugere o próximo AD livre com H1 M1; no VSL/Outro, o título "(cópia)". Abre o card novo.
- **Família AD{n}:** última seção do card Ad.
  - Árvore por H, com os Ms embaixo.
  - Cada item mostra nome curto, lista, pílulas das contas e troféu. Arquivados ficam acinzentados.
  - O card aberto fica destacado, e clicar abre o outro card.
- **"Veio de: AD1-H1-M1 · motivo"** no cabeçalho, clicável.
- **Componente reaproveitado:** `PilulasContas` saiu do `Cartao.tsx`, para a frente do card e a família usarem as mesmas pílulas.

## Etapa 6: métricas por anúncio (28/10/2026)

Diagnóstico em `DIAGNOSTICO_METRICAS.md` (etapa 6a). A usuária autorizou tudo o que ele recomendou (leituras do dashboard registradas no CLAUDE.md).

**Migration 007 (`007_metricas.sql`):**
- `ops.importar_contas_dashboard()`: copia de `public.meta_ad_accounts` as contas que faltam, só número e nome. "CONTA 02 - BM 01 - Henrique" vira nome "Conta 02" e BM "BM 01 - Henrique", com apelido no primeiro "C{n}" livre. A migration já roda a importação (21 contas). Botão "Importar do dashboard" em Configurações → Contas de anúncio.
- `ops.vendas_por_anuncio(ids, desde)`: lê `public.purchases` por `ad_id` e devolve só quantidade e valores agregados (por anúncio, tipo de oferta e status). Dia da venda no fuso de Brasília, valores em reais. `canceled` (cartão recusado) fica de fora.
- `ops.metricas_anuncio_dia` (chave anúncio + dia):
  - gasto na moeda da conta, cotação e gasto em reais (sem IOF);
  - impressões, cliques, cliques no link e compras atribuídas pela Meta (uma só fonte: omni_purchase, purchase ou pixel);
  - visualizações de 3 s (`video_view`) e ThruPlays.
- `ops.metricas_buscas`: cada busca na Meta (período, contas, linhas, falhas).
- Próxima migration: 008.

**Funções no Vercel (`api/`, mesmo padrão do financeiro, sempre com o JWT do usuário e nunca a service role):**
- `POST /api/meta-metricas`: `/insights` com `level=ad`, por dia, nas contas ativas com ID, 4 contas por vez.
  - Período: últimos 3 dias (a Meta ainda ajusta os recentes); na primeira vez ou com `completo`, 90 dias.
  - Contas em dólar convertidas pela PTAX. A moeda vem da Meta: a "CONTA 03 - BM 01 - Cecilia" é USD sem "[Dólar]" no nome.
- `GET /api/meta-anuncios?conta=`: lista os anúncios da conta (id, nome, status), do mais novo para o mais antigo.
- Chave: `META_ADS_TOKEN` (a mesma do financeiro) no `.env.local` e no Vercel. Opcional: `META_API_VERSION` (padrão v23.0).
- O `vite.config.ts` atende `/api` no `npm run dev` (o mesmo plugin do financeiro). O `vercel.json` dá até 300 s às funções.
- Testado direto na Meta com a chave (só leitura): os campos pedidos e a lista de anúncios responderam.

**Na tela:**
- **Seção "Métricas" no card (`card/Metricas.tsx`):**
  - período de 7 dias, 30 dias ou tudo (lembrado);
  - cartões de Gasto, Faturamento, ROAS, Vendas, CPA, CPM, CTR (link) e Hook rate (hold rate embaixo), cada um com Dica;
  - "Ver por conta" (uma linha por veiculação);
  - "Meta atualizada em …" e "Atualizar agora";
  - sem nenhum ID de anúncio no card, mostra o aviso para preencher.
- **Definições:**
  - faturamento = vendas aprovadas com o ID do anúncio, somando principal, upsell e downsell;
  - vendas e CPA = só o produto principal;
  - reembolso e chargeback aparecem à parte;
  - ROAS = faturamento ÷ gasto sem IOF.
- **Veiculação:** "Escolher na lista da Meta" abaixo do campo do ID. A lista vem já filtrada pelo AD/H/M do card (ex.: `ad27-h1-m1`), mas isso é só sugestão de busca: quem escolhe é a pessoa. Grava o ID e o `nome_no_meta`.
- **Atualização automática:** ao abrir Quadros, se a última busca tem mais de 1 hora, busca de novo em segundo plano.

## Etapa 7: vencedores em evidência e ranking (04/11/2026)

**Migration 008 (`008_regras_e_ranking.sql`):**
- `ops.ofertas` ganhou as regras de performance: `cpa_alvo` (R$), `roas_minimo`, `gasto_minimo` (R$) e `periodo_avaliacao` (7, 14 ou 30 dias, padrão 7).
- `ops.classificar(...)`: a regra, num lugar só.
  - Vencedor: gasto ≥ mínimo e (ROAS ≥ mínimo ou CPA ≤ alvo).
  - Perdedor: gastou 2× o CPA alvo sem venda principal.
  - Promissor: tem vendas, mas não atingiu o gasto mínimo.
  - Em teste: gastando, sem dados suficientes, ou oferta sem regras.
  - Sem dados: sem gasto.
- `ops.ranking(oferta, dias, nivel)`: números por anúncio, hook (AD+H) ou família (AD), somando todas as veiculações. Só cards Ad não arquivados com algum ID de anúncio.
  - `dias`: null = período de avaliação de cada oferta; 0 = tudo.
  - A classificação usa sempre o período de avaliação da oferta.
  - Lê `public.purchases` só agregado (security definer + `is_membro`).
- `ops.ultima_venda()`: só a data/hora da última venda registrada (`max(created_at)`). Leitura nova do `public`, autorizada pela usuária no pedido da etapa 7 e registrada no CLAUDE.md.

**Na tela:**
- **Ofertas:** seção "Regras de performance" no modal (campos em branco = sem regra; aceita "1.500" e "1,5").
- **Quadro:**
  - selo 🔥 Vencedor (verde), ✨ Promissor (azul) ou ⚠️ Perdedor (vermelho); "Em teste" e "Sem dados" não têm selo;
  - nos cards com veiculação rodando, a linha "R$ 320 · 2,4x · 5v" (período de avaliação da oferta);
  - botão "Métricas" na barra mostra e esconde essas linhas (lembrado);
  - filtro "Classificação". O antigo "Só vencedores" virou "Só com troféu" (o troféu continua manual e separado);
  - "Ordenar por" ganhou maior ROAS, maior gasto e mais vendas;
  - os números recarregam ao abrir, quando muda um ID de anúncio, depois de cada busca na Meta e a cada 10 minutos.
- **Ranking (menu lateral, `/ranking`):**
  - oferta (ou todas), período (7, 14, 30 dias ou tudo), agrupar por anúncio, hook ou família, classificação e busca (lembrados, menos a busca);
  - tabela ordenável: classificação, gasto, faturamento, ROAS, vendas (+ upsell/downsell), CPA, CTR, hook rate, contas onde está rodando e lista; totais no rodapé;
  - por anúncio: Abrir (vai para o quadro com o card aberto), Gerar variações (o modal da etapa 5) e o troféu;
  - por hook ou família: "Ver anúncios" troca para anúncio, buscando pelo prefixo.
- **Alertas (topo de Quadros e do Ranking, `AvisosDados.tsx`):**
  - gasto nas últimas 24 h (hoje e ontem na Meta) sem venda registrada nas últimas 24 h: "Nenhuma venda registrada desde …";
  - última busca na Meta com falha em alguma conta, ou a busca inteira falhou: mostra o motivo;
  - a atualização automática das métricas (1 por hora) saiu de Quadros e passou para esse componente.

**Teste (migration 009, temporária):** oferta "Oferta de teste" (TESTE-PT) com 7 cards, IDs de anúncio falsos (999000000000…), métricas falsas em `ops.metricas_anuncio_dia` e vendas falsas em `ops.vendas_teste` (o dashboard não foi tocado). `ops.ranking` e `ops.vendas_por_anuncio` somavam essa tabela. Aprovado pela usuária em 04/11/2026. A migration 010 (rodada em 04/11/2026) voltou as duas funções à versão da 007/008 e apagou tudo.

## Etapa 8: importação do Trello (04–05/11/2026)

- **011:** 39 cards dos ads ativos na Meta, com veiculações já ligadas ao `meta_ad_id` (PC-EN na Nina C22 e Boulevard C23; GE-ES na Cecilia C3).
- **012:** 34 cards de Aguardando edição e Revisão [Edição]; os das listas 🚨 ganharam a etiqueta "Urgente".
- **013:** PC pausado na Nina (veiculações mantidas como "Pausado"); AD12 rejeitado na Nina; 9 PC sem Boulevard foram para "Pronto pra subir".
- **014:** quando a veiculação sai de "Rejeitado" (ou é removida rejeitada), a rejeição vira comentário no card e o motivo/categoria são limpos.
- **015:** 88 cards não arquivados de Standby e Criação (PC-EN 82, GE-EN 4, PC-FR 1, PC-IT 1), com links e checklists; criou PC-FR, PC-IT e GE-EN. Histórico: uma linha "importou do Trello" por card.
- **Descartado por decisão da usuária:** cards arquivados, a lista Em planejamento, cards sem oferta, as ofertas antigas (Western Wall, Gelatina bariátrica, Nossa Senhora, Arcanjo Gabriel, Adesivo Emagrecedor, Aprendendo Brincando), comentários e imagens hospedadas no Trello.
- O JSON exportado (`6l4PLnjs - ays-criativos.json`) fica só na máquina (no `.gitignore`).

## Etapa 9: modelos de card (05/11/2026)

- **Migration 016:** `ops.modelos_card` ganhou `oferta_id` (vazio = todas), `lista_id` (lista padrão), `prazo_dias` (prazo = dia da criação + N) e `atualizado_em`.
  - `ops.criar_de_modelo`: cria de 1 a 10 cards numa transação. Ad sem AD informado usa os próximos AD livres da oferta (H1-M1), com a trava por oferta da etapa 5; com AD informado, a trava por família.
  - Etiquetas, anexos com link e checklists (itens desmarcados) vão para o card. A cópia roda com `ops.silencio`; o histórico fica com uma linha: "criou o card em X a partir do modelo Y".
  - `ops.salvar_como_modelo`: cria o modelo a partir de um card (tipo, formato, lista atual, etiquetas, descrição, anexos de link, checklists com itens).
- **Página Modelos** (`src/pages/Modelos.tsx`): tabela com nome, oferta, tipo, formato e lista padrão; criar, editar, duplicar e excluir (com confirmação).
- **No quadro:**
  - "+ Adicionar card": seletor de modelo (lembra o último) e quantidade para Ad, com prévia dos nomes;
  - "+ Novo a partir de modelo" na barra (`ModelosQuadro.tsx`);
  - "Salvar como modelo…" no clique-direito e no modal do card.
- Imagens da descrição do modelo são copiadas para a pasta do card novo (`copiarImagensParaCards`).

## Etapa 10: módulo de ofertas (09/11/2026)

- **Migration 017:**
  - `ofertas.anotacoes`, tabela `ops.ofertas_links` (vendas, checkout, Drive, membros, outro);
  - `ops.testes_oferta` (tipo, hipótese, status, início/fim automáticos, resultado, aprendizado, card ligado);
  - checklist de lançamento: `modelos_checklist_oferta` preenchido (11 seções, 36 itens); `ops.criar_checklist_oferta` e gatilho que copia o modelo em toda oferta nova; itens com `prazo` e `nota`;
  - histórico da oferta: `ops.atividades` com `card_id` nulo, via `ops.registrar_oferta` (itens marcados/desmarcados, testes criados, status e resultado);
  - `ops.veiculacoes_log` agora atualiza a categoria/motivo da última rejeição no histórico (a view `v_rejeicoes` passa a contar por categoria);
  - `ops.vendas_por_dia` (leitura nova de `public.purchases`, só totais por dia, autorizada pela usuária ao rodar a 017) e `ops.cobertura_oferta` (gasto das contas da oferta sem card).
- **Página da oferta** (`/ofertas/:id`, `src/pages/oferta/`): cabeçalho com status editável, "Editar oferta" e "Abrir quadro"; abas Visão geral | Checklist | Testes (`?aba=`).
  - Visão geral: período 7/14/30/tudo, cartões (gasto, faturamento, ROAS, vendas, CPA, taxa de upsell, reembolsos), gráficos diários de gasto × faturamento e de ROAS (`GraficoLinhas.tsx`, SVG, cores `--c-series-1/2` validadas), produção, top 5 com "Abrir" e "Gerar variações", aviso de cobertura, links, anotações e histórico.
  - Checklist: seções recolhíveis com progresso, quem/quando marcou, prazo e anotação por item, adicionar/renomear/reordenar/excluir.
  - Testes: quadro por status com arrastar entre colunas; o card ligado mostra "Teste: …" no cabeçalho.
- **Lista de ofertas:** linha abre a página; coluna com o progresso do checklist.
- **Configurações → Checklist de oferta:** editor do modelo (vale só para ofertas novas).

## Etapa 11: ativos (09/11/2026)

- **Regra:** cada ativo tem UMA dona (BM ou perfil) e pode estar compartilhado com outras BMs e perfis. Só se perde numa queda quando não sobra nenhum acesso ativo (de BM ou perfil que não esteja caído).
- **Migration 019:**
  - tabelas `fornecedores`, `perfis`, `bms`, `paginas`, `pixels`, `dominios`, `cartoes` (só apelido, 4 últimos dígitos, banco e PF/PJ). Nenhum campo de senha, 2FA, cookie ou token; do gerenciador de senhas, só o nome do item;
  - `contas_anuncio` ganha moeda, limite de gasto, cartão, status (ativa/restrita/desativada) e data de criação. `ativa` acompanha o status (só "desativada" tira a conta dos quadros); `bm_nome` acompanha a BM dona;
  - `ops.acessos`: um ativo (perfil, BM, conta, página, pixel) e um titular (BM ou perfil) por linha, papel dona/compartilhado, nível, desde, ativo. No máximo uma dona ativa por ativo; o mesmo titular não repete;
  - `ops.ofertas_ativos`: páginas, pixels e domínios de cada oferta;
  - `ops.ativos_status_log` (escrita só pelos gatilhos): toda mudança de status, com motivo e data. Na queda (restrita, desativada, checkpoint, restrito, morto), os acessos que a BM/perfil dá ficam inativos, guardados;
  - `ops.simular_queda(tipo, id)` (em cascata) e `ops.mudar_status_ativo(tipo, id, status, motivo, data)`;
  - BMs criadas a partir do campo "BM" das contas existentes, cada uma como dona das suas contas.
- **Página Ativos** (`/ativos`, `src/pages/Ativos.tsx`, `src/pages/ativos/`, `src/lib/ativos.ts`): abas Perfis | BMs | Contas | Páginas | Pixels | Domínios | Cartões | Fornecedores, cada uma com busca, filtro de status, criar, editar e excluir (só sem ligações). No topo, aviso dos ativos que dependem de uma única BM ou perfil.
  - Painel lateral: dados, dona e compartilhamentos (adicionar, remover, tornar dona), o que a BM/perfil possui e acessa, ofertas e ads rodando, histórico de status.
  - "E se cair?" (BMs e perfis): perdidos × seguros (com "via"), ofertas e ads afetados. Mudar status pede motivo e data; numa queda, mostra antes o que vai se perder e depois o resultado como alerta.
  - Status com as mesmas cores em todo lugar: verde ok, amarelo atenção, vermelho caído, cinza morto.
- **Contas de anúncio** saíram de Configurações para Ativos → Contas (com "Importar do dashboard"); `/config/contas` redireciona.
- **Página da oferta:** nova aba Ativos (contas pelas veiculações; páginas, pixels e domínios ligados).
- **Ajustes de 10/11/2026 (migration 020, queda manual):**
  - por decisão da usuária, a queda de uma BM ou perfil não mexe em mais nada: os acessos não são inativados e não há alerta de perdidos. Ela marca à mão o que mais caiu. O status vai para o histórico com motivo e data, como antes;
  - "E se cair?" continua, só como simulação;
  - botão "+ Compartilhar com BM ou perfil" logo abaixo de "Compartilhado com" (antes era um "+ Acesso" pequeno no canto).
- **Migration 021 (importação do inventário):** a partir do documento `docs/Ativos-de-contingência-Facebook.md` (levantado em 10/11/2026 pelo perfil do Luciano):
  - junta as BMs repetidas da Cecília ("BM 01 - Celilia", "BM Cecilia") em "BM 01 - Cecília"; apaga a falsa BM "ED" (a C1 é da BM Luciano Peters); tira "[Dólar]" do nome das BMs Nicoly e Viewy (C8, C9, C15 ficam em USD);
  - cria as BMs 01, 02 e 03 - Mayarah Laysla; BM 01/03 - Mayarah e BM 02 - Viewy ficam desativadas (acesso perdido);
  - 9 contas desativadas (❌) e 8 contas novas sem ID da Meta (C27–C34: Maria Eduarda 02 e 03, Mayarah BM 02 e BM 03);
  - 10 perfis (5 bloqueados = restrito; "Grupo Capi" é um perfil só que aparece com 4 nomes), 21 páginas, 51 pixels (os desativados no Meta com observação);
  - acessos: dona e compartilhamentos de BMs (pessoas ativas), contas, páginas e pixels. E-mails do documento não foram gravados.
- **Migration 022:** apaga o perfil "Grupo Capi" e os 4 acessos dele (tinha sido deduzido só por um e-mail; a usuária pediu para desconsiderar). O documento fica fora do Git (`.gitignore`), porque tem e-mails.
- **Migration 023:** por decisão da usuária, quem aparece como "Inativo (nunca entrou)" nas BMs tem acesso de verdade. Entram Nicoly e Maria Eduarda (BMs Luciano Peters, Maneca, Nina, Maria Eduarda) e o perfil novo Ana Júlia (Maneca, Maria Eduarda). Contas de Instagram e pessoas só identificáveis por e-mail ficam de fora.
- **Nomes das contas (10/11/2026):** botão "Buscar nomes na Meta" em Ativos → Contas (`api/meta-contas.ts`): busca `name` e `currency` de cada conta com ID (lotes de 50 via `?ids=`; se o lote falha, tenta uma por uma) e grava `nome` e `moeda` com o JWT do usuário. O apelido (CXX) não muda. Avisa as contas sem ID da Meta.
- **Quadro de uso das contas (migration 028, 10/11/2026):** kanban manual em Ativos → Contas → "Quadro de uso" (atalho "Uso das contas" no menu, rota `/uso-contas`). Colunas Veiculando ads | Aquecimento | Sem uso (`contas_anuncio.uso`), arrastar muda a coluna e grava `uso_desde`; clicar abre a conta para marcar oferta (`uso_oferta_id`), data e anotação (`uso_nota`). Contas desativadas não aparecem. Nada é preenchido sozinho (pedido da usuária).
- **Possui / Acessa (10/11/2026):** contam pela cadeia (`posseEAcesso` em `src/lib/ativos.ts`): Possui = o que a BM/perfil tem como dona + o que as BMs dele possuem; Acessa = o resto do alcance (compartilhado). Passar o mouse no número mostra o detalhe por tipo.
- **Migration 027:** apaga os 13 pixels antigos; ficam só GE e Pontos de Comando.
- **Migration 026 e ajustes da página Ativos (10/11/2026):**
  - pixels ganham status (ativo/desativado, com histórico como os outros); quem tinha "Desativado no Meta" na observação virou desativado;
  - perfis Henrique, Cecília e Nina: fornecedor BW Digital, origem comprado; os demais: origem "Pessoal" (valor `proprio`, só o rótulo mudou);
  - apelido das contas = `AC` + número da conta + 3 letras da BM dona (ex.: AC01LUC); BM que não é a 01 ganha o número no fim (AC01VIE2, AC01MAY3). Apelido aceita até 8 caracteres;
  - abas Perfis, BMs, Contas, Páginas e Pixels mostram dois grupos: Ativos primeiro, depois Desativados e restritos;
  - perfis sem a coluna Navegador; Fornecedor mostra "Pessoal" quando não há fornecedor; Possui e Acessa com dica explicando.
- **Migration 025:** apaga 5 páginas e 36 pixels antigos (pedido da usuária; com acessos e ligações com ofertas); C27–C34 ganham nome, ID da Meta e moeda da planilha `docs/Organização-contas-Facebook.xlsx` (fora do Git), as da Mayarah como desativadas; as 13 BMs ganham o ID da Meta.
- **Migration 024:** Nicoly compartilhada na BM 01 - Boulevard (no documento a pessoa se chama "Nicoly Souza"; a 021 tinha ligado ao Grupo Capi pelo e-mail).

## Etapa 12: Contingência (10/11/2026)

- **Princípio:** processo separado, com item próprio no menu (`/contingencia`). Usa os perfis, páginas e contas de Ativos, mas nada se move sozinho: o sistema organiza, lembra e avisa; status do ativo e coluna do quadro de uso só mudam quando a usuária confirma.
- **Migration 029:**
  - `ops.rotinas_aquecimento` (nome, tipo perfil/página/conta, duração em dias, ativa, descrição) e `ops.rotinas_tarefas` (dia; vazio = todos os dias; texto; ordem). Começa vazia;
  - `ops.aquecimentos` (perfil_id/pagina_id/conta_id com `ativo_tipo`/`ativo_id` gerados, cópia do nome e da duração da rotina, início, status andamento/concluído/interrompido, fim, motivo, observações) e `ops.aquecimento_tarefas` (dia, texto, diária, feito, feito_em). Índice único: um aquecimento em andamento por ativo;
  - `ops.iniciar_aquecimento(tipo, id, rotina, início)`: copia as tarefas da rotina; as de "todos os dias" viram uma por dia (1..duração), então mudar a rotina depois não altera aquecimentos em andamento;
  - `ops.reserva_minima` (mínimo de prontos por tipo, começa em 0);
  - `ativos_status_log.importacao`: marca as linhas gravadas pelas importações (019–026), que não contam como queda.
- **Telas** (`src/pages/Contingencia.tsx`, `src/pages/contingencia/`, `src/lib/contingencia.ts`):
  - topo: reserva de prontos × mínimo por tipo, com "Configurar mínimo" e alerta quando abaixo (o alerta também aparece em Ativos). Pronto = não caído + aquecimento concluído + sem uso (perfil "Pronto"; conta em "Sem uso" no quadro de uso; página sem oferta ligada);
  - Hoje: aquecimentos em andamento agrupados por tipo, "D4 de 14", barra de progresso, tarefas de hoje para marcar e atrasadas em vermelho;
  - Quadro: Em andamento | Concluído | Interrompido; o cartão abre o aquecimento completo (tarefas por dia, observações, concluir, interromper com motivo, excluir). Ao concluir/interromper, pergunta se quer mudar o status do ativo (sugere "Pronto" para perfil) e, para conta, a coluna do quadro de uso; "Deixar como está" não muda nada;
  - Rotinas: criar, editar, duplicar e excluir; tarefas por dia (Todos os dias + D1..Dn) com adicionar, editar, mudar de dia, subir/descer e excluir;
  - Quedas: quedas por mês (12 meses), resumo por fornecedor (perfis e BMs comprados, quantos caíram, vida útil média da compra até a queda, custo por mês de vida) e lista de quedas no período (ativo, tipo, fornecedor, data, motivo, quanto durou).
- **Ativos:** painel de perfis, contas e páginas ganhou o bloco "Aquecimento" (em andamento com dia e progresso, ou "Iniciar aquecimento", e os anteriores).

## Ajustes de 12/11/2026

- **Favicon:** a logo `Logo-Capi-Ops.png` (1254 px, fora do Git) virou `public/favicon-32.png`, `public/apple-touch-icon.png` (180) e `public/icon-192.png`, ligados no `index.html`.
- **Migration 030:** em todos os cards de Pontos de Comando (PC) e Gatilhos (GE), os anexos "Script" e "AD Finalizado" foram trocados pelos links das pastas do Drive de cada oferta (os outros anexos ficaram). Rodou com `ops.silencio`, sem encher o histórico.
- **Veicular em lote** (barra do quadro, `src/pages/quadro/VeicularEmLote.tsx`): escolhe uma ou mais listas (vem "Pronto pra subir"; os cards que aparecem já vêm marcados) e, se quiser, só os cards sem nenhuma conta; os cards, as contas e o status (Não subido ou Em análise) e cria todas as veiculações de uma vez (`upsert` ignorando card + conta que já existem).
- **Preencher IDs da Meta** (barra do quadro, `api/meta-casar.ts`): para cada conta com veiculação sem ID (cards Ad não arquivados, da oferta do quadro ou de todas), lista os anúncios na Meta e casa pelo padrão `ad{n}-h{n}-m{n}` no nome (aceita `-`, `_`, espaço e maiúsculas). Ofertas diferentes com o mesmo AD/H/M na mesma conta: usa o código da oferta no nome ("PC-EN"); na dúvida, não preenche e lista. Anúncio já usado em outra veiculação é ignorado. Quem estava "Não subido" ganha o status do anúncio na Meta (ACTIVE → rodando, PAUSED → pausado, DISAPPROVED → rejeitado, em revisão → em análise). Resultado: preenchidas, não achadas, dúvidas (mais de um anúncio com o mesmo nome), contas sem ID e falhas.
- **Ajuda** (menu, `/ajuda`, `src/pages/Ajuda.tsx`): manual do app com índice, busca e link para cada área: começando, passo a passo de uma remessa de ADs, Quadros, card por dentro, Modelos, Ranking, Ofertas, Ativos, Uso das contas, Contingência, Configurações e glossário. **Toda função nova deve ganhar o seu item aqui.**
- **Checklist da oferta:** cada seção tem "Marcar todos" (marca só os que faltam, mantendo data e autor dos já marcados) e vira "Desmarcar todos" quando a seção está completa; cada item entra no histórico da oferta.
- **Vários IDs por veiculação (migration 031):** quando o mesmo AD é subido de novo na mesma conta sem duplicar, ganha outro ID na Meta. O principal continua em `veiculacoes.meta_ad_id`; os outros ficam em `ops.veiculacoes_ids_extras` ("+ Outro ID nesta conta" no card). A view `ops.veiculacoes_anuncios` junta todos; `ops.ranking`, `ops.cobertura_oferta`, as métricas do card, o gráfico da oferta e o Preencher IDs usam ela. Gatilhos impedem o mesmo ID em dois lugares e registram no histórico do card. A tabela nova não está no Realtime (o quadro vê os extras ao recarregar).
- **Contingência padrão (migration 032):** a usuária pediu um processo pronto, sem montar tarefas. Mudou a regra da etapa 12 ("não muda nada sozinha"):
  - um roteiro **padrão** por tipo (`rotinas_aquecimento.padrao`, um por tipo): Perfil 7 dias, BM 5, Conta 7, Página 7 (sem tarefas no D7), com os textos dela;
  - BM entrou nos aquecimentos (`aquecimentos.bm_id`) e na reserva mínima;
  - coluna `aquecimento` (a_classificar | aquecendo | pronto) em perfis, BMs, contas e páginas;
  - gatilho `aquecer_ao_cadastrar`: ativo novo (não caído) entra sozinho no aquecimento com o roteiro padrão;
  - gatilho `aquecimento_tarefas_conferir`: checklist completo conclui o aquecimento; desmarcar reabre;
  - gatilho `aquecimentos_sincronizar`: mantém a coluna `aquecimento` e passa perfil "Aquecendo" para "Pronto" ao concluir;
  - `ops.aquecer_com_padrao(tipo, ids)` para mandar vários para o aquecimento.
  - App: abas Aquecimento (quadro com colunas por dia: o card fica no primeiro dia com tarefa pendente; atrasado quando o calendário passou), A classificar (Pronto / Precisa aquecer, um a um ou em lote), Roteiros padrão (★ padrão, excluir na lista) e Quedas. A coluna Pronto mostra todos os ativos prontos e não caídos (com checklist concluído ou classificados como prontos). Saíram a tela Hoje e o botão "Iniciar aquecimento" do topo. Coluna "Aquecimento" em Ativos e selo no quadro "Uso das contas". Reserva conta quem está "Pronto".

## Vendas que não chegam ao dashboard (diagnóstico de 12/11/2026)

Feito só com leitura: código do dashboard (cópia local de `AysDigital/projeto-dashboard`, sem `git pull`), notas do dashboard e do financeiro e as migrations do `ops`. Nada foi alterado.

**Por onde a venda entra:** um único caminho. A Mundpay chama `POST https://<painel>/api/webhook/mundpay?a=<token da área>` (rota Next.js na Vercel, projeto do dashboard), que grava em `public.purchases` com a chave `SUPABASE_SERVICE_ROLE_KEY` (upsert por `transaction_id`). Não há edge function, gatilho, pg_cron nem pg_net gravando vendas; os crons da Vercel são só `rules` e `cleanup`. A Mundpay usa o modo de autenticação `none`: não há segredo que possa ter vencido.

**O que não mudou:** nenhum commit no dashboard entre 12/10 e 31/10 (na cópia local). O `ops` só lê `public.purchases` e começou em 27/10, depois da parada. O financeiro também só lê.

**Pontos em que a venda pode se perder, e o que aparece nos logs da Vercel:**

| Causa | Resposta da rota | Log |
| --- | --- | --- |
| Webhook desligado, URL errada ou eventos desmarcados na Mundpay | nenhuma chamada chega | — |
| Token `?a=` diferente do da área, ou chave do Supabase inválida/rotacionada | 404 `area_not_found` | "[webhook] falha ao resolver área/segredo" (quando é a chave) |
| Integração desligada no painel do dashboard | 503 `integration_disabled` | — |
| Formato do payload mudou (valor, id, ad_id fora do esperado) | **200** `ignored: invalid_payload` (a Mundpay acha que deu certo) | "falha ao gravar compra: Payload de compra inválido…" |
| Erro do banco (tabela, permissão, coluna) | 500 `storage_error` | "falha ao gravar compra" |

**Contradição a esclarecer primeiro:** o dashboard (commit de 31/10, vendas LATAM em US$) e o financeiro (migrations 046–048 de 12/11, venda SPEI "que veio no webhook") trabalharam com vendas recentes de `public.purchases`. Pode ser que o webhook tenha voltado depois de 28/10, ou que só parte das vendas (outra conta/loja da Mundpay, outros métodos) esteja chegando. A primeira consulta de leitura pedida à usuária mostra isso por dia.

**Recuperação:** como a gravação é idempotente por `transaction_id`, reenviar os webhooks pela Mundpay recupera tudo, com UTM e `ad_id`. Sem reenvio, o export CSV da Mundpay mostra o que falta (`npm run conciliar` no dashboard compara, só leitura), mas importar pelo CSV não traz o `ad_id`, então essas vendas não entrariam nas métricas por anúncio.

**Resultado (consulta por dia rodada pela usuária em 12/11):** pedidos gravados todos os dias de 19/10 a 12/11, **menos 26 e 27/10** (zero linhas). Em 28/10 voltou sozinho (5 aprovadas) e seguiu normal (9 a 33 aprovadas por dia em novembro). A usuária confirmou que a configuração da Mundpay está certa e que o dashboard mostra as vendas. Os três projetos (dashboard, financeiro, operação) usam o mesmo projeto do Supabase.

- **Conclusão:** não há falha ativa. O alerta de 28/10 olhou logo depois de um buraco de dois dias (a "última venda 26/10 00:44" era em UTC, ou seja, 25/10 21:44 em Brasília). Nada a corrigir no dashboard nem no banco.
- **Causa do buraco:** não houve buraco. A usuária conferiu no painel da Mundpay: nenhuma venda em 26 e 27/10. Nada a recuperar; assunto encerrado.

## Etapa 13: fases do manual de tráfego (12/11/2026)

Manual de Bidcap da usuária: cada anúncio passa por Validação (D1–D3 desde que começou a rodar), Pré-escala (D4+) e Escala. No fim do D3, o ROAS dos dias de validação decide: avança, monitora ou falhou. Mid-spenders vão para uma conta secundária sem limite de lance (No-Bid).

**Banco (migration 033, rodada em 12/11/2026):**
- `ofertas`: `roas_avanca` (1,3), `roas_monitora` (0,8), `dias_validacao` (3), `gasto_nospend` (R$ 5) e `escalando` (começou marcado nas ofertas com status "escalando"; nenhuma hoje).
- `contas_anuncio.papel`: `principal_bidcap` | `secundaria_nobid` | `nenhum` (padrão).
- `veiculacoes.rodando_desde`: o gatilho `veiculacoes_rodando_desde` preenche na primeira vez que o status vira "rodando" (com a data do status). Para as que já existiam: a atividade mais antiga de "rodando"; sem ela, a data do status se ainda está rodando. Resultado: as 29 rodando ganharam data; as 23 pausadas não (vieram da importação, sem histórico). `veiculacoes.origem`: nota de onde veio.
- `ops.fase_veiculacao(oferta, card)`: dia (D1 = o dia em que começou, em Brasília), fase (validacao / pre_escala / escala), veredito depois da validação (ROAS ≥ `roas_avanca` avança; ≥ `roas_monitora` monitora; abaixo ou sem gasto falhou; sem ID de anúncio não tem veredito), ROAS/gasto/faturamento da validação e `no_spend`. As vendas vêm só por `ops.vendas_por_dia` (já autorizada).
- `ops.classificar` (agora com 9 argumentos): ordem no_spend > sem_dados > vencedor > mid_spender > perdedor > promissor > em_teste.
  - **no_spend:** o card tem veiculações rodando há 2+ dias (com ID) e **todas** gastaram menos que `gasto_nospend` ontem e anteontem.
  - **mid_spender:** ROAS ≥ mínimo (ou CPA ≤ alvo), pelo menos 1 venda principal, gasto do período de avaliação abaixo da mediana dos cards rodando da mesma oferta, e veiculação com ID em conta Bidcap ou sem papel. Vencedor vem antes: quem já gastou o mínimo com ROAS bom continua vencedor.
- `ops.ranking` devolve também `no_bid` (o card já tem veiculação numa conta No-Bid).
- `ops.mandar_para_nobid(card, conta)`: só conta ativa com papel No-Bid; cria a veiculação "Não subido" com a origem "Mid-spender vindo da {contas}" e registra no histórico (`nobid`). Não mexe na veiculação original.

**App:**
- Ofertas → editar → Regras de performance → "Manual de tráfego (Bidcap)": os cinco campos.
- Papel da conta em Ativos → Contas (campo e coluna "Papel") e no quadro Uso das contas (modal e selo).
- Frente do card: pílula por veiculação rodando ("D2 · Validação" ou "Avança 1,8x" / "Monitorar" / "Falhou"; o mouse mostra a conta). Selos ⏸ No-spend (cinza escuro) e ↗ Mid-spender (roxo, tokens `--c-roxo`) no filtro de classificação, no Ranking e na linha de métricas.
- Card → Veiculação por conta: dia, fase, veredito e ROAS da validação por linha; origem; aviso "Mid-spender" com "Mandar para No-Bid".
- Ranking: botão "Mandar para No-Bid" nas linhas mid-spender e filtro "Mid-spenders ainda não enviados".
- Pausar uma veiculação em Validação ou Pré-escala mostra o aviso do manual com "Pausar mesmo assim" (não bloqueia).
- Ajuda: tópico "Manual de tráfego (Bidcap)".

## Ajustes de 12/11/2026 (depois da etapa 13)

- **Acesso do Luciano:** login próprio criado pela usuária no Supabase Auth e cadastrado à mão em `ops.membros` (nome "Luciano"), pelo SQL Editor, sem migration (o e-mail não entra no código). O login antigo compartilhado continua como "May e Luciano".
- **Métricas com dias faltando (cards de PC sem gasto):** a busca na Meta pegava só os últimos 3 dias. Quando ninguém abria o app por mais de 3 dias, os dias do meio ficavam sem números para sempre. Na oferta PC, os anúncios rodando na Boulevard tinham só 3 a 6 dias de dados desde 04/11, e o último dia era 08 a 10/11.
  - Correção (`api/meta-metricas.ts`): a busca agora recomeça 2 dias antes do fim da última busca em que todas as contas responderam (no mínimo os últimos 3 dias, no máximo 90).
  - Novo botão "Refazer 90 dias" na seção Métricas do card, para preencher os buracos que já existiam.
  - Os cards de PC só com veiculação pausada na Nina (desde 03 a 05/11) aparecem sem números porque a frente do card mostra só o período de avaliação (7 dias) e só quando alguma conta está rodando. AD75, AD76, AD82 e AD83 na Nina nunca tiveram gasto registrado.
