import { Vazio } from '../../components/ds'
import { nomeDe, type Inventario } from '../../lib/ativos'
import { diaAtual, NOME_TIPO, ordenarTarefas, progresso, TIPOS_AQUECIVEIS, type Aquecimento, type TarefaAquecimento } from '../../lib/contingencia'
import { LinhaTarefa } from './ModalAquecimento'

/**
 * Tela inicial da Contingência: cada ativo em aquecimento, em que dia está,
 * as tarefas de hoje para marcar e, em vermelho, as atrasadas de dias anteriores.
 */
export function Hoje({
  inv,
  aquecimentos,
  onAbrir,
  onTarefa,
}: {
  inv: Inventario
  aquecimentos: Aquecimento[]
  onAbrir: (a: Aquecimento) => void
  onTarefa: (t: TarefaAquecimento) => void
}) {
  const andamento = aquecimentos.filter((a) => a.status === 'andamento')
  if (!andamento.length) return <Vazio titulo="Nenhum ativo em aquecimento agora" />

  return (
    <div className="space-y-8">
      {TIPOS_AQUECIVEIS.map((tipo) => {
        const doTipo = andamento.filter((a) => a.ativo_tipo === tipo)
        if (!doTipo.length) return null
        return (
          <section key={tipo}>
            <h2 className="mb-3 text-sm font-semibold">
              {NOME_TIPO[tipo].varios} <span className="ml-1 font-normal text-muted tabular-nums">{doTipo.length}</span>
            </h2>
            <div className="grid gap-3 md:grid-cols-2">
              {doTipo.map((a) => {
                const dia = diaAtual(a)
                const ts = ordenarTarefas(a.tarefas)
                const hoje = ts.filter((t) => t.dia === dia)
                const atrasadas = ts.filter((t) => t.dia < dia && !t.feito)
                const p = progresso(a)
                const ativo = inv[a.ativo_tipo].find((r) => r.id === a.ativo_id)
                return (
                  <article key={a.id} className="rounded-card border border-line bg-surface p-4">
                    <header className="mb-2 flex flex-wrap items-baseline gap-x-2">
                      <button onClick={() => onAbrir(a)} className="text-left font-medium hover:text-accent-strong hover:underline">
                        {nomeDe(a.ativo_tipo, ativo)}
                      </button>
                      <span className="text-xs text-muted">{a.rotina_nome}</span>
                      <span className={`ml-auto text-sm font-semibold tabular-nums ${dia > a.duracao_dias ? 'text-bad' : ''}`}>
                        {dia === 0 ? 'começa em breve' : `D${dia} de ${a.duracao_dias}`}
                      </span>
                    </header>
                    <div className="mb-3 h-1.5 overflow-hidden rounded-full bg-surface-2" aria-label={`${p.pct}% das tarefas feitas`}>
                      <div className="h-full rounded-full bg-accent" style={{ width: `${p.pct}%` }} />
                    </div>
                    {dia > a.duracao_dias && <p className="mb-2 text-xs text-bad">Passou da duração da rotina: conclua ou interrompa.</p>}
                    {atrasadas.length > 0 && (
                      <ul className="mb-2 space-y-0.5">
                        {atrasadas.map((t) => (
                          <LinhaTarefa key={t.id} t={t} atrasada onMudou={onTarefa} />
                        ))}
                      </ul>
                    )}
                    {hoje.length > 0 ? (
                      <ul className="space-y-0.5">
                        {hoje.map((t) => (
                          <LinhaTarefa key={t.id} t={t} onMudou={onTarefa} />
                        ))}
                      </ul>
                    ) : (
                      !atrasadas.length && <p className="text-sm text-muted">Nada para hoje.</p>
                    )}
                  </article>
                )
              })}
            </div>
          </section>
        )
      })}
    </div>
  )
}
