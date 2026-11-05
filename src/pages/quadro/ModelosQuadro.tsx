import { useEffect, useMemo, useState } from 'react'
import { Dica, Modal } from '../../components/ds'
import { useToast } from '../../components/Toast'
import { Botao, Campo, entrada } from '../../components/ui'
import { copiarImagensParaCards } from '../../lib/arquivos'
import { mensagemErro } from '../../lib/cadastros'
import { criarDeModelo, modelosDaOferta, previaAds, textoPrazo, type Modelo } from '../../lib/modelos'
import { gravarLocal, lerLocal, TIPOS, type Lista, type OfertaQuadro } from '../../lib/quadro'
import { ops } from '../../lib/supabase'
import { idsDaResposta, proximoAd } from '../../lib/versoes'

export const CHAVE_MODELO = 'novo_card_modelo'

/** Próximo AD livre da oferta (para a prévia; o número de verdade sai do banco). */
export function useProximoAd(ofertaId: string | null | undefined, ativo: boolean) {
  const [ad, setAd] = useState<number | null>(null)
  useEffect(() => {
    if (!ofertaId || !ativo) return setAd(null)
    let vivo = true
    proximoAd(ofertaId).then((n) => vivo && setAd(n))
    return () => {
      vivo = false
    }
  }, [ofertaId, ativo])
  return ad
}

/** Prévia dos nomes que vão nascer. */
export function PreviaNomes({ nomes }: { nomes: string[] }) {
  if (!nomes.length) return null
  return (
    <div className="rounded-control bg-surface-2 px-3 py-2 text-sm">
      <span className="text-muted">{nomes.length === 1 ? 'Vai nascer: ' : `Vão nascer ${nomes.length}: `}</span>
      <span className="font-mono font-medium">{nomes.join(', ')}</span>
    </div>
  )
}

