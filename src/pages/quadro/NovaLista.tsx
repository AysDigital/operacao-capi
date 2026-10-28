import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useToast } from '../../components/Toast'
import { Botao } from '../../components/ui'
import { mensagemErro } from '../../lib/cadastros'
import type { Lista } from '../../lib/quadro'
import { ops } from '../../lib/supabase'

/** Coluna "+ Adicionar lista" no fim do quadro. A lista nova vale para todos os quadros. */
export function NovaLista({ listas, onCriada }: { listas: Lista[]; onCriada: () => void }) {
  const toast = useToast()
  const [aberta, setAberta] = useState(false)
  const [nome, setNome] = useState('')
  const [salvando, setSalvando] = useState(false)
  const caixa = useRef<HTMLFormElement>(null)

  useEffect(() => {
    if (!aberta) return
    const fora = (e: PointerEvent) => caixa.current && !caixa.current.contains(e.target as Node) && setAberta(false)
    document.addEventListener('pointerdown', fora)
    return () => document.removeEventListener('pointerdown', fora)
  }, [aberta])

  async function criar(e: FormEvent) {
    e.preventDefault()
    if (!nome.trim()) return
    setSalvando(true)
    const ordem = Math.max(0, ...listas.map((l) => l.ordem)) + 1
    const { error } = await ops().from('listas').insert({ nome: nome.trim(), ordem, cor: '#a9a49a' })
    setSalvando(false)
    if (error) return toast('ruim', mensagemErro(error, { listas_nome_key: `Já existe uma lista chamada ${nome.trim()} (talvez arquivada).` }))
    toast('bom', `Lista ${nome.trim()} criada em todos os quadros.`)
    setNome('')
    setAberta(false)
    onCriada()
  }

  if (!aberta) {
    return (
      <button
        onClick={() => setAberta(true)}
        className="w-72 shrink-0 rounded-card border border-dashed border-line px-3 py-2.5 text-left text-sm text-muted hover:bg-surface-2 hover:text-ink"
      >
        + Adicionar lista
      </button>
    )
  }

  return (
    <form
      ref={caixa}
      onSubmit={criar}
      onKeyDown={(e) => e.key === 'Escape' && setAberta(false)}
      className="w-72 shrink-0 space-y-2 rounded-card border border-line bg-surface-2 p-2"
    >
      <input
        autoFocus
        value={nome}
        onChange={(e) => setNome(e.target.value)}
        placeholder="Nome da lista"
        aria-label="Nome da lista"
        className="w-full rounded-md border border-line bg-surface px-2 py-1.5 text-sm outline-none focus:border-muted"
      />
      <p className="text-xs text-muted">Aparece em todos os quadros, no fim.</p>
      <div className="flex items-center gap-2">
        <Botao type="submit" disabled={salvando || !nome.trim()} className="px-3 py-1.5 text-xs">
          {salvando ? 'Criando…' : 'Criar lista'}
        </Botao>
        <button type="button" onClick={() => setAberta(false)} className="text-xs text-muted hover:text-ink">
          Fechar
        </button>
      </div>
    </form>
  )
}
