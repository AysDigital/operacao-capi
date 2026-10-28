import { useCallback, useEffect, useState } from 'react'
import { Carregando } from '../../../components/ds'
import type { Membro } from '../../../lib/card'
import { caminhosNoTexto, ehDoCard, removerArquivos } from '../../../lib/arquivos'
import { formatarDataHora } from '../../../lib/format'
import { gravarLocal, lerLocal } from '../../../lib/quadro'
import { ops } from '../../../lib/supabase'
import { Avatar, botaoPequeno, ICONES, TituloSecao, type Salvar } from './comum'
import { EditorTexto, TextoFormatado } from './Texto'

type Comentario = { id: string; autor_id: string | null; texto: string; criado_em: string; editado_em: string | null }
type Atividade = { id: string; autor_id: string | null; tipo: string; texto: string; criado_em: string }
type Entrada = ({ tipo: 'comentario' } & Comentario) | ({ tipo: 'atividade' } & Atividade)

/** Comentários do card; com "Mostrar detalhes", o histórico entra junto, em ordem cronológica. */
export function ComentariosEAtividade({
  cardId,
  membros,
  euId,
  versao,
  salvar,
}: {
  cardId: string
  membros: Membro[]
  euId: string | null
  /** muda a cada gravação no card, para recarregar o histórico */
  versao: number
  salvar: Salvar
}) {
  const [comentarios, setComentarios] = useState<Comentario[] | null>(null)
  const [atividades, setAtividades] = useState<Atividade[]>([])
  const [detalhes, setDetalhes] = useState(() => lerLocal('card_mostrar_detalhes', false))
  const [novo, setNovo] = useState('')
  const [enviando, setEnviando] = useState(false)

  const carregar = useCallback(async () => {
    const [c, a] = await Promise.all([
      ops().from('comentarios').select('id, autor_id, texto, criado_em, editado_em').eq('card_id', cardId).order('criado_em', { ascending: false }),
      ops().from('atividades').select('id, autor_id, tipo, texto, criado_em').eq('card_id', cardId).neq('tipo', 'comentario').order('criado_em', { ascending: false }),
    ])
    if (c.data) setComentarios(c.data)
    if (a.data) setAtividades(a.data)
  }, [cardId])

  useEffect(() => {
    carregar()
  }, [carregar, versao])

  const nome = (id: string | null) => membros.find((m) => m.user_id === id)?.nome ?? 'Sistema'
  const cor = (id: string | null) => membros.find((m) => m.user_id === id)?.cor ?? null

  async function comentar() {
    if (!novo.trim()) return
    setEnviando(true)
    const ok = await salvar(ops().from('comentarios').insert({ card_id: cardId, texto: novo.trim(), autor_id: euId }))
    setEnviando(false)
    if (ok) setNovo('')
  }

  const entradas: Entrada[] = [
    ...(comentarios ?? []).map((c) => ({ ...c, tipo: 'comentario' as const })),
    ...(detalhes ? atividades.map((a) => ({ ...a, tipo: 'atividade' as const })) : []),
  ].sort((a, b) => b.criado_em.localeCompare(a.criado_em))

  return (
    <section>
      <TituloSecao
        icone={ICONES.atividade}
        acoes={
          <button
            onClick={() =>
              setDetalhes((d) => {
                gravarLocal('card_mostrar_detalhes', !d)
                return !d
              })
            }
            className={`${botaoPequeno} bg-surface-2`}
          >
            {detalhes ? 'Ocultar detalhes' : 'Mostrar detalhes'}
          </button>
        }
      >
        Comentários e atividade
      </TituloSecao>

      <div
        className="mb-4"
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) comentar()
        }}
      >
        <EditorTexto valor={novo} onMudar={setNovo} placeholder="Escrever um comentário…" linhas={2} cardId={cardId} />
        {novo.trim() && (
          <button onClick={comentar} disabled={enviando} className="mt-1.5 rounded-control bg-accent px-3 py-1 text-xs font-medium text-accent-ink disabled:opacity-50">
            {enviando ? 'Enviando…' : 'Comentar'}
          </button>
        )}
      </div>

      {!comentarios ? (
        <Carregando linhas={3} />
      ) : entradas.length === 0 ? (
        <p className="text-sm text-muted">{detalhes ? 'Nada por aqui ainda.' : 'Nenhum comentário ainda.'}</p>
      ) : (
        <ol className="space-y-3">
          {entradas.map((e) =>
            e.tipo === 'comentario' ? (
              <ItemComentario key={`c${e.id}`} c={e} cardId={cardId} nome={nome(e.autor_id)} cor={cor(e.autor_id)} meu={e.autor_id === euId} salvar={salvar} />
            ) : (
              <li key={`a${e.id}`} className="flex gap-2 text-sm">
                <Avatar nome={nome(e.autor_id)} cor={cor(e.autor_id)} tamanho="h-6 w-6 text-[10px]" />
                <p className="min-w-0 flex-1 text-muted">
                  <strong className="font-medium text-ink">{nome(e.autor_id)}</strong> {e.texto}
                  <span className="block text-xs">{formatarDataHora(e.criado_em)}</span>
                </p>
              </li>
            ),
          )}
        </ol>
      )}
    </section>
  )
}

