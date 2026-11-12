import { useMemo, useState, type ReactNode } from 'react'
import { Link } from 'react-router'
import { TituloPagina } from '../components/ui'

/**
 * Ajuda: manual do app, com índice, busca e um link para cada área.
 * Quando uma função nova entrar no app, acrescente o item aqui.
 */

type Item = { titulo: string; texto: ReactNode; busca: string }
type Topico = { id: string; titulo: string; link?: { para: string; nome: string }; resumo: string; itens: Item[] }

/** Item com texto simples (a busca usa o mesmo texto). */
const i = (titulo: string, ...linhas: string[]): Item => ({
  titulo,
  busca: `${titulo} ${linhas.join(' ')}`,
  texto:
    linhas.length === 1 ? (
      <p>{linhas[0]}</p>
    ) : (
      <ul className="list-disc space-y-1 pl-5">
        {linhas.map((l) => (
          <li key={l}>{l}</li>
        ))}
      </ul>
    ),
})

/** Passo a passo numerado. */
const passos = (titulo: string, ...linhas: string[]): Item => ({
  titulo,
  busca: `${titulo} ${linhas.join(' ')}`,
  texto: (
    <ol className="list-decimal space-y-1 pl-5">
      {linhas.map((l) => (
        <li key={l}>{l}</li>
      ))}
    </ol>
  ),
})

