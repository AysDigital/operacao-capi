import { useEffect, useMemo, useState } from 'react'
import { Carregando, Modal } from '../../../components/ds'
import { useToast } from '../../../components/Toast'
import { Botao } from '../../../components/ui'
import { copiarImagensParaCards } from '../../../lib/arquivos'
import { mensagemErro } from '../../../lib/cadastros'
import { buscarCardDetalhe, CATEGORIAS_REJEICAO, type CardDetalhe } from '../../../lib/card'
import type { ContaQuadro, Lista, OfertaQuadro } from '../../../lib/quadro'
import { ops } from '../../../lib/supabase'
import { buscarFamilia, idsDaResposta, MOTIVOS, nomeCurto, proximoAd, proximosNumeros, type MembroFamilia } from '../../../lib/versoes'
import { PilulasContas } from '../Cartao'
import { campoPequeno, ICONES, TituloSecao } from './comum'

type Contexto = { listas: Lista[]; ofertas: OfertaQuadro[]; contas: ContaQuadro[] }

const ativas = (listas: Lista[]) => listas.filter((l) => !l.arquivada)
/** Lista pelo nome (as padrão podem ter sido renomeadas: cai na primeira). */
const listaChamada = (listas: Lista[], nome: string) => (ativas(listas).find((l) => l.nome === nome) ?? ativas(listas)[0])?.id ?? ''

function nomeCompleto(oferta: OfertaQuadro | undefined, formato: string | null, ad: number, h: number, m: number) {
  return `${oferta?.codigo ?? '?'}-${oferta?.idioma ?? '?'}-AD${ad}-H${h}-M${m}-${formato ?? '?'}`
}

/** Carrega o card de origem completo (veiculações, números...). */
function useOrigem(cardId: string) {
  const [card, setCard] = useState<CardDetalhe | null>(null)
  useEffect(() => {
    buscarCardDetalhe(cardId).then(setCard)
  }, [cardId])
  return card
}

// ---------------------------------------------------------------------
// Motivo: atalhos + texto livre
// ---------------------------------------------------------------------
function CampoMotivo({
  atalho,
  texto,
  onAtalho,
  onTexto,
}: {
  atalho: string
  texto: string
  onAtalho: (v: string) => void
  onTexto: (v: string) => void
}) {
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">Motivo</p>
      <div className="flex flex-wrap gap-1.5">
        {MOTIVOS.map((m) => (
          <button
            key={m}
            type="button"
            aria-pressed={atalho === m}
            onClick={() => onAtalho(atalho === m ? '' : m)}
            className={`rounded-full px-3 py-1 text-xs font-medium ${atalho === m ? 'bg-ink text-page' : 'bg-surface-2 text-muted hover:text-ink'}`}
          >
            {m}
          </button>
        ))}
      </div>
      <textarea value={texto} onChange={(e) => onTexto(e.target.value)} rows={2} placeholder="Detalhes (opcional se escolheu um atalho)" className={`${campoPequeno} resize-y`} />
    </div>
  )
}

const juntarMotivo = (atalho: string, texto: string) => (atalho && texto.trim() ? `${atalho}: ${texto.trim()}` : atalho || texto.trim())

function SeletorLista({ listas, valor, onMudar, rotulo = 'Lista de destino' }: { listas: Lista[]; valor: string; onMudar: (v: string) => void; rotulo?: string }) {
  return (
    <label className="block text-sm font-medium">
      {rotulo}
      <select value={valor} onChange={(e) => onMudar(e.target.value)} className={`${campoPequeno} mt-1`}>
        {ativas(listas).map((l) => (
          <option key={l.id} value={l.id}>
            {l.nome}
          </option>
        ))}
      </select>
    </label>
  )
}

