import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { ops, supabase } from '../lib/supabase'

type Estado =
  | { status: 'carregando' }
  | { status: 'deslogado' }
  | { status: 'verificando'; session: Session }
  | { status: 'nao_autorizado'; session: Session }
  | { status: 'erro'; session: Session; mensagem: string }
  | { status: 'membro'; session: Session }

const AuthContext = createContext<Estado>({ status: 'carregando' })

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null | undefined>(undefined)
  const [estado, setEstado] = useState<Estado>({ status: 'carregando' })

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data } = supabase.auth.onAuthStateChange((_evento, s) => setSession(s))
    return () => data.subscription.unsubscribe()
  }, [])

  // Verifica ops.is_membro() sempre que o usuário logado muda.
  const userId = session?.user.id
  useEffect(() => {
    if (session === undefined) return
    if (!session) {
      setEstado({ status: 'deslogado' })
      return
    }
    let cancelado = false
    setEstado({ status: 'verificando', session })
    ops()
      .rpc('is_membro')
      .then(({ data, error }) => {
        if (cancelado) return
        if (error) setEstado({ status: 'erro', session, mensagem: error.message })
        else setEstado(data === true ? { status: 'membro', session } : { status: 'nao_autorizado', session })
      })
    return () => {
      cancelado = true
    }
    // Só reverifica quando troca o usuário (não a cada renovação de token).
  }, [userId, session === null])

  return <AuthContext.Provider value={estado}>{children}</AuthContext.Provider>
}

export const useAuth = () => useContext(AuthContext)

export const sair = () => supabase.auth.signOut()
