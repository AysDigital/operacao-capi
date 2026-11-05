import { useEffect, useMemo, useRef, useState } from 'react'
import { formatarDia } from '../../lib/format'

export type Serie = { nome: string; cor: string; valores: (number | null)[] }

const ALTURA = 200
const MARGEM = { topo: 12, direita: 12, baixo: 24, esquerda: 56 }

/** Escala "bonita": 4 a 5 divisões com números redondos. */
function marcas(max: number): number[] {
  if (max <= 0) return [0]
  const bruto = max / 4
  const potencia = 10 ** Math.floor(Math.log10(bruto))
  const passo = [1, 2, 2.5, 5, 10].map((m) => m * potencia).find((p) => p >= bruto) ?? bruto
  const r: number[] = []
  for (let v = 0; v <= max + passo * 0.001; v += passo) r.push(v)
  if (r[r.length - 1] < max) r.push(r[r.length - 1] + passo)
  return r
}

/**
 * Gráfico de linhas com um eixo só. Passe o mouse (ou o dedo) para ver os valores do dia.
 * `referencia`: linha tracejada horizontal (ex.: ROAS mínimo da oferta).
 */
export function GraficoLinhas({
  titulo,
  dias,
  series,
  formatar,
  referencia,
}: {
  titulo: string
  dias: string[]
  series: Serie[]
  formatar: (v: number) => string
  referencia?: { valor: number; nome: string } | null
}) {
  const caixa = useRef<HTMLDivElement>(null)
  const [largura, setLargura] = useState(640)
  const [foco, setFoco] = useState<number | null>(null)

  // acompanha a largura da caixa
  useEffect(() => {
    if (!caixa.current) return
    const obs = new ResizeObserver(([e]) => setLargura(Math.max(260, Math.round(e.contentRect.width))))
    obs.observe(caixa.current)
    return () => obs.disconnect()
  }, [dias.length > 0])

  const max = useMemo(
    () => Math.max(referencia?.valor ?? 0, ...series.flatMap((s) => s.valores.filter((v): v is number => v !== null))),
    [series, referencia],
  )
  const ticks = marcas(max)
  const topo = ticks[ticks.length - 1] || 1
  const w = largura - MARGEM.esquerda - MARGEM.direita
  const h = ALTURA - MARGEM.topo - MARGEM.baixo
  const x = (i: number) => MARGEM.esquerda + (dias.length <= 1 ? w / 2 : (i / (dias.length - 1)) * w)
  const y = (v: number) => MARGEM.topo + h - (v / topo) * h

  const caminho = (valores: (number | null)[]) => {
    let d = ''
    let dentro = false
    valores.forEach((v, i) => {
      if (v === null) return (dentro = false)
      d += `${dentro ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`
      dentro = true
    })
    return d
  }

  // rótulos do eixo X: no máximo ~6
  const passoX = Math.max(1, Math.ceil(dias.length / 6))

  function mover(e: React.PointerEvent<SVGSVGElement>) {
    const r = e.currentTarget.getBoundingClientRect()
    const px = ((e.clientX - r.left) / r.width) * largura
    const i = Math.round(((px - MARGEM.esquerda) / w) * (dias.length - 1))
    setFoco(Math.min(dias.length - 1, Math.max(0, i)))
  }

  if (!dias.length) return <p className="text-sm text-muted">Sem dados no período.</p>

  const balaoEsquerda = foco !== null && x(foco) > largura / 2

  return (
    <figure className="min-w-0">
      <figcaption className="mb-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
        <span className="font-medium">{titulo}</span>
        {series.length > 1 &&
          series.map((s) => (
            <span key={s.nome} className="inline-flex items-center gap-1.5 text-xs text-muted">
              <span aria-hidden className="h-0.5 w-4 rounded-full" style={{ background: s.cor }} />
              {s.nome}
            </span>
          ))}
        {referencia && (
          <span className="inline-flex items-center gap-1.5 text-xs text-muted">
            <span aria-hidden className="w-4 border-t-2 border-dashed border-muted" />
            {referencia.nome}
          </span>
        )}
      </figcaption>
      <div ref={caixa} className="relative">
        <svg
          width="100%"
          viewBox={`0 0 ${largura} ${ALTURA}`}
          role="img"
          aria-label={titulo}
          className="block touch-none select-none"
          onPointerMove={mover}
          onPointerDown={mover}
          onPointerLeave={() => setFoco(null)}
        >
          {ticks.map((t) => (
            <g key={t}>
              <line x1={MARGEM.esquerda} x2={largura - MARGEM.direita} y1={y(t)} y2={y(t)} stroke="var(--c-line)" strokeWidth={1} />
              <text x={MARGEM.esquerda - 8} y={y(t)} dy="0.32em" textAnchor="end" fontSize={11} fill="var(--c-muted)" className="tabular-nums">
                {formatar(t)}
              </text>
            </g>
          ))}
          {dias.map((d, i) =>
            i % passoX === 0 || i === dias.length - 1 ? (
              <text key={d} x={x(i)} y={ALTURA - 6} textAnchor="middle" fontSize={11} fill="var(--c-muted)">
                {d.slice(8, 10)}/{d.slice(5, 7)}
              </text>
            ) : null,
          )}
          {referencia && (
            <line
              x1={MARGEM.esquerda}
              x2={largura - MARGEM.direita}
              y1={y(referencia.valor)}
              y2={y(referencia.valor)}
              stroke="var(--c-muted)"
              strokeWidth={1.5}
              strokeDasharray="5 4"
            />
          )}
          {foco !== null && <line x1={x(foco)} x2={x(foco)} y1={MARGEM.topo} y2={MARGEM.topo + h} stroke="var(--c-muted)" strokeWidth={1} />}
          {series.map((s) => (
            <path key={s.nome} d={caminho(s.valores)} fill="none" stroke={s.cor} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
          ))}
          {foco !== null &&
            series.map((s) =>
              s.valores[foco] !== null ? (
                <circle key={s.nome} cx={x(foco)} cy={y(s.valores[foco]!)} r={4} fill={s.cor} stroke="var(--c-surface)" strokeWidth={2} />
              ) : null,
            )}
        </svg>
        {foco !== null && (
          <div
            className="pointer-events-none absolute top-2 z-10 min-w-36 rounded-control border border-line bg-surface px-3 py-2 text-xs shadow-lg"
            style={balaoEsquerda ? { right: `${((largura - x(foco) + 10) / largura) * 100}%` } : { left: `${((x(foco) + 10) / largura) * 100}%` }}
          >
            <p className="mb-1 font-medium">{formatarDia(dias[foco])}</p>
            {series.map((s) => (
              <p key={s.nome} className="flex items-center justify-between gap-3">
                <span className="inline-flex items-center gap-1.5 text-muted">
                  <span aria-hidden className="h-2 w-2 rounded-full" style={{ background: s.cor }} />
                  {s.nome}
                </span>
                <span className="tabular-nums">{s.valores[foco] === null ? '—' : formatar(s.valores[foco]!)}</span>
              </p>
            ))}
          </div>
        )}
      </div>
    </figure>
  )
}
