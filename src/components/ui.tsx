import type { ReactNode } from 'react'
import { Dica } from './ds'

export function TelaCentral({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-card border border-line bg-surface p-6 shadow-sm">{children}</div>
    </div>
  )
}

export function Botao({
  children,
  variante = 'primario',
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variante?: 'primario' | 'secundario' }) {
  const estilos =
    variante === 'primario'
      ? 'bg-accent text-accent-ink shadow-sm hover:brightness-105 active:brightness-95'
      : 'border border-line bg-surface text-ink hover:bg-surface-2'
  return (
    <button
      {...props}
      className={`rounded-control px-4 py-2 text-sm font-medium transition disabled:opacity-50 ${estilos} ${props.className ?? ''}`}
    >
      {children}
    </button>
  )
}

/** Título da página. A explicação (`subtitulo`) não fica escrita embaixo: abre na dica ao lado do título. */
export function TituloPagina({ children, subtitulo, acoes }: { children: ReactNode; subtitulo?: string; acoes?: ReactNode }) {
  return (
    <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
      <h1 className="text-2xl font-semibold tracking-tight">
        {subtitulo ? (
          <Dica conteudo={subtitulo} lado="esquerda">
            {children}
          </Dica>
        ) : (
          children
        )}
      </h1>
      {acoes && <div className="flex flex-wrap items-center gap-2">{acoes}</div>}
    </header>
  )
}

/** Classe padrão de caixas de texto e seletores. */
export const entrada =
  'mt-1 w-full rounded-control border border-line bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-muted disabled:opacity-60'

/** Campo de formulário: rótulo em cima, erro embaixo. */
export function Campo({ rotulo, erro, children }: { rotulo: ReactNode; erro?: string | null; children: ReactNode }) {
  return (
    <label className="block text-sm font-medium">
      {rotulo}
      {children}
      {erro && <span className="mt-1 block text-xs font-normal text-bad">{erro}</span>}
    </label>
  )
}

/** Botão de excluir (texto vermelho, sem fundo). */
export function BotaoExcluir(props: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      {...props}
      className={`rounded-control px-3 py-2 text-sm font-medium text-bad hover:bg-bad-soft disabled:opacity-50 ${props.className ?? ''}`}
    />
  )
}
