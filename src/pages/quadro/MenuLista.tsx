import { useEffect, useRef, useState } from 'react'
import { ORDENACOES, type Lista } from '../../lib/quadro'
import { ExcluirLista } from './card/Exclusoes'

export type AcaoLista =
  | { tipo: 'ordenar'; indice: number }
  | { tipo: 'mover'; para: string }
  | { tipo: 'arquivar_cards' }
  | { tipo: 'arquivar_lista' }
  /** a lista já foi excluída (pelo próprio menu): só recarregar */
  | { tipo: 'lista_excluida' }

type Tela = 'inicio' | 'ordenar' | 'mover' | 'arquivar_cards' | 'arquivar_lista' | 'excluir'

const item = 'block w-full rounded-md px-3 py-1.5 text-left text-sm hover:bg-surface-2 disabled:opacity-40 disabled:hover:bg-transparent'

/** Botão "⋯" no cabeçalho da lista. O menu é posicionado na tela (não é cortado pela rolagem do quadro). */
export function MenuLista({
  lista,
  listas,
  qtdCards,
  onAcao,
}: {
  lista: Lista
  /** listas ativas (destinos do "mover") */
  listas: Lista[]
  qtdCards: number
  onAcao: (listaId: string, acao: AcaoLista) => void
}) {
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)
  const [tela, setTela] = useState<Tela>('inicio')
  const botao = useRef<HTMLButtonElement>(null)
  const caixa = useRef<HTMLDivElement>(null)

  const fechar = () => {
    setPos(null)
    setTela('inicio')
  }

  useEffect(() => {
    if (!pos) return
    const fora = (e: PointerEvent) =>
      !caixa.current?.contains(e.target as Node) && !botao.current?.contains(e.target as Node) && fechar()
    const tecla = (e: KeyboardEvent) => e.key === 'Escape' && fechar()
    document.addEventListener('pointerdown', fora)
    document.addEventListener('keydown', tecla)
    window.addEventListener('resize', fechar)
    return () => {
      document.removeEventListener('pointerdown', fora)
      document.removeEventListener('keydown', tecla)
      window.removeEventListener('resize', fechar)
    }
  }, [pos])

  function abrir() {
    if (pos) return fechar()
    const r = botao.current!.getBoundingClientRect()
    setPos({ top: r.bottom + 4, left: Math.max(8, Math.min(r.right - 256, window.innerWidth - 264)) })
  }

  function fazer(acao: AcaoLista) {
    fechar()
    onAcao(lista.id, acao)
  }

  const semCards = qtdCards === 0
  const voltar = (
    <button onClick={() => setTela('inicio')} className="mb-1 px-3 py-1 text-xs text-muted hover:text-ink">
      ← Voltar
    </button>
  )

  return (
    <>
      <button
        ref={botao}
        onClick={abrir}
        aria-label={`Ações da lista ${lista.nome}`}
        aria-expanded={Boolean(pos)}
        title="Ações da lista"
        className="rounded p-0.5 text-muted hover:bg-line/60 hover:text-ink"
      >
        <svg viewBox="0 0 16 16" aria-hidden className="h-3.5 w-3.5" fill="currentColor">
          <circle cx="3.5" cy="8" r="1.3" />
          <circle cx="8" cy="8" r="1.3" />
          <circle cx="12.5" cy="8" r="1.3" />
        </svg>
      </button>

      {pos && (
        <div
          ref={caixa}
          role="menu"
          style={{ top: pos.top, left: pos.left }}
          className="fixed z-40 w-64 rounded-card border border-line bg-surface p-1.5 shadow-lg"
        >
          <p className="truncate px-3 pt-1 pb-2 text-xs font-medium text-muted">{lista.nome}</p>

          {tela === 'inicio' && (
            <>
              <button className={item} disabled={qtdCards < 2} onClick={() => setTela('ordenar')}>
                Ordenar por…
              </button>
              <button className={item} disabled={semCards} onClick={() => setTela('mover')}>
                Mover todos os cards…
              </button>
              <div className="my-1 border-t border-line" />
              <button className={item} disabled={semCards} onClick={() => setTela('arquivar_cards')}>
                Arquivar todos os cards…
              </button>
              <button className={item} onClick={() => setTela('arquivar_lista')}>
                Arquivar esta lista…
              </button>
              <button className={`${item} text-bad`} onClick={() => setTela('excluir')}>
                Excluir lista…
              </button>
            </>
          )}

          {tela === 'ordenar' && (
            <>
              {voltar}
              {ORDENACOES.map((o, i) => (
                <button key={o.nome} className={item} onClick={() => fazer({ tipo: 'ordenar', indice: i })}>
                  {o.nome}
                </button>
              ))}
            </>
          )}

          {tela === 'mover' && (
            <>
              {voltar}
              <p className="px-3 pb-1 text-xs text-muted">
                Mover {qtdCards} {qtdCards === 1 ? 'card' : 'cards'} para:
              </p>
              <div className="max-h-72 overflow-y-auto">
                {listas
                  .filter((l) => l.id !== lista.id)
                  .map((l) => (
                    <button key={l.id} className={`${item} flex items-center gap-2`} onClick={() => fazer({ tipo: 'mover', para: l.id })}>
                      <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: l.cor ?? undefined }} />
                      {l.nome}
                    </button>
                  ))}
              </div>
            </>
          )}

          {tela === 'arquivar_cards' && (
            <div className="px-3 pb-2">
              <p className="text-sm">
                Arquivar {qtdCards} {qtdCards === 1 ? 'card' : 'cards'} desta lista? Eles saem do quadro e podem ser restaurados em "Arquivados".
              </p>
              <div className="mt-2 flex gap-2">
                <button onClick={() => fazer({ tipo: 'arquivar_cards' })} className="rounded-control bg-accent px-3 py-1.5 text-sm font-medium text-accent-ink">
                  Arquivar
                </button>
                <button onClick={() => setTela('inicio')} className="px-2 text-sm text-muted hover:text-ink">
                  Cancelar
                </button>
              </div>
            </div>
          )}

          {tela === 'excluir' && (
            <div className="px-3 pb-2">
              <ExcluirLista lista={lista} destinos={listas} onExcluida={() => fazer({ tipo: 'lista_excluida' })} onCancelar={() => setTela('inicio')} />
            </div>
          )}

          {tela === 'arquivar_lista' && (
            <div className="px-3 pb-2">
              <p className="text-sm">
                Arquivar a lista {lista.nome}? Ela some de <strong>todos os quadros</strong>, junto com os cards dela, e pode ser restaurada em
                "Arquivados".
              </p>
              <div className="mt-2 flex gap-2">
                <button onClick={() => fazer({ tipo: 'arquivar_lista' })} className="rounded-control bg-accent px-3 py-1.5 text-sm font-medium text-accent-ink">
                  Arquivar lista
                </button>
                <button onClick={() => setTela('inicio')} className="px-2 text-sm text-muted hover:text-ink">
                  Cancelar
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </>
  )
}
