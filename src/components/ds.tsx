/**
 * Componentes do padrão visual (etapa 18, identidade Capi). Usam os tokens de src/index.css.
 *
 * Regras de uso:
 *  - Explicações nunca ficam escritas embaixo de títulos: vão para a Dica (ícone ⓘ desenhado),
 *    que abre ao passar o mouse, ao focar com o teclado ou ao tocar no celular.
 *  - Cartões (Indicador): nome, valor e no máximo UMA informação. O resto vai para a Dica.
 *  - Status sempre com ícone e texto (Selo, Aviso), nunca só a cor.
 */
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { formatarCentavos, formatarCompacto } from '../lib/format'

export type Tom = 'neutro' | 'bom' | 'ruim' | 'atencao' | 'info' | 'destaque'

const TOM_TEXTO: Record<Tom, string> = {
  neutro: 'text-ink',
  bom: 'text-good',
  ruim: 'text-bad',
  atencao: 'text-warn',
  info: 'text-info',
  destaque: 'text-accent-strong',
}

const TOM_FUNDO: Record<Tom, string> = {
  neutro: 'bg-surface-2 text-muted',
  bom: 'bg-good-soft text-good',
  ruim: 'bg-bad-soft text-bad',
  atencao: 'bg-warn-soft text-warn',
  info: 'bg-info-soft text-info',
  destaque: 'bg-accent-soft text-accent-strong',
}

const ICONE: Record<Tom, string> = { neutro: '•', bom: '✓', ruim: '✕', atencao: '!', info: 'i', destaque: '→' }

/** Ícone de informação desenhado (não depende da fonte). */
export function IconeInfo({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" aria-hidden className={`inline-block h-3.5 w-3.5 ${className}`} fill="none">
      <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.3" />
      <circle cx="8" cy="5" r="0.9" fill="currentColor" />
      <path d="M8 7.3v4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  )
}

/**
 * Dica: mostra uma explicação num balão ao passar o mouse, focar ou tocar.
 * Sem `children`, vira só o ícone ⓘ. Com `children`, o próprio texto (ex.: um título)
 * também abre a dica, e o ícone aparece ao lado.
 */
export function Dica({
  conteudo,
  children,
  lado = 'centro',
}: {
  conteudo: ReactNode
  children?: ReactNode
  lado?: 'esquerda' | 'centro' | 'direita'
}) {
  const [aberta, setAberta] = useState(false)
  const ref = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    if (!aberta) return
    const fechar = (e: MouseEvent | TouchEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setAberta(false)
    }
    document.addEventListener('mousedown', fechar)
    document.addEventListener('touchstart', fechar)
    return () => {
      document.removeEventListener('mousedown', fechar)
      document.removeEventListener('touchstart', fechar)
    }
  }, [aberta])

  const posicao = { esquerda: 'left-0', centro: 'left-1/2 -translate-x-1/2', direita: 'right-0' }[lado]

  return (
    <span
      ref={ref}
      className="relative inline-flex items-center gap-1"
      onMouseEnter={() => setAberta(true)}
      onMouseLeave={() => setAberta(false)}
    >
      {children}
      <button
        type="button"
        aria-label="Mais informações"
        aria-expanded={aberta}
        onClick={() => setAberta((a) => !a)}
        onFocus={() => setAberta(true)}
        onBlur={() => setAberta(false)}
        className="inline-flex cursor-help items-center text-muted transition-colors hover:text-ink focus:text-ink focus:outline-none"
      >
        <IconeInfo />
      </button>
      {aberta && (
        <span
          role="tooltip"
          className={`absolute top-full z-40 mt-2 block w-72 max-w-[80vw] rounded-control bg-ink px-3 py-2.5 text-left text-xs leading-relaxed font-normal whitespace-normal text-page shadow-lg ${posicao}`}
        >
          {conteudo}
        </span>
      )}
    </span>
  )
}

