import { BrowserRouter, Navigate, Route, Routes } from 'react-router'
import { AuthProvider, sair, useAuth } from './auth/AuthProvider'
import { Layout, TELAS } from './components/Layout'
import { ToastProvider } from './components/Toast'
import { Botao, TelaCentral } from './components/ui'
import { supabaseConfigurado } from './lib/supabase'
import { Ativos } from './pages/Ativos'
import { Configuracoes } from './pages/Configuracoes'
import { Etiquetas } from './pages/config/Etiquetas'
import { Login } from './pages/Login'
import { Modelos } from './pages/Modelos'
import { Ofertas } from './pages/Ofertas'
import { PaginaOferta } from './pages/oferta/PaginaOferta'
import { ModeloChecklistOferta } from './pages/config/ModeloChecklistOferta'
import { Placeholder } from './pages/Placeholder'
import { Ranking } from './pages/Ranking'
import { IrParaUltimoQuadro, Quadros } from './pages/quadro/Quadros'

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
        {TELAS.filter((t) => !['/quadros', '/ranking', '/ofertas', '/ativos', '/modelos', '/config'].includes(t.caminho)).map((t) => (
          <Route key={t.caminho} path={t.caminho} element={<Placeholder titulo={t.titulo} />} />
        ))}
        <Route path="/" element={<IrParaUltimoQuadro />} />
        <Route path="/quadros" element={<IrParaUltimoQuadro />} />
        <Route path="/quadros/:id" element={<Quadros />} />
        <Route path="/ranking" element={<Ranking />} />
        <Route path="/ofertas" element={<Ofertas />} />
        <Route path="/ofertas/:id" element={<PaginaOferta />} />
        <Route path="/ativos" element={<Ativos />} />
        <Route path="/modelos" element={<Modelos />} />
        <Route path="/config" element={<Configuracoes />}>
          <Route index element={<Navigate to="etiquetas" replace />} />
          <Route path="contas" element={<Navigate to="/ativos?aba=contas" replace />} />
          <Route path="etiquetas" element={<Etiquetas />} />
          <Route path="checklist-oferta" element={<ModeloChecklistOferta />} />
        </Route>
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
      <ToastProvider>
        <BrowserRouter>
          <Portao />
        </BrowserRouter>
      </ToastProvider>
    </AuthProvider>
  )
}
