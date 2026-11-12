import { Link } from 'react-router'
import { Popover } from '../../components/ds'
import { useToast } from '../../components/Toast'
import { mensagemErro } from '../../lib/cadastros'
import { mandarParaNoBid } from '../../lib/fases'
import type { ContaQuadro } from '../../lib/quadro'

/**
 * "Mandar para No-Bid": cria a veiculação do card numa conta secundária (sem limite de lance),
 * como "Não subido". A veiculação original não muda.
 */
export function MandarNoBid({
  cardId,
  contas,
  jaEm,
  onFeito,
  classe = 'rounded-md px-2 py-1 text-xs font-medium text-roxo hover:bg-roxo-soft',
}: {
  cardId: string
  contas: ContaQuadro[]
  /** contas onde o card já está */
  jaEm: string[]
  onFeito: () => void
  classe?: string
}) {
  const toast = useToast()
  const nobid = contas
    .filter((c) => c.ativa && c.papel === 'secundaria_nobid')
    .sort((a, b) => a.apelido.localeCompare(b.apelido, 'pt-BR', { numeric: true }))

  async function mandar(c: ContaQuadro) {
    const error = await mandarParaNoBid(cardId, c.id)
    if (error) return toast('ruim', mensagemErro(error))
    toast('bom', `Mandado para ${c.apelido} (No-Bid) como "Não subido".`)
    onFeito()
  }

  return (
    <Popover
      titulo="Mandar para No-Bid"
      largura="w-72"
      gatilho={(alternar) => (
        <button onClick={alternar} className={classe}>
          ↗ Mandar para No-Bid
        </button>
      )}
    >
      {(fechar) =>
        nobid.length === 0 ? (
          <p className="text-sm text-muted">
            Nenhuma conta marcada como "Secundária No-Bid". Marque uma em{' '}
            <Link to="/ativos?aba=contas" className="font-medium text-accent-strong underline" onClick={fechar}>
              Ativos → Contas
            </Link>
            .
          </p>
        ) : (
          <div className="space-y-0.5">
            {nobid.map((c) => {
              const ja = jaEm.includes(c.id)
              return (
                <button
                  key={c.id}
                  disabled={ja}
                  onClick={() => {
                    fechar()
                    mandar(c)
                  }}
                  className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-surface-2 disabled:opacity-50"
                >
                  <span className="rounded bg-info-soft px-1.5 font-mono text-xs font-semibold text-info">{c.apelido}</span>
                  <span className="truncate">{c.nome}</span>
                  {ja && <span className="ml-auto text-xs text-muted">já está</span>}
                </button>
              )
            })}
          </div>
        )
      }
    </Popover>
  )
}
