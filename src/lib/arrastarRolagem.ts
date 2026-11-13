import { useRef, type MouseEvent, type PointerEvent } from 'react'

/**
 * Arrastar um quadro para o lado com o mouse, sem usar a barra de rolagem.
 * Funciona clicando em qualquer lugar (inclusive em cima dos cards): se o mouse
 * andou mais de alguns pixels, vira rolagem e o clique no card é ignorado.
 * Toque no celular continua com a rolagem normal do dedo.
 */
export function useArrastarRolagem<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  const estado = useRef<{ x: number; rolagem: number; moveu: boolean } | null>(null)

  const onPointerDown = (e: PointerEvent<T>) => {
    if (e.pointerType !== 'mouse' || e.button !== 0 || !ref.current) return
    if ((e.target as HTMLElement).closest('input, select, textarea, a')) return
    estado.current = { x: e.clientX, rolagem: ref.current.scrollLeft, moveu: false }
  }

  const onPointerMove = (e: PointerEvent<T>) => {
    const s = estado.current
    if (!s || !ref.current) return
    const dx = e.clientX - s.x
    if (!s.moveu) {
      if (Math.abs(dx) < 5) return
      s.moveu = true
      ref.current.setPointerCapture(e.pointerId)
      ref.current.style.cursor = 'grabbing'
      ref.current.style.userSelect = 'none'
    }
    ref.current.scrollLeft = s.rolagem - dx
  }

  const terminar = () => {
    if (ref.current) {
      ref.current.style.cursor = ''
      ref.current.style.userSelect = ''
    }
    // se arrastou, o clique que vem logo depois não abre o card
    if (estado.current?.moveu) setTimeout(() => (estado.current = null), 0)
    else estado.current = null
  }

  const onClickCapture = (e: MouseEvent<T>) => {
    if (estado.current?.moveu) {
      e.stopPropagation()
      e.preventDefault()
    }
  }

  return { ref, onPointerDown, onPointerMove, onPointerUp: terminar, onPointerCancel: terminar, onClickCapture }
}