// ---------------------------------------------------------------------
// Salvar como modelo (modal do card e clique-direito)
// ---------------------------------------------------------------------
export function ModalSalvarComoModelo({
  card,
  oferta,
  onFechar,
  onSalvo,
}: {
  card: { id: string; nome: string }
  oferta: OfertaQuadro | undefined
  onFechar: () => void
  onSalvo?: () => void
}) {
  const toast = useToast()
  const [nome, setNome] = useState('')
  const [soOferta, setSoOferta] = useState(false)
  const [salvando, setSalvando] = useState(false)

  async function salvar() {
    if (!nome.trim()) return
    setSalvando(true)
    const { error } = await ops().rpc('salvar_como_modelo', { p_card: card.id, p_nome: nome.trim(), p_so_oferta: soOferta })
    setSalvando(false)
    if (error) return toast('ruim', mensagemErro(error))
    toast('bom', `Modelo ${nome.trim()} criado. Edite em Modelos.`)
    onSalvo?.()
    onFechar()
  }

  const opcao = (valor: boolean, rotulo: string) => (
    <label className={`flex flex-1 cursor-pointer items-center gap-2 rounded-control border p-3 text-sm ${soOferta === valor ? 'border-accent bg-accent-soft' : 'border-line hover:bg-surface-2'}`}>
      <input type="radio" name="alcance-modelo" checked={soOferta === valor} onChange={() => setSoOferta(valor)} className="accent-[var(--c-accent)]" />
      {rotulo}
    </label>
  )

  return (
    <Modal
      titulo="Salvar como modelo"
      onFechar={onFechar}
      rodape={
        <>
          <Botao variante="secundario" onClick={onFechar} className="ml-auto">
            Cancelar
          </Botao>
          <Botao onClick={salvar} disabled={!nome.trim() || salvando}>
            {salvando ? 'Salvando…' : 'Salvar modelo'}
          </Botao>
        </>
      }
    >
      <div className="space-y-4">
        <p className="text-sm text-muted">
          <Dica conteudo="O modelo leva tipo, formato, lista atual (como lista padrão), etiquetas, descrição, anexos de link e checklists. Nos cards criados com ele, os itens nascem desmarcados.">
            <span>
              A partir de <span className="font-mono text-ink">{card.nome}</span>
            </span>
          </Dica>
        </p>
        <Campo rotulo="Nome do modelo">
          <input autoFocus value={nome} onChange={(e) => setNome(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && salvar()} className={entrada} placeholder="Ex.: Ad vídeo padrão" />
        </Campo>
        <fieldset>
          <legend className="mb-1.5 text-sm font-medium">Vale para</legend>
          <div className="flex flex-col gap-2 sm:flex-row">
            {opcao(false, 'Todas as ofertas')}
            {opcao(true, oferta ? `Só ${oferta.codigo}-${oferta.idioma}` : 'Só a oferta do card')}
          </div>
        </fieldset>
      </div>
    </Modal>
  )
}

// ---------------------------------------------------------------------
// Novo card a partir de modelo (botão da barra do quadro)
// ---------------------------------------------------------------------
export function ModalNovoDeModelo({
  modelos,
  ofertas,
  ofertaFixa,
  listas,
  onFechar,
  onCriados,
}: {
  modelos: Modelo[]
  /** ofertas que aceitam card novo */
  ofertas: OfertaQuadro[]
  /** quadro de uma oferta; null no "Todas" */
  ofertaFixa: OfertaQuadro | null
  listas: Lista[]
  onFechar: () => void
  onCriados: (ids: string[]) => void
}) {
  const toast = useToast()
  const disponiveis = useMemo(() => (ofertaFixa ? modelosDaOferta(modelos, ofertaFixa.id) : modelos), [modelos, ofertaFixa])
  const [modeloId, setModeloId] = useState(() => {
    const ultimo = lerLocal<string>(CHAVE_MODELO, '')
    return disponiveis.some((m) => m.id === ultimo) ? ultimo : (disponiveis[0]?.id ?? '')
  })
  const modelo = disponiveis.find((m) => m.id === modeloId)
  const [ofertaId, setOfertaId] = useState(() => ofertaFixa?.id ?? lerLocal<string>('novo_card_oferta', '') ?? '')
  const ativas = listas.filter((l) => !l.arquivada)
  const [listaId, setListaId] = useState('')
  const [quantidade, setQuantidade] = useState(1)
  const [titulo, setTitulo] = useState('')
  const [criando, setCriando] = useState(false)

  // Modelo de uma oferta só: a oferta vem dele. Sem oferta escolhida: a primeira.
  const ofertasDoModelo = modelo?.oferta_id ? ofertas.filter((o) => o.id === modelo.oferta_id) : ofertas
  useEffect(() => {
    if (ofertaFixa) return
    if (!ofertasDoModelo.some((o) => o.id === ofertaId) && ofertasDoModelo[0]) setOfertaId(ofertasDoModelo[0].id)
  }, [ofertaFixa, ofertasDoModelo, ofertaId])

  // A lista acompanha a lista padrão do modelo.
  useEffect(() => {
    setListaId(ativas.find((l) => l.id === modelo?.lista_id)?.id ?? ativas[0]?.id ?? '')
    // ativas muda de referência a cada render; só o modelo importa aqui
  }, [modelo?.id])

  const oferta = ofertaFixa ?? ofertas.find((o) => o.id === ofertaId)
  const ehAd = modelo?.tipo === 'ad'
  const proximo = useProximoAd(oferta?.id, ehAd)
  const nomes = ehAd && proximo ? previaAds(oferta, modelo?.formato ?? null, proximo, quantidade) : []

  async function criar() {
    if (!modelo || !oferta || !listaId) return
    if (!ehAd && !titulo.trim()) return
    setCriando(true)
    const { data, error } = await criarDeModelo({
      modelo: modelo.id,
      oferta: oferta.id,
      lista: listaId,
      quantidade: ehAd ? quantidade : 1,
      nome: ehAd ? null : titulo.trim(),
    })
    if (error) {
      setCriando(false)
      return toast('ruim', mensagemErro(error))
    }
    const ids = idsDaResposta(data)
    await copiarImagensParaCards(ids)
    gravarLocal(CHAVE_MODELO, modelo.id)
    if (!ofertaFixa) gravarLocal('novo_card_oferta', oferta.id)
    toast('bom', ids.length === 1 ? 'Card criado a partir do modelo.' : `${ids.length} cards criados a partir do modelo.`)
    onCriados(ids)
  }

  return (
    <Modal
      titulo="Novo card a partir de modelo"
      onFechar={onFechar}
      rodape={
        <>
          <Botao variante="secundario" onClick={onFechar} className="ml-auto">
            Cancelar
          </Botao>
          <Botao onClick={criar} disabled={!modelo || !oferta || !listaId || criando || (!ehAd && !titulo.trim())}>
            {criando ? 'Criando…' : ehAd && quantidade > 1 ? `Criar ${quantidade} cards` : 'Criar card'}
          </Botao>
        </>
      }
    >
      {disponiveis.length === 0 ? (
        <p className="text-sm text-muted">Nenhum modelo para esta oferta. Crie em Modelos ou use “Salvar como modelo” num card.</p>
      ) : (
        <div className="space-y-4">
          <Campo rotulo="Modelo">
            <select value={modeloId} onChange={(e) => setModeloId(e.target.value)} className={entrada}>
              {disponiveis.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.nome} · {TIPOS.find((t) => t.valor === m.tipo)?.nome}
                  {m.formato ? ` ${m.formato}` : ''}
                </option>
              ))}
            </select>
          </Campo>
          {modelo && (
            <p className="-mt-2 text-xs text-muted">
              {[
                modelo.etiquetas.length && `${modelo.etiquetas.length} ${modelo.etiquetas.length === 1 ? 'etiqueta' : 'etiquetas'}`,
                modelo.checklists.length && `${modelo.checklists.length} ${modelo.checklists.length === 1 ? 'checklist' : 'checklists'}`,
                modelo.anexos.filter((a) => a.url).length && `${modelo.anexos.filter((a) => a.url).length} anexos`,
                modelo.descricao && 'descrição',
                `prazo: ${textoPrazo(modelo.prazo_dias).toLowerCase()}`,
              ]
                .filter(Boolean)
                .join(' · ')}
            </p>
          )}

          {!ofertaFixa && (
            <Campo rotulo="Oferta">
              <select value={ofertaId} onChange={(e) => setOfertaId(e.target.value)} className={entrada}>
                {ofertasDoModelo.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.codigo}-{o.idioma} · {o.nome}
                  </option>
                ))}
              </select>
            </Campo>
          )}

          <div className="grid gap-4 sm:grid-cols-[1fr_8rem]">
            <Campo rotulo="Lista">
              <select value={listaId} onChange={(e) => setListaId(e.target.value)} className={entrada}>
                {ativas.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.nome}
                  </option>
                ))}
              </select>
            </Campo>
            {ehAd && (
              <Campo rotulo="Quantidade">
                <input type="number" min={1} max={10} value={quantidade} onChange={(e) => setQuantidade(Math.min(10, Math.max(1, parseInt(e.target.value) || 1)))} className={`${entrada} tabular-nums`} />
              </Campo>
            )}
          </div>

          {!ehAd && modelo && (
            <Campo rotulo="Título do card">
              <input autoFocus value={titulo} onChange={(e) => setTitulo(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && criar()} className={entrada} placeholder={modelo.tipo === 'vsl' ? 'Título da VSL' : 'Título do card'} />
            </Campo>
          )}
          <PreviaNomes nomes={nomes} />
        </div>
      )}
    </Modal>
  )
}
