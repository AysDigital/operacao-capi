import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../../../auth/AuthProvider'
import { Aviso, Carregando, Modal, PilulaCor, Popover, SeletorCor } from '../../../components/ds'
import { useToast } from '../../../components/Toast'
import { Botao, BotaoExcluir } from '../../../components/ui'
import { mensagemErro, PALETA, soSigla, type Etiqueta } from '../../../lib/cadastros'
import { buscarCardDetalhe, prazoCurto, situacaoPrazo, type CardDetalhe, type Membro } from '../../../lib/card'
import { diaBrasilia } from '../../../lib/format'
import type { ContaQuadro, Lista, OfertaQuadro } from '../../../lib/quadro'
import { ops } from '../../../lib/supabase'
import { Anexos } from './Anexos'
import { ComentariosEAtividade } from './Atividade'
import { Checklists } from './Checklists'
import { Avatar, botaoAcao, campoPequeno, ICONES, TituloSecao, type Atualizar, type Salvar } from './comum'
import { ConfirmarExclusaoCard } from './Exclusoes'
import { Descricao } from './Texto'
import { Metricas } from './Metricas'
import { Veiculacoes } from './Veiculacoes'
import { LinhaOrigem, ModalDuplicar, ModalGerarVariacoes, ModalNovaVersao, SecaoFamilia } from './Versoes'

