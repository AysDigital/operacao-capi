import { useEffect, useState } from 'react'
import { Aviso, Carregando, PainelLateral, PilulaCor, Secao, Vazio } from '../../components/ds'
import { useToast } from '../../components/Toast'
import { mensagemErro } from '../../lib/cadastros'
import { formatarData } from '../../lib/format'
import type { Lista, OfertaQuadro } from '../../lib/quadro'
import { ops } from '../../lib/supabase'

type CardArquivado = { id: string; nome: string; lista_id: string; oferta_id: string; atualizado_em: string }

/** Listas e cards arquivados (do quadro atual), com "Restaurar". */
export function PainelArquivados({
  ofertaId,
  listas,
  ofertas,
  onFechar,
  onListasMudaram,
  onCardsMudaram,
}: {
  ofertaId: string | null
  listas: Lista[]
  ofertas: OfertaQuadro[]
  onFechar: () => void
  onListasMudaram: () => void
  onCardsMudaram: () => void
}) {
  const toast = useToast()
  const [cards, setCards] = useState<CardArquivado[] | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [mexendo, setMexendo] = useState<string | null>(null)

  useEffect(() => {
    let q = ops()
      .from('cards')
      .select('id, nome, lista_id, oferta_id, atualizado_em')
      .eq('arquivado', true)
      .order('atualizado_em', { ascending: false })
    if (ofertaId) q = q.eq('oferta_id', ofertaId)
    q.then(({ data, error }) => (error ? setErro(error.message) : setCards(data)))
  }, [ofertaId])

  const porLista = new Map(listas.map((l) => [l.id, l]))
  const porOferta = new Map(ofertas.map((o) => [o.id, o]))
  const listasArquivadas = listas.filter((l) => l.arquivada)

  async function restaurarLista(l: Lista) {
    setMexendo(l.id)
    const { error } = await ops().from('listas').update({ arquivada: false }).eq('id', l.id)
    setMexendo(null)
    if (error) return toast('ruim', mensagemErro(error))
    toast('bom', `Lista ${l.nome} restaurada.`)
    onListasMudaram()
  }

  async function restaurarCard(c: CardArquivado) {
    setMexendo(c.id)
    const { error } = await ops().from('cards').update({ arquivado: false }).eq('id', c.id)
    setMexendo(null)
    if (error) return toast('ruim', mensagemErro(error))
    toast('bom', `${c.nome} restaurado.`)
    setCards((cs) => cs?.filter((x) => x.id !== c.id) ?? null)
    onCardsMudaram()
  }

  const botao = 'shrink-0 rounded-control border border-line px-2.5 py-1 text-xs hover:bg-surface-2 disabled:opacity-50'

  return (
    <PainelLateral titulo="Arquivados" onFechar={onFechar}>
      <div className="space-y-8">
        <Secao titulo="Listas" ajuda="As listas são as mesmas em todos os quadros. Restaurar traz a lista de volta, com os cards dela.">
          {listasArquivadas.length === 0 ? (
            <Vazio titulo="Nenhuma lista arquivada" />
          ) : (
            <ul className="divide-y divide-line rounded-card border border-line">
              {listasArquivadas.map((l) => (
                <li key={l.id} className="flex items-center gap-2 px-3 py-2 text-sm">
                  <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: l.cor ?? undefined }} />
                  <span className="flex-1">{l.nome}</span>
                  <button onClick={() => restaurarLista(l)} disabled={mexendo === l.id} className={botao}>
                    Restaurar
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Secao>

        <Secao titulo={ofertaId ? 'Cards desta oferta' : 'Cards'}>
          {erro && <Aviso tom="ruim">Não foi possível carregar os cards arquivados: {erro}</Aviso>}
          {!cards && !erro && <Carregando linhas={3} />}
          {cards?.length === 0 && <Vazio titulo="Nenhum card arquivado" />}
          {cards && cards.length > 0 && (
            <ul className="divide-y divide-line rounded-card border border-line">
              {cards.map((c) => {
                const l = porLista.get(c.lista_id)
                const o = porOferta.get(c.oferta_id)
                return (
                  <li key={c.id} className="flex items-center gap-2 px-3 py-2 text-sm">
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{c.nome}</p>
                      <p className="flex flex-wrap items-center gap-1.5 text-xs text-muted">
                        {!ofertaId && o && <PilulaCor pequena texto={o.codigo} cor={o.cor} />}
                        <span>
                          {l?.nome}
                          {l?.arquivada && ' (lista arquivada)'} · arquivado em {formatarData(c.atualizado_em)}
                        </span>
                      </p>
                    </div>
                    <button onClick={() => restaurarCard(c)} disabled={mexendo === c.id} className={botao}>
                      Restaurar
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </Secao>
      </div>
    </PainelLateral>
  )
}
