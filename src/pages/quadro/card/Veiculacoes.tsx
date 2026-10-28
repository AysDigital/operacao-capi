import { useEffect, useState } from 'react'
import { Popover } from '../../../components/ds'
import { useToast } from '../../../components/Toast'
import { CATEGORIAS_REJEICAO, extrairIdAnuncio, type CardDetalhe, type VeiculacaoDetalhe } from '../../../lib/card'
import { STATUS_VEICULACAO, type ContaQuadro, type StatusVeiculacao } from '../../../lib/quadro'
import { ops } from '../../../lib/supabase'
import { botaoPequeno, campoPequeno, ICONES, TituloSecao, type Atualizar, type Salvar } from './comum'

const COR_STATUS: Record<StatusVeiculacao, string> = {
  nao_subido: 'border-line',
  em_analise: 'border-warn',
  rodando: 'border-good',
  rejeitado: 'border-bad',
  pausado: 'border-line',
}

/** Data (dia) em Brasília para o campo de data, a partir do timestamp do banco. */
const diaDe = (iso: string) => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date(iso))

export function Veiculacoes({
  card,
  contas,
  salvar,
  atualizar,
}: {
  card: CardDetalhe
  contas: ContaQuadro[]
  salvar: Salvar
  atualizar: Atualizar
}) {
  const porConta = new Map(contas.map((c) => [c.id, c]))
  const linhas = [...card.veiculacoes].sort((a, b) =>
    (porConta.get(a.conta_id)?.apelido ?? '').localeCompare(porConta.get(b.conta_id)?.apelido ?? '', 'pt-BR', { numeric: true }),
  )
  const livres = contas.filter((c) => c.ativa && !card.veiculacoes.some((v) => v.conta_id === c.id))

  return (
    <section>
      <TituloSecao icone={ICONES.veiculacao}>Veiculação por conta</TituloSecao>

      {linhas.length === 0 && <p className="mb-2 text-sm text-muted">Este card ainda não foi subido em nenhuma conta.</p>}

      <div className="space-y-2">
        {linhas.map((v) => (
          <LinhaVeiculacao key={v.id} v={v} conta={porConta.get(v.conta_id)} card={card} salvar={salvar} atualizar={atualizar} />
        ))}
      </div>

      <Popover
        titulo="Subir em outra conta"
        largura="w-64"
        gatilho={(alternar) => (
          <button onClick={alternar} className={`${botaoPequeno} mt-2 bg-surface-2`}>
            + Subir em outra conta
          </button>
        )}
      >
        {(fechar) =>
          livres.length === 0 ? (
            <p className="text-sm text-muted">Todas as contas ativas já estão neste card.</p>
          ) : (
            <div className="space-y-0.5">
              {livres.map((c) => (
                <button
                  key={c.id}
                  onClick={() => {
                    fechar()
                    salvar(ops().from('veiculacoes').insert({ card_id: card.id, conta_id: c.id, status: 'em_analise' }))
                  }}
                  className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-surface-2"
                >
                  <span className="rounded bg-info-soft px-1.5 font-mono text-xs font-semibold text-info">{c.apelido}</span>
                  <span className="truncate">
                    {c.nome}
                    {c.bm_nome && <span className="text-muted"> · {c.bm_nome}</span>}
                  </span>
                </button>
              ))}
            </div>
          )
        }
      </Popover>
    </section>
  )
}

