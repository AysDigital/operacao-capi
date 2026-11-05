import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { useToast } from '../../components/Toast'
import { Botao } from '../../components/ui'
import { copiarImagensParaCards } from '../../lib/arquivos'
import { mensagemErro, soSigla } from '../../lib/cadastros'
import { criarDeModelo, FORMATOS, modelosDaOferta, previaAds, type Modelo } from '../../lib/modelos'
import { buscarCard, gravarLocal, lerLocal, TIPOS, type CardQuadro, type OfertaQuadro, type TipoCard } from '../../lib/quadro'
import { ops } from '../../lib/supabase'
import { idsDaResposta } from '../../lib/versoes'
import { CHAVE_MODELO } from './ModelosQuadro'

const pequena = 'w-full rounded-md border border-line bg-surface px-2 py-1 text-sm outline-none focus:border-muted'

/** Formulário curto no fim da lista. Enter cria e deixa aberto para o próximo. */
export function NovoCard({
  listaId,
  ofertaFixa,
  ofertas,
  modelos,
  proximaPosicao,
  onCriado,
  onFechar,
}: {
  listaId: string
  /** quadro de uma oferta; null no quadro "Todas" (aí escolhe a oferta) */
  ofertaFixa: OfertaQuadro | null
  ofertas: OfertaQuadro[]
  modelos: Modelo[]
  proximaPosicao: () => number
  onCriado: (c: CardQuadro) => void
  onFechar: () => void
}) {
  const toast = useToast()
  const [tipoLivre, setTipo] = useState<TipoCard>(() => lerLocal<TipoCard>('novo_card_tipo', 'ad'))
  const [ofertaId, setOfertaId] = useState(() => ofertaFixa?.id ?? lerLocal<string>('novo_card_oferta', '') ?? '')
  const [modeloId, setModeloId] = useState(() => lerLocal<string>(CHAVE_MODELO, ''))
  const [ad, setAd] = useState(1)
  const [sugerido, setSugerido] = useState(1)
  const [hook, setHook] = useState(1)
  const [varNum, setVarNum] = useState(1)
  const [quantidade, setQuantidade] = useState(1)
  const [formatoLivre, setFormato] = useState(() => lerLocal('novo_card_formato', 'VD'))
  const [titulo, setTitulo] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const primeiro = useRef<HTMLInputElement>(null)
  const caixa = useRef<HTMLFormElement>(null)

  // clicar em qualquer lugar fora do formulário fecha
  useEffect(() => {
    const fora = (e: PointerEvent) => caixa.current && !caixa.current.contains(e.target as Node) && onFechar()
    document.addEventListener('pointerdown', fora)
    return () => document.removeEventListener('pointerdown', fora)
  }, [onFechar])

  const oferta = ofertaFixa ?? ofertas.find((o) => o.id === ofertaId) ?? null

  // oferta guardada não existe mais (ou nunca escolheu): usa a primeira
  useEffect(() => {
    if (!ofertaFixa && !ofertas.some((o) => o.id === ofertaId) && ofertas[0]) setOfertaId(ofertas[0].id)
  }, [ofertaFixa, ofertas, ofertaId])

  const disponiveis = useMemo(() => modelosDaOferta(modelos, oferta?.id ?? null), [modelos, oferta?.id])
  const modelo = disponiveis.find((m) => m.id === modeloId) ?? null
  // com modelo, tipo e formato vêm dele
  const tipo = modelo?.tipo ?? tipoLivre
  const formato = modelo ? (modelo.formato ?? '') : formatoLivre
  const varios = Boolean(modelo) && tipo === 'ad' && quantidade > 1

  /** Próximo AD livre da oferta (contando arquivados), com H1 e M1. */
  const sugerir = useCallback(async () => {
    if (!oferta) return
    const { data } = await ops()
      .from('cards')
      .select('ad_num')
      .eq('oferta_id', oferta.id)
      .eq('tipo', 'ad')
      .order('ad_num', { ascending: false })
      .limit(1)
      .maybeSingle()
    const n = (data?.ad_num ?? 0) + 1
    setAd(n)
    setSugerido(n)
    setHook(1)
    setVarNum(1)
  }, [oferta?.id])

  useEffect(() => {
    sugerir()
  }, [sugerir])

  useEffect(() => {
    primeiro.current?.focus()
  }, [tipo, varios])

  const previa = oferta ? `${oferta.codigo}-${oferta.idioma}-AD${ad || '?'}-H${hook || '?'}-M${varNum || '?'}-${formato || '?'}` : ''
  const previaVarios = varios ? previaAds(oferta, formato || null, sugerido, quantidade) : []

  async function criar(e: FormEvent) {
    e.preventDefault()
    setErro(null)
    if (!oferta) return setErro('Escolha a oferta.')
    if (tipo === 'ad' && !varios && (!ad || !hook || !varNum || !formato)) return setErro('Preencha AD, H, M e formato.')
    if (tipo !== 'ad' && !titulo.trim()) return setErro('Informe o título.')
    setSalvando(true)

    let ids: string[] = []
    if (modelo) {
      // AD/H/M sugeridos: o banco escolhe o próximo livre (com trava); mexeu: usa o informado
      const manual = tipo === 'ad' && !varios && (ad !== sugerido || hook !== 1 || varNum !== 1)
      const { data, error } = await criarDeModelo({
        modelo: modelo.id,
        oferta: oferta.id,
        lista: listaId,
        quantidade: tipo === 'ad' ? quantidade : 1,
        ad: manual ? ad : null,
        hook: manual ? hook : null,
        variacao: manual ? varNum : null,
        nome: tipo === 'ad' ? null : titulo.trim(),
      })
      if (error) {
        setSalvando(false)
        return setErro(mensagemErro(error, { cards_ad_unico: `Já existe o AD${ad}-H${hook}-M${varNum} nesta oferta.` }))
      }
      ids = idsDaResposta(data)
      await copiarImagensParaCards(ids)
      if (ids.length > 1) toast('bom', `${ids.length} cards criados a partir do modelo ${modelo.nome}.`)
    } else {
      const base = { oferta_id: oferta.id, lista_id: listaId, posicao: proximaPosicao(), tipo }
      const campos: Record<string, unknown> =
        tipo === 'ad' ? { ...base, ad_num: ad, hook_num: hook, var_num: varNum, formato } : { ...base, nome: titulo.trim() }
      const { data, error } = await ops().from('cards').insert(campos).select('id').single()
      if (error) {
        setSalvando(false)
        return setErro(mensagemErro(error, { cards_ad_unico: `Já existe o AD${ad}-H${hook}-M${varNum} nesta oferta.` }))
      }
      ids = [data.id]
      gravarLocal('novo_card_tipo', tipo)
      gravarLocal('novo_card_formato', formato)
    }

    gravarLocal(CHAVE_MODELO, modelo?.id ?? '')
    if (!ofertaFixa) gravarLocal('novo_card_oferta', oferta.id)
    for (const id of ids) {
      const card = await buscarCard(id).catch(() => null)
      if (card) onCriado(card)
    }
    setSalvando(false)
    setTitulo('')
    if (tipo === 'ad') await sugerir()
    primeiro.current?.focus()
  }

  return (
    <form
      ref={caixa}
      onSubmit={criar}
      onKeyDown={(e) => e.key === 'Escape' && onFechar()}
      className="space-y-2 rounded-control border border-line bg-surface p-2 shadow-sm"
    >
      {!ofertaFixa && (
        <select value={ofertaId} onChange={(e) => setOfertaId(e.target.value)} className={pequena} aria-label="Oferta">
          {ofertas.length === 0 && <option value="">Nenhuma oferta ativa</option>}
          {ofertas.map((o) => (
            <option key={o.id} value={o.id}>
              {o.codigo} · {o.nome}
            </option>
          ))}
        </select>
      )}

      {disponiveis.length > 0 && (
        <label className="flex items-center gap-2 text-[11px] text-muted">
          Modelo
          <select value={modelo?.id ?? ''} onChange={(e) => setModeloId(e.target.value)} className={`${pequena} text-ink`} aria-label="Modelo">
            <option value="">Nenhum</option>
            {disponiveis.map((m) => (
              <option key={m.id} value={m.id}>
                {m.nome}
              </option>
            ))}
          </select>
        </label>
      )}

      {!modelo && (
        <div className="flex gap-1" role="radiogroup" aria-label="Tipo">
          {TIPOS.map((t) => (
            <button
              key={t.valor}
              type="button"
              role="radio"
              aria-checked={tipo === t.valor}
              onClick={() => setTipo(t.valor)}
              className={`flex-1 rounded-md px-2 py-1 text-xs font-medium ${tipo === t.valor ? 'bg-ink text-page' : 'bg-surface-2 text-muted hover:text-ink'}`}
            >
              {t.nome}
            </button>
          ))}
        </div>
      )}

      {tipo === 'ad' ? (
        <>
          {modelo && (
            <label className="flex items-center gap-2 text-[11px] text-muted">
              Quantidade
              <input
                type="number"
                min={1}
                max={10}
                value={quantidade}
                onChange={(e) => setQuantidade(Math.min(10, Math.max(1, parseInt(e.target.value) || 1)))}
                className={`${pequena} w-16 text-ink tabular-nums`}
              />
            </label>
          )}
          {varios ? (
            <p className="font-mono text-xs break-words text-muted">{previaVarios.join(', ')}</p>
          ) : (
            <>
              <div className="grid grid-cols-4 gap-1">
                {(
                  [
                    ['AD', ad, setAd],
                    ['H', hook, setHook],
                    ['M', varNum, setVarNum],
                  ] as const
                ).map(([rotulo, valor, mudar], i) => (
                  <label key={rotulo} className="text-[11px] text-muted">
                    {rotulo}
                    <input
                      ref={i === 0 ? primeiro : undefined}
                      type="number"
                      min={1}
                      value={valor || ''}
                      onChange={(e) => mudar(Math.max(0, parseInt(e.target.value) || 0))}
                      className={`${pequena} tabular-nums`}
                    />
                  </label>
                ))}
                <label className="text-[11px] text-muted">
                  Formato
                  <input
                    list="formatos-card"
                    value={formato}
                    disabled={Boolean(modelo)}
                    onChange={(e) => setFormato(soSigla(e.target.value, 8))}
                    className={`${pequena} font-mono uppercase disabled:opacity-60`}
                  />
                  <datalist id="formatos-card">
                    {FORMATOS.map((f) => (
                      <option key={f} value={f} />
                    ))}
                  </datalist>
                </label>
              </div>
              {oferta && <p className="truncate font-mono text-xs text-muted">{previa}</p>}
            </>
          )}
        </>
      ) : (
        <input
          ref={primeiro}
          value={titulo}
          onChange={(e) => setTitulo(e.target.value)}
          placeholder={tipo === 'vsl' ? 'Título da VSL' : 'Título do card'}
          className={pequena}
        />
      )}

      {erro && <p className="text-xs text-bad">{erro}</p>}

      <div className="flex items-center gap-2">
        <Botao type="submit" disabled={salvando} className="px-3 py-1.5 text-xs">
          {salvando ? 'Criando…' : varios ? `Criar ${quantidade} cards` : 'Criar card'}
        </Botao>
        <button type="button" onClick={onFechar} className="text-xs text-muted hover:text-ink">
          Fechar
        </button>
      </div>
    </form>
  )
}