function ItemComentario({
  c,
  cardId,
  nome,
  cor,
  meu,
  salvar,
}: {
  c: Comentario
  cardId: string
  nome: string
  cor: string | null
  meu: boolean
  salvar: Salvar
}) {
  const [editando, setEditando] = useState(false)
  const [texto, setTexto] = useState(c.texto)
  const [confirmarExcluir, setConfirmarExcluir] = useState(false)

  async function salvarEdicao() {
    if (!texto.trim()) return
    if (await salvar(ops().from('comentarios').update({ texto: texto.trim() }).eq('id', c.id))) {
      setEditando(false)
      // imagens que saíram do texto na edição
      const ficaram = caminhosNoTexto(texto)
      removerArquivos(caminhosNoTexto(c.texto).filter((x) => !ficaram.includes(x) && ehDoCard(cardId, x)))
    }
  }

  async function excluir() {
    if (await salvar(ops().from('comentarios').delete().eq('id', c.id))) removerArquivos(caminhosNoTexto(c.texto).filter((x) => ehDoCard(cardId, x)))
  }

  return (
    <li className="flex gap-2">
      <Avatar nome={nome} cor={cor} tamanho="h-6 w-6 text-[10px]" />
      <div className="min-w-0 flex-1">
        <p className="text-sm">
          <strong className="font-medium">{nome}</strong>{' '}
          <span className="text-xs text-muted">
            {formatarDataHora(c.criado_em)}
            {c.editado_em && ' (editado)'}
          </span>
        </p>
        {editando ? (
          <div className="mt-1">
            <EditorTexto valor={texto} onMudar={setTexto} linhas={3} autoFocus cardId={cardId} />
            <div className="mt-1.5 flex gap-2">
              <button onClick={salvarEdicao} className="rounded-control bg-accent px-3 py-1 text-xs font-medium text-accent-ink">
                Salvar
              </button>
              <button
                onClick={() => {
                  setTexto(c.texto)
                  setEditando(false)
                }}
                className="text-xs text-muted hover:text-ink"
              >
                Cancelar
              </button>
            </div>
          </div>
        ) : (
          <div className="mt-1 rounded-control border border-line bg-surface px-3 py-1.5">
            <TextoFormatado texto={c.texto} />
          </div>
        )}
        {meu && !editando && (
          <div className="mt-0.5 flex items-center gap-2 text-xs text-muted">
            {confirmarExcluir ? (
              <>
                <span className="text-bad">Excluir este comentário?</span>
                <button onClick={excluir} className="font-medium text-bad hover:underline">
                  Excluir
                </button>
                <button onClick={() => setConfirmarExcluir(false)} className="hover:text-ink">
                  Cancelar
                </button>
              </>
            ) : (
              <>
                <button onClick={() => setEditando(true)} className="hover:text-ink hover:underline">
                  Editar
                </button>
                ·
                <button onClick={() => setConfirmarExcluir(true)} className="hover:text-ink hover:underline">
                  Excluir
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </li>
  )
}
