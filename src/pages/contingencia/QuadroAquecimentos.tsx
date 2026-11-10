import { nomeDe, type Inventario } from '../../lib/ativos'
import { diaAtual, NOME_TIPO, progresso, STATUS_AQUECIMENTO, type Aquecimento } from '../../lib/contingencia'
import { formatarDiaIso } from '../../lib/format'

/** Quadro Em andamento | Concluído | Interrompido. Clicar abre o aquecimento completo. */
export function QuadroAquecimentos({ inv, aquecimentos, onAbrir }: { inv: Inventario; aquecimentos: Aquecimento[]; onAbrir: (a: Aquecimento) => void }) {
  return (
    <div className="grid gap-3 md:grid-cols-3">
      {STATUS_AQUECIMENTO.map((s) => {
        const daColuna = aquecimentos.filter((a) => a.status === s.valor)
        return (
          <section key={s.valor} aria-label={s.nome} className="flex min-h-48 flex-col rounded-card border border-line bg-surface-2 p-2">
            <header className="flex items-center gap-2 px-1 pb-2">
              <span aria-hidden>{s.icone}</span>
              <h2 className="flex-1 text-sm font-semibold">{s.nome}</h2>
              <span className="text-xs text-muted tabular-nums">{daColuna.length}</span>
            </header>
            <div className="flex flex-col gap-1.5">
              {daColuna.map((a) => {
                const p = progresso(a)
                const ativo = inv[a.ativo_tipo].find((r) => r.id === a.ativo_id)
                return (
                  <button
                    key={a.id}
                    onClick={() => onAbrir(a)}
                    className="rounded-control border border-line bg-surface p-2.5 text-left text-sm shadow-sm hover:border-muted"
                  >
                    <span className="flex items-baseline gap-2">
                      <span className="text-xs text-muted">{NOME_TIPO[a.ativo_tipo].um}</span>
                      <span className="ml-auto text-xs font-semibold tabular-nums">
                        {a.status === 'andamento' ? `D${diaAtual(a)} de ${a.duracao_dias}` : formatarDiaIso(a.fim)}
                      </span>
                    </span>
                    <span className="mt-0.5 block font-medium break-words">{nomeDe(a.ativo_tipo, ativo)}</span>
                    <span className="block text-xs text-muted">{a.rotina_nome}</span>
                    <span className="mt-2 flex items-center gap-2">
                      <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-2">
                        <span className="block h-full rounded-full bg-accent" style={{ width: `${p.pct}%` }} />
                      </span>
                      <span className="text-xs text-muted tabular-nums">
                        {p.feitas}/{p.total}
                      </span>
                    </span>
                    {a.motivo && <span className="mt-1 block text-xs text-bad">{a.motivo}</span>}
                  </button>
                )
              })}
            </div>
          </section>
        )
      })}
    </div>
  )
}
