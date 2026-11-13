import { useState } from 'react'
import { Aviso, Dica } from '../../components/ds'
import { caido, nomeDe, type Inventario, type Registro } from '../../lib/ativos'
import { atrasado, diaAtual, diaDoQuadro, NOME_TIPO, progresso, situacaoDe, TIPOS_AQUECIVEIS, type Aquecimento, type TipoAquecivel } from '../../lib/contingencia'
import { useArrastarRolagem } from '../../lib/arrastarRolagem'
import { formatarDiaIso } from '../../lib/format'

/** Ativo pronto sem aquecimento concluído no app (classificado como pronto). */
type ProntoSemCard = { tipo: TipoAquecivel; r: Registro }

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
  const trilho = useArrastarRolagem<HTMLDivElement>()
  const doFiltro = aquecimentos.filter((a) => !filtro || a.ativo_tipo === filtro)
  const andamento = doFiltro.filter((a) => a.status === 'andamento')

  // Pronto: todo ativo pronto e não caído. Quem passou pelo aquecimento abre o checklist (o mais recente);
  // quem foi classificado como pronto aparece num cartão simples.
  const prontosComCard: Aquecimento[] = []
  const prontosSemCard: ProntoSemCard[] = []
  for (const tipo of TIPOS_AQUECIVEIS) {
    if (filtro && filtro !== tipo) continue
    for (const r of inv[tipo]) {
      if (situacaoDe(r) !== 'pronto' || caido(tipo, r.status as string)) continue
      const ultimo = aquecimentos
        .filter((a) => a.ativo_tipo === tipo && a.ativo_id === r.id && a.status === 'concluido')
        .sort((a, b) => String(b.fim).localeCompare(String(a.fim)))[0]
      if (ultimo) prontosComCard.push(ultimo)
      else prontosSemCard.push({ tipo, r })
    }
  }
  prontosComCard.sort((a, b) => String(b.fim).localeCompare(String(a.fim)))
  prontosSemCard.sort((a, b) => a.tipo.localeCompare(b.tipo) || nomeDe(a.tipo, a.r).localeCompare(nomeDe(b.tipo, b.r), 'pt-BR', { numeric: true }))
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

      <div {...trilho} className="flex cursor-grab gap-3 overflow-x-auto pb-3">
        {dias.map((d) => (
          <Coluna key={d} titulo={`Dia ${d}`} cards={andamento.filter((a) => diaDoQuadro(a) === d)} inv={inv} onAbrir={onAbrir} />
        ))}
        <Coluna
          titulo="Pronto"
          dica="Ativos prontos para uso (não caídos): os que completaram o checklist e os que você classificou como prontos."
          pronto
          cards={prontosComCard}
          semCard={prontosSemCard}
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
  semCard = [],
  inv,
  onAbrir,
}: {
  titulo: string
  dica?: string
  pronto?: boolean
  cards: Aquecimento[]
  semCard?: ProntoSemCard[]
  inv: Inventario
  onAbrir: (a: Aquecimento) => void
}) {
  return (
    <section aria-label={titulo} className="flex w-64 shrink-0 flex-col rounded-card border border-line bg-surface-2 p-2">
      <header className="flex items-center gap-2 px-1 pb-2">
        {pronto && <span aria-hidden className="text-good">✓</span>}
        <h2 className="flex-1 text-sm font-semibold">{dica ? <Dica conteudo={dica}>{titulo}</Dica> : titulo}</h2>
        <span className="text-xs text-muted tabular-nums">{cards.length + semCard.length}</span>
      </header>
      <div className="flex min-h-24 flex-col gap-1.5">
        {cards.map((a) => (
          <Cartao key={a.id} a={a} inv={inv} onAbrir={() => onAbrir(a)} />
        ))}
        {semCard.map(({ tipo, r }) => (
          <div key={`${tipo}:${r.id}`} className="rounded-control border border-line bg-surface p-2.5 text-sm shadow-sm">
            <span className="flex items-baseline gap-2">
              <span className="text-xs text-muted">{NOME_TIPO[tipo].um}</span>
              <span className="ml-auto text-xs text-good">✓ classificado</span>
            </span>
            <span className="mt-0.5 block font-medium break-words">{nomeDe(tipo, r)}</span>
          </div>
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
