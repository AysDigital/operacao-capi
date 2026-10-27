import { useEffect, useState } from 'react'

export type Tema = 'sistema' | 'claro' | 'escuro'

function lerTema(): Tema {
  try {
    const t = localStorage.getItem('tema')
    if (t === 'claro' || t === 'escuro') return t
  } catch {
    // localStorage indisponível: segue o sistema
  }
  return 'sistema'
}

function aplicar(tema: Tema) {
  const escuro =
    tema === 'escuro' || (tema === 'sistema' && window.matchMedia('(prefers-color-scheme: dark)').matches)
  document.documentElement.classList.toggle('dark', escuro)
}

export function useTema() {
  const [tema, setTema] = useState<Tema>(lerTema)

  useEffect(() => {
    aplicar(tema)
    try {
      if (tema === 'sistema') localStorage.removeItem('tema')
      else localStorage.setItem('tema', tema)
    } catch {
      // ignora
    }
    if (tema !== 'sistema') return
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => aplicar('sistema')
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [tema])

  return [tema, setTema] as const
}
