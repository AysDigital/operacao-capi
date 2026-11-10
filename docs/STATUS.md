# Operação Capi — Status do projeto

## Situação atual (04/11/2026)

- **No ar:** https://ops.capimarketing.online (GitHub `AysDigital/operacao-capi`, Vercel `operacao-capi`).
- **Banco:** migrations 001 a 020 rodadas pela usuária (007: 21 contas importadas do dashboard; 009: dados de teste temporários, apagados pela 010). 011–013: cards importados do Trello e ajustes de 04/11; 014: rejeição vira comentário; 015: Standby e Criação do Trello; 016: modelos de card; 017: módulo de ofertas; 018: correção de permissão do checklist da oferta; 019: ativos (etapa 11, rodada em 09/11/2026: 27 contas, 13 BMs criadas do campo BM, 27 contas com dona); 020: queda manual (rodada em 10/11/2026); 021: importação do inventário de ativos (rodada em 10/11/2026: 10 perfis, 13 BMs, 35 contas, 21 páginas, 51 pixels, 308 acessos); 022: tira o perfil "Grupo Capi" (rodada em 10/11/2026: 9 perfis, 304 acessos); 023: pessoas "inativas" das BMs contam como acesso (rodada em 10/11/2026: 10 perfis, 312 acessos); 024: Nicoly na BM Boulevard (rodada em 10/11/2026: 313 acessos); 025: apaga ativos antigos e completa IDs pela planilha (rodada em 10/11/2026: 16 páginas, 15 pixels, todas as contas e BMs com ID). Onde a planilha e o documento discordam, vale o documento (decisão da usuária); 026: status dos pixels, fornecedor dos perfis e apelidos AC das contas (**aguardando a usuária rodar**). **Próxima: 027.**
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
  - etapa 7: regras por oferta, selos, linha de números, filtro e ordenação no quadro, ranking e alertas (testada com os dados falsos da 009).
- **Próximas etapas:**
  - importação do Trello concluída (011–015); o resto do Trello foi descartado pela usuária;
  - modelos de card: feito na etapa 9 (016);
  - checklist de lançamento de oferta: feito na etapa 10 (017/018);
  - ativos: etapa 11 (019); vida útil por fornecedor e histórico de quedas ficam para a próxima etapa.
- **Alerta (28/10):** nenhuma venda gravada no dashboard desde 26/10 00:44 (possível webhook parado); afeta o faturamento das métricas.

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
- **Migration 026 e ajustes da página Ativos (10/11/2026):**
  - pixels ganham status (ativo/desativado, com histórico como os outros); quem tinha "Desativado no Meta" na observação virou desativado;
  - perfis Henrique, Cecília e Nina: fornecedor BW Digital, origem comprado; os demais: origem "Pessoal" (valor `proprio`, só o rótulo mudou);
  - apelido das contas = `AC` + número da conta + 3 letras da BM dona (ex.: AC01LUC); BM que não é a 01 ganha o número no fim (AC01VIE2, AC01MAY3). Apelido aceita até 8 caracteres;
  - abas Perfis, BMs, Contas, Páginas e Pixels mostram dois grupos: Ativos primeiro, depois Desativados e restritos;
  - perfis sem a coluna Navegador; Fornecedor mostra "Pessoal" quando não há fornecedor; Possui e Acessa com dica explicando.
- **Migration 025:** apaga 5 páginas e 36 pixels antigos (pedido da usuária; com acessos e ligações com ofertas); C27–C34 ganham nome, ID da Meta e moeda da planilha `docs/Organização-contas-Facebook.xlsx` (fora do Git), as da Mayarah como desativadas; as 13 BMs ganham o ID da Meta.
- **Migration 024:** Nicoly compartilhada na BM 01 - Boulevard (no documento a pessoa se chama "Nicoly Souza"; a 021 tinha ligado ao Grupo Capi pelo e-mail).
