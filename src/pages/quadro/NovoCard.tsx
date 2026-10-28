import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { Botao } from '../../components/ui'
import { mensagemErro, soSigla } from '../../lib/cadastros'
import { buscarCard, gravarLocal, lerLocal, TIPOS, type CardQuadro, type OfertaQuadro, type TipoCard } from '../../lib/quadro'
import { ops } from '../../lib/supabase'

const pequena = 'w-full rounded-md border border-line bg-surface px-2 py-1 text-sm outline-none focus:border-muted'
const FORMATOS = ['VD', 'IMG', 'CAR', 'GIF']

/** Formulário curto no fim da lista. Enter cria e deixa aberto para o próximo. */
export function NovoCard({
  listaId,
  ofertaFixa,
  ofertas,
  proximaPosicao,
  onCriado,
  onFechar,
}: {
  listaId: string
  /** quadro de uma oferta; null no quadro "Todas" (aí escolhe a oferta) */
  ofertaFixa: OfertaQuadro | null
  ofertas: OfertaQuadro[]
  proximaPosicao: () => number
  onCriado: (c: CardQuadro) => void
  onFechar: () => void
}) {
  const [tipo, setTipo] = useState<TipoCard>(() => lerLocal<TipoCard>('novo_card_tipo', 'ad'))
  const [ofertaId, setOfertaId] = useState(() => ofertaFixa?.id ?? lerLocal<string>('novo_card_oferta', '') ?? '')
  const [ad, setAd] = useState(1)
  const [hook, setHook] = useState(1)
  const [varNum, setVarNum] = useState(1)
  const [formato, setFormato] = useState(() => lerLocal('novo_card_formato', 'VD'))
  const [titulo, setTitulo] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const primeiro = useRef<HTMLInputElement>(null)

  const oferta = ofertaFixa ?? ofertas.find((o) => o.id === ofertaId) ?? null

  // oferta guardada não existe mais (ou nunca escolheu): usa a primeira
  useEffect(() => {
    if (!ofertaFixa && !ofertas.some((o) => o.id === ofertaId) && ofertas[0]) setOfertaId(ofertas[0].id)
  }, [ofertaFixa, ofertas, ofertaId])

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
    setAd((data?.ad_num ?? 0) + 1)
    setHook(1)
    setVarNum(1)
  }, [oferta?.id])

  useEffect(() => {
    sugerir()
  }, [sugerir])

  useEffect(() => {
    primeiro.current?.focus()
  }, [tipo])

  const previa = oferta ? `${oferta.codigo}-${oferta.idioma}-AD${ad || '?'}-H${hook || '?'}-M${varNum || '?'}-${formato || '?'}` : ''

  async function criar(e: FormEvent) {
    e.preventDefault()
    setErro(null)
    if (!oferta) return setErro('Escolha a oferta.')
    if (tipo === 'ad' && (!ad || !hook || !varNum || !formato)) return setErro('Preencha AD, H, M e formato.')
    if (tipo !== 'ad' && !titulo.trim()) return setErro('Informe o título.')

    setSalvando(true)
    const base = { oferta_id: oferta.id, lista_id: listaId, posicao: proximaPosicao(), tipo }
    const campos: Record<string, unknown> =
      tipo === 'ad' ? { ...base, ad_num: ad, hook_num: hook, var_num: varNum, formato } : { ...base, nome: titulo.trim() }
    const { data, error } = await ops().from('cards').insert(campos).select('id').single()
    if (error) {
      setSalvando(false)
      return setErro(
        mensagemErro(error, { cards_ad_unico: `Já existe o AD${ad}-H${hook}-M${varNum} nesta oferta.` }),
      )
    }
    gravarLocal('novo_card_tipo', tipo)
    gravarLocal('novo_card_formato', formato)
    if (!ofertaFixa) gravarLocal('novo_card_oferta', oferta.id)
    const card = await buscarCard(data.id).catch(() => null)
    if (card) onCriado(card)
    setSalvando(false)
    setTitulo('')
    if (tipo === 'ad') await sugerir()
    primeiro.current?.focus()
  }

  return (
    <form
      onSubmit={criar}
      onKeyDown={(e) => e.key === 'Escape' && onFechar()}
      className="space-y-2 rounded-control border border-line bg-surface p-2 shadow-sm"
    >
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

      {tipo === 'ad' ? (
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
                onChange={(e) => setFormato(soSigla(e.target.value, 8))}
                className={`${pequena} font-mono uppercase`}
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
          {salvando ? 'Criando…' : 'Criar card'}
        </Botao>
        <button type="button" onClick={onFechar} className="text-xs text-muted hover:text-ink">
          Fechar
        </button>
      </div>
    </form>
  )
}
