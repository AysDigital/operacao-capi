import { useRef, useState, type ReactNode } from 'react'
import { useToast } from '../../../components/Toast'
import { enviarImagem, imagensDe, marcaImagem, useUrlAssinada } from '../../../lib/arquivos'

/**
 * Formatação simples, no estilo do Trello:
 *   **negrito**   - item de lista   1. item numerado   [texto](https://link)   links soltos
 *   ![imagem](storage:caminho)   imagem guardada no Storage (colada ou arrastada)
 * Desenhado como elementos React (sem HTML cru), então não há risco de código injetado.
 */
export function TextoFormatado({ texto }: { texto: string }) {
  const blocos: ReactNode[] = []
  const linhas = texto.replace(/\r\n/g, '\n').split('\n')
  let i = 0
  while (i < linhas.length) {
    const linha = linhas[i]
    if (/^\s*[-*]\s+/.test(linha) || /^\s*\d+[.)]\s+/.test(linha)) {
      const numerada = /^\s*\d+[.)]\s+/.test(linha)
      const padrao = numerada ? /^\s*\d+[.)]\s+/ : /^\s*[-*]\s+/
      const itens: string[] = []
      while (i < linhas.length && padrao.test(linhas[i])) itens.push(linhas[i++].replace(padrao, ''))
      const Lista = numerada ? 'ol' : 'ul'
      blocos.push(
        <Lista key={blocos.length} className={`my-1 pl-5 ${numerada ? 'list-decimal' : 'list-disc'}`}>
          {itens.map((t, k) => (
            <li key={k}>{emLinha(t)}</li>
          ))}
        </Lista>,
      )
    } else if (!linha.trim()) {
      i++
    } else {
      const paragrafo: string[] = []
      while (i < linhas.length && linhas[i].trim() && !/^\s*([-*]|\d+[.)])\s+/.test(linhas[i])) paragrafo.push(linhas[i++])
      blocos.push(
        <p key={blocos.length} className="my-1">
          {paragrafo.map((t, k) => (
            <span key={k}>
              {k > 0 && <br />}
              {emLinha(t)}
            </span>
          ))}
        </p>,
      )
    }
  }
  return <div className="text-sm leading-relaxed break-words">{blocos}</div>
}

const MARCAS = /(!\[[^\]]*\]\(storage:[^\s)]+\)|\*\*[^*]+\*\*|\[[^\]]+\]\((?:https?:\/\/)[^\s)]+\)|https?:\/\/[^\s<]+)/g

function emLinha(t: string): ReactNode[] {
  return t.split(MARCAS).map((parte, k) => {
    const imagem = parte.match(/^!\[[^\]]*\]\(storage:([^\s)]+)\)$/)
    if (imagem) return <ImagemGuardada key={k} caminho={imagem[1]} />
    if (/^\*\*[^*]+\*\*$/.test(parte)) return <strong key={k}>{parte.slice(2, -2)}</strong>
    const link = parte.match(/^\[([^\]]+)\]\(([^\s)]+)\)$/)
    if (link) return <Link key={k} href={link[2]}>{link[1]}</Link>
    if (/^https?:\/\//.test(parte)) return <Link key={k} href={parte}>{parte}</Link>
    return parte
  })
}

function Link({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className="text-info underline underline-offset-2 hover:text-accent-strong" onClick={(e) => e.stopPropagation()}>
      {children}
    </a>
  )
}

/** Imagem do Storage dentro de um texto; clicar abre em tamanho real numa aba nova. */
export function ImagemGuardada({ caminho, pequena }: { caminho: string; pequena?: boolean }) {
  const url = useUrlAssinada(caminho)
  if (!url) return <span className={`my-1 block animate-pulse rounded-control bg-surface-2 ${pequena ? 'h-12 w-16' : 'h-32 w-48'}`} aria-label="Carregando imagem" />
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="my-1 block w-fit">
      <img src={url} alt="Imagem anexada" loading="lazy" className={`rounded-control border border-line object-cover ${pequena ? 'h-12 w-16' : 'max-h-64 max-w-full'}`} />
    </a>
  )
}

