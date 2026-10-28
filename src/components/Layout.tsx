import { useEffect, useState, type ReactNode } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router'
import { sair, useAuth } from '../auth/AuthProvider'
import { useTema, type Tema } from '../lib/theme'

/** Ícones simples de traço (16×16), um por tela. */
const ICONES: Record<string, ReactNode> = {
  '/quadros': <path d="M2.5 3h3v10h-3ZM6.5 3h3v6.5h-3ZM10.5 3h3v8.5h-3Z" />,
  '/ofertas': <path d="M2.5 2.5h5l6 6-5 5-6-6Zm3 3h.01" />,
  '/veiculacoes': <path d="M3 6.5v3h2l4 3v-9l-4 3Zm8.5-1a3.5 3.5 0 0 1 0 5" />,
  '/modelos': <path d="M5.5 5.5h7v8h-7ZM3.5 10.5v-8h7" />,
  '/config': <path d="M8 10a2 2 0 1 0 0-4 2 2 0 0 0 0 4Zm0-7.5v1.3m0 8.4v1.3M3.4 3.4l.9.9m7.4 7.4.9.9M2.5 8h1.3m8.4 0h1.3M3.4 12.6l.9-.9m7.4-7.4.9-.9" />,
}

export const TELAS = [
  { caminho: '/quadros', titulo: 'Quadros' },
  { caminho: '/ofertas', titulo: 'Ofertas' },
  { caminho: '/veiculacoes', titulo: 'Veiculações' },
  { caminho: '/modelos', titulo: 'Modelos' },
  { caminho: '/config', titulo: 'Configurações' },
] as const

const PROXIMO_TEMA: Record<Tema, Tema> = { sistema: 'claro', claro: 'escuro', escuro: 'sistema' }
const NOME_TEMA: Record<Tema, string> = { sistema: 'Tema: sistema', claro: 'Tema: claro', escuro: 'Tema: escuro' }

function Icone({ caminho }: { caminho: string }) {
  return (
    <svg viewBox="0 0 16 16" aria-hidden className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      {ICONES[caminho]}
    </svg>
  )
}

/** Marca: "capi." com o ponto em coral. */
function Marca({ curta }: { curta?: boolean }) {
  return (
    <span className="font-display text-lg font-semibold tracking-tight">
      capi<span className="text-accent">.</span>
      {!curta && <span className="ml-1.5 text-sm font-medium text-muted">operação</span>}
    </span>
  )
}

function lerRecolhido() {
  try {
    return localStorage.getItem('menu_recolhido') === '1'
  } catch {
    return false
  }
}

export function Layout() {
  const auth = useAuth()
  const [tema, setTema] = useTema()
  const [menuAberto, setMenuAberto] = useState(false)
  const [recolhido, setRecolhido] = useState(lerRecolhido)
  const email = 'session' in auth ? auth.session.user.email : ''
  // o quadro usa a largura toda da tela
  const largo = useLocation().pathname.startsWith('/quadros')

  useEffect(() => {
    try {
      localStorage.setItem('menu_recolhido', recolhido ? '1' : '0')
    } catch {
      // sem armazenamento local: só não lembra
    }
  }, [recolhido])

  return (
    <div className="min-h-screen md:flex">
      {/* Barra superior no celular */}
      <div className="flex items-center justify-between border-b border-line bg-surface px-4 py-3 md:hidden">
        <Marca />
        <button onClick={() => setMenuAberto((v) => !v)} className="rounded-control border border-line px-3 py-1 text-sm">
          {menuAberto ? 'Fechar' : 'Menu'}
        </button>
      </div>

      <aside
        className={`${menuAberto ? 'flex' : 'hidden'} w-full flex-col border-b border-line bg-surface md:sticky md:top-0 md:flex md:h-screen md:shrink-0 md:border-b-0 md:border-r ${
          recolhido ? 'md:w-16' : 'md:w-60'
        } transition-[width]`}
      >
        <div className={`hidden items-center py-5 md:flex ${recolhido ? 'justify-center px-2' : 'justify-between px-5'}`}>
          {!recolhido && <Marca />}
          <button
            onClick={() => setRecolhido((r) => !r)}
            title={recolhido ? 'Abrir a lista' : 'Recolher a lista'}
            aria-label={recolhido ? 'Abrir a lista de telas' : 'Recolher a lista de telas'}
            className="rounded-control p-1.5 text-muted hover:bg-surface-2 hover:text-ink"
          >
            <svg viewBox="0 0 16 16" aria-hidden className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              {recolhido ? <path d="M6 3.5 10.5 8 6 12.5" /> : <path d="M10 3.5 5.5 8 10 12.5" />}
            </svg>
          </button>
        </div>
        <nav className={`flex flex-col gap-0.5 py-2 ${recolhido ? 'md:px-2' : ''} px-3`}>
          {TELAS.map((t) => (
            <NavLink
              key={t.caminho}
              to={t.caminho}
              onClick={() => setMenuAberto(false)}
              title={recolhido ? t.titulo : undefined}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-control px-3 py-2 text-sm transition-colors ${recolhido ? 'md:justify-center md:px-0' : ''} ${
                  isActive ? 'bg-accent-soft font-medium text-accent-strong' : 'text-muted hover:bg-surface-2 hover:text-ink'
                }`
              }
            >
              <Icone caminho={t.caminho} />
              <span className={recolhido ? 'md:hidden' : ''}>{t.titulo}</span>
            </NavLink>
          ))}
        </nav>
        <div className={`mt-auto space-y-2 border-t border-line py-4 text-sm ${recolhido ? 'px-5 md:hidden' : 'px-5'}`}>
          <p className="truncate text-muted" title={email}>
            {email}
          </p>
          <div className="flex gap-3">
            <button onClick={() => setTema(PROXIMO_TEMA[tema])} className="text-muted hover:text-ink">
              {NOME_TEMA[tema]}
            </button>
            <button onClick={sair} className="ml-auto text-muted hover:text-ink">
              Sair
            </button>
          </div>
        </div>
      </aside>

      <main className="min-w-0 flex-1 px-4 py-6 md:px-10 md:py-8">
        <div className={largo ? '' : 'mx-auto max-w-6xl'}>
          <Outlet />
        </div>
      </main>
    </div>
  )
}
