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
export function TituloPagina({ children, subtitulo }: { children: ReactNode; subtitulo?: string }) {
  return (
    <header className="mb-6">
      <h1 className="text-2xl font-semibold tracking-tight">
        {subtitulo ? (
          <Dica conteudo={subtitulo} lado="esquerda">
            {children}
          </Dica>
        ) : (
          children
        )}
      </h1>
    </header>
  )
}
