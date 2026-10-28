import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useToast } from '../../../components/Toast'
import { caminhoDe, ehArquivo, ehDoCard, enviarImagem, imagensDe, PREFIXO, removerArquivos, useUrlAssinada } from '../../../lib/arquivos'
import { normalizarUrl, tipoDoLink, type Anexo, type CardDetalhe } from '../../../lib/card'
import { ops } from '../../../lib/supabase'
import { Ordenavel } from './Ordenavel'
import { ImagemGuardada } from './Texto'
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
  const toast = useToast()
  const [novo, setNovo] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(0)
  const [soltando, setSoltando] = useState(false)
  const seletor = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (pedido) setNovo(pedido.titulo)
  }, [pedido])

  /** Imagens viram anexos (guardadas na pasta do card). */
  async function anexarImagens(arquivos: File[]) {
    let ordem = Math.max(0, ...card.anexos.map((a) => a.ordem))
    setEnviando((n) => n + arquivos.length)
    for (const arquivo of arquivos) {
      try {
        const caminho = await enviarImagem(card.id, arquivo)
        const titulo = arquivo.name && arquivo.name !== 'image.png' ? arquivo.name.replace(/\.[a-z0-9]+$/i, '') : 'Imagem colada'
        await salvar(ops().from('anexos').insert({ card_id: card.id, titulo, url: PREFIXO + caminho, ordem: ++ordem }))
      } catch (e) {
        toast('ruim', (e as Error).message)
      } finally {
        setEnviando((n) => n - 1)
      }
    }
  }

  // Ctrl+V com o card aberto (fora de um campo de texto) anexa a imagem
  const anexarRef = useRef(anexarImagens)
  anexarRef.current = anexarImagens
  useEffect(() => {
    const colar = (e: ClipboardEvent) => {
      const alvo = e.target as HTMLElement | null
      if (alvo?.closest('input, textarea, [contenteditable]')) return
      const imagens = imagensDe(e.clipboardData)
      if (!imagens.length) return
      e.preventDefault()
      anexarRef.current(imagens)
    }
    document.addEventListener('paste', colar)
    return () => document.removeEventListener('paste', colar)
  }, [])

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
    <section
      onDragOver={(e) => {
        if (!e.dataTransfer.types.includes('Files')) return
        e.preventDefault()
        setSoltando(true)
      }}
      onDragLeave={(e) => !e.currentTarget.contains(e.relatedTarget as Node) && setSoltando(false)}
      onDrop={(e) => {
        setSoltando(false)
        const imagens = imagensDe(e.dataTransfer)
        if (!imagens.length) return
        e.preventDefault()
        anexarImagens(imagens)
      }}
      className={`-m-2 rounded-card p-2 ${soltando ? 'bg-accent-soft outline-2 outline-dashed outline-accent' : ''}`}
    >
      <TituloSecao icone={ICONES.anexo} acoes={enviando > 0 && <span className="text-xs text-muted">Enviando imagem…</span>}>
        Anexos
      </TituloSecao>

      {card.anexos.length > 0 && (
        <div className="mb-2 space-y-1">
          <Ordenavel itens={card.anexos} onOrdenar={ordenar}>
            {(a, alca) => <LinhaAnexo anexo={a} cardId={card.id} alca={alca} salvar={salvar} />}
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
          <button onClick={() => seletor.current?.click()} className={`${botaoPequeno} bg-surface-2`}>
            + Imagem
          </button>
          <input
            ref={seletor}
            type="file"
            accept="image/png,image/jpeg,image/gif,image/webp"
            multiple
            hidden
            onChange={(e) => {
              anexarImagens([...(e.target.files ?? [])])
              e.target.value = ''
            }}
          />
          <span className="self-center text-xs text-muted">ou cole (Ctrl+V) / arraste uma imagem</span>
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
  const soTitulo = ehArquivo(urlInicial)

  useEffect(() => setTitulo(tituloInicial), [tituloInicial])

  function enviar(e: FormEvent) {
    e.preventDefault()
    if (!titulo.trim()) return setErro('Informe o título.')
    if (soTitulo) return onSalvar(titulo.trim(), urlInicial)
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
      {!soTitulo && (
        <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="Cole o link" aria-label="Link" className={campoPequeno} autoFocus={Boolean(tituloInicial)} />
      )}
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

function LinhaAnexo({ anexo, cardId, alca, salvar }: { anexo: Anexo; cardId: string; alca: React.ReactNode; salvar: Salvar }) {
  const [editando, setEditando] = useState(false)
  const imagem = ehArquivo(anexo.url)
  const urlImagem = useUrlAssinada(imagem ? caminhoDe(anexo.url) : null)
  const tipo = tipoDoLink(anexo.url)
  let host = imagem ? 'Imagem' : anexo.url
  if (!imagem) {
    try {
      host = new URL(anexo.url).hostname.replace(/^www\./, '')
    } catch {
      // link antigo sem protocolo: mostra como está
    }
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
      {imagem ? (
        <ImagemGuardada caminho={caminhoDe(anexo.url)} pequena />
      ) : (
        <span
          aria-hidden
          className="inline-flex h-8 w-12 shrink-0 items-center justify-center rounded-md text-[10px] font-semibold text-white"
          style={{ background: tipo.cor }}
        >
          {tipo.rotulo}
        </span>
      )}
      <a href={imagem ? (urlImagem ?? undefined) : anexo.url} target="_blank" rel="noopener noreferrer" className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium hover:underline">{anexo.titulo}</span>
        <span className="block truncate text-xs text-muted">{host}</span>
      </a>
      <button onClick={() => setEditando(true)} className={botaoPequeno}>
        Editar
      </button>
      <button
        onClick={async () => {
          if ((await salvar(ops().from('anexos').delete().eq('id', anexo.id))) && imagem && ehDoCard(cardId, caminhoDe(anexo.url))) removerArquivos([caminhoDe(anexo.url)])
        }}
        className={`${botaoPequeno} hover:text-bad`}
      >
        Remover
      </button>
    </div>
  )
}
