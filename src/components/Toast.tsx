import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'

type Aviso = { id: number; tom: 'bom' | 'ruim'; texto: string }

const ToastContext = createContext<(tom: Aviso['tom'], texto: string) => void>(() => {})

/** Mensagens rápidas de sucesso e erro, no canto da tela. Erro fica mais tempo. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [avisos, setAvisos] = useState<Aviso[]>([])

  const fechar = (id: number) => setAvisos((a) => a.filter((x) => x.id !== id))
  const mostrar = useCallback((tom: Aviso['tom'], texto: string) => {
    const id = Date.now() + Math.random()
    setAvisos((a) => [...a, { id, tom, texto }])
    setTimeout(() => fechar(id), tom === 'ruim' ? 7000 : 3500)
  }, [])

  return (
    <ToastContext.Provider value={mostrar}>
      {children}
      <div aria-live="polite" className="pointer-events-none fixed inset-x-4 bottom-4 z-50 flex flex-col items-center gap-2 sm:inset-x-auto sm:right-6 sm:items-end">
        {avisos.map((a) => (
          <div
            key={a.id}
            role={a.tom === 'ruim' ? 'alert' : 'status'}
            className={`pointer-events-auto flex max-w-sm items-start gap-2 rounded-card px-4 py-3 text-sm shadow-lg ${
              a.tom === 'bom' ? 'bg-good-soft text-good' : 'bg-bad-soft text-bad'
            }`}
          >
            <span aria-hidden className="font-semibold">
              {a.tom === 'bom' ? '✓' : '✕'}
            </span>
            <span className="min-w-0 flex-1">{a.texto}</span>
            <button onClick={() => fechar(a.id)} aria-label="Fechar" className="-my-0.5 ml-1 opacity-60 hover:opacity-100">
              ×
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export const useToast = () => useContext(ToastContext)