// ---------------------------------------------------------------------
// Nova versão
// ---------------------------------------------------------------------
export function ModalNovaVersao({
  cardId,
  ctx,
  onFechar,
  onCriado,
}: {
  cardId: string
  ctx: Contexto
  onFechar: () => void
  onCriado: (novoId: string) => void
}) {
  const toast = useToast()
  const origem = useOrigem(cardId)
  const [tipo, setTipo] = useState<'variacao' | 'hook'>('variacao')
  const [prox, setProx] = useState<{ proxHook: number; proxVar: number } | null>(null)
  const [atalho, setAtalho] = useState('')
  const [texto, setTexto] = useState('')
  const [lista, setLista] = useState('')
  const [listaManual, setListaManual] = useState(false)
  const [destinoOrigem, setDestinoOrigem] = useState<'manter' | 'rejeitado' | 'arquivar'>('manter')
  const [criando, setCriando] = useState(false)

  // Rejeição na origem: já sugere "Rejeitado" com conta, motivo e categoria.
  useEffect(() => {
    if (!origem) return
    proximosNumeros(origem.oferta_id, origem.ad_num!, origem.hook_num!).then(setProx)
    const rejeitadas = origem.veiculacoes.filter((v) => v.status === 'rejeitado')
    if (rejeitadas.length) {
      setAtalho('Rejeitado')
      setTexto(
        rejeitadas
          .map((v) => {
            const conta = ctx.contas.find((c) => c.id === v.conta_id)?.apelido ?? '?'
            const categoria = CATEGORIAS_REJEICAO.find((c) => c.valor === v.categoria_rejeicao)?.nome
            return `${conta}: ${v.motivo_rejeicao?.trim() || 'sem motivo anotado'}${categoria ? ` (${categoria})` : ''}`
          })
          .join('; '),
      )
    }
  }, [origem, ctx.contas])

  // Lista de destino acompanha o motivo, até ser escolhida à mão.
  useEffect(() => {
    if (!listaManual) setLista(listaChamada(ctx.listas, atalho === 'Rejeitado' ? 'Em ajuste [Edição]' : 'Criação'))
  }, [atalho, listaManual, ctx.listas])

  if (!origem || !prox) {
    return (
      <Modal titulo="Nova versão" onFechar={onFechar}>
        <Carregando linhas={4} />
      </Modal>
    )
  }

  const oferta = ctx.ofertas.find((o) => o.id === origem.oferta_id)
  const motivo = juntarMotivo(atalho, texto)
  const previa =
    tipo === 'variacao'
      ? nomeCompleto(oferta, origem.formato, origem.ad_num!, origem.hook_num!, prox.proxVar)
      : nomeCompleto(oferta, origem.formato, origem.ad_num!, prox.proxHook, 1)

  async function criar() {
    if (!origem || !motivo) return
    setCriando(true)
    const { data, error } = await ops().rpc('criar_versoes', {
      p_origem: origem.id,
      p_tipo: tipo,
      p_quantidade: 1,
      p_lista: lista,
      p_motivo: motivo,
    })
    if (error) {
      setCriando(false)
      return toast('ruim', mensagemErro(error))
    }
    const [novo] = idsDaResposta(data)
    await copiarImagensParaCards([novo])
    if (destinoOrigem === 'rejeitado') {
      await ops().rpc('mover_cards', { p_ids: [origem.id], p_lista: listaChamada(ctx.listas, 'Rejeitado') })
    } else if (destinoOrigem === 'arquivar') {
      await ops().from('cards').update({ arquivado: true }).eq('id', origem.id)
    }
    toast('bom', `Versão criada: ${previa}.`)
    onCriado(novo)
  }

  const opcao = (valor: typeof tipo, rotulo: string, detalhe: string) => (
    <label className={`flex flex-1 cursor-pointer gap-2 rounded-control border p-3 ${tipo === valor ? 'border-accent bg-accent-soft' : 'border-line hover:bg-surface-2'}`}>
      <input type="radio" name="tipo-versao" checked={tipo === valor} onChange={() => setTipo(valor)} className="mt-0.5 accent-[var(--c-accent)]" />
      <span>
        <span className="block text-sm font-medium">{rotulo}</span>
        <span className="block text-xs text-muted">{detalhe}</span>
      </span>
    </label>
  )

  return (
    <Modal
      titulo="Nova versão"
      onFechar={onFechar}
      rodape={
        <>
          <Botao variante="secundario" onClick={onFechar} className="ml-auto">
            Cancelar
          </Botao>
          <Botao onClick={criar} disabled={!motivo || !lista || criando}>
            {criando ? 'Criando…' : 'Criar versão'}
          </Botao>
        </>
      }
    >
      <div className="space-y-4">
        <p className="text-sm text-muted">
          A partir de <span className="font-mono text-ink">{origem.nome}</span>
        </p>
        <div className="flex flex-col gap-2 sm:flex-row">
          {opcao('variacao', 'Nova variação (M)', `Mesmo hook, M${prox.proxVar}`)}
          {opcao('hook', 'Novo hook (H)', `H${prox.proxHook}, começando no M1`)}
        </div>
        <div className="rounded-control bg-surface-2 px-3 py-2 text-sm">
          <span className="text-muted">Vai nascer: </span>
          <span className="font-mono font-medium">{previa}</span>
        </div>

        <CampoMotivo atalho={atalho} texto={texto} onAtalho={setAtalho} onTexto={setTexto} />
        {!motivo && <p className="-mt-2 text-xs text-bad">O motivo é obrigatório.</p>}

        <SeletorLista
          listas={ctx.listas}
          valor={lista}
          onMudar={(v) => {
            setLista(v)
            setListaManual(true)
          }}
        />

        <fieldset className="space-y-1.5">
          <legend className="mb-1 text-sm font-medium">E o card de origem?</legend>
          {(
            [
              ['manter', 'Manter onde está'],
              ['rejeitado', 'Mover para Rejeitado'],
              ['arquivar', 'Arquivar'],
            ] as const
          ).map(([valor, rotulo]) => (
            <label key={valor} className="flex items-center gap-2 text-sm">
              <input type="radio" name="destino-origem" checked={destinoOrigem === valor} onChange={() => setDestinoOrigem(valor)} className="accent-[var(--c-accent)]" />
              {rotulo}
            </label>
          ))}
        </fieldset>
      </div>
    </Modal>
  )
}