export function ModalCard({
  cardId,
  listas,
  ofertas,
  contas,
  etiquetas,
  mostrarOferta,
  onFechar,
  onMudou,
  onBaseMudou,
  onAbrirCard,
}: {
  cardId: string
  listas: Lista[]
  ofertas: OfertaQuadro[]
  contas: ContaQuadro[]
  etiquetas: Etiqueta[]
  /** quadro "Todas": dá para trocar a oferta */
  mostrarOferta: boolean
  onFechar: () => void
  /** o card mudou: o quadro recarrega */
  onMudou: () => void
  /** etiqueta nova: recarrega os cadastros do quadro */
  onBaseMudou: () => void
  /** abre outro card (família, origem, versão recém-criada) */
  onAbrirCard: (id: string) => void
}) {
  const toast = useToast()
  const auth = useAuth()
  const euId = 'session' in auth ? auth.session.user.id : null
  const [card, setCard] = useState<CardDetalhe | null | 'nao_existe'>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [membros, setMembros] = useState<Membro[]>([])
  const [versao, setVersao] = useState(0)
  const [pedidoAnexo, setPedidoAnexo] = useState<{ titulo: string; n: number } | null>(null)
  const [excluir, setExcluir] = useState(false)
  const [acaoVersao, setAcaoVersao] = useState<'versao' | 'variacoes' | 'duplicar' | null>(null)

  const recarregar = useCallback(async () => {
    try {
      setCard((await buscarCardDetalhe(cardId)) ?? 'nao_existe')
      setErro(null)
    } catch (e) {
      setErro((e as Error).message)
    }
  }, [cardId])

  useEffect(() => {
    recarregar()
    ops()
      .from('membros')
      .select('user_id, nome, cor')
      .eq('ativo', true)
      .order('nome')
      .then(({ data }) => setMembros(data ?? []))
  }, [recarregar])

  const salvar: Salvar = useCallback(
    async (op, erros) => {
      const { error } = await op
      if (error) toast('ruim', mensagemErro(error, erros))
      await recarregar()
      setVersao((v) => v + 1)
      onMudou()
      return !error
    },
    [toast, recarregar, onMudou],
  )

  const atualizar: Atualizar = useCallback((f) => setCard((c) => (c && c !== 'nao_existe' ? f(c) : c)), [])

  if (card === 'nao_existe' || (erro && !card)) {
    return (
      <Modal titulo="Card" onFechar={onFechar}>
        {erro ? <Aviso tom="ruim">Não foi possível abrir o card: {erro}</Aviso> : <p className="text-sm text-muted">Este card não existe mais.</p>}
      </Modal>
    )
  }
  if (!card) {
    return (
      <Modal titulo="Carregando card" onFechar={onFechar} largura="max-w-5xl">
        <Carregando linhas={6} altura="h-8" />
      </Modal>
    )
  }

  const temIdAnuncio = card.veiculacoes.some((v) => v.meta_ad_id)
  /** card novo (versão ou cópia): o quadro recarrega e o modal passa para ele */
  const depoisDeCriar = (novoId: string) => {
    setAcaoVersao(null)
    onMudou()
    onAbrirCard(novoId)
  }
  const arquivar = (arquivado: boolean) => salvar(ops().from('cards').update({ arquivado }).eq('id', card.id))

  return (
    <>
      <Modal
        titulo={card.nome}
        largura="max-w-5xl"
        onFechar={onFechar}
        cabecalho={<Cabecalho card={card} listas={listas} ofertas={ofertas} mostrarOferta={mostrarOferta} salvar={salvar} onAbrir={onAbrirCard} />}
        rodape={
          <>
            <BotaoExcluir onClick={() => setExcluir(true)}>Excluir</BotaoExcluir>
            <Botao variante="secundario" onClick={() => arquivar(!card.arquivado)} className="ml-auto">
              {card.arquivado ? 'Restaurar card' : 'Arquivar card'}
            </Botao>
          </>
        }
      >
        {card.arquivado && (
          <div className="mb-4">
            <Aviso tom="atencao">Este card está arquivado e não aparece no quadro.</Aviso>
          </div>
        )}
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <div className="min-w-0 space-y-6">
            <BarraAcoes
              card={card}
              etiquetas={etiquetas}
              membros={membros}
              salvar={salvar}
              onAnexo={() => setPedidoAnexo((p) => ({ titulo: '', n: (p?.n ?? 0) + 1 }))}
              onBaseMudou={onBaseMudou}
              onVersao={setAcaoVersao}
            />
            <Resumo card={card} etiquetas={etiquetas} membros={membros} />

            <section>
              <TituloSecao icone={ICONES.descricao}>Descrição</TituloSecao>
              <Descricao
                cardId={card.id}
                valor={card.descricao}
                onSalvar={async (descricao) => {
                  await salvar(ops().from('cards').update({ descricao }).eq('id', card.id))
                }}
              />
            </section>

            <Checklists card={card} salvar={salvar} atualizar={atualizar} />
            <Anexos card={card} salvar={salvar} atualizar={atualizar} pedido={pedidoAnexo} />
            <Veiculacoes card={card} contas={contas} salvar={salvar} atualizar={atualizar} />
            <Metricas card={card} contas={contas} versao={versao} />
            <SecaoFamilia card={card} listas={listas} contas={contas} versao={versao} onAbrir={onAbrirCard} />
          </div>

          <div className="min-w-0 lg:border-l lg:border-line lg:pl-6">
            <ComentariosEAtividade cardId={card.id} membros={membros} euId={euId} versao={versao} salvar={salvar} />
          </div>
        </div>
      </Modal>

      {acaoVersao === 'versao' && (
        <ModalNovaVersao cardId={card.id} ctx={{ listas, ofertas, contas }} onFechar={() => setAcaoVersao(null)} onCriado={depoisDeCriar} />
      )}
      {acaoVersao === 'variacoes' && (
        <ModalGerarVariacoes
          cardId={card.id}
          ctx={{ listas, ofertas, contas }}
          onFechar={() => setAcaoVersao(null)}
          onCriados={() => {
            setAcaoVersao(null)
            onMudou()
            setVersao((v) => v + 1)
          }}
        />
      )}
      {acaoVersao === 'duplicar' && (
        <ModalDuplicar cardId={card.id} ctx={{ listas, ofertas, contas }} onFechar={() => setAcaoVersao(null)} onCriado={depoisDeCriar} />
      )}

      {excluir && (
        <ConfirmarExclusaoCard
          card={card}
          temIdAnuncio={temIdAnuncio}
          onArquivar={
            card.arquivado
              ? undefined
              : () => {
                  setExcluir(false)
                  arquivar(true)
                }
          }
          onFechar={() => setExcluir(false)}
          onExcluido={() => {
            setExcluir(false)
            onMudou()
            onFechar()
          }}
        />
      )}
    </>
  )
}

