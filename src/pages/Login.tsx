import { useState, type FormEvent } from 'react'
import { supabase } from '../lib/supabase'
import { Botao, TelaCentral } from '../components/ui'

const campo =
  'mt-1 w-full rounded-control border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-muted'

/** Só entrada: não há cadastro. Os usuários são criados à mão no painel do Supabase. */
export function Login() {
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  async function entrar(e: FormEvent) {
    e.preventDefault()
    setErro(null)
    setEnviando(true)
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password: senha })
    setEnviando(false)
    if (error) {
      setErro(error.message === 'Invalid login credentials' ? 'E-mail ou senha incorretos.' : error.message)
    }
  }

  return (
    <TelaCentral>
      <h1 className="text-xl font-semibold">
        capi<span className="text-accent">.</span>
        <span className="ml-1.5 text-base font-medium text-muted">operação</span>
      </h1>
      <p className="mt-1 text-sm text-muted">Entre com seu e-mail e senha.</p>
      <form onSubmit={entrar} className="mt-6 space-y-4">
        <label className="block text-sm font-medium">
          E-mail
          <input
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={campo}
          />
        </label>
        <label className="block text-sm font-medium">
          Senha
          <input
            type="password"
            required
            autoComplete="current-password"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            className={campo}
          />
        </label>
        {erro && <p className="text-sm text-bad">{erro}</p>}
        <Botao type="submit" disabled={enviando} className="w-full">
          {enviando ? 'Entrando…' : 'Entrar'}
        </Botao>
      </form>
    </TelaCentral>
  )
}