// ---------------------------------------------------------------------
// Gerar variações (escalar)
// ---------------------------------------------------------------------
export function ModalGerarVariacoes({
  cardId,
  ctx,
  onFechar,
  onCriados,
}: {
  cardId: string
  ctx: Contexto
  onFechar: () => void
  onCriados: (ids: string[]) => void
}) {
  const toast = useToast()
  const origem = useOrigem(cardId)
  const [prox, setProx] = useState<{ proxHook: number; proxVar: number } | null>(null)
  const [hooks, setHooks] = useState(2)
  const [variacoes, setVariacoes] = useState(2)
  const [atalho, setAtalho] = useState('')
  const [texto, setTexto] = useState('')
  const [lista, setLista] = useState(() => listaChamada(ctx.listas, 'Criação'))
  const [criando, setCriando] = useState(false)

  useEffect(() => {
    if (!origem) return
    proximosNumeros(origem.oferta_id, origem.ad_num!, origem.hook_num!).then(setProx)
    if (origem.vencedor) setAtalho('Escala de vencedor')
  }, [origem])

  const nomes = useMemo(() => {
    if (!origem || !prox) return []
    const oferta = ctx.ofertas.find((o) => o.id === origem.oferta_id)
    return [
      ...Array.from({ length: hooks }, (_, i) => nomeCompleto(oferta, origem.formato, origem.ad_num!, prox.proxHook + i, 1)),
      ...Array.from({ length: variacoes }, (_, i) => nomeCompleto(oferta, origem.formato, origem.ad_num!, origem.hook_num!, prox.proxVar + i)),
    ]
  }, [origem, prox, hooks, variacoes, ctx.ofertas])

  if (!origem || !prox) {
    return (
      <Modal titulo="Gerar variações" onFechar={onFechar}>
        <Carregando linhas={4} />
      </Modal>
    )
  }

  const motivo = juntarMotivo(atalho, texto)
  const nomeLista = ctx.listas.find((l) => l.id === lista)?.nome ?? ''

  async function criar() {
    if (!origem) return
    setCriando(true)
    const { data, error } = await ops().rpc('gerar_variacoes', {
      p_origem: origem.id,
      p_hooks: hooks,
      p_variacoes: variacoes,
      p_lista: lista,
      p_motivo: motivo,
    })
    if (error) {
      setCriando(false)
      return toast('ruim', mensagemErro(error))
    }
    const ids = idsDaResposta(data)
    await copiarImagensParaCards(ids)
    toast('bom', `${ids.length} ${ids.length === 1 ? 'card criado' : 'cards criados'} em ${nomeLista}.`)
    onCriados(ids)
  }

  const contador = (rotulo: string, valor: number, mudar: (n: number) => void) => (
    <label className="block flex-1 text-sm font-medium">
      {rotulo}
      <div className="mt-1 flex items-center gap-1">
        <button type="button" onClick={() => mudar(Math.max(0, valor - 1))} className="h-8 w-8 rounded-control bg-surface-2 text-lg leading-none hover:bg-line/70" aria-label={`Menos ${rotulo}`}>
          −
        </button>
        <input
          type="number"
          min={0}
          max={10}
          value={valor}
          onChange={(e) => mudar(Math.min(10, Math.max(0, parseInt(e.target.value) || 0)))}
          className={`${campoPequeno} w-14 text-center tabular-nums`}
        />
        <button type="button" onClick={() => mudar(Math.min(10, valor + 1))} className="h-8 w-8 rounded-control bg-surface-2 text-lg leading-none hover:bg-line/70" aria-label={`Mais ${rotulo}`}>
          +
        </button>
      </div>
    </label>
  )

  return (
    <Modal
      titulo="Gerar variações"
      onFechar={onFechar}
      rodape={
        <>
          <Botao variante="secundario" onClick={onFechar} className="ml-auto">
            Cancelar
          </Botao>
          <Botao onClick={criar} disabled={!nomes.length || !motivo || !lista || criando}>
            {criando ? 'Criando…' : `Criar ${nomes.length} ${nomes.length === 1 ? 'card' : 'cards'}`}
          </Botao>
        </>
      }
    >
      <div className="space-y-4">
        <p className="text-sm text-muted">
          A partir de <span className="font-mono text-ink">{origem.nome}</span>
        </p>
        <div className="flex gap-4">
          {contador('Hooks novos', hooks, setHooks)}
          {contador(`Variações do H${origem.hook_num}`, variacoes, setVariacoes)}
        </div>

        <div>
          <p className="mb-1 text-sm font-medium">Vão nascer</p>
          {nomes.length === 0 ? (
            <p className="text-sm text-muted">Escolha ao menos um hook ou uma variação.</p>
          ) : (
            <ul className="max-h-40 space-y-0.5 overflow-y-auto rounded-control bg-surface-2 px-3 py-2 font-mono text-xs">
              {nomes.map((n) => (
                <li key={n}>{n}</li>
              ))}
            </ul>
          )}
        </div>

        <SeletorLista listas={ctx.listas} valor={lista} onMudar={setLista} />
        <CampoMotivo atalho={atalho} texto={texto} onAtalho={setAtalho} onTexto={setTexto} />
        {!motivo && <p className="-mt-2 text-xs text-bad">O motivo é obrigatório.</p>}
      </div>
    </Modal>
  )
}

