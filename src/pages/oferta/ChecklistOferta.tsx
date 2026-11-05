import { useCallback, useEffect, useState } from 'react'
import { Aviso, Carregando, Vazio } from '../../components/ds'
import { useToast } from '../../components/Toast'
import { Botao } from '../../components/ui'
import { normalizarUrl, prazoCurto, situacaoPrazo } from '../../lib/card'
import { mensagemErro } from '../../lib/cadastros'
import { formatarDataHora } from '../../lib/format'
import { buscarChecklistOferta, type ItemOferta, type SecaoOferta } from '../../lib/oferta'
import { lerLocal, gravarLocal } from '../../lib/quadro'
import { ops } from '../../lib/supabase'
import { todos } from '../quadro/card/comum'
import { Ordenavel } from '../quadro/card/Ordenavel'

type Membro = { user_id: string; nome: string }
type Resultado = { error: { message: string; code?: string } | null }

const pequeno = 'w-full rounded-md border border-line bg-surface px-2 py-1 text-sm outline-none focus:border-muted'
const botaoTexto = 'rounded-control px-2 py-1 text-xs text-muted hover:bg-surface-2 hover:text-ink'

/** Barra de progresso com "feitos/total". */
export function Progresso({ feitos, total, fina }: { feitos: number; total: number; fina?: boolean }) {
  const pct = total ? Math.round((feitos / total) * 100) : 0
  return (
    <div className="flex items-center gap-2">
      <div className={`flex-1 overflow-hidden rounded-full bg-surface-2 ${fina ? 'h-1' : 'h-1.5'}`} role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
        <div className={`h-full rounded-full transition-all ${pct === 100 ? 'bg-good' : 'bg-info'}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-muted tabular-nums">
        {feitos}/{total}
      </span>
    </div>
  )
}

export function ChecklistOferta({ ofertaId, membros, onMudou }: { ofertaId: string; membros: Membro[]; onMudou: () => void }) {
  const toast = useToast()
  const [secoes, setSecoes] = useState<SecaoOferta[] | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [criando, setCriando] = useState(false)
  const [novaSecao, setNovaSecao] = useState<string | null>(null)

  const carregar = useCallback(
    () => buscarChecklistOferta(ofertaId).then(setSecoes, (e: Error) => setErro(e.message)),
    [ofertaId],
  )
  useEffect(() => {
    carregar()
  }, [carregar])

  /** Grava, avisa se der erro e recarrega. */
  const salvar = useCallback(
    async (op: PromiseLike<Resultado>) => {
      const { error } = await op
      if (error) toast('ruim', mensagemErro(error as never))
      await carregar()
      onMudou()
      return !error
    },
    [toast, carregar, onMudou],
  )

  async function criarDoModelo() {
    setCriando(true)
    await salvar(ops().rpc('criar_checklist_oferta', { p_oferta: ofertaId }))
    setCriando(false)
  }

  async function adicionarSecao() {
    const titulo = novaSecao?.trim()
    if (!titulo) return
    setNovaSecao(null)
    const ordem = Math.max(0, ...(secoes ?? []).map((s) => s.ordem)) + 1
    await salvar(ops().from('checklists').insert({ oferta_id: ofertaId, titulo, ordem }))
  }

  function ordenarSecoes(ids: string[]) {
    setSecoes((ss) => ids.map((id, n) => ({ ...ss!.find((s) => s.id === id)!, ordem: n + 1 })))
    salvar(todos(ids.map((id, n) => ops().from('checklists').update({ ordem: n + 1 }).eq('id', id))))
  }

  if (erro) return <Aviso tom="ruim">Não foi possível carregar o checklist: {erro}</Aviso>
  if (!secoes) return <Carregando linhas={5} altura="h-10" />

  if (secoes.length === 0) {
    return (
      <Vazio titulo="Esta oferta ainda não tem checklist de lançamento">
        <Botao onClick={criarDoModelo} disabled={criando} className="mt-3">
          {criando ? 'Criando…' : 'Criar checklist a partir do modelo'}
        </Botao>
      </Vazio>
    )
  }

  const itens = secoes.flatMap((s) => s.itens)
  const feitos = itens.filter((i) => i.feito).length

  return (
    <div className="max-w-4xl space-y-4">
      <div className="rounded-card border border-line bg-surface p-4">
        <p className="mb-2 text-sm font-medium">Progresso do lançamento</p>
        <Progresso feitos={feitos} total={itens.length} />
      </div>

      <div className="space-y-2">
        <Ordenavel itens={secoes} onOrdenar={ordenarSecoes}>
          {(s, alca) => <Secao secao={s} alca={alca} membros={membros} salvar={salvar} ofertaId={ofertaId} />}
        </Ordenavel>
      </div>

      {novaSecao === null ? (
        <button onClick={() => setNovaSecao('')} className={`${botaoTexto} bg-surface-2`}>
          + Seção
        </button>
      ) : (
        <div className="flex max-w-md gap-2">
          <input
            autoFocus
            value={novaSecao}
            onChange={(e) => setNovaSecao(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') adicionarSecao()
              if (e.key === 'Escape') setNovaSecao(null)
            }}
            placeholder="Nome da seção"
            className={pequeno}
          />
          <button onClick={adicionarSecao} className="rounded-control bg-accent px-3 py-1 text-xs font-medium text-accent-ink">
            Adicionar
          </button>
          <button onClick={() => setNovaSecao(null)} className="text-xs text-muted hover:text-ink">
            Cancelar
          </button>
        </div>
      )}
    </div>
  )
}

function Secao({
  secao,
  alca,
  membros,
  salvar,
  ofertaId,
}: {
  secao: SecaoOferta
  alca: React.ReactNode
  membros: Membro[]
  salvar: (op: PromiseLike<Resultado>) => Promise<boolean>
  ofertaId: string
}) {
  const chave = `checklist_oferta_${ofertaId}_${secao.id}`
  const feitos = secao.itens.filter((i) => i.feito).length
  const [aberta, setAberta] = useState(() => lerLocal<boolean>(chave, feitos < secao.itens.length))
  const [titulo, setTitulo] = useState(secao.titulo)
  const [editando, setEditando] = useState(false)
  const [confirmar, setConfirmar] = useState(false)
  const [novo, setNovo] = useState<string | null>(null)

  const alternar = () =>
    setAberta((a) => {
      gravarLocal(chave, !a)
      return !a
    })

  async function salvarTitulo() {
    setEditando(false)
    if (titulo.trim() && titulo.trim() !== secao.titulo) await salvar(ops().from('checklists').update({ titulo: titulo.trim() }).eq('id', secao.id))
    else setTitulo(secao.titulo)
  }

  async function adicionar() {
    const texto = novo?.trim()
    if (!texto) return
    setNovo('')
    const ordem = Math.max(0, ...secao.itens.map((i) => i.ordem)) + 1
    await salvar(ops().from('checklist_itens').insert({ checklist_id: secao.id, texto, ordem }))
  }

  function ordenar(ids: string[]) {
    salvar(todos(ids.map((id, n) => ops().from('checklist_itens').update({ ordem: n + 1 }).eq('id', id))))
  }

  return (
    <section className="rounded-card border border-line bg-surface">
      <header className="flex items-center gap-2 px-3 py-2.5">
        {alca}
        <button onClick={alternar} aria-expanded={aberta} className="w-4 text-muted hover:text-ink" aria-label={aberta ? 'Recolher seção' : 'Abrir seção'}>
          {aberta ? '▾' : '▸'}
        </button>
        {editando ? (
          <input
            autoFocus
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            onBlur={salvarTitulo}
            onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
            className={`${pequeno} max-w-sm font-medium`}
          />
        ) : (
          <button onClick={alternar} onDoubleClick={() => setEditando(true)} className="min-w-0 flex-1 truncate text-left text-sm font-semibold">
            {secao.titulo}
          </button>
        )}
        <div className="w-36 shrink-0">
          <Progresso feitos={feitos} total={secao.itens.length} fina />
        </div>
        <button onClick={() => setEditando(true)} className={botaoTexto}>
          Renomear
        </button>
        {!confirmar && (
          <button onClick={() => setConfirmar(true)} className={`${botaoTexto} hover:text-bad`}>
            Excluir
          </button>
        )}
      </header>

      {confirmar && (
        <div className="mx-3 mb-2 flex flex-wrap items-center gap-2 rounded-control bg-bad-soft px-3 py-2 text-sm text-bad">
          Excluir a seção {secao.titulo} e os {secao.itens.length} itens?
          <button onClick={() => salvar(ops().from('checklists').delete().eq('id', secao.id))} className="ml-auto rounded-control bg-bad px-2.5 py-1 text-xs font-medium text-white">
            Excluir
          </button>
          <button onClick={() => setConfirmar(false)} className="text-xs">
            Cancelar
          </button>
        </div>
      )}

      {aberta && (
        <div className="border-t border-line px-3 py-2">
          <div className="space-y-0.5">
            <Ordenavel itens={secao.itens} onOrdenar={ordenar}>
              {(item, alcaItem) => <Item item={item} alca={alcaItem} membros={membros} salvar={salvar} />}
            </Ordenavel>
          </div>
          {novo === null ? (
            <button onClick={() => setNovo('')} className={`${botaoTexto} mt-1 ml-6`}>
              + Item
            </button>
          ) : (
            <div className="mt-1 ml-6 flex gap-2">
              <input
                autoFocus
                value={novo}
                onChange={(e) => setNovo(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    adicionar()
                  }
                  if (e.key === 'Escape') setNovo(null)
                }}
                onBlur={() => !novo.trim() && setNovo(null)}
                placeholder="Novo item (Enter adiciona)"
                className={pequeno}
              />
              <button onMouseDown={(e) => e.preventDefault()} onClick={adicionar} className="rounded-control bg-accent px-3 py-1 text-xs font-medium text-accent-ink">
                Adicionar
              </button>
            </div>
          )}
        </div>
      )}
    </section>
  )
}

function Item({
  item,
  alca,
  membros,
  salvar,
}: {
  item: ItemOferta
  alca: React.ReactNode
  membros: Membro[]
  salvar: (op: PromiseLike<Resultado>) => Promise<boolean>
}) {
  const [editando, setEditando] = useState(false)
  const [detalhes, setDetalhes] = useState(false)
  const [texto, setTexto] = useState(item.texto)
  const [nota, setNota] = useState(item.nota ?? '')
  const quem = membros.find((m) => m.user_id === item.feito_por)?.nome
  const ehLink = /^(https?:\/\/|www\.)\S+$/i.test(item.nota?.trim() ?? '')

  async function sair() {
    setEditando(false)
    const t = texto.trim()
    if (!t) return setTexto(item.texto)
    if (t !== item.texto) await salvar(ops().from('checklist_itens').update({ texto: t }).eq('id', item.id))
  }

  const situacao = item.prazo && !item.feito ? situacaoPrazo(item.prazo) : null
  const corPrazo = situacao === 'vencido' ? 'bg-bad-soft text-bad' : situacao === 'perto' ? 'bg-warn-soft text-warn' : 'bg-surface-2 text-muted'

  return (
    <div className="rounded-md py-0.5 pr-1 hover:bg-surface-2/60">
      <div className="flex items-center gap-1.5">
        {alca}
        <input
          type="checkbox"
          checked={item.feito}
          onChange={(e) => salvar(ops().from('checklist_itens').update({ feito: e.target.checked }).eq('id', item.id))}
          aria-label={item.texto}
          className="h-4 w-4 shrink-0 accent-[var(--c-good)]"
        />
        {editando ? (
          <input autoFocus value={texto} onChange={(e) => setTexto(e.target.value)} onBlur={sair} onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()} className={pequeno} />
        ) : (
          <button onClick={() => setEditando(true)} className={`min-w-0 flex-1 px-1 text-left text-sm break-words ${item.feito ? 'text-muted line-through' : ''}`}>
            {item.texto}
          </button>
        )}
        {item.prazo && (
          <span className={`shrink-0 rounded-full px-2 py-px text-[11px] ${corPrazo}`} title="Prazo">
            {situacao === 'vencido' ? '! ' : ''}
            {prazoCurto(item.prazo)}
          </span>
        )}
        {item.nota &&
          (ehLink ? (
            <a href={normalizarUrl(item.nota)} target="_blank" rel="noreferrer" className="shrink-0 text-xs text-info hover:underline">
              Link
            </a>
          ) : (
            <span className="shrink-0 text-xs text-muted" title={item.nota}>
              Nota
            </span>
          ))}
        <button onClick={() => setDetalhes((d) => !d)} aria-expanded={detalhes} className={`${botaoTexto} shrink-0`}>
          {detalhes ? 'Fechar' : 'Detalhes'}
        </button>
      </div>
      {item.feito && item.feito_em && (
        <p className="ml-11 text-[11px] text-muted">
          feito por {quem ?? 'alguém'} em {formatarDataHora(item.feito_em)}
        </p>
      )}
      {detalhes && (
        <div className="mt-1 ml-11 grid gap-2 rounded-control bg-surface-2 p-2 sm:grid-cols-[10rem_1fr_auto]">
          <label className="text-xs text-muted">
            Prazo
            <input
              type="date"
              value={item.prazo ?? ''}
              onChange={(e) => salvar(ops().from('checklist_itens').update({ prazo: e.target.value || null }).eq('id', item.id))}
              className={`${pequeno} mt-0.5 text-ink`}
            />
          </label>
          <label className="text-xs text-muted">
            Anotação ou link
            <input
              value={nota}
              onChange={(e) => setNota(e.target.value)}
              onBlur={() => (nota.trim() || null) !== (item.nota ?? null) && salvar(ops().from('checklist_itens').update({ nota: nota.trim() || null }).eq('id', item.id))}
              placeholder="Opcional"
              className={`${pequeno} mt-0.5 text-ink`}
            />
          </label>
          <button onClick={() => salvar(ops().from('checklist_itens').delete().eq('id', item.id))} className={`${botaoTexto} self-end hover:text-bad`}>
            Excluir item
          </button>
        </div>
      )}
    </div>
  )
}
