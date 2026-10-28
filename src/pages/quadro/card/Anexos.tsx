import { useEffect, useState, type FormEvent } from 'react'
import { normalizarUrl, tipoDoLink, type Anexo, type CardDetalhe } from '../../../lib/card'
import { ops } from '../../../lib/supabase'
import { Ordenavel } from './Ordenavel'
import { botaoPequeno, campoPequeno, ICONES, TituloSecao, todos, type Atualizar, type Salvar } from './comum'

const RAPIDOS = ['Script', 'AD Finalizado']

/**
 * Anexos (links). `pedido` abre o formulário de novo anexo com o título preenchido
 * (vem do botão "Anexo" da barra de ações); muda a cada clique.
 */
export function Anexos({
  card,
  salvar,
  atualizar,
  pedido,
}: {
  card: CardDetalhe
  salvar: Salvar
  atualizar: Atualizar
  pedido: { titulo: string; n: number } | null
}) {
  const [novo, setNovo] = useState<string | null>(null)

  useEffect(() => {
    if (pedido) setNovo(pedido.titulo)
  }, [pedido])

  async function adicionar(titulo: string, url: string) {
    const ordem = Math.max(0, ...card.anexos.map((a) => a.ordem)) + 1
    const ok = await salvar(ops().from('anexos').insert({ card_id: card.id, titulo, url, ordem }))
    if (ok) setNovo(null)
  }

  function ordenar(ids: string[]) {
    atualizar((c) => ({ ...c, anexos: ids.map((id, n) => ({ ...c.anexos.find((a) => a.id === id)!, ordem: n + 1 })) }))
    salvar(todos(ids.map((id, n) => ops().from('anexos').update({ ordem: n + 1 }).eq('id', id))))
  }

  return (
    <section>
      <TituloSecao icone={ICONES.anexo}>Anexos</TituloSecao>

      {card.anexos.length > 0 && (
        <div className="mb-2 space-y-1">
          <Ordenavel itens={card.anexos} onOrdenar={ordenar}>
            {(a, alca) => <LinhaAnexo anexo={a} alca={alca} salvar={salvar} />}
          </Ordenavel>
        </div>
      )}

      {novo !== null ? (
        <FormAnexo tituloInicial={novo} onSalvar={adicionar} onCancelar={() => setNovo(null)} />
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {RAPIDOS.filter((t) => !card.anexos.some((a) => a.titulo === t)).map((t) => (
            <button key={t} onClick={() => setNovo(t)} className={`${botaoPequeno} bg-surface-2`}>
              + {t}
            </button>
          ))}
          <button onClick={() => setNovo('')} className={`${botaoPequeno} bg-surface-2`}>
            + Outro anexo
          </button>
        </div>
      )}
    </section>
  )
}

function FormAnexo({
  tituloInicial,
  urlInicial = '',
  rotulo = 'Adicionar',
  onSalvar,
  onCancelar,
}: {
  tituloInicial: string
  urlInicial?: string
  rotulo?: string
  onSalvar: (titulo: string, url: string) => void
  onCancelar: () => void
}) {
  const [titulo, setTitulo] = useState(tituloInicial)
  const [url, setUrl] = useState(urlInicial)
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => setTitulo(tituloInicial), [tituloInicial])

  function enviar(e: FormEvent) {
    e.preventDefault()
    if (!titulo.trim()) return setErro('Informe o título.')
    if (!url.trim()) return setErro('Cole o link.')
    try {
      new URL(normalizarUrl(url))
    } catch {
      return setErro('Esse link não parece válido.')
    }
    onSalvar(titulo.trim(), normalizarUrl(url))
  }

  return (
    <form onSubmit={enviar} onKeyDown={(e) => e.key === 'Escape' && (e.stopPropagation(), onCancelar())} className="space-y-1.5 rounded-control border border-line p-2">
      <input value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Título" aria-label="Título" className={campoPequeno} autoFocus={!tituloInicial} />
      <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="Cole o link" aria-label="Link" className={campoPequeno} autoFocus={Boolean(tituloInicial)} />
      {erro && <p className="text-xs text-bad">{erro}</p>}
      <div className="flex gap-2">
        <button type="submit" className="rounded-control bg-accent px-3 py-1 text-xs font-medium text-accent-ink">
          {rotulo}
        </button>
        <button type="button" onClick={onCancelar} className="text-xs text-muted hover:text-ink">
          Cancelar
        </button>
      </div>
    </form>
  )
}

function LinhaAnexo({ anexo, alca, salvar }: { anexo: Anexo; alca: React.ReactNode; salvar: Salvar }) {
  const [editando, setEditando] = useState(false)
  const tipo = tipoDoLink(anexo.url)
  let host = anexo.url
  try {
    host = new URL(anexo.url).hostname.replace(/^www\./, '')
  } catch {
    // link antigo sem protocolo: mostra como está
  }

  if (editando) {
    return (
      <FormAnexo
        tituloInicial={anexo.titulo}
        urlInicial={anexo.url}
        rotulo="Salvar"
        onCancelar={() => setEditando(false)}
        onSalvar={async (titulo, url) => {
          if (await salvar(ops().from('anexos').update({ titulo, url }).eq('id', anexo.id))) setEditando(false)
        }}
      />
    )
  }

  return (
    <div className="flex items-center gap-2 rounded-control py-1 pr-1 hover:bg-surface-2">
      {alca}
      <span
        aria-hidden
        className="inline-flex h-8 w-12 shrink-0 items-center justify-center rounded-md text-[10px] font-semibold text-white"
        style={{ background: tipo.cor }}
      >
        {tipo.rotulo}
      </span>
      <a href={anexo.url} target="_blank" rel="noopener noreferrer" className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium hover:underline">{anexo.titulo}</span>
        <span className="block truncate text-xs text-muted">{host}</span>
      </a>
      <button onClick={() => setEditando(true)} className={botaoPequeno}>
        Editar
      </button>
      <button onClick={() => salvar(ops().from('anexos').delete().eq('id', anexo.id))} className={`${botaoPequeno} hover:text-bad`}>
        Remover
      </button>
    </div>
  )
}