// ---------------------------------------------------------------------
// Duplicar
// ---------------------------------------------------------------------
export function ModalDuplicar({
  cardId,
  ctx,
  onFechar,
  onCriado,
}: {
  cardId: string
  ctx: Contexto
  onFechar: () => void
  onCriado: (novoId: string) => void
}) {
  const toast = useToast()
  const origem = useOrigem(cardId)
  const [ad, setAd] = useState(0)
  const [hook, setHook] = useState(1)
  const [varNum, setVarNum] = useState(1)
  const [nome, setNome] = useState('')
  const [lista, setLista] = useState('')
  const [criando, setCriando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    if (!origem) return
    setLista(origem.lista_id)
    if (origem.tipo === 'ad') proximoAd(origem.oferta_id).then(setAd)
    else setNome(`${origem.nome} (cópia)`)
  }, [origem])

  if (!origem || (origem.tipo === 'ad' && !ad)) {
    return (
      <Modal titulo="Duplicar card" onFechar={onFechar}>
        <Carregando linhas={3} />
      </Modal>
    )
  }

  const oferta = ctx.ofertas.find((o) => o.id === origem.oferta_id)
  const ehAd = origem.tipo === 'ad'
  const previa = ehAd ? nomeCompleto(oferta, origem.formato, ad, hook, varNum) : nome

  async function criar() {
    if (!origem) return
    setErro(null)
    if (ehAd && (!ad || !hook || !varNum)) return setErro('Preencha AD, H e M.')
    if (!ehAd && !nome.trim()) return setErro('Informe o título.')
    setCriando(true)
    const { data, error } = await ops().rpc('duplicar_card', {
      p_origem: origem.id,
      p_lista: lista,
      p_ad: ehAd ? ad : null,
      p_hook: ehAd ? hook : null,
      p_var: ehAd ? varNum : null,
      p_nome: ehAd ? null : nome.trim(),
    })
    if (error) {
      setCriando(false)
      return setErro(mensagemErro(error, { cards_ad_unico: `Já existe o AD${ad}-H${hook}-M${varNum} nesta oferta.` }))
    }
    const [novo] = idsDaResposta(data)
    await copiarImagensParaCards([novo])
    toast('bom', `Card duplicado: ${previa}.`)
    onCriado(novo)
  }

  return (
    <Modal
      titulo="Duplicar card"
      onFechar={onFechar}
      rodape={
        <>
          <Botao variante="secundario" onClick={onFechar} className="ml-auto">
            Cancelar
          </Botao>
          <Botao onClick={criar} disabled={criando}>
            {criando ? 'Duplicando…' : 'Duplicar'}
          </Botao>
        </>
      }
    >
      <div className="space-y-4">
        <p className="text-sm text-muted">
          Copia etiquetas, membros, descrição, anexos e checklists (desmarcados). Comentários, veiculações, vencedor e prazo ficam de fora.
        </p>
        {ehAd ? (
          <>
            <div className="flex gap-2">
              {(
                [
                  ['AD', ad, setAd],
                  ['H', hook, setHook],
                  ['M', varNum, setVarNum],
                ] as const
              ).map(([rotulo, valor, mudar]) => (
                <label key={rotulo} className="text-xs text-muted">
                  {rotulo}
                  <input
                    type="number"
                    min={1}
                    value={valor || ''}
                    onChange={(e) => mudar(Math.max(0, parseInt(e.target.value) || 0))}
                    className={`${campoPequeno} mt-0.5 w-20 tabular-nums`}
                  />
                </label>
              ))}
            </div>
            <div className="rounded-control bg-surface-2 px-3 py-2 text-sm">
              <span className="text-muted">Vai nascer: </span>
              <span className="font-mono font-medium">{previa}</span>
            </div>
          </>
        ) : (
          <label className="block text-sm font-medium">
            Título
            <input value={nome} onChange={(e) => setNome(e.target.value)} className={`${campoPequeno} mt-1`} autoFocus />
          </label>
        )}
        <SeletorLista listas={ctx.listas} valor={lista} onMudar={setLista} rotulo="Lista" />
        {erro && <p className="text-sm text-bad">{erro}</p>}
      </div>
    </Modal>
  )
}

