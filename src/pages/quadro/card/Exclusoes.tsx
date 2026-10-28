import { useCallback, useEffect, useState } from 'react'
import { Aviso, Modal } from '../../../components/ds'
import { useToast } from '../../../components/Toast'
import { Botao, entrada } from '../../../components/ui'
import { limparPastaDoCard } from '../../../lib/arquivos'
import { mensagemErro } from '../../../lib/cadastros'
import type { Lista } from '../../../lib/quadro'
import { ops } from '../../../lib/supabase'

/**
 * Confirmação de exclusão de card. Se alguma veiculação já tem ID de anúncio,
 * pede para digitar o nome do card (o histórico de rejeições também se perde).
 */
export function ConfirmarExclusaoCard({
  card,
  temIdAnuncio,
  onArquivar,
  onFechar,
  onExcluido,
}: {
  card: { id: string; nome: string }
  temIdAnuncio: boolean
  /** alternativa oferecida no lugar de excluir (omitir se o card já está arquivado) */
  onArquivar?: () => void
  onFechar: () => void
  onExcluido: () => void
}) {
  const toast = useToast()
  const [digitado, setDigitado] = useState('')
  const [excluindo, setExcluindo] = useState(false)
  const liberado = !temIdAnuncio || digitado.trim() === card.nome

  async function excluir() {
    setExcluindo(true)
    const { error } = await ops().from('cards').delete().eq('id', card.id)
    setExcluindo(false)
    if (error) return toast('ruim', mensagemErro(error))
    // só depois que o card saiu do banco: as imagens dele não servem mais
    await limparPastaDoCard(card.id)
    toast('bom', `${card.nome} excluído.`)
    onExcluido()
  }

  return (
    <Modal
      titulo="Excluir card"
      onFechar={onFechar}
      rodape={
        <>
          {onArquivar && (
            <Botao variante="secundario" onClick={onArquivar}>
              Arquivar em vez disso
            </Botao>
          )}
          <button
            onClick={excluir}
            disabled={!liberado || excluindo}
            className="ml-auto rounded-control bg-bad px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
          >
            {excluindo ? 'Excluindo…' : 'Excluir permanentemente'}
          </button>
        </>
      }
    >
      <div className="space-y-3 text-sm">
        <p>
          Excluir <strong className="font-mono">{card.nome}</strong>?
        </p>
        <Aviso tom="ruim">
          A exclusão é permanente e apaga anexos, comentários, checklists, histórico e veiculações do card, inclusive o histórico de rejeições.
          Se outros cards foram criados a partir dele, eles continuam e só perdem a ligação com a origem.
        </Aviso>
        {onArquivar && <p className="text-muted">Para tirar o card do quadro sem perder nada, arquive.</p>}
        {temIdAnuncio && (
          <label className="block">
            Este card já tem ID de anúncio no Meta. Para confirmar, digite o nome do card:
            <input value={digitado} onChange={(e) => setDigitado(e.target.value)} className={`${entrada} font-mono`} placeholder={card.nome} autoFocus />
          </label>
        )}
      </div>
    </Modal>
  )
}

/**
 * Exclusão de lista: só com a lista vazia em TODOS os quadros (inclusive cards arquivados).
 * Se tiver cards, oferece movê-los antes.
 */
export function ExcluirLista({
  lista,
  destinos,
  onExcluida,
  onCancelar,
}: {
  lista: Lista
  /** listas ativas para onde os cards podem ir */
  destinos: Lista[]
  onExcluida: () => void
  onCancelar: () => void
}) {
  const toast = useToast()
  const [qtd, setQtd] = useState<number | null>(null)
  const [para, setPara] = useState('')
  const [mexendo, setMexendo] = useState(false)
  const opcoes = destinos.filter((l) => l.id !== lista.id)

  const contar = useCallback(async () => {
    const { count, error } = await ops().from('cards').select('id', { count: 'exact', head: true }).eq('lista_id', lista.id)
    if (error) toast('ruim', mensagemErro(error))
    else setQtd(count ?? 0)
  }, [lista.id, toast])

  useEffect(() => {
    contar()
  }, [contar])

  async function moverTodos() {
    if (!para) return
    setMexendo(true)
    const { error } = await ops().rpc('esvaziar_lista', { p_de: lista.id, p_para: para })
    setMexendo(false)
    if (error) return toast('ruim', mensagemErro(error))
    toast('bom', `Cards movidos para ${opcoes.find((l) => l.id === para)?.nome}.`)
    contar()
  }

  async function excluir() {
    setMexendo(true)
    const { error } = await ops().from('listas').delete().eq('id', lista.id)
    setMexendo(false)
    if (error) {
      toast('ruim', error.code === '23503' ? 'A lista ainda tem cards. Mova todos antes de excluir.' : mensagemErro(error))
      return contar()
    }
    toast('bom', `Lista ${lista.nome} excluída.`)
    onExcluida()
  }

  const cancelar = (
    <button onClick={onCancelar} className="px-2 text-sm text-muted hover:text-ink">
      Cancelar
    </button>
  )

  if (qtd === null) return <p className="text-sm text-muted">Conferindo os cards da lista…</p>

  if (qtd > 0) {
    return (
      <div className="space-y-2 text-sm">
        <p>
          A lista {lista.nome} tem <strong>{qtd}</strong> {qtd === 1 ? 'card' : 'cards'}, somando todos os quadros (inclusive arquivados). Mova todos
          antes de excluir:
        </p>
        <select value={para} onChange={(e) => setPara(e.target.value)} className="w-full rounded-md border border-line bg-surface px-2 py-1.5 text-sm" aria-label="Lista de destino">
          <option value="">Escolha a lista de destino</option>
          {opcoes.map((l) => (
            <option key={l.id} value={l.id}>
              {l.nome}
            </option>
          ))}
        </select>
        <div className="flex gap-2">
          <button onClick={moverTodos} disabled={!para || mexendo} className="rounded-control bg-accent px-3 py-1.5 text-sm font-medium text-accent-ink disabled:opacity-40">
            Mover todos os cards
          </button>
          {cancelar}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-2 text-sm">
      <p>
        Excluir a lista {lista.nome}? Ela some de <strong>todos os quadros</strong>, e isso não pode ser desfeito.
      </p>
      <div className="flex gap-2">
        <button onClick={excluir} disabled={mexendo} className="rounded-control bg-bad px-3 py-1.5 text-sm font-medium text-white disabled:opacity-40">
          Excluir lista
        </button>
        {cancelar}
      </div>
    </div>
  )
}