function LinhaVeiculacao({
  v,
  conta,
  card,
  salvar,
  atualizar,
}: {
  v: VeiculacaoDetalhe
  conta: ContaQuadro | undefined
  card: CardDetalhe
  salvar: Salvar
  atualizar: Atualizar
}) {
  const toast = useToast()
  const [idAnuncio, setIdAnuncio] = useState(v.meta_ad_id ?? '')
  const [motivo, setMotivo] = useState(v.motivo_rejeicao ?? '')
  const [confirmarRemover, setConfirmarRemover] = useState(false)

  useEffect(() => setIdAnuncio(v.meta_ad_id ?? ''), [v.meta_ad_id])
  useEffect(() => setMotivo(v.motivo_rejeicao ?? ''), [v.motivo_rejeicao])

  const mudar = (campos: Partial<VeiculacaoDetalhe>) => {
    atualizar((c) => ({ ...c, veiculacoes: c.veiculacoes.map((x) => (x.id === v.id ? { ...x, ...campos } : x)) }))
    return salvar(ops().from('veiculacoes').update(campos).eq('id', v.id))
  }

  /** Aceita o número ou um link do Gerenciador; avisa em qual card o ID já está, se repetir. */
  async function salvarId(texto: string) {
    const t = texto.trim()
    if (!t) {
      if (v.meta_ad_id) await mudar({ meta_ad_id: null })
      return
    }
    const id = extrairIdAnuncio(t)
    if (!id) {
      toast('ruim', 'Não achei o ID do anúncio nesse texto. Cole o número ou o link do anúncio no Gerenciador.')
      return setIdAnuncio(v.meta_ad_id ?? '')
    }
    setIdAnuncio(id)
    if (id === v.meta_ad_id) return
    const { data: outro } = await ops().from('veiculacoes').select('card_id, cards(nome)').eq('meta_ad_id', id).neq('id', v.id).maybeSingle()
    if (outro) {
      const nome = (outro.cards as unknown as { nome: string } | null)?.nome
      toast('ruim', outro.card_id === card.id ? 'Esse ID de anúncio já está em outra conta deste card.' : `Esse ID de anúncio já está no card ${nome ?? ''}.`)
      return setIdAnuncio(v.meta_ad_id ?? '')
    }
    await mudar({ meta_ad_id: id })
  }

  const rejeitado = v.status === 'rejeitado'

  return (
    <div className={`rounded-control border-l-4 bg-surface-2/60 p-3 ${COR_STATUS[v.status]}`}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded bg-surface px-1.5 py-0.5 font-mono text-xs font-semibold">{conta?.apelido ?? '?'}</span>
        <span className="min-w-0 flex-1 truncate text-sm">
          {conta?.nome}
          {conta?.bm_nome && <span className="text-muted"> · {conta.bm_nome}</span>}
          {conta && !conta.ativa && <span className="text-muted"> (inativa)</span>}
        </span>
        {!confirmarRemover ? (
          <button onClick={() => setConfirmarRemover(true)} className={`${botaoPequeno} hover:text-bad`}>
            Remover
          </button>
        ) : (
          <span className="flex items-center gap-2 text-xs text-bad">
            Remover esta conta do card?
            <button onClick={() => salvar(ops().from('veiculacoes').delete().eq('id', v.id))} className="rounded-control bg-bad px-2 py-0.5 font-medium text-white">
              Remover
            </button>
            <button onClick={() => setConfirmarRemover(false)} className="text-muted hover:text-ink">
              Cancelar
            </button>
          </span>
        )}
      </div>

      <div className="mt-2 grid gap-2 sm:grid-cols-[10rem_1fr_9.5rem]">
        <label className="text-xs text-muted">
          Status
          <select value={v.status} onChange={(e) => mudar({ status: e.target.value as StatusVeiculacao })} className={`${campoPequeno} mt-0.5 text-ink`}>
            {Object.entries(STATUS_VEICULACAO).map(([valor, s]) => (
              <option key={valor} value={valor}>
                {s.icone} {s.nome}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs text-muted">
          ID do anúncio no Meta
          <input
            value={idAnuncio}
            onChange={(e) => setIdAnuncio(e.target.value)}
            onPaste={(e) => {
              e.preventDefault()
              const colado = e.clipboardData.getData('text')
              setIdAnuncio(colado)
              salvarId(colado)
            }}
            onBlur={() => salvarId(idAnuncio)}
            placeholder="Número ou link do anúncio"
            className={`${campoPequeno} mt-0.5 font-mono text-ink`}
          />
        </label>
        <label className="text-xs text-muted">
          Data do status
          <input
            type="date"
            value={diaDe(v.data_status)}
            onChange={(e) => e.target.value && mudar({ data_status: `${e.target.value}T12:00:00-03:00` })}
            className={`${campoPequeno} mt-0.5 text-ink`}
          />
        </label>
      </div>

      {rejeitado && (
        <div className="mt-2 grid gap-2 sm:grid-cols-[1fr_14rem]">
          <label className="text-xs text-muted">
            Motivo da rejeição
            <textarea
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              onBlur={() => (motivo.trim() || null) !== (v.motivo_rejeicao ?? null) && mudar({ motivo_rejeicao: motivo.trim() || null })}
              rows={2}
              placeholder="O que a Meta disse"
              className={`${campoPequeno} mt-0.5 resize-y text-ink`}
            />
          </label>
          <label className="text-xs text-muted">
            Categoria
            <select
              value={v.categoria_rejeicao ?? ''}
              onChange={(e) => mudar({ categoria_rejeicao: e.target.value || null })}
              className={`${campoPequeno} mt-0.5 text-ink`}
            >
              <option value="">Escolha</option>
              {CATEGORIAS_REJEICAO.map((c) => (
                <option key={c.valor} value={c.valor}>
                  {c.nome}
                </option>
              ))}
            </select>
          </label>
        </div>
      )}
    </div>
  )
}