const TOPICOS: Topico[] = [
  {
    id: 'comecando',
    titulo: 'Começando',
    resumo: 'O que é o app e como ele funciona no geral.',
    itens: [
      i(
        'Para que serve',
        'É o sistema da operação de Direct Response: substitui o Trello. Aqui ficam os cards dos anúncios (do roteiro até a veiculação), as ofertas, as métricas, o inventário de ativos (perfis, BMs, contas, páginas) e a contingência.',
      ),
      i(
        'Coisas que valem para o app todo',
        'Quase tudo salva sozinho: ao sair do campo, a mudança já está gravada. Não existe botão "Salvar geral".',
        'O ícone ⓘ ao lado de um título abre a explicação daquele item. Passe o mouse ou toque nele.',
        'Status sempre aparecem com ícone e cor: verde = ok, amarelo = atenção, vermelho = caído/problema, cinza = parado/morto.',
        'Datas são mostradas no horário de Brasília.',
        'O quadro é ao vivo: se alguém mexer em outro computador, a mudança aparece sozinha ("Ao vivo" na barra).',
      ),
      i(
        'Menu lateral',
        'A seta no topo recolhe o menu e deixa só os ícones (o app lembra a escolha).',
        'No rodapé do menu: o e-mail logado, o tema (sistema, claro ou escuro) e Sair.',
        'O login é um só para May e Luciano; por isso o histórico não separa quem fez cada coisa.',
      ),
    ],
  },
  {
    id: 'remessa',
    titulo: 'Passo a passo: uma remessa de ADs',
    link: { para: '/quadros', nome: 'Abrir Quadros' },
    resumo: 'O caminho completo, do card novo até as métricas aparecerem.',
    itens: [
      passos(
        'Do zero até rodando',
        'No quadro da oferta, crie os cards: "+ Adicionar card" no fim da lista (Enter cria e já sugere o próximo AD) ou "+ Novo a partir de modelo" para criar vários de uma vez já com anexos e checklists.',
        'Mova os cards pelas listas conforme o trabalho anda (Criação → Revisão → Edição → Pronto pra subir).',
        'Quando a remessa estiver em "Pronto pra subir", clique em "Veicular em lote" na barra do quadro, escolha a lista (os cards já vêm marcados), marque as contas e crie todas as veiculações de uma vez.',
        'Suba os anúncios na Meta mantendo no nome o padrão ad12-h1-m2 (AD, hook e variação do card).',
        'Volte ao quadro e clique em "Preencher IDs da Meta": o app procura cada anúncio pelo nome e preenche o ID sozinho. O que ele não achar aparece na lista do resultado para você escolher no card.',
        'Pronto: com o ID preenchido, as métricas da Meta e as vendas do dashboard passam a aparecer no card e no Ranking.',
      ),
    ],
  },
  {
    id: 'quadros',
    titulo: 'Quadros',
    link: { para: '/quadros', nome: 'Abrir Quadros' },
    resumo: 'O kanban dos cards, um por oferta.',
    itens: [
      i(
        'Abas',
        'Uma aba por oferta ativa e a aba "Todas as ofertas". As ofertas pausadas ficam no menu "Pausadas".',
        'O app abre sempre o último quadro que você usou.',
      ),
      i(
        'Listas',
        'As listas padrão: Standby, Criação, Revisão [Copy], Aguardando edição, Em edição, Em ajuste [Edição], Revisão [Edição], Pronto pra subir, Em veiculação e Rejeitado.',
        'A seta no cabeçalho recolhe a lista. O menu "⋯" ordena (nome, mais novos, mais antigos, mais tempo na lista, maior ROAS, maior gasto, mais vendas), move todos os cards para outra lista, arquiva todos ou arquiva a lista.',
        '"+ Adicionar lista" no fim do quadro cria uma lista nova (vale para todos os quadros).',
        'Para andar pelo quadro, clique e arraste no fundo (fora dos cards).',
      ),
      i(
        'Cards',
        'Arraste o card para mudar de lista ou de posição. No celular, segure o card antes de arrastar.',
        'Clique no card para abrir os detalhes. Clique com o botão direito para o menu rápido: abrir, nova versão, gerar variações, duplicar, salvar como modelo, arquivar e excluir.',
        'O nome dos ads é automático: OFERTA-IDIOMA-AD-H-M-FORMATO (ex.: PC-EN-AD12-H1-M2-VD). É só organização interna.',
        'Na frente do card: etiquetas, pílulas das contas com a cor do status (verde rodando, amarelo em análise, vermelho rejeitado, cinza pausado), tempo na lista (amarelo depois de 2 dias, vermelho depois de 5), prazo, anexos, comentários, checklist e troféu.',
      ),
      i(
        'Criar cards',
        '"+ Adicionar card": escolha Ad, VSL ou Outro. No Ad, o app sugere o próximo AD livre com H1 e M1 e mostra a prévia do nome. Enter cria e deixa o formulário aberto para o próximo.',
        '"+ Novo a partir de modelo": cria de 1 a 10 cards de uma vez a partir de um modelo, já com etiquetas, anexos e checklists.',
        'Se o AD/H/M já existir na oferta, o app avisa e não cria.',
      ),
      i(
        'Barra de filtros',
        'Busca por nome, etiqueta, tipo, status da veiculação + conta (ex.: "Rejeitado na AC01NIN"), classificação, "Só com troféu" e "Mostrar arquivados".',
        '"Métricas" mostra ou esconde a linha "R$ gasto · ROAS · vendas" nos cards rodando.',
        'Selos automáticos: 🔥 Vencedor, ✨ Promissor e ⚠️ Perdedor, pelas regras de performance da oferta.',
        '"Arquivados" abre o painel com os cards e listas arquivados, cada um com "Restaurar".',
        '"Veicular em lote" e "Preencher IDs da Meta": veja o passo a passo da remessa.',
      ),
    ],
  },
  {
    id: 'card',
    titulo: 'O card por dentro',
    resumo: 'Tudo o que tem dentro de um card aberto.',
    itens: [
      i(
        'Cabeçalho',
        'Oferta, lista (trocar aqui move o card), AD/H/M/formato (no Ad) ou título (VSL/Outro) e o troféu de vencedor.',
        'O endereço da página muda quando o card abre: dá para copiar e mandar o link do card.',
        'Esc fecha. Se houver um campo sendo editado, ele é salvo antes de fechar.',
      ),
      i(
        'Barra de ações',
        'Etiquetas (marcar ou criar nova), Membros, Prazo (atalhos Hoje, Amanhã, Em 3 dias, Em 1 semana), Checklist e Anexo.',
      ),
      i(
        'Descrição e comentários',
        'Formatação simples: **negrito** e listas com "-" ou "1.". Links colados viram link.',
        'Cole (Ctrl+V) ou arraste uma imagem para dentro do texto.',
        'Comentário: Ctrl+Enter envia. Só quem escreveu edita ou apaga.',
        '"Mostrar detalhes" mistura os comentários com o histórico do card (quem moveu, quando mudou status etc.).',
      ),
      i(
        'Anexos',
        'Botões rápidos "+ Script" e "+ AD Finalizado" (somem quando o card já tem), "+ Outro anexo" com título livre e "+ Imagem".',
        'Também dá para colar uma imagem com Ctrl+V com o card aberto, fora de um campo de texto.',
        'Arraste para reordenar; clique para abrir em outra aba.',
      ),
      i(
        'Veiculação por conta',
        'Uma linha por conta onde o anúncio está: status, ID do anúncio na Meta e data do status.',
        '"Escolher na lista da Meta" mostra os anúncios da conta já filtrados pelo AD/H/M do card. Também dá para colar o link do Gerenciador: o app tira o ID dele.',
        'Rejeitado pede motivo e categoria. Ao sair de "Rejeitado", a rejeição vira um comentário no card.',
        '"+ Subir em outra conta" cria a veiculação numa conta nova.',
        'Métricas e vendas casam pelo ID do anúncio, nunca pelo nome: sem ID, o card não mostra números.',
      ),
      i(
        'Métricas',
        'Gasto, faturamento, ROAS, vendas, CPA, CPM, CTR e hook rate, em 7 dias, 30 dias ou tudo. "Ver por conta" separa por veiculação.',
        'As métricas da Meta são buscadas sozinhas a cada hora (ou em "Atualizar agora").',
        'Faturamento = vendas aprovadas com o ID do anúncio (principal + upsell + downsell). Vendas e CPA contam só o produto principal.',
      ),
      i(
        'Versões e família',
        '"Nova versão": cria uma variação (próximo M) ou um novo hook (próximo H), com motivo obrigatório. Quando o motivo é rejeição, já vem preenchido e vai para "Em ajuste [Edição]".',
        '"Gerar variações": vários hooks e variações de uma vez (ótimo para escalar um vencedor).',
        '"Duplicar": copia o card com outro AD (ou "(cópia)" no VSL/Outro).',
        'A seção "Família AD{n}" mostra a árvore de todos os hooks e variações daquele AD; clique para abrir outro.',
      ),
      i(
        'Arquivar e excluir',
        'Arquivar esconde o card (dá para restaurar em "Arquivados"). Excluir apaga tudo de vez; se o card tem ID de anúncio, o app pede para digitar o nome dele para confirmar.',
      ),
    ],
  },
  {
    id: 'modelos',
    titulo: 'Modelos de card',
    link: { para: '/modelos', nome: 'Abrir Modelos' },
    resumo: 'Cards prontos para criar em quantidade.',
    itens: [
      i(
        'Para que serve',
        'Um modelo guarda tipo, formato, lista padrão, prazo em dias, etiquetas, descrição, anexos de link e checklists. Pode valer para uma oferta ou para todas.',
        'Use no quadro em "+ Novo a partir de modelo" ou no "+ Adicionar card".',
        'Num card pronto, "Salvar como modelo…" (clique-direito ou dentro do card) cria o modelo a partir dele.',
        'Dica: deixe os anexos Script e AD Finalizado da oferta no modelo, para todo card novo já nascer com eles.',
      ),
    ],
  },
  {
    id: 'ranking',
    titulo: 'Ranking',
    link: { para: '/ranking', nome: 'Abrir Ranking' },
    resumo: 'Quais anúncios, hooks e famílias estão performando.',
    itens: [
      i(
        'Como usar',
        'Escolha a oferta (ou todas), o período e agrupe por anúncio, hook (AD+H) ou família (AD).',
        'Clique no título de uma coluna para ordenar. Totais no rodapé.',
        'Por anúncio: "Abrir" leva ao card, "Gerar variações" e o troféu. Por hook ou família: "Ver anúncios".',
      ),
      i(
        'Classificação',
        'Vencedor: gastou o mínimo e bateu o ROAS mínimo ou o CPA alvo. Promissor: tem vendas mas ainda não gastou o mínimo. Perdedor: gastou 2× o CPA alvo sem venda. Em teste / Sem dados: o resto.',
        'As regras ficam em cada oferta (Ofertas → editar → Regras de performance). Sem regra, ninguém é classificado.',
      ),
      i(
        'Alertas no topo',
        'Gasto nas últimas 24 h sem nenhuma venda registrada (pode ser o webhook de vendas parado).',
        'Falha ao buscar as métricas na Meta, com o motivo.',
      ),
    ],
  },
  {
    id: 'ofertas',
    titulo: 'Ofertas',
    link: { para: '/ofertas', nome: 'Abrir Ofertas' },
    resumo: 'Cadastro das ofertas e a página completa de cada uma.',
    itens: [
      i(
        'Lista de ofertas',
        'Nome, sigla, idioma, status (Em produção, Testando, Validada, Escalando, Saturando, Pausada), cor e o progresso do checklist de lançamento.',
        'Mudar a sigla ou o idioma renomeia sozinho todos os ads da oferta.',
        'Oferta com cards não pode ser excluída: mude para "Pausada".',
      ),
      i(
        'Página da oferta',
        'Visão geral: gasto, faturamento, ROAS, vendas, CPA, taxa de upsell, reembolsos, gráficos por dia, produção, top 5, links, anotações e histórico.',
        'Checklist: o checklist de lançamento (copiado do modelo em Configurações), com prazo e anotação por item. Cada seção tem "Marcar todos" (ou "Desmarcar todos" quando já está completa).',
        'Testes: quadro de testes (Ideia → Em produção → Rodando → Concluído), com hipótese, resultado (venceu, perdeu…) e aprendizado. Arraste entre as colunas; o card ligado ao teste mostra "Teste: …".',
        'Ativos: as contas onde a oferta roda (vêm sozinhas das veiculações) e as páginas, pixels e domínios ligados a ela.',
      ),
    ],
  },
  {
    id: 'ativos',
    titulo: 'Ativos',
    link: { para: '/ativos', nome: 'Abrir Ativos' },
    resumo: 'Inventário de perfis, BMs, contas, páginas, pixels, domínios, cartões e fornecedores.',
    itens: [
      i(
        'Abas e lista',
        'Uma aba por tipo. Cada uma tem busca, filtro de status e "Novo". A lista vem em dois grupos: primeiro os ativos, depois os desativados e restritos.',
        'Clique numa linha para abrir o painel do ativo.',
      ),
      i(
        'Dona e compartilhado',
        'Cada ativo tem UMA dona (a BM ou o perfil proprietário) e pode estar compartilhado com outras BMs e perfis.',
        'No painel: "+ Compartilhar com BM ou perfil", "Tornar dona" e "Remover" (o acesso removido fica no histórico).',
        'Um ativo só se perde numa queda quando não sobra nenhum acesso válido. Perfil ou BM caído não segura nada.',
        'O aviso amarelo no topo lista os ativos que dependem de uma única BM ou perfil.',
      ),
      i(
        'Possui e Acessa',
        'Possui: tudo o que a BM ou o perfil tem como dona, somando o que as BMs dele possuem. Acessa: o que ele alcança por compartilhamento. Passe o mouse no número para ver o detalhe.',
      ),
      i(
        'Status e quedas',
        'Mude o status pelo seletor no painel: o app pede motivo e data e guarda no histórico do ativo.',
        'A queda é manual: só aquele ativo muda. Se mais coisa caiu junto, marque em cada uma.',
        '"E se cair?" (BMs e perfis) só simula: mostra o que se perderia, o que fica seguro (e por qual BM ou perfil) e as ofertas e ads afetados.',
      ),
      i(
        'Contas de anúncio',
        'Apelido = AC + número da conta + 3 letras da BM (ex.: AC01LUC). Se a BM não for a 01, o número dela vai no fim (AC01VIE2). É o que aparece nas pílulas dos cards.',
        '"Buscar nomes na Meta" traz o nome e a moeda reais de cada conta com ID.',
        '"Importar do dashboard" traz as contas novas do dashboard de vendas.',
        'Contas desativadas somem das listas dos quadros.',
      ),
      i('Aquecimento no painel', 'Perfis, contas e páginas têm o bloco "Aquecimento": o aquecimento em andamento (dia e progresso) ou o botão "Iniciar aquecimento".'),
    ],
  },
  {
    id: 'uso',
    titulo: 'Uso das contas',
    link: { para: '/uso-contas', nome: 'Abrir Uso das contas' },
    resumo: 'Quadro manual de quais contas estão rodando, aquecendo ou paradas.',
    itens: [
      i(
        'Como usar',
        'Três colunas: Veiculando ads, Aquecimento e Sem uso. Arraste a conta para a coluna certa; a data "desde" é marcada sozinha.',
        'Clique na conta para marcar a oferta que ela roda, corrigir a data e escrever uma anotação.',
        'Nada muda sozinho: o quadro mostra só o que você colocar. Contas desativadas não aparecem.',
        'O mesmo quadro fica em Ativos → Contas → "Quadro de uso".',
      ),
    ],
  },
  {
    id: 'contingencia',
    titulo: 'Contingência',
    link: { para: '/contingencia', nome: 'Abrir Contingência' },
    resumo: 'Aquecimento, reserva de ativos prontos e quedas.',
    itens: [
      i(
        'Princípio',
        'A Contingência organiza, lembra e avisa, mas não muda nada sozinha: status do ativo e coluna do quadro de uso só mudam quando você confirma.',
      ),
      passos(
        'Aquecer um ativo',
        'Em Rotinas, crie a rotina: nome, tipo (perfil, conta ou página), duração em dias e as tarefas por dia ("Todos os dias", D1, D2…).',
        'Clique em "Iniciar aquecimento" (na Contingência ou no painel do ativo), escolha o ativo, a rotina e a data de início.',
        'Todo dia, abra "Hoje": cada ativo mostra em que dia está (ex.: D4 de 14), as tarefas de hoje para marcar e, em vermelho, as atrasadas.',
        'No fim, abra o aquecimento (Quadro ou clique no nome) e clique em Concluir ou Interromper (com motivo). O app pergunta se você quer mudar o status do ativo ou a coluna da conta; "Deixar como está" não muda nada.',
      ),
      i(
        'Rotinas',
        'Criar, editar, duplicar e excluir. Tarefas: adicionar (Enter), editar o texto, mudar de dia, subir/descer e excluir.',
        'Mudar a rotina depois não altera os aquecimentos que já começaram.',
      ),
      i(
        'Reserva de prontos',
        'Em "Configurar mínimo", diga quantos perfis, contas e páginas prontos você quer ter sempre.',
        'Pronto = não caído, com aquecimento concluído e sem uso: perfil com status "Pronto"; conta em "Sem uso" no quadro de uso; página sem oferta ligada.',
        'Abaixo do mínimo, aparece o alerta vermelho aqui e em Ativos.',
      ),
      i(
        'Quedas',
        'Gráfico de quedas por mês, resumo por fornecedor e a lista de quedas no período.',
        'Por fornecedor: comprados, quantos caíram, vida útil média (da compra até a queda) e custo por mês de vida (custo ÷ meses que durou). Para isso funcionar, preencha data da compra e custo nos perfis e BMs.',
        'As mudanças gravadas nas importações do inventário não contam como queda.',
      ),
    ],
  },
  {
    id: 'config',
    titulo: 'Configurações',
    link: { para: '/config', nome: 'Abrir Configurações' },
    resumo: 'Etiquetas e o modelo do checklist de oferta.',
    itens: [
      i(
        'Abas',
        'Etiquetas: criar, editar nome e cor, excluir (a etiqueta sai dos cards antes).',
        'Checklist de oferta: o modelo copiado para toda oferta nova. Mudar o modelo não altera as ofertas que já existem.',
        'As contas de anúncio ficam em Ativos → Contas.',
      ),
    ],
  },
  {
    id: 'glossario',
    titulo: 'Glossário',
    resumo: 'O que significa cada termo.',
    itens: [
      i(
        'Ads e cards',
        'AD = número do anúncio (a ideia). H = hook (abertura). M = variação do hook. Família = todos os cards com o mesmo AD na oferta.',
        'Veiculação = o card numa conta de anúncio (com status e ID do anúncio na Meta). Um card pode ter várias.',
        'Troféu = marcação manual de vencedor. Selo 🔥/✨/⚠️ = classificação automática pelas regras da oferta.',
      ),
      i(
        'Números',
        'ROAS = faturamento ÷ gasto (sem IOF). CPA = gasto ÷ vendas do produto principal. CTR = cliques no link ÷ impressões. Hook rate = visualizações de 3 s ÷ impressões.',
      ),
      i(
        'Ativos',
        'Dona = BM ou perfil proprietário. Compartilhado = quem também acessa. Caído = restrito, desativado, checkpoint ou morto. Pronto = ver Contingência → Reserva.',
      ),
    ],
  },
]

