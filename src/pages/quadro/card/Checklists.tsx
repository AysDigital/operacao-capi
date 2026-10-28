import { useState } from 'react'
import type { CardDetalhe, Checklist, ItemChecklist } from '../../../lib/card'
import { ops } from '../../../lib/supabase'
import { Ordenavel } from './Ordenavel'
import { botaoPequeno, campoPequeno, ICONES, TituloSecao, todos, type Atualizar, type Salvar } from './comum'

export function Checklists({ card, salvar, atualizar }: { card: CardDetalhe; salvar: Salvar; atualizar: Atualizar }) {
  if (card.checklists.length === 0) return null
  return (
    <div className="space-y-6">
      {card.checklists.map((c) => (
        <UmChecklist key={c.id} lista={c} salvar={salvar} atualizar={atualizar} />
      ))}
    </div>
  )
}

function UmChecklist({ lista, salvar, atualizar }: { lista: Checklist; salvar: Salvar; atualizar: Atualizar }) {
  const [editandoTitulo, setEditandoTitulo] = useState(false)
  const [titulo, setTitulo] = useState(lista.titulo)
  const [confirmarExcluir, setConfirmarExcluir] = useState(false)
  const [novo, setNovo] = useState<string | null>(null)

  const feitos = lista.itens.filter((i) => i.feito).length
  const pct = lista.itens.length ? Math.round((feitos / lista.itens.length) * 100) : 0

  const mudarItens = (f: (itens: ItemChecklist[]) => ItemChecklist[]) =>
    atualizar((c) => ({ ...c, checklists: c.checklists.map((l) => (l.id === lista.id ? { ...l, itens: f(l.itens) } : l)) }))

  async function salvarTitulo() {
    setEditandoTitulo(false)
    if (titulo.trim() && titulo.trim() !== lista.titulo) await salvar(ops().from('checklists').update({ titulo: titulo.trim() }).eq('id', lista.id))
    else setTitulo(lista.titulo)
  }

  async function adicionar() {
    const texto = novo?.trim()
    if (!texto) return
    setNovo('')
    const ordem = Math.max(0, ...lista.itens.map((i) => i.ordem)) + 1
    await salvar(ops().from('checklist_itens').insert({ checklist_id: lista.id, texto, ordem }))
  }

  function marcar(item: ItemChecklist, feito: boolean) {
    mudarItens((itens) => itens.map((i) => (i.id === item.id ? { ...i, feito } : i)))
    salvar(ops().from('checklist_itens').update({ feito }).eq('id', item.id))
  }

  function ordenar(ids: string[]) {
    mudarItens((itens) => ids.map((id, n) => ({ ...itens.find((i) => i.id === id)!, ordem: n + 1 })))
    salvar(todos(ids.map((id, n) => ops().from('checklist_itens').update({ ordem: n + 1 }).eq('id', id))))
  }

  return (
    <section>
      <TituloSecao
        icone={ICONES.checklist}
        acoes={
          !confirmarExcluir && (
            <button onClick={() => setConfirmarExcluir(true)} className={botaoPequeno}>
              Excluir
            </button>
          )
        }
      >
        {editandoTitulo ? (
          <input
            autoFocus
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            onBlur={salvarTitulo}
            onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
            className={campoPequeno}
          />
        ) : (
          <button onClick={() => setEditandoTitulo(true)} className="text-left hover:text-accent-strong">
            {lista.titulo}
          </button>
        )}
      </TituloSecao>

      {confirmarExcluir && (
        <div className="mb-2 flex flex-wrap items-center gap-2 rounded-control bg-bad-soft px-3 py-2 text-sm text-bad">
          Excluir o checklist {lista.titulo} e os {lista.itens.length} itens?
          <button onClick={() => salvar(ops().from('checklists').delete().eq('id', lista.id))} className="ml-auto rounded-control bg-bad px-2.5 py-1 text-xs font-medium text-white">
            Excluir
          </button>
          <button onClick={() => setConfirmarExcluir(false)} className="text-xs">
            Cancelar
          </button>
        </div>
      )}

      <div className="mb-2 flex items-center gap-2">
        <span className="w-9 text-right text-xs text-muted tabular-nums">{pct}%</span>
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-2" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
          <div className={`h-full rounded-full transition-all ${pct === 100 ? 'bg-good' : 'bg-info'}`} style={{ width: `${pct}%` }} />
        </div>
      </div>

      <div className="space-y-0.5">
        <Ordenavel itens={lista.itens} onOrdenar={ordenar}>
          {(item, alca) => <Item item={item} alca={alca} onMarcar={marcar} salvar={salvar} />}
        </Ordenavel>
      </div>

      {novo === null ? (
        <button onClick={() => setNovo('')} className={`${botaoPequeno} mt-1 ml-6 bg-surface-2`}>
          Adicionar um item
        </button>
      ) : (
        <div className="mt-1 ml-6 space-y-1.5">
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
            className={campoPequeno}
          />
          <div className="flex gap-2">
            <button onMouseDown={(e) => e.preventDefault()} onClick={adicionar} className="rounded-control bg-accent px-3 py-1 text-xs font-medium text-accent-ink">
              Adicionar
            </button>
            <button onClick={() => setNovo(null)} className="text-xs text-muted hover:text-ink">
              Fechar
            </button>
          </div>
        </div>
      )}
    </section>
  )
}

function Item({
  item,
  alca,
  onMarcar,
  salvar,
}: {
  item: ItemChecklist
  alca: React.ReactNode
  onMarcar: (i: ItemChecklist, feito: boolean) => void
  salvar: Salvar
}) {
  const [editando, setEditando] = useState(false)
  const [texto, setTexto] = useState(item.texto)

  async function sair() {
    setEditando(false)
    const t = texto.trim()
    if (!t) return setTexto(item.texto)
    if (t !== item.texto) await salvar(ops().from('checklist_itens').update({ texto: t }).eq('id', item.id))
  }

  return (
    <div className="flex items-center gap-1.5 rounded-md py-0.5 pr-1 hover:bg-surface-2">
      {alca}
      <input
        type="checkbox"
        checked={item.feito}
        onChange={(e) => onMarcar(item, e.target.checked)}
        aria-label={item.texto}
        className="h-4 w-4 shrink-0 accent-[var(--c-good)]"
      />
      {editando ? (
        <input
          autoFocus
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          onBlur={sair}
          onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
          className={campoPequeno}
        />
      ) : (
        <button onClick={() => setEditando(true)} className={`min-w-0 flex-1 px-1 text-left text-sm break-words ${item.feito ? 'text-muted line-through' : ''}`}>
          {item.texto}
        </button>
      )}
      <button
        onClick={() => salvar(ops().from('checklist_itens').delete().eq('id', item.id))}
        aria-label={`Excluir item ${item.texto}`}
        title="Excluir item"
        className="shrink-0 px-1 text-muted opacity-0 group-hover:opacity-100 hover:text-bad focus:opacity-100"
      >
        ×
      </button>
    </div>
  )
}
