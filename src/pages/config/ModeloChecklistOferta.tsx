import { useEffect, useState } from 'react'
import { Aviso, Carregando, Dica } from '../../components/ds'
import { useToast } from '../../components/Toast'
import { Botao } from '../../components/ui'
import { mensagemErro } from '../../lib/cadastros'
import type { SecaoModelo } from '../../lib/oferta'
import { ops } from '../../lib/supabase'

const pequeno = 'w-full rounded-md border border-line bg-surface px-2 py-1 text-sm outline-none focus:border-muted'
const botaoTexto = 'rounded-control px-2 py-1 text-xs text-muted hover:bg-surface-2 hover:text-ink disabled:opacity-30'

/** Editor do modelo "Lançamento de oferta". Vale só para as ofertas criadas depois. */
export function ModeloChecklistOferta() {
  const toast = useToast()
  const [modelo, setModelo] = useState<{ id: string; nome: string } | null>(null)
  const [secoes, setSecoes] = useState<(SecaoModelo & { texto: string })[] | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [salvando, setSalvando] = useState(false)
  const [mudou, setMudou] = useState(false)

  useEffect(() => {
    ops()
      .from('modelos_checklist_oferta')
      .select('id, nome, secoes')
      .eq('ativo', true)
      .order('criado_em')
      .limit(1)
      .maybeSingle()
      .then(({ data, error }) => {
        if (error) return setErro(error.message)
        if (!data) return setErro('Nenhum modelo ativo encontrado.')
        setModelo({ id: data.id, nome: data.nome })
        setSecoes(((data.secoes ?? []) as SecaoModelo[]).map((s) => ({ ...s, texto: (s.itens ?? []).join('\n') })))
      })
  }, [])

  const mudar = (f: (ss: NonNullable<typeof secoes>) => NonNullable<typeof secoes>) => {
    setSecoes((ss) => f(ss ?? []))
    setMudou(true)
  }
  const mover = (i: number, d: -1 | 1) =>
    mudar((ss) => {
      const r = [...ss]
      ;[r[i], r[i + d]] = [r[i + d], r[i]]
      return r
    })

  async function salvar() {
    if (!modelo || !secoes) return
    setSalvando(true)
    const limpo = secoes
      .map((s) => ({ titulo: s.titulo.trim() || 'Seção', itens: s.texto.split('\n').map((i) => i.trim()).filter(Boolean) }))
      .filter((s) => s.titulo || s.itens.length)
    const { error } = await ops().from('modelos_checklist_oferta').update({ secoes: limpo, atualizado_em: new Date().toISOString() }).eq('id', modelo.id)
    setSalvando(false)
    if (error) return toast('ruim', mensagemErro(error))
    setMudou(false)
    toast('bom', 'Modelo salvo. Vale para as ofertas criadas daqui em diante.')
  }

  if (erro) return <Aviso tom="ruim">Não foi possível carregar o modelo: {erro}</Aviso>
  if (!secoes || !modelo) return <Carregando linhas={5} altura="h-16" />

  const total = secoes.reduce((n, s) => n + s.texto.split('\n').filter((i) => i.trim()).length, 0)

  return (
    <div className="max-w-3xl space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-base font-semibold">
          <Dica
            conteudo="Toda oferta nova nasce com uma cópia deste checklist. Mudar o modelo não altera o checklist das ofertas que já existem (cada uma edita o seu na aba Checklist da oferta)."
            lado="esquerda"
          >
            {modelo.nome}
          </Dica>
        </h2>
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted">
            {secoes.length} seções · {total} itens
          </span>
          <Botao onClick={salvar} disabled={salvando || !mudou}>
            {salvando ? 'Salvando…' : 'Salvar modelo'}
          </Botao>
        </div>
      </div>

      {secoes.map((s, i) => (
        <section key={i} className="rounded-card border border-line bg-surface p-3">
          <div className="flex items-center gap-2">
            <input
              value={s.titulo}
              onChange={(e) => mudar((ss) => ss.map((x, j) => (j === i ? { ...x, titulo: e.target.value } : x)))}
              aria-label="Nome da seção"
              className={`${pequeno} font-medium`}
            />
            <button onClick={() => mover(i, -1)} disabled={i === 0} className={botaoTexto} aria-label="Subir seção">
              ↑
            </button>
            <button onClick={() => mover(i, 1)} disabled={i === secoes.length - 1} className={botaoTexto} aria-label="Descer seção">
              ↓
            </button>
            <button onClick={() => mudar((ss) => ss.filter((_, j) => j !== i))} className={`${botaoTexto} hover:text-bad`}>
              Remover
            </button>
          </div>
          <textarea
            value={s.texto}
            onChange={(e) => mudar((ss) => ss.map((x, j) => (j === i ? { ...x, texto: e.target.value } : x)))}
            rows={Math.max(3, s.texto.split('\n').length + 1)}
            placeholder="Um item por linha"
            aria-label={`Itens de ${s.titulo}`}
            className={`${pequeno} mt-2 resize-y`}
          />
        </section>
      ))}

      <button onClick={() => mudar((ss) => [...ss, { titulo: 'Nova seção', itens: [], texto: '' }])} className={`${botaoTexto} bg-surface-2`}>
        + Seção
      </button>
    </div>
  )
}