// ---------------------------------------------------------------------
// Cabeçalho: lista, oferta, nome e vencedor
// ---------------------------------------------------------------------
function Cabecalho({
  card,
  listas,
  ofertas,
  mostrarOferta,
  salvar,
  onAbrir,
}: {
  card: CardDetalhe
  listas: Lista[]
  ofertas: OfertaQuadro[]
  mostrarOferta: boolean
  salvar: Salvar
  onAbrir: (id: string) => void
}) {
  const oferta = ofertas.find((o) => o.id === card.oferta_id)
  const [ad, setAd] = useState(card.ad_num ?? 1)
  const [hook, setHook] = useState(card.hook_num ?? 1)
  const [varNum, setVarNum] = useState(card.var_num ?? 1)
  const [formato, setFormato] = useState(card.formato ?? '')
  const [titulo, setTitulo] = useState(card.nome)
  const [erroNome, setErroNome] = useState<string | null>(null)

  useEffect(() => {
    setAd(card.ad_num ?? 1)
    setHook(card.hook_num ?? 1)
    setVarNum(card.var_num ?? 1)
    setFormato(card.formato ?? '')
    setTitulo(card.nome)
    setErroNome(null)
  }, [card.ad_num, card.hook_num, card.var_num, card.formato, card.nome])

  const opcoesLista = listas.filter((l) => !l.arquivada || l.id === card.lista_id)
  const erroAd = `Já existe o AD${ad}-H${hook}-M${varNum} nesta oferta.`

  async function salvarCamposAd() {
    if (ad === card.ad_num && hook === card.hook_num && varNum === card.var_num && formato === card.formato) return
    if (!ad || !hook || !varNum || !formato) return setErroNome('Preencha AD, H, M e formato.')
    const ok = await salvar(
      ops().from('cards').update({ ad_num: ad, hook_num: hook, var_num: varNum, formato }).eq('id', card.id),
      { cards_ad_unico: erroAd },
    )
    setErroNome(ok ? null : erroAd)
  }

  async function salvarTitulo() {
    const t = titulo.trim()
    if (!t) return setTitulo(card.nome)
    if (t !== card.nome) await salvar(ops().from('cards').update({ nome: t }).eq('id', card.id))
  }

  const seletor = 'rounded-md border border-line bg-surface px-1.5 py-0.5 text-xs text-ink'

  return (
    <div className="min-w-0 flex-1 space-y-2">
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
        {mostrarOferta ? (
          <label className="flex items-center gap-1">
            Oferta
            <select
              value={card.oferta_id}
              onChange={(e) =>
                salvar(ops().from('cards').update({ oferta_id: e.target.value }).eq('id', card.id), {
                  cards_ad_unico: 'Essa oferta já tem um ad com o mesmo AD/H/M.',
                })
              }
              className={seletor}
            >
              {ofertas.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.codigo} · {o.nome}
                </option>
              ))}
            </select>
          </label>
        ) : (
          oferta && <PilulaCor pequena texto={`${oferta.codigo} · ${oferta.nome}`} cor={oferta.cor} />
        )}
        <label className="flex items-center gap-1">
          na lista
          <select
            value={card.lista_id}
            onChange={(e) => salvar(ops().rpc('mover_cards', { p_ids: [card.id], p_lista: e.target.value }))}
            className={seletor}
          >
            {opcoesLista.map((l) => (
              <option key={l.id} value={l.id}>
                {l.nome}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="flex items-start gap-2">
        {card.tipo === 'ad' ? (
          <div className="min-w-0 flex-1">
            <h2 className="font-mono text-lg font-semibold break-all">
              {oferta ? `${oferta.codigo}-${oferta.idioma}-AD${ad || '?'}-H${hook || '?'}-M${varNum || '?'}-${formato || '?'}` : card.nome}
            </h2>
            <div className="mt-1.5 flex flex-wrap items-end gap-1.5">
              {(
                [
                  ['AD', ad, setAd],
                  ['H', hook, setHook],
                  ['M', varNum, setVarNum],
                ] as const
              ).map(([rotulo, valor, mudar]) => (
                <label key={rotulo} className="text-[11px] text-muted">
                  {rotulo}
                  <input
                    type="number"
                    min={1}
                    value={valor || ''}
                    onChange={(e) => mudar(Math.max(0, parseInt(e.target.value) || 0))}
                    onBlur={salvarCamposAd}
                    onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
                    className={`${campoPequeno} w-16 tabular-nums`}
                  />
                </label>
              ))}
              <label className="text-[11px] text-muted">
                Formato
                <input
                  value={formato}
                  onChange={(e) => setFormato(soSigla(e.target.value, 8))}
                  onBlur={salvarCamposAd}
                  onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
                  className={`${campoPequeno} w-20 font-mono uppercase`}
                />
              </label>
            </div>
            {erroNome && <p className="mt-1 text-xs text-bad">{erroNome}</p>}
            <div className="mt-1">
              <LinhaOrigem card={card} onAbrir={onAbrir} />
            </div>
          </div>
        ) : (
          <input
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            onBlur={salvarTitulo}
            onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
            aria-label="Título do card"
            className="min-w-0 flex-1 rounded-md border border-transparent bg-transparent px-1 py-0.5 font-display text-lg font-semibold hover:border-line focus:border-muted focus:outline-none"
          />
        )}
        <button
          onClick={() => salvar(ops().from('cards').update({ vencedor: !card.vencedor }).eq('id', card.id))}
          aria-pressed={card.vencedor}
          title={card.vencedor ? 'Vencedor (clique para desmarcar)' : 'Marcar como vencedor'}
          className={`inline-flex shrink-0 items-center gap-1 rounded-control px-2.5 py-1.5 text-xs font-medium ${
            card.vencedor ? 'bg-warn-soft text-warn' : 'text-muted hover:bg-surface-2 hover:text-ink'
          }`}
        >
          <svg viewBox="0 0 16 16" aria-hidden className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
            {ICONES.trofeu}
          </svg>
          {card.vencedor ? 'Vencedor' : 'Vencedor?'}
        </button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------
// Barra de ações: Etiquetas | Membros | Prazo | Checklist | Anexo
// ---------------------------------------------------------------------
function Icone({ d }: { d: React.ReactNode }) {
  return (
    <svg viewBox="0 0 16 16" aria-hidden className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      {d}
    </svg>
  )
}

function BarraAcoes({
  card,
  etiquetas,
  membros,
  salvar,
  onAnexo,
  onBaseMudou,
  onVersao,
}: {
  card: CardDetalhe
  etiquetas: Etiqueta[]
  membros: Membro[]
  salvar: Salvar
  onAnexo: () => void
  onBaseMudou: () => void
  onVersao: (acao: 'versao' | 'variacoes' | 'duplicar') => void
}) {
  const [novaEtiqueta, setNovaEtiqueta] = useState('')
  const [corNova, setCorNova] = useState<string>(PALETA[0].hex)
  const [tituloChecklist, setTituloChecklist] = useState('Checklist')

  const alternarEtiqueta = (id: string) =>
    card.etiquetas.includes(id)
      ? salvar(ops().from('card_etiquetas').delete().eq('card_id', card.id).eq('etiqueta_id', id))
      : salvar(ops().from('card_etiquetas').insert({ card_id: card.id, etiqueta_id: id }))

  async function criarEtiqueta() {
    const nome = novaEtiqueta.trim()
    if (!nome) return
    const { data, error } = await ops().from('etiquetas').insert({ nome, cor: corNova }).select('id').single()
    if (error) return salvar(Promise.resolve({ error }), { etiquetas_nome_key: `Já existe uma etiqueta chamada ${nome}.` })
    setNovaEtiqueta('')
    onBaseMudou()
    await salvar(ops().from('card_etiquetas').insert({ card_id: card.id, etiqueta_id: data.id }))
  }

  const alternarMembro = (id: string) =>
    card.membros.includes(id)
      ? salvar(ops().from('card_membros').delete().eq('card_id', card.id).eq('user_id', id))
      : salvar(ops().from('card_membros').insert({ card_id: card.id, user_id: id }))

  return (
    <div className="flex flex-wrap gap-2">
      <Popover
        titulo="Etiquetas"
        gatilho={(alternar) => (
          <button onClick={alternar} className={botaoAcao}>
            <Icone d={ICONES.etiqueta} /> Etiquetas
          </button>
        )}
      >
        {() => (
          <div className="space-y-3">
            <div className="space-y-1">
              {etiquetas.length === 0 && <p className="text-sm text-muted">Nenhuma etiqueta cadastrada.</p>}
              {etiquetas.map((e) => (
                <label key={e.id} className="flex cursor-pointer items-center gap-2 rounded-md px-1 py-1 hover:bg-surface-2">
                  <input type="checkbox" checked={card.etiquetas.includes(e.id)} onChange={() => alternarEtiqueta(e.id)} className="h-4 w-4 accent-[var(--c-accent)]" />
                  <PilulaCor texto={e.nome} cor={e.cor} />
                </label>
              ))}
            </div>
            <div className="space-y-2 border-t border-line pt-3">
              <p className="text-xs font-medium text-muted">Criar etiqueta</p>
              <input
                value={novaEtiqueta}
                onChange={(e) => setNovaEtiqueta(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && criarEtiqueta()}
                placeholder="Nome"
                className={campoPequeno}
              />
              <SeletorCor cores={PALETA} valor={corNova} onMudar={setCorNova} />
              <button
                onClick={criarEtiqueta}
                disabled={!novaEtiqueta.trim()}
                className="w-full rounded-control bg-accent px-3 py-1.5 text-sm font-medium text-accent-ink disabled:opacity-40"
              >
                Criar e adicionar
              </button>
            </div>
          </div>
        )}
      </Popover>

      <Popover
        titulo="Membros"
        largura="w-60"
        gatilho={(alternar) => (
          <button onClick={alternar} className={botaoAcao}>
            <Icone d={ICONES.membro} /> Membros
          </button>
        )}
      >
        {() => (
          <div className="space-y-1">
            {membros.map((m) => (
              <label key={m.user_id} className="flex cursor-pointer items-center gap-2 rounded-md px-1 py-1 hover:bg-surface-2">
                <input type="checkbox" checked={card.membros.includes(m.user_id)} onChange={() => alternarMembro(m.user_id)} className="h-4 w-4 accent-[var(--c-accent)]" />
                <Avatar nome={m.nome} cor={m.cor} tamanho="h-6 w-6 text-[10px]" />
                <span className="text-sm">{m.nome}</span>
              </label>
            ))}
          </div>
        )}
      </Popover>

      <Popover
        titulo="Prazo"
        largura="w-60"
        gatilho={(alternar) => (
          <button onClick={alternar} className={botaoAcao}>
            <Icone d={ICONES.prazo} /> Prazo
          </button>
        )}
      >
        {(fechar) => (
          <EditorPrazo
            atual={card.prazo}
            onDefinir={(prazo) => {
              fechar()
              salvar(ops().from('cards').update({ prazo }).eq('id', card.id))
            }}
          />
        )}
      </Popover>

      <Popover
        titulo="Novo checklist"
        largura="w-64"
        gatilho={(alternar) => (
          <button onClick={alternar} className={botaoAcao}>
            <Icone d={ICONES.checklist} /> Checklist
          </button>
        )}
      >
        {(fechar) => {
          const criar = () => {
            if (!tituloChecklist.trim()) return
            fechar()
            const ordem = Math.max(0, ...card.checklists.map((c) => c.ordem)) + 1
            salvar(ops().from('checklists').insert({ card_id: card.id, titulo: tituloChecklist.trim(), ordem }))
            setTituloChecklist('Checklist')
          }
          return (
            <div className="space-y-2">
              <input
                autoFocus
                value={tituloChecklist}
                onChange={(e) => setTituloChecklist(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && criar()}
                onFocus={(e) => e.currentTarget.select()}
                className={campoPequeno}
                aria-label="Título do checklist"
              />
              <button onClick={criar} className="w-full rounded-control bg-accent px-3 py-1.5 text-sm font-medium text-accent-ink">
                Adicionar
              </button>
            </div>
          )
        }}
      </Popover>

      <button onClick={onAnexo} className={botaoAcao}>
        <Icone d={ICONES.anexo} /> Anexo
      </button>

      <span className="mx-1 hidden w-px self-stretch bg-line sm:block" aria-hidden />
      {card.tipo === 'ad' && (
        <>
          <button onClick={() => onVersao('versao')} className={botaoAcao}>
            <Icone d={ICONES.versao} /> Nova versão
          </button>
          <button onClick={() => onVersao('variacoes')} className={botaoAcao}>
            <Icone d={ICONES.familia} /> Gerar variações
          </button>
        </>
      )}
      <button onClick={() => onVersao('duplicar')} className={botaoAcao}>
        <Icone d={ICONES.duplicar} /> Duplicar
      </button>
    </div>
  )
}

/**
 * Prazo: atalhos (hoje, amanhã...) ou uma data. Começa na data de hoje e só grava
 * ao clicar em "Definir" ou apertar Enter.
 */
function EditorPrazo({ atual, onDefinir }: { atual: string | null; onDefinir: (prazo: string | null) => void }) {
  const [data, setData] = useState(atual ?? diaBrasilia())
  const atalhos: [string, number][] = [
    ['Hoje', 0],
    ['Amanhã', 1],
    ['Em 3 dias', 3],
    ['Em 1 semana', 7],
  ]
  const valida = /^20\d{2}-\d{2}-\d{2}$/.test(data)

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-1">
        {atalhos.map(([rotulo, dias]) => (
          <button key={rotulo} onClick={() => onDefinir(diaBrasilia(dias))} className="rounded-md bg-surface-2 px-2 py-1.5 text-xs hover:bg-line/70">
            {rotulo}
          </button>
        ))}
      </div>
      <input
        type="date"
        value={data}
        min="2020-01-01"
        max="2099-12-31"
        onChange={(e) => setData(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && valida && onDefinir(data)}
        className={campoPequeno}
        aria-label="Data do prazo"
      />
      <button
        onClick={() => onDefinir(data)}
        disabled={!valida}
        className="w-full rounded-control bg-accent px-3 py-1.5 text-sm font-medium text-accent-ink disabled:opacity-40"
      >
        Definir prazo
      </button>
      {atual && (
        <button onClick={() => onDefinir(null)} className="w-full rounded-control px-3 py-1.5 text-sm text-bad hover:bg-bad-soft">
          Remover prazo
        </button>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------
// Resumo: etiquetas, membros e prazo do card
// ---------------------------------------------------------------------
function Resumo({ card, etiquetas, membros }: { card: CardDetalhe; etiquetas: Etiqueta[]; membros: Membro[] }) {
  const minhas = etiquetas.filter((e) => card.etiquetas.includes(e.id))
  const pessoas = membros.filter((m) => card.membros.includes(m.user_id))
  if (!minhas.length && !pessoas.length && !card.prazo) return null

  const tomPrazo = card.prazo
    ? { vencido: 'bg-bad-soft text-bad', perto: 'bg-warn-soft text-warn', normal: 'bg-surface-2 text-ink' }[situacaoPrazo(card.prazo)]
    : ''
  const rotuloPrazo = card.prazo ? { vencido: 'Vencido', perto: 'Vence logo', normal: '' }[situacaoPrazo(card.prazo)] : ''

  return (
    <div className="flex flex-wrap gap-x-6 gap-y-3">
      {pessoas.length > 0 && (
        <div>
          <p className="mb-1 text-xs font-medium text-muted">Membros</p>
          <div className="flex gap-1">
            {pessoas.map((m) => (
              <Avatar key={m.user_id} nome={m.nome} cor={m.cor} />
            ))}
          </div>
        </div>
      )}
      {minhas.length > 0 && (
        <div>
          <p className="mb-1 text-xs font-medium text-muted">Etiquetas</p>
          <div className="flex flex-wrap gap-1">
            {minhas.map((e) => (
              <PilulaCor key={e.id} texto={e.nome} cor={e.cor} />
            ))}
          </div>
        </div>
      )}
      {card.prazo && (
        <div>
          <p className="mb-1 text-xs font-medium text-muted">Prazo</p>
          <span className={`inline-flex items-center gap-1 rounded-control px-2 py-1 text-sm ${tomPrazo}`}>
            {prazoCurto(card.prazo)}
            {rotuloPrazo && <span className="text-xs font-medium">· {rotuloPrazo}</span>}
          </span>
        </div>
      )}
    </div>
  )
}
