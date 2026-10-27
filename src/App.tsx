import { BrowserRouter, Navigate, Route, Routes } from 'react-router'
import { AuthProvider, sair, useAuth } from './auth/AuthProvider'
import { Layout, TELAS } from './components/Layout'
import { Botao, TelaCentral } from './components/ui'
import { supabaseConfigurado } from './lib/supabase'
import { Login } from './pages/Login'
import { Placeholder } from './pages/Placeholder'

function Portao() {
  const auth = useAuth()

  if (auth.status === 'carregando' || auth.status === 'verificando') {
    return <p className="p-8 text-sm text-muted">Carregando…</p>
  }
  if (auth.status === 'deslogado') return <Login />
  if (auth.status === 'nao_autorizado' || auth.status === 'erro') {
    return (
      <TelaCentral>
        <h1 className="text-xl font-semibold">Acesso não autorizado</h1>
        <p className="mt-2 text-sm text-muted">
          {auth.status === 'erro'
            ? `Não foi possível verificar seu acesso: ${auth.mensagem}`
            : `O e-mail ${auth.session.user.email} não faz parte da equipe da operação.`}
        </p>
        <Botao variante="secundario" onClick={sair} className="mt-6 w-full">
          Sair
        </Botao>
      </TelaCentral>
    )
  }

  return (
    <Routes>
      <Route element={<Layout />}>
        {TELAS.map((t) => (
          <Route key={t.caminho} path={t.caminho} element={<Placeholder titulo={t.titulo} />} />
        ))}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}

export default function App() {
  if (!supabaseConfigurado) {
    return (
      <TelaCentral>
        <h1 className="text-xl font-semibold">Configuração pendente</h1>
        <p className="mt-2 text-sm text-muted">
          Preencha VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY no arquivo .env.local e reinicie o app.
        </p>
      </TelaCentral>
    )
  }
  return (
    <AuthProvider>
      <BrowserRouter>
        <Portao />
      </BrowserRouter>
    </AuthProvider>
  )
}
