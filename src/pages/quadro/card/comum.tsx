import type { ReactNode } from 'react'
import type { PostgrestError } from '@supabase/supabase-js'
import type { CardDetalhe } from '../../../lib/card'

type Resultado = { error: PostgrestError | null }

/**
 * Grava no banco: em caso de erro mostra a mensagem em português; em qualquer caso
 * recarrega o card (e o quadro). `erros` traduz restrições específicas.
 */
export type Salvar = (op: PromiseLike<Resultado>, erros?: Record<string, string>) => Promise<boolean>

/** Muda o card na tela antes de o banco responder (marcar item, trocar status...). */
export type Atualizar = (f: (c: CardDetalhe) => CardDetalhe) => void

/** Várias gravações como uma só (o primeiro erro, se houver). */
export async function todos(ops: PromiseLike<Resultado>[]): Promise<Resultado> {
  const rs = await Promise.all(ops)
  return { error: rs.find((r) => r.error)?.error ?? null }
}

export function TituloSecao({ icone, children, acoes }: { icone: ReactNode; children: ReactNode; acoes?: ReactNode }) {
  return (
    <div className="mb-2 flex items-center gap-2">
      <svg viewBox="0 0 16 16" aria-hidden className="h-4 w-4 shrink-0 text-muted" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
        {icone}
      </svg>
      <h3 className="flex-1 font-sans text-sm font-semibold">{children}</h3>
      {acoes}
    </div>
  )
}

export const ICONES = {
  descricao: <path d="M2.5 4h11M2.5 7h11M2.5 10h11M2.5 13h6" />,
  checklist: <path d="M2.5 2.5h11v11h-11ZM5 8l2 2 4-4" />,
  anexo: <path d="M10.5 5.5 6 10a1.4 1.4 0 0 0 2 2l4.6-4.6a2.8 2.8 0 0 0-4-4L4 8a4.2 4.2 0 0 0 6 6l3.5-3.5" />,
  veiculacao: <path d="M3 6.5v3h2l4 3v-9l-4 3Zm8.5-1a3.5 3.5 0 0 1 0 5" />,
  atividade: <path d="M2.5 3.5h11v7h-6l-3 2.5v-2.5h-2Z" />,
  etiqueta: <path d="M2.5 2.5h5l6 6-5 5-6-6Zm3 3h.01" />,
  membro: <path d="M8 8a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Zm-4.5 5.5c0-2.2 2-4 4.5-4s4.5 1.8 4.5 4" />,
  prazo: <path d="M8 13.5a5.5 5.5 0 1 0 0-11 5.5 5.5 0 0 0 0 11ZM8 5v3l2 1.5" />,
  trofeu: <path d="M5 2.5h6v3a3 3 0 0 1-6 0Zm0 1H2.5a2 2 0 0 0 2.5 2.5M11 3.5h2.5A2 2 0 0 1 11 6M8 8.5v3m-2.5 2h5" />,
}

/** Bolinha com a inicial do membro. */
export function Avatar({ nome, cor, tamanho = 'h-7 w-7 text-xs' }: { nome: string; cor?: string | null; tamanho?: string }) {
  return (
    <span
      title={nome}
      aria-hidden
      className={`inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-white ${tamanho}`}
      style={{ background: cor ?? '#7d786f' }}
    >
      {nome.trim().charAt(0).toUpperCase()}
    </span>
  )
}

export const botaoAcao =
  'inline-flex items-center gap-1.5 rounded-control bg-surface-2 px-3 py-1.5 text-sm font-medium text-ink hover:bg-line/70'
export const botaoPequeno = 'rounded-control px-2 py-1 text-xs text-muted hover:bg-surface-2 hover:text-ink'
export const campoPequeno = 'w-full rounded-md border border-line bg-surface px-2 py-1 text-sm outline-none focus:border-muted'
