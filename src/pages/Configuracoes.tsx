import { NavLink, Outlet } from 'react-router'
import { TituloPagina } from '../components/ui'

const ABAS = [
  { caminho: '/config/contas', titulo: 'Contas de anúncio' },
  { caminho: '/config/etiquetas', titulo: 'Etiquetas' },
]

export function Configuracoes() {
  return (
    <>
      <TituloPagina>Configurações</TituloPagina>
      <nav className="mb-6 flex gap-1 border-b border-line" aria-label="Seções de configurações">
        {ABAS.map((a) => (
          <NavLink
            key={a.caminho}
            to={a.caminho}
            className={({ isActive }) =>
              `-mb-px border-b-2 px-3 py-2 text-sm transition-colors ${
                isActive ? 'border-accent font-medium text-accent-strong' : 'border-transparent text-muted hover:text-ink'
              }`
            }
          >
            {a.titulo}
          </NavLink>
        ))}
      </nav>
      <Outlet />
    </>
  )
}