// ---------------------------------------------------------------------
// Família dentro do card
// ---------------------------------------------------------------------
export function SecaoFamilia({
  card,
  listas,
  contas,
  versao,
  onAbrir,
}: {
  card: CardDetalhe
  listas: Lista[]
  contas: ContaQuadro[]
  /** muda a cada gravação: recarrega a árvore */
  versao: number
  onAbrir: (id: string) => void
}) {
  const [familia, setFamilia] = useState<MembroFamilia[] | null>(null)

  useEffect(() => {
    if (card.tipo !== 'ad' || !card.ad_num) return
    buscarFamilia(card.oferta_id, card.ad_num).then(setFamilia, () => setFamilia([]))
  }, [card.tipo, card.oferta_id, card.ad_num, versao])

  const porConta = useMemo(() => new Map(contas.map((c) => [c.id, c])), [contas])
  const nomeLista = useMemo(() => new Map(listas.map((l) => [l.id, l.nome])), [listas])

  if (card.tipo !== 'ad') return null

  const hooks = new Map<number, MembroFamilia[]>()
  for (const m of familia ?? []) hooks.set(m.hook_num, [...(hooks.get(m.hook_num) ?? []), m])

  return (
    <section>
      <TituloSecao icone={ICONES.familia}>
        Família AD{card.ad_num}
        {familia && <span className="ml-1.5 text-xs font-normal text-muted">({familia.length})</span>}
      </TituloSecao>
      {!familia ? (
        <Carregando linhas={3} />
      ) : (
        <div className="space-y-2">
          {[...hooks.entries()].map(([h, membros]) => (
            <div key={h}>
              <p className="mb-0.5 text-xs font-semibold text-muted">H{h}</p>
              <ul className="space-y-0.5 border-l-2 border-line pl-2">
                {membros.map((m) => {
                  const atual = m.id === card.id
                  return (
                    <li key={m.id}>
                      <button
                        onClick={() => !atual && onAbrir(m.id)}
                        aria-current={atual ? 'true' : undefined}
                        className={`flex w-full flex-wrap items-center gap-2 rounded-md px-2 py-1 text-left text-sm ${
                          atual ? 'bg-accent-soft font-medium text-accent-strong' : 'hover:bg-surface-2'
                        } ${m.arquivado ? 'opacity-50' : ''}`}
                      >
                        <span className="font-mono">{nomeCurto({ ad_num: card.ad_num, hook_num: m.hook_num, var_num: m.var_num }, true)}</span>
                        <span className="text-xs text-muted">{nomeLista.get(m.lista_id)}</span>
                        <PilulasContas veiculacoes={m.veiculacoes} contas={porConta} />
                        {m.vencedor && (
                          <span className="text-warn" title="Vencedor">
                            <svg viewBox="0 0 16 16" aria-hidden className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
                              {ICONES.trofeu}
                            </svg>
                            <span className="sr-only">Vencedor</span>
                          </span>
                        )}
                        {m.arquivado && <span className="text-xs text-muted">arquivado</span>}
                      </button>
                    </li>
                  )
                })}
              </ul>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

/** "Veio de: AD1-H1-M1 · motivo", no cabeçalho do card. */
export function LinhaOrigem({ card, onAbrir }: { card: CardDetalhe; onAbrir: (id: string) => void }) {
  if (!card.origem) return null
  return (
    <button onClick={() => onAbrir(card.origem!.id)} className="max-w-full truncate text-left text-xs text-muted hover:text-accent-strong">
      Veio de: <span className="font-mono">{card.origem.ad_num ? nomeCurto(card.origem) : card.origem.nome}</span>
      {card.motivo_versao && <> · {card.motivo_versao}</>}
    </button>
  )
}