const normalizar = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')

export function Ajuda() {
  const [busca, setBusca] = useState('')
  const q = normalizar(busca.trim())

  const visiveis = useMemo(
    () =>
      TOPICOS.map((t) => ({
        ...t,
        itens: q ? t.itens.filter((it) => normalizar(`${t.titulo} ${it.busca}`).includes(q)) : t.itens,
      })).filter((t) => t.itens.length > 0),
    [q],
  )

  return (
    <>
      <TituloPagina>Ajuda</TituloPagina>

      <div className="grid gap-8 lg:grid-cols-[14rem_1fr]">
        <aside className="lg:sticky lg:top-8 lg:self-start">
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar na ajuda…"
            aria-label="Buscar na ajuda"
            className="mb-3 w-full rounded-control border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-muted"
          />
          <nav aria-label="Tópicos da ajuda" className="flex flex-wrap gap-1 lg:flex-col">
            {visiveis.map((t) => (
              <a key={t.id} href={`#${t.id}`} className="rounded-control px-2.5 py-1.5 text-sm text-muted hover:bg-surface-2 hover:text-ink">
                {t.titulo}
              </a>
            ))}
          </nav>
        </aside>

        <div className="min-w-0 space-y-10">
          {visiveis.length === 0 && <p className="text-sm text-muted">Nada encontrado para "{busca}".</p>}
          {visiveis.map((t) => (
            <section key={t.id} id={t.id} className="scroll-mt-6">
              <header className="mb-3 flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b border-line pb-2">
                <h2 className="font-display text-lg font-semibold">{t.titulo}</h2>
                <span className="text-sm text-muted">{t.resumo}</span>
                {t.link && (
                  <Link to={t.link.para} className="ml-auto text-sm font-medium text-accent-strong hover:underline">
                    {t.link.nome} →
                  </Link>
                )}
              </header>
              <div className="space-y-4">
                {t.itens.map((it) => (
                  <div key={it.titulo} className="rounded-card border border-line bg-surface p-4 text-sm leading-relaxed">
                    <h3 className="mb-2 font-semibold">{it.titulo}</h3>
                    {it.texto}
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    </>
  )
}
