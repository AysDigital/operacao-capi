import { useState } from 'react'
import { Aviso, Dica } from '../../components/ds'
import { nomeDe, type Inventario } from '../../lib/ativos'
import { atrasado, diaAtual, diaDoQuadro, diasEntre, NOME_TIPO, progresso, TIPOS_AQUECIVEIS, type Aquecimento, type TipoAquecivel } from '../../lib/contingencia'
import { diaBrasilia, formatarDiaIso } from '../../lib/format'

/** Quantos dias a coluna "Pronto" mostra os que acabaram de ficar prontos. */
const DIAS_NO_PRONTO = 14

/**
 * Quadro de aquecimento: uma coluna por dia (Dia 1, Dia 2, …) e "Pronto".
 * O card fica no primeiro dia que ainda tem tarefa por marcar; com tudo marcado, vai para Pronto.
 */
export function QuadroAquecimentos({
  inv,
  aquecimentos,
  aClassificar,
  onAbrir,
  onClassificar,
}: {
  inv: Inventario
  aquecimentos: Aquecimento[]
  aClassificar: number
  onAbrir: (a: Aquecimento) => void
  onClassificar: () => void
}) {
  const [filtro, setFiltro] = useState<TipoAquecivel | ''>('')
  const hoje = diaBrasilia()
  const doFiltro = aquecimentos.filter((a) => !filtro || a.ativo_tipo === filtro)
  const andamento = doFiltro.filter((a) => a.status === 'andamento')
  const prontosRecentes = doFiltro.filter((a) => a.status === 'concluido' && a.fim && diasEntre(a.fim, hoje) <= DIAS_NO_PRONTO)
  const maxDias = Math.max(1, ...andamento.map((a) => a.duracao_dias))
  const dias = Array.from({ length: maxDias }, (_, i) => i + 1)
  const atrasados = andamento.filter(atrasado).length

  return (
    <div className="space-y-3">
      {aClassificar > 0 && (
        <Aviso
          tom="atencao"
          acao={
            <button onClick={onClassificar} className="shrink-0 text-sm font-medium underline-offset-2 hover:underline">
              Classificar agora
            </button>
          }
        >
          {aClassificar} ativo(s) ainda sem classificação: diga se já estão prontos ou se precisam aquecer.
        </Aviso>
      )}

      <div className="flex flex-wrap items-center gap-1.5">
        {(['', ...TIPOS_AQUECIVEIS] as const).map((t) => (
          <button
            key={t || 'todos'}
            onClick={() => setFiltro(t)}
            className={`rounded-full px-3 py-1 text-xs ${filtro === t ? 'bg-ink text-page' : 'bg-surface-2 text-muted hover:text-ink'}`}
          >
            {t ? NOME_TIPO[t].varios : 'Todos'}
          </button>
        ))}
        <span className="ml-auto text-xs text-muted">
          {andamento.length} aquecendo
          {atrasados > 0 && <span className="font-semibold text-bad"> · {atrasados} atrasado(s)</span>}
        </span>
      </div>

      <div className="flex gap-3 overflow-x-auto pb-3">
        {dias.map((d) => (
          <Coluna key={d} titulo={`Dia ${d}`} cards={andamento.filter((a) => diaDoQuadro(a) === d)} inv={inv} onAbrir={onAbrir} />
        ))}
        <Coluna
          titulo="Pronto"
          dica={`Checklist completo: o ativo está pronto para uso. Aparecem aqui os que ficaram prontos nos últimos ${DIAS_NO_PRONTO} dias.`}
          pronto
          cards={prontosRecentes}
          inv={inv}
          onAbrir={onAbrir}
        />
      </div>
    </div>
  )
}

function Coluna({
  titulo,
  dica,
  pronto,
  cards,
  inv,
  onAbrir,
}: {
  titulo: string
  dica?: string
  pronto?: boolean
  cards: Aquecimento[]
  inv: Inventario
  onAbrir: (a: Aquecimento) => void
}) {
  return (
    <section aria-label={titulo} className="flex w-64 shrink-0 flex-col rounded-card border border-line bg-surface-2 p-2">
      <header className="flex items-center gap-2 px-1 pb-2">
        {pronto && <span aria-hidden className="text-good">✓</span>}
        <h2 className="flex-1 text-sm font-semibold">{dica ? <Dica conteudo={dica}>{titulo}</Dica> : titulo}</h2>
        <span className="text-xs text-muted tabular-nums">{cards.length}</span>
      </header>
      <div className="flex min-h-24 flex-col gap-1.5">
        {cards.map((a) => (
          <Cartao key={a.id} a={a} inv={inv} onAbrir={() => onAbrir(a)} />
        ))}
      </div>
    </section>
  )
}

function Cartao({ a, inv, onAbrir }: { a: Aquecimento; inv: Inventario; onAbrir: () => void }) {
  const ativo = inv[a.ativo_tipo].find((r) => r.id === a.ativo_id)
  const p = progresso(a)
  const dia = diaDoQuadro(a)
  const doDia = a.tarefas.filter((t) => t.dia === dia)
  const atras = atrasado(a)
  return (
    <button
      onClick={onAbrir}
      className={`rounded-control border bg-surface p-2.5 text-left text-sm shadow-sm hover:border-muted ${atras ? 'border-bad/60' : 'border-line'}`}
    >
      <span className="flex items-baseline gap-2">
        <span className="text-xs text-muted">{NOME_TIPO[a.ativo_tipo].um}</span>
        {a.status === 'andamento' ? (
          <span className={`ml-auto text-xs tabular-nums ${atras ? 'font-semibold text-bad' : 'text-muted'}`}>
            {atras ? `! atrasado · hoje é D${Math.min(diaAtual(a), a.duracao_dias)}` : `desde ${formatarDiaIso(a.inicio)}`}
          </span>
        ) : (
          <span className="ml-auto text-xs text-good">✓ {formatarDiaIso(a.fim)}</span>
        )}
      </span>
      <span className="mt-0.5 block font-medium break-words">{nomeDe(a.ativo_tipo, ativo)}</span>
      {a.status === 'andamento' && doDia.length > 0 && (
        <span className="mt-1 block text-xs text-muted">
          D{dia}: {doDia.filter((t) => t.feito).length} de {doDia.length} tarefas feitas
        </span>
      )}
      <span className="mt-2 flex items-center gap-2">
        <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-2">
          <span className={`block h-full rounded-full ${a.status === 'concluido' ? 'bg-good' : 'bg-accent'}`} style={{ width: `${p.pct}%` }} />
        </span>
        <span className="text-xs text-muted tabular-nums">
          {p.feitas}/{p.total}
        </span>
      </span>
    </button>
  )
}
