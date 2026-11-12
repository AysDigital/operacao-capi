import { useEffect, useState } from 'react'
import { Aviso, Dica, Popover } from '../../../components/ds'
import { useToast } from '../../../components/Toast'
import { CATEGORIAS_REJEICAO, extrairIdAnuncio, type CardDetalhe, type VeiculacaoDetalhe } from '../../../lib/card'
import { buscarFases, corFase, NOME_FASE, naoPausar, roasTexto, textoFase, VEREDITOS, type FaseVeiculacao } from '../../../lib/fases'
import { listarAnunciosDaConta, type AnuncioMeta } from '../../../lib/metricas'
import { buscarRanking, type Classe } from '../../../lib/ranking'
import { MandarNoBid } from '../MandarNoBid'
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

const AJUDA_ID = (
  <>
    <span className="block font-medium">Onde achar, no Gerenciador de Anúncios (aba Anúncios):</span>
    <span className="mt-1 block">
      <strong>Pelo link:</strong> marque a caixinha do anúncio (ou abra para editar) e copie o endereço da barra do navegador. Ele contém
      "selected_ad_ids=" seguido do número. Cole o link inteiro aqui: o app separa o ID sozinho.
    </span>
    <span className="mt-1 block">
      <strong>Pelo número:</strong> em Colunas → Personalizar colunas, ative "ID do anúncio" e copie o número da linha do anúncio.
    </span>
  </>
)

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

  // Fase do manual por veiculação e a classificação do card (para o botão No-Bid)
  const [fases, setFases] = useState<FaseVeiculacao[]>([])
  const [classe, setClasse] = useState<Classe | null>(null)
  const [versao, setVersao] = useState(0)
  const chave = card.veiculacoes.map((v) => `${v.id}:${v.status}:${v.meta_ad_id}`).join(',')
  useEffect(() => {
    let vivo = true
    buscarFases(null, card.id).then(
      (f) => vivo && setFases(f),
      () => vivo && setFases([]),
    )
    if (card.tipo === 'ad')
      buscarRanking(card.oferta_id, null, 'anuncio').then(
        (ls) => vivo && setClasse(ls.find((l) => l.cards.includes(card.id))?.classe ?? null),
        () => vivo && setClasse(null),
      )
    return () => {
      vivo = false
    }
  }, [card.id, card.oferta_id, card.tipo, chave, versao])

  return (
    <section>
      <TituloSecao icone={ICONES.veiculacao}>Veiculação por conta</TituloSecao>

      {linhas.length === 0 && <p className="mb-2 text-sm text-muted">Este card ainda não foi subido em nenhuma conta.</p>}

      <div className="space-y-2">
        {linhas.map((v) => (
          <LinhaVeiculacao
            key={v.id}
            v={v}
            conta={porConta.get(v.conta_id)}
            card={card}
            fase={fases.find((f) => f.veiculacao_id === v.id)}
            salvar={salvar}
            atualizar={atualizar}
          />
        ))}
      </div>

      {classe === 'mid_spender' && (
        <div className="mt-2 flex flex-wrap items-center gap-2 rounded-control bg-roxo-soft/60 px-3 py-2 text-sm">
          <span className="text-roxo">↗ Mid-spender: converte bem, mas gasta pouco no Bidcap.</span>
          <MandarNoBid
            cardId={card.id}
            contas={contas}
            jaEm={card.veiculacoes.map((v) => v.conta_id)}
            onFeito={() => {
              setVersao((n) => n + 1)
              salvar(Promise.resolve({ error: null }))
            }}
            classe="ml-auto rounded-control bg-roxo px-2.5 py-1 text-xs font-medium text-white hover:brightness-110"
          />
        </div>
      )}

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
  fase,
  salvar,
  atualizar,
}: {
  v: VeiculacaoDetalhe
  conta: ContaQuadro | undefined
  card: CardDetalhe
  fase: FaseVeiculacao | undefined
  salvar: Salvar
  atualizar: Atualizar
}) {
  const toast = useToast()
  const [confirmarPausa, setConfirmarPausa] = useState(false)
  const [idAnuncio, setIdAnuncio] = useState(v.meta_ad_id ?? '')
  // Rejeição: é um acontecimento. Registra (motivo, categoria, data) e a conta volta para "Não subido".
  const [rejeitando, setRejeitando] = useState(false)
  const [motivo, setMotivo] = useState(v.motivo_rejeicao ?? '')
  const [categoria, setCategoria] = useState(v.categoria_rejeicao ?? '')
  const [dataRej, setDataRej] = useState(diaDe(new Date().toISOString()))
  const [gravandoRej, setGravandoRej] = useState(false)
  const [confirmarRemover, setConfirmarRemover] = useState(false)

  useEffect(() => setIdAnuncio(v.meta_ad_id ?? ''), [v.meta_ad_id])
  useEffect(() => setMotivo(v.motivo_rejeicao ?? ''), [v.motivo_rejeicao])
  const [data, setData] = useState(diaDe(v.data_status))
  useEffect(() => setData(diaDe(v.data_status)), [v.data_status])

  const mudar = (campos: Partial<VeiculacaoDetalhe>) => {
    atualizar((c) => ({ ...c, veiculacoes: c.veiculacoes.map((x) => (x.id === v.id ? { ...x, ...campos } : x)) }))
    return salvar(ops().from('veiculacoes').update(campos).eq('id', v.id))
  }

  /** Aceita o número ou um link do Gerenciador; avisa em qual card o ID já está, se repetir. */
  async function salvarId(texto: string, nomeNoMeta?: string) {
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
    await mudar(nomeNoMeta ? { meta_ad_id: id, nome_no_meta: nomeNoMeta } : { meta_ad_id: id })
  }

  const rejeitado = v.status === 'rejeitado'

  /**
   * Grava a rejeição (status "Rejeitado" com motivo, categoria e data, que vai para o histórico)
   * e logo volta a conta para "Não subido": o banco guarda a rejeição nos comentários do card.
   */
  async function salvarRejeicao() {
    if (!categoria) return toast('ruim', 'Escolha a categoria da rejeição.')
    if (!/^20\d{2}-\d{2}-\d{2}$/.test(dataRej)) return toast('ruim', 'Informe a data da rejeição.')
    setGravandoRej(true)
    const ok = await salvar(
      ops()
        .from('veiculacoes')
        .update({ status: 'rejeitado', motivo_rejeicao: motivo.trim() || null, categoria_rejeicao: categoria, data_status: `${dataRej}T12:00:00-03:00` })
        .eq('id', v.id),
    )
    if (ok) await salvar(ops().from('veiculacoes').update({ status: 'nao_subido' }).eq('id', v.id))
    setGravandoRej(false)
    if (!ok) return
    setRejeitando(false)
    setMotivo('')
    setCategoria('')
    toast('bom', `Rejeição em ${conta?.apelido ?? 'conta'} registrada nos comentários do card. A conta voltou para "Não subido".`)
  }
  const sugestao = card.tipo === 'ad' ? `ad${card.ad_num}-h${card.hook_num}-m${card.var_num}` : ''

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

      {(fase || v.origem) && (
        <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
          {fase && (
            <>
              <span className={`rounded px-1.5 py-0.5 font-medium tabular-nums ${corFase(fase)}`}>{textoFase(fase)}</span>
              <span className="text-muted tabular-nums">
                D{fase.dia} · {NOME_FASE[fase.fase]}
                {fase.veredito ? (
                  <>
                    {' '}
                    · validação: {VEREDITOS[fase.veredito].icone} {VEREDITOS[fase.veredito].nome}, ROAS {roasTexto(fase.roas_validacao)} (gasto R$ {Math.round(fase.gasto_validacao).toLocaleString('pt-BR')})
                  </>
                ) : (
                  fase.fase === 'validacao' && fase.gasto_validacao > 0 && <> · ROAS até agora {roasTexto(fase.roas_validacao)}</>
                )}
              </span>
              {fase.no_spend && <span className="rounded bg-muted px-1.5 py-0.5 font-medium text-page">⏸ No-spend</span>}
            </>
          )}
          {v.origem && <span className="text-roxo">↗ {v.origem}</span>}
        </div>
      )}

      {confirmarPausa && fase && (
        <div className="mt-2">
          <Aviso
            tom="atencao"
            acao={
              <span className="flex shrink-0 gap-2">
                <button
                  onClick={() => {
                    setConfirmarPausa(false)
                    mudar({ status: 'pausado' })
                  }}
                  className="rounded-control bg-warn px-2 py-0.5 text-xs font-medium text-page"
                >
                  Pausar mesmo assim
                </button>
                <button onClick={() => setConfirmarPausa(false)} className="text-xs text-muted hover:text-ink">
                  Cancelar
                </button>
              </span>
            }
          >
            Este anúncio está em {NOME_FASE[fase.fase]} (D{fase.dia}). O manual pede para não pausar nesta fase. Pausar mesmo assim?
          </Aviso>
        </div>
      )}

      <div className="mt-2 grid gap-2 sm:grid-cols-[10rem_1fr_9.5rem]">
        <label className="text-xs text-muted">
          Status
          <select
            value={rejeitando ? 'rejeitado' : v.status}
            onChange={(e) => {
              const novo = e.target.value as StatusVeiculacao
              // linha vermelha do manual: não pausar em validação ou pré-escala (só avisa)
              if (novo === 'pausado' && naoPausar(fase)) return setConfirmarPausa(true)
              // rejeição: abre o registro; só grava ao clicar em Salvar
              if (novo === 'rejeitado') return setRejeitando(true)
              mudar({ status: novo })
            }}
            className={`${campoPequeno} mt-0.5 text-ink`}
          >
            {Object.entries(STATUS_VEICULACAO).map(([valor, s]) => (
              <option key={valor} value={valor}>
                {s.icone} {s.nome}
              </option>
            ))}
          </select>
        </label>
        <div className="text-xs text-muted">
          <Dica conteudo={AJUDA_ID} lado="centro">
            <span>ID do anúncio no Meta</span>
          </Dica>
          <input
            aria-label="ID do anúncio no Meta"
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
          {conta?.meta_ad_account_id && <EscolherAnuncio contaId={v.conta_id} sugestao={sugestao} onEscolher={(a) => salvarId(a.id, a.nome)} />}
          {v.meta_ad_id && <IdsExtras v={v} temConta={!!conta?.meta_ad_account_id} sugestao={sugestao} salvar={salvar} />}
        </div>
        <label className="text-xs text-muted">
          Data do status
          <input
            type="date"
            value={data}
            min="2020-01-01"
            max="2099-12-31"
            onChange={(e) => setData(e.target.value)}
            onBlur={() => /^20\d{2}-\d{2}-\d{2}$/.test(data) && data !== diaDe(v.data_status) ? mudar({ data_status: `${data}T12:00:00-03:00` }) : setData(diaDe(v.data_status))}
            className={`${campoPequeno} mt-0.5 text-ink`}
          />
        </label>
      </div>

      {(rejeitando || rejeitado) && (
        <div className="mt-2 rounded-control border border-bad/40 bg-bad-soft/40 p-2.5">
          <p className="mb-2 text-xs font-medium text-bad">
            <Dica conteudo="A rejeição é só um registro: fica salva nos comentários e no histórico do card (com data, categoria e motivo) e a conta volta para &quot;Não subido&quot;, para você ajustar e subir de novo. Para desistir do anúncio, mova o card para a lista Rejeitado.">
              <span>🚫 Registrar rejeição em {conta?.apelido ?? 'conta'}</span>
            </Dica>
          </p>
          <div className="grid gap-2 sm:grid-cols-[1fr_12rem_9.5rem]">
            <label className="text-xs text-muted">
              Motivo
              <textarea
                autoFocus
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                rows={2}
                placeholder="O que a Meta disse"
                className={`${campoPequeno} mt-0.5 resize-y text-ink`}
              />
            </label>
            <label className="text-xs text-muted">
              Categoria
              <select value={categoria} onChange={(e) => setCategoria(e.target.value)} className={`${campoPequeno} mt-0.5 text-ink`}>
                <option value="">Escolha</option>
                {CATEGORIAS_REJEICAO.map((c) => (
                  <option key={c.valor} value={c.valor}>
                    {c.nome}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs text-muted">
              Data da rejeição
              <input type="date" value={dataRej} max={diaDe(new Date().toISOString())} onChange={(e) => setDataRej(e.target.value)} className={`${campoPequeno} mt-0.5 text-ink`} />
            </label>
          </div>
          <div className="mt-2 flex justify-end gap-2">
            {!rejeitado && (
              <button onClick={() => setRejeitando(false)} disabled={gravandoRej} className={`${botaoPequeno} text-muted hover:text-ink`}>
                Cancelar
              </button>
            )}
            <button onClick={salvarRejeicao} disabled={gravandoRej} className="rounded-control bg-bad px-2.5 py-1 text-xs font-medium text-white disabled:opacity-50">
              {gravandoRej ? 'Salvando…' : 'Salvar rejeição'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

/**
 * Outros IDs do mesmo AD nesta conta: quando o anúncio é subido de novo sem
 * duplicar, a Meta dá um ID novo. Métricas e vendas somam todos.
 */
function IdsExtras({ v, temConta, sugestao, salvar }: { v: VeiculacaoDetalhe; temConta: boolean; sugestao: string; salvar: Salvar }) {
  const toast = useToast()
  const [novo, setNovo] = useState<string | null>(null)
  const [removendo, setRemovendo] = useState<string | null>(null)

  async function adicionar(texto: string, nomeNoMeta?: string) {
    const t = texto.trim()
    if (!t) return setNovo(null)
    const id = extrairIdAnuncio(t)
    if (!id) return toast('ruim', 'Não achei o ID do anúncio nesse texto. Cole o número ou o link do anúncio no Gerenciador.')
    if (id === v.meta_ad_id || v.ids_extras.some((e) => e.meta_ad_id === id)) return toast('ruim', 'Esse ID já está nesta conta.')
    const ok = await salvar(ops().from('veiculacoes_ids_extras').insert({ veiculacao_id: v.id, meta_ad_id: id, nome_no_meta: nomeNoMeta ?? null }), {
      veiculacoes_ids_extras_meta_ad_id_key: 'Esse ID de anúncio já está em outro card.',
    })
    if (ok) setNovo(null)
  }

  return (
    <div className="mt-1.5 space-y-1">
      {v.ids_extras.map((e) => (
        <div key={e.id} className="flex items-center gap-1.5">
          <span className="rounded bg-surface px-1.5 py-0.5 font-mono text-[11px] text-ink" title={e.nome_no_meta ?? undefined}>
            {e.meta_ad_id}
          </span>
          {removendo === e.id ? (
            <span className="flex items-center gap-1.5 text-[11px] text-bad">
              Tirar este ID?
              <button onClick={() => salvar(ops().from('veiculacoes_ids_extras').delete().eq('id', e.id))} className="font-medium hover:underline">
                Tirar
              </button>
              <button onClick={() => setRemovendo(null)} className="text-muted hover:text-ink">
                Cancelar
              </button>
            </span>
          ) : (
            <button onClick={() => setRemovendo(e.id)} aria-label="Tirar este ID" className="text-[11px] text-muted hover:text-bad">
              ✕
            </button>
          )}
        </div>
      ))}
      {novo === null ? (
        <Dica conteudo="Use quando o mesmo AD foi subido de novo nesta conta sem duplicar e ganhou outro ID na Meta. Gasto e vendas do card somam todos os IDs.">
          <button type="button" onClick={() => setNovo('')} className="text-[11px] text-info hover:underline">
            + Outro ID nesta conta
          </button>
        </Dica>
      ) : (
        <div>
          <input
            autoFocus
            aria-label="Outro ID do anúncio"
            value={novo}
            onChange={(e) => setNovo(e.target.value)}
            onPaste={(e) => {
              e.preventDefault()
              const colado = e.clipboardData.getData('text')
              setNovo(colado)
              adicionar(colado)
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') adicionar(novo)
              if (e.key === 'Escape') setNovo(null)
            }}
            onBlur={() => novo.trim() && adicionar(novo)}
            placeholder="Número ou link do outro anúncio"
            className={`${campoPequeno} font-mono text-ink`}
          />
          <span className="flex gap-3">
            {temConta && <EscolherAnuncio contaId={v.conta_id} sugestao={sugestao} onEscolher={(a) => adicionar(a.id, a.nome)} />}
            <button type="button" onClick={() => setNovo(null)} className="mt-1 text-[11px] text-muted hover:text-ink">
              Cancelar
            </button>
          </span>
        </div>
      )}
    </div>
  )
}

/**
 * Escolher o anúncio na lista da Meta (em vez de colar o ID). A busca já começa
 * com AD/H/M do card (ex.: "ad1-h1-m2"), que costuma estar no nome do anúncio;
 * é só uma sugestão: quem escolhe é a pessoa.
 */
function EscolherAnuncio({ contaId, sugestao, onEscolher }: { contaId: string; sugestao: string; onEscolher: (a: AnuncioMeta) => void }) {
  return (
    <Popover
      titulo="Escolher anúncio na Meta"
      largura="w-96 max-w-[calc(100vw-1rem)]"
      gatilho={(alternar) => (
        <button type="button" onClick={alternar} className="mt-1 text-[11px] text-info hover:underline">
          Escolher na lista da Meta
        </button>
      )}
    >
      {(fechar) => (
        <ListaAnuncios
          contaId={contaId}
          sugestao={sugestao}
          onEscolher={(a) => {
            fechar()
            onEscolher(a)
          }}
        />
      )}
    </Popover>
  )
}

function ListaAnuncios({ contaId, sugestao, onEscolher }: { contaId: string; sugestao: string; onEscolher: (a: AnuncioMeta) => void }) {
  const [anuncios, setAnuncios] = useState<AnuncioMeta[] | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [busca, setBusca] = useState(sugestao)

  useEffect(() => {
    listarAnunciosDaConta(contaId).then(setAnuncios, (e: Error) => setErro(e.message))
  }, [contaId])

  if (erro) return <p className="text-sm text-bad">{erro}</p>
  if (!anuncios) return <p className="text-sm text-muted">Buscando os anúncios da conta na Meta…</p>

  const termo = busca.trim().toLowerCase()
  const filtrados = anuncios.filter((a) => !termo || a.nome.toLowerCase().includes(termo) || a.id.includes(termo))

  return (
    <div className="space-y-2">
      <input autoFocus value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar por nome ou ID" className={campoPequeno} />
      {filtrados.length === 0 ? (
        <p className="text-sm text-muted">
          Nenhum anúncio com "{busca}".{' '}
          {busca && (
            <button onClick={() => setBusca('')} className="text-info hover:underline">
              Ver todos
            </button>
          )}
        </p>
      ) : (
        <ul className="max-h-72 space-y-0.5 overflow-y-auto">
          {filtrados.slice(0, 100).map((a) => (
            <li key={a.id}>
              <button onClick={() => onEscolher(a)} className="w-full rounded-md px-2 py-1.5 text-left hover:bg-surface-2">
                <span className="block truncate text-sm">{a.nome}</span>
                <span className="block text-[11px] text-muted">
                  <span className="font-mono">{a.id}</span> · {a.status.toLowerCase()}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