/** Selo de status: sempre com texto; a cor só reforça o significado. */
export function Selo({ tom = 'neutro', children, ajuda }: { tom?: Tom; children: ReactNode; ajuda?: ReactNode }) {
  const selo = (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap ${TOM_FUNDO[tom]}`}>{children}</span>
  )
  return ajuda ? <Dica conteudo={ajuda}>{selo}</Dica> : selo
}

/** Faixa de aviso com ícone. Com `onFechar`, ganha um × para dispensar. */
export function Aviso({ tom = 'atencao', children, acao, onFechar }: { tom?: Tom; children: ReactNode; acao?: ReactNode; onFechar?: () => void }) {
  return (
    <div className={`flex items-start gap-2 rounded-card px-4 py-3 text-sm ${TOM_FUNDO[tom]}`}>
      <span aria-hidden className="font-semibold">
        {ICONE[tom]}
      </span>
      <div className="min-w-0 flex-1">{children}</div>
      {acao}
      {onFechar && (
        <button onClick={onFechar} aria-label="Dispensar aviso" title="Dispensar (volta se mudar)" className="-my-0.5 ml-1 shrink-0 rounded px-1 text-base leading-none opacity-60 hover:opacity-100">
          ×
        </button>
      )}
    </div>
  )
}

/**
 * Cartão de indicador: nome (com a dica), valor e UMA informação.
 * O valor aparece na forma curta ("R$ 53,3 mil"); o exato vai para a dica.
 */
export function Indicador({
  titulo,
  ajuda,
  centavos,
  valor,
  tom = 'neutro',
  info,
  anteriorCentavos,
  selo,
  grande,
}: {
  titulo: string
  ajuda?: ReactNode
  centavos?: number | null
  valor?: ReactNode
  tom?: Tom
  /** a única informação de apoio do cartão */
  info?: ReactNode
  /** se informado (e sem `info`), mostra a variação contra o mês anterior */
  anteriorCentavos?: number | null
  selo?: ReactNode
  grande?: boolean
}) {
  const exato = centavos != null && Math.abs(centavos) >= 100000 ? formatarCentavos(centavos) : undefined
  const variacao =
    centavos != null && anteriorCentavos != null && anteriorCentavos !== 0
      ? (centavos - anteriorCentavos) / Math.abs(anteriorCentavos)
      : null
  const conteudoDica =
    ajuda || exato ? (
      <>
        {exato && <span className="block font-medium">Valor exato: {exato}</span>}
        {ajuda && <span className={`block ${exato ? 'mt-1.5' : ''}`}>{ajuda}</span>}
      </>
    ) : null

  return (
    <div className="rounded-card border border-line bg-surface p-4 sm:p-5">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm text-muted">
          {conteudoDica ? (
            <Dica conteudo={conteudoDica} lado="esquerda">
              {titulo}
            </Dica>
          ) : (
            titulo
          )}
        </p>
        {selo}
      </div>
      <p className={`mt-2 font-display font-semibold tabular-nums tracking-tight ${grande ? 'text-3xl' : 'text-2xl'} ${TOM_TEXTO[tom]}`}>
        {valor ?? (centavos != null ? formatarCompacto(centavos) : '—')}
      </p>
      {info ? (
        <p className="mt-1.5 text-sm text-muted">{info}</p>
      ) : (
        variacao != null && (
          <p className={`mt-1.5 text-sm ${variacao >= 0 ? 'text-good' : 'text-bad'}`}>
            {variacao >= 0 ? '▲' : '▼'} {Math.abs(variacao * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}% vs. mês anterior
          </p>
        )
      )}
    </div>
  )
}

/**
 * Seção: título (com a dica, se houver), ações à direita e, se `recolhida` for informado, abre e fecha.
 * Com `lembrar` (uma chave), o estado aberto/fechado fica guardado no navegador.
 */
export function Secao({
  titulo,
  ajuda,
  acoes,
  recolhida,
  lembrar,
  children,
}: {
  titulo: string
  ajuda?: ReactNode
  acoes?: ReactNode
  recolhida?: boolean
  lembrar?: string
  children: ReactNode
}) {
  const [aberta, setAbertaEstado] = useState(() => {
    if (lembrar) {
      try {
        const v = localStorage.getItem(`secao_${lembrar}`)
        if (v === '1' || v === '0') return v === '1'
      } catch {
        // sem armazenamento local
      }
    }
    return recolhida === undefined ? true : !recolhida
  })
  const setAberta = (f: (a: boolean) => boolean) =>
    setAbertaEstado((a) => {
      const novo = f(a)
      if (lembrar) {
        try {
          localStorage.setItem(`secao_${lembrar}`, novo ? '1' : '0')
        } catch {
          // ignora
        }
      }
      return novo
    })
  const podeRecolher = recolhida !== undefined
  const nome = podeRecolher ? (
    <button onClick={() => setAberta((a) => !a)} className="flex items-center gap-2 text-left hover:text-accent-strong" aria-expanded={aberta}>
      <span className="inline-block w-3 text-muted">{aberta ? '▾' : '▸'}</span>
      {titulo}
    </button>
  ) : (
    titulo
  )
  return (
    <section>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-base font-semibold">{ajuda ? <Dica conteudo={ajuda} lado="esquerda">{nome}</Dica> : nome}</h2>
        {acoes && aberta && <div className="flex flex-wrap items-center gap-2">{acoes}</div>}
      </div>
      {aberta && children}
    </section>
  )
}

/** Caixa padrão das tabelas: borda, fundo, rolagem horizontal no celular. */
export function CaixaTabela({ children }: { children: ReactNode }) {
  return <div className="overflow-x-auto rounded-card border border-line bg-surface">{children}</div>
}

/** Classes padrão das tabelas (cabeçalho, linhas com respiro, subtotal, 1ª coluna fixa). */
export const tabela = {
  table: 'w-full text-sm',
  thead: 'border-b border-line text-muted',
  th: 'px-3 py-3 font-medium whitespace-nowrap',
  tbody: 'divide-y divide-line',
  td: 'px-3 py-2.5',
  num: 'px-3 py-2.5 text-right whitespace-nowrap tabular-nums',
  subtotal: 'bg-surface-2 font-semibold',
  /** primeira coluna fixa ao rolar para o lado */
  fixa: 'sticky left-0 z-[1] bg-surface',
  fixaSubtotal: 'sticky left-0 z-[1] bg-surface-2',
}

/** Estado vazio. */
export function Vazio({ titulo, children }: { titulo: string; children?: ReactNode }) {
  return (
    <div className="rounded-card border border-dashed border-line px-4 py-8 text-center">
      <p className="text-sm font-medium">{titulo}</p>
      {children && <div className="mt-1 text-sm text-muted">{children}</div>}
    </div>
  )
}

/** Estado carregando: blocos no formato do conteúdo. */
export function Carregando({ linhas = 3, altura = 'h-5' }: { linhas?: number; altura?: string }) {
  return (
    <div className="space-y-2" aria-busy="true" aria-label="Carregando">
      {Array.from({ length: linhas }).map((_, i) => (
        <div key={i} className={`${altura} animate-pulse rounded-control bg-surface-2`} style={{ width: `${100 - i * 12}%` }} />
      ))}
    </div>
  )
}

/** Cartão vazio enquanto carrega (mesmo tamanho do Indicador). */
export function IndicadorCarregando({ titulo }: { titulo: string }) {
  return (
    <div className="rounded-card border border-line bg-surface p-4 sm:p-5">
      <p className="mb-3 text-sm text-muted">{titulo}</p>
      <Carregando linhas={2} altura="h-6" />
    </div>
  )
}

/** Painel lateral de detalhes (direita; tela cheia no celular). */
export function PainelLateral({ titulo, onFechar, children }: { titulo: string; onFechar: () => void; children: ReactNode }) {
  return (
    <div className="fixed inset-0 z-30 flex justify-end bg-black/30" onClick={onFechar}>
      <div className="h-full w-full max-w-2xl overflow-y-auto bg-surface p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-start justify-between gap-4">
          <h2 className="text-lg font-semibold">{titulo}</h2>
          <button onClick={onFechar} className="rounded-control border border-line px-3 py-1.5 text-sm hover:bg-surface-2">
            Fechar
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

/** Janelas abertas, da de baixo para a de cima: o Esc fecha só a de cima. */
const pilhaModais: object[] = []

/** Janela sobre a tela (formulários de criar/editar). Fecha no Esc, no × e clicando fora. */
export function Modal({
  titulo,
  cabecalho,
  onFechar,
  rodape,
  largura = 'max-w-lg',
  children,
}: {
  titulo: string
  /** substitui o título escrito (o `titulo` continua como nome acessível) */
  cabecalho?: ReactNode
  onFechar: () => void
  rodape?: ReactNode
  largura?: string
  children: ReactNode
}) {
  // Antes de fechar, tira o foco do campo em edição: os campos que salvam "ao sair" salvam.
  const fechar = useRef(onFechar)
  fechar.current = () => {
    ;(document.activeElement as HTMLElement | null)?.blur?.()
    onFechar()
  }

  useEffect(() => {
    const eu = {}
    pilhaModais.push(eu)
    const tecla = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || pilhaModais[pilhaModais.length - 1] !== eu) return
      const foco = document.activeElement as HTMLElement | null
      // Esc dentro de um campo só sai do campo (salvando); o segundo Esc fecha.
      if (foco && foco.matches('input, textarea, select, [contenteditable]')) return foco.blur()
      fechar.current()
    }
    document.addEventListener('keydown', tecla)
    return () => {
      document.removeEventListener('keydown', tecla)
      pilhaModais.splice(pilhaModais.indexOf(eu), 1)
    }
  }, [])

  return (
    <div className="fixed inset-0 z-30 flex items-end justify-center bg-black/30 sm:items-center sm:p-4" onMouseDown={() => fechar.current()}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={titulo}
        className={`flex max-h-[92vh] w-full ${largura} flex-col rounded-t-card bg-surface shadow-xl sm:rounded-card`}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-4 border-b border-line px-5 py-4">
          {cabecalho ?? <h2 className="text-lg font-semibold">{titulo}</h2>}
          <button onClick={() => fechar.current()} aria-label="Fechar" className="rounded-control px-2 py-1 text-lg leading-none text-muted hover:bg-surface-2 hover:text-ink">
            ×
          </button>
        </div>
        <div className="overflow-y-auto px-5 py-4">{children}</div>
        {rodape && <div className="flex flex-wrap items-center gap-2 border-t border-line px-5 py-3">{rodape}</div>}
      </div>
    </div>
  )
}

/** Interruptor liga/desliga, sempre com o texto do estado ao lado. */
export function Interruptor({
  ligado,
  onMudar,
  textoLigado,
  textoDesligado,
  desabilitado,
}: {
  ligado: boolean
  onMudar: (v: boolean) => void
  textoLigado: string
  textoDesligado: string
  desabilitado?: boolean
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={ligado}
      disabled={desabilitado}
      onClick={() => onMudar(!ligado)}
      className="inline-flex items-center gap-2 text-sm disabled:opacity-50"
    >
      <span className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${ligado ? 'bg-good' : 'bg-line'}`}>
        <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-surface shadow transition-all ${ligado ? 'left-[18px]' : 'left-0.5'}`} />
      </span>
      <span className={ligado ? 'text-ink' : 'text-muted'}>{ligado ? textoLigado : textoDesligado}</span>
    </button>
  )
}

/** Bolinha de cor (ofertas, etiquetas). */
export function BolinhaCor({ cor, tamanho = 'h-3.5 w-3.5' }: { cor: string | null; tamanho?: string }) {
  return <span aria-hidden className={`inline-block shrink-0 rounded-full border border-black/10 ${tamanho}`} style={{ background: cor ?? 'transparent' }} />
}

/** Paleta pronta para escolher uma cor. */
export function SeletorCor({ cores, valor, onMudar }: { cores: readonly { hex: string; nome: string }[]; valor: string | null; onMudar: (hex: string) => void }) {
  return (
    <div role="radiogroup" className="flex flex-wrap gap-2">
      {cores.map((c) => {
        const ativa = valor?.toLowerCase() === c.hex.toLowerCase()
        return (
          <button
            key={c.hex}
            type="button"
            role="radio"
            aria-checked={ativa}
            aria-label={c.nome}
            title={c.nome}
            onClick={() => onMudar(c.hex)}
            className={`h-8 w-8 rounded-full border border-black/10 transition ${ativa ? 'ring-2 ring-ink ring-offset-2 ring-offset-surface' : 'hover:scale-110'}`}
            style={{ background: c.hex }}
          />
        )
      })}
    </div>
  )
}

/** Pílula com fundo na cor informada; o texto fica escuro ou claro conforme o fundo. */
export function PilulaCor({ texto, cor, pequena, title }: { texto: ReactNode; cor: string | null; pequena?: boolean; title?: string }) {
  const hex = cor ?? '#7d786f'
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16))
  const clara = 0.299 * r + 0.587 * g + 0.114 * b > 160
  return (
    <span
      title={title}
      className={`inline-block max-w-full truncate rounded-full font-medium ${pequena ? 'px-1.5 py-px text-[11px] leading-4' : 'px-2.5 py-0.5 text-xs'} ${
        clara ? 'text-[#2b2a28]' : 'text-white'
      }`}
      style={{ background: hex }}
    >
      {texto}
    </span>
  )
}

/**
 * Balão preso a um botão (escolher etiquetas, prazo...). Posicionado na tela,
 * fecha ao clicar fora. `gatilho` recebe a função de abrir/fechar.
 */
export function Popover({
  gatilho,
  titulo,
  largura = 'w-72',
  children,
}: {
  gatilho: (alternar: (e: React.MouseEvent<HTMLElement>) => void, aberto: boolean) => ReactNode
  titulo: string
  largura?: string
  children: (fechar: () => void) => ReactNode
}) {
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)
  const caixa = useRef<HTMLDivElement>(null)
  const ancora = useRef<HTMLElement | null>(null)
  const fechar = () => setPos(null)

  useEffect(() => {
    if (!pos) return
    const fora = (e: PointerEvent) =>
      !caixa.current?.contains(e.target as Node) && !ancora.current?.contains(e.target as Node) && fechar()
    document.addEventListener('pointerdown', fora)
    return () => document.removeEventListener('pointerdown', fora)
  }, [pos])

  function alternar(e: React.MouseEvent<HTMLElement>) {
    if (pos) return fechar()
    ancora.current = e.currentTarget
    const r = e.currentTarget.getBoundingClientRect()
    setPos({ top: Math.min(r.bottom + 6, window.innerHeight - 120), left: Math.max(8, Math.min(r.left, window.innerWidth - 300)) })
  }

  return (
    <>
      {gatilho(alternar, Boolean(pos))}
      {pos && (
        <div
          ref={caixa}
          role="dialog"
          aria-label={titulo}
          style={{ top: pos.top, left: pos.left }}
          className={`fixed z-50 max-h-[70vh] overflow-y-auto rounded-card border border-line bg-surface p-3 shadow-xl ${largura}`}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <p className="mb-2 text-center text-sm font-medium text-muted">{titulo}</p>
          {children(fechar)}
        </div>
      )}
    </>
  )
}