/** Caixa de texto com botões de negrito e lista. Com `cardId`, aceita colar ou arrastar imagens. */
export function EditorTexto({
  valor,
  onMudar,
  onSair,
  placeholder,
  linhas = 5,
  autoFocus,
  cardId,
}: {
  valor: string
  onMudar: (v: string) => void
  onSair?: () => void
  placeholder?: string
  linhas?: number
  autoFocus?: boolean
  /** card onde as imagens coladas são guardadas (sem ele, colar imagem não faz nada) */
  cardId?: string
}) {
  const ref = useRef<HTMLTextAreaElement>(null)
  const toast = useToast()
  const [enviando, setEnviando] = useState(0)
  // o texto pode mudar enquanto a imagem sobe: a inserção usa sempre o valor mais novo
  const atual = useRef(valor)
  atual.current = valor

  async function receberImagens(arquivos: File[]) {
    if (!cardId || !arquivos.length) return
    const pos = ref.current?.selectionStart ?? atual.current.length
    setEnviando((n) => n + arquivos.length)
    for (const arquivo of arquivos) {
      try {
        const caminho = await enviarImagem(cardId, arquivo)
        const texto = atual.current
        const antes = texto.slice(0, pos)
        const marca = (antes && !antes.endsWith('\n') ? '\n' : '') + marcaImagem(caminho) + '\n'
        onMudar(antes + marca + texto.slice(pos))
      } catch (e) {
        toast('ruim', (e as Error).message)
      } finally {
        setEnviando((n) => n - 1)
      }
    }
    ref.current?.focus()
  }

  /** Troca a seleção por `antes + seleção + depois` e mantém o cursor no lugar certo. */
  function envolver(antes: string, depois: string, padrao: string) {
    const el = ref.current!
    const { selectionStart: a, selectionEnd: b } = el
    const sel = valor.slice(a, b) || padrao
    onMudar(valor.slice(0, a) + antes + sel + depois + valor.slice(b))
    requestAnimationFrame(() => {
      el.focus()
      el.setSelectionRange(a + antes.length, a + antes.length + sel.length)
    })
  }

  function lista() {
    const el = ref.current!
    const inicio = valor.lastIndexOf('\n', el.selectionStart - 1) + 1
    onMudar(valor.slice(0, inicio) + '- ' + valor.slice(inicio))
    requestAnimationFrame(() => {
      el.focus()
      el.setSelectionRange(el.selectionStart + 2, el.selectionStart + 2)
    })
  }

  const botao = 'rounded px-2 py-0.5 text-xs text-muted hover:bg-surface-2 hover:text-ink'
  // onMouseDown + preventDefault: clicar no botão não tira o foco da caixa (senão ela salvaria e fecharia)
  const semPerderFoco = (f: () => void) => (e: React.MouseEvent) => {
    e.preventDefault()
    f()
  }

  return (
    <div className="rounded-control border border-line focus-within:border-muted">
      <div className="flex gap-1 border-b border-line px-1.5 py-1">
        <button type="button" className={`${botao} font-bold`} onMouseDown={semPerderFoco(() => envolver('**', '**', 'negrito'))} title="Negrito">
          B
        </button>
        <button type="button" className={botao} onMouseDown={semPerderFoco(lista)} title="Lista">
          • Lista
        </button>
        {cardId && <span className="ml-auto self-center pr-1 text-[11px] text-muted">{enviando > 0 ? 'Enviando imagem…' : 'Cole ou arraste imagens'}</span>}
      </div>
      <textarea
        ref={ref}
        value={valor}
        onChange={(e) => onMudar(e.target.value)}
        onBlur={() => enviando === 0 && onSair?.()}
        onPaste={(e) => {
          const imagens = imagensDe(e.clipboardData)
          if (!cardId || !imagens.length) return
          e.preventDefault()
          receberImagens(imagens)
        }}
        onDragOver={(e) => cardId && e.dataTransfer.types.includes('Files') && e.preventDefault()}
        onDrop={(e) => {
          const imagens = imagensDe(e.dataTransfer)
          if (!cardId || !imagens.length) return
          e.preventDefault()
          receberImagens(imagens)
        }}
        rows={linhas}
        autoFocus={autoFocus}
        placeholder={placeholder}
        className="block w-full resize-y rounded-b-control bg-surface px-3 py-2 text-sm outline-none"
      />
    </div>
  )
}

/** Descrição: mostra formatada; clicando, edita. Salva ao sair do campo. */
export function Descricao({ cardId, valor, onSalvar }: { cardId: string; valor: string | null; onSalvar: (v: string | null) => Promise<void> }) {
  const [editando, setEditando] = useState(false)
  const [rascunho, setRascunho] = useState(valor ?? '')

  async function sair() {
    setEditando(false)
    const novo = rascunho.trim() || null
    if (novo !== (valor?.trim() || null)) await onSalvar(novo)
  }

  function editar() {
    setRascunho(valor ?? '')
    setEditando(true)
  }

  if (editando) {
    return <EditorTexto valor={rascunho} onMudar={setRascunho} onSair={sair} autoFocus linhas={6} placeholder="Escreva os detalhes do card…" cardId={cardId} />
  }
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={editar}
      onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), editar())}
      className="block w-full cursor-text rounded-control bg-surface-2 px-3 py-2 text-left hover:bg-line/60"
    >
      {valor ? <TextoFormatado texto={valor} /> : <span className="text-sm text-muted">Adicionar uma descrição mais detalhada…</span>}
    </div>
  )
}
