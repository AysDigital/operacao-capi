import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router'
import { Aviso, Carregando, Dica, Indicador, Selo } from '../../components/ds'
import { useToast } from '../../components/Toast'
import { CATEGORIAS_REJEICAO, normalizarUrl, tipoDoLink } from '../../lib/card'
import { mensagemErro } from '../../lib/cadastros'
import { formatarDataHora } from '../../lib/format'
import {
  buscarHistoricoOferta,
  buscarLinks,
  buscarMetricasOferta,
  buscarProducao,
  PERIODOS_OFERTA,
  reais,
  TIPOS_LINK,
  vezes,
  type EventoOferta,
  type LinkOferta,
  type MetricasOferta,
  type OfertaCompleta,
  type Rejeicao,
  type TipoLink,
} from '../../lib/oferta'
import { gravarLocal, lerLocal, type ContaQuadro, type Lista, type OfertaQuadro } from '../../lib/quadro'
import { CLASSES, roasDe } from '../../lib/ranking'
import { ops } from '../../lib/supabase'
import { EditorTexto, TextoFormatado } from '../quadro/card/Texto'
import { ModalGerarVariacoes } from '../quadro/card/Versoes'
import { GraficoLinhas } from './GraficoLinhas'

type Membro = { user_id: string; nome: string }

export function VisaoGeral({
  oferta,
  listas,
  ofertas,
  contas,
  membros,
  versao,
  onMudou,
}: {
  oferta: OfertaCompleta
  listas: Lista[]
  ofertas: OfertaQuadro[]
  contas: ContaQuadro[]
  membros: Membro[]
  /** muda quando algo da oferta mudou (recarrega o histórico) */
  versao: number
  onMudou: () => void
}) {
  const [dias, setDias] = useState<number>(() => lerLocal('oferta_periodo', 30))

  return (
    <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_22rem]">
      <div className="min-w-0 space-y-8">
        <div className="flex flex-wrap items-center gap-1" role="radiogroup" aria-label="Período">
          {PERIODOS_OFERTA.map((p) => (
            <button
              key={p.valor}
              role="radio"
              aria-checked={dias === p.valor}
              onClick={() => {
                setDias(p.valor)
                gravarLocal('oferta_periodo', p.valor)
              }}
              className={`rounded-full px-3 py-1 text-sm ${dias === p.valor ? 'bg-ink text-page' : 'bg-surface-2 text-muted hover:text-ink'}`}
            >
              {p.nome}
            </button>
          ))}
        </div>
        <Numeros oferta={oferta} dias={dias} listas={listas} ofertas={ofertas} contas={contas} />
        <Producao ofertaId={oferta.id} dias={dias} listas={listas} />
      </div>

      <div className="min-w-0 space-y-8 xl:border-l xl:border-line xl:pl-6">
        <Links ofertaId={oferta.id} onMudou={onMudou} />
        <Anotacoes oferta={oferta} onMudou={onMudou} />
        <Historico ofertaId={oferta.id} membros={membros} versao={versao} />
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------
// Números, gráficos, top 5 e cobertura
// ---------------------------------------------------------------------
function Numeros({
  oferta,
  dias,
  listas,
  ofertas,
  contas,
}: {
  oferta: OfertaCompleta
  dias: number
  listas: Lista[]
  ofertas: OfertaQuadro[]
  contas: ContaQuadro[]
}) {
  const [m, setM] = useState<MetricasOferta | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [nomes, setNomes] = useState<Map<string, string>>(new Map())
  const [variacoesDe, setVariacoesDe] = useState<string | null>(null)

  const carregar = useCallback(() => {
    setM(null)
    buscarMetricasOferta(oferta.id, dias).then(
      async (r) => {
        setM(r)
        setErro(null)
        const ids = r.linhas.flatMap((l) => l.cards)
        if (ids.length) {
          const { data } = await ops().from('cards').select('id, nome').in('id', ids)
          setNomes(new Map((data ?? []).map((c) => [c.id, c.nome])))
        }
      },
      (e: Error) => setErro(e.message),
    )
  }, [oferta.id, dias])

  useEffect(() => {
    carregar()
  }, [carregar])

  if (erro) return <Aviso tom="ruim">Não foi possível carregar as métricas: {erro}</Aviso>
  if (!m) return <Carregando linhas={3} altura="h-24" />

  const t = m.totais
  const roas = t.gasto ? t.faturamento / t.gasto : null
  const cpa = t.vendas ? t.gasto / t.vendas : null
  const upsell = t.vendas ? t.vendasExtras / t.vendas : null
  const top = [...m.linhas].filter((l) => l.gasto > 0 || l.faturamento > 0).sort((a, b) => b.faturamento - a.faturamento || a.gasto - b.gasto).slice(0, 5)
  const dias_ = m.serie.map((p) => p.dia)
  const pctSemCard = m.cobertura.gastoTotal ? m.cobertura.gastoSemCard / m.cobertura.gastoTotal : 0
  const pct = (v: number) => `${(v * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`

  return (
    <>
      {m.cobertura.gastoSemCard > 0 && (
        <Aviso tom={pctSemCard > 0.1 ? 'atencao' : 'info'}>
          {reais(m.cobertura.gastoSemCard)} ({pct(pctSemCard)}) do gasto das contas desta oferta no período não está ligado a nenhum card (
          {m.cobertura.anunciosSemCard} {m.cobertura.anunciosSemCard === 1 ? 'anúncio' : 'anúncios'} sem card). Os números abaixo não incluem esse gasto.
        </Aviso>
      )}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Indicador titulo="Gasto" ajuda="Gasto na Meta dos anúncios ligados aos cards da oferta, em reais (dólar pela PTAX do dia), sem IOF." valor={reais(t.gasto)} />
        <Indicador
          titulo="Faturamento"
          ajuda="Vendas aprovadas no dashboard com o ID desses anúncios, somando produto principal, upsell e downsell. Reembolsos ficam de fora."
          valor={reais(t.faturamento)}
        />
        <Indicador
          titulo="ROAS"
          ajuda="Faturamento ÷ gasto."
          valor={vezes(roas)}
          tom={roas === null || !oferta.roas_minimo ? 'neutro' : roas >= oferta.roas_minimo ? 'bom' : 'ruim'}
          info={oferta.roas_minimo ? `mínimo ${vezes(Number(oferta.roas_minimo))}` : undefined}
        />
        <Indicador titulo="Vendas" ajuda="Vendas aprovadas do produto principal." valor={t.vendas.toLocaleString('pt-BR')} />
        <Indicador
          titulo="CPA"
          ajuda="Gasto ÷ vendas do produto principal."
          valor={cpa === null ? '—' : reais(cpa)}
          tom={cpa === null || !oferta.cpa_alvo ? 'neutro' : cpa <= oferta.cpa_alvo ? 'bom' : 'ruim'}
          info={oferta.cpa_alvo ? `alvo ${reais(Number(oferta.cpa_alvo))}` : undefined}
        />
        <Indicador
          titulo="Taxa de upsell"
          ajuda="Vendas de upsell e downsell ÷ vendas do produto principal."
          valor={upsell === null ? '—' : pct(upsell)}
          info={`${t.vendasExtras} ${t.vendasExtras === 1 ? 'venda extra' : 'vendas extras'}`}
        />
        <Indicador
          titulo="Reembolsos"
          ajuda="Reembolsos e chargebacks no período (quantidade e valor)."
          valor={t.reembolsos.toLocaleString('pt-BR')}
          tom={t.reembolsos ? 'ruim' : 'neutro'}
          info={t.reembolsos ? reais(t.valorReembolsado) : undefined}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-card border border-line bg-surface p-4">
          <GraficoLinhas
            titulo="Gasto × faturamento por dia"
            dias={dias_}
            series={[
              { nome: 'Gasto', cor: 'var(--c-series-1)', valores: m.serie.map((p) => p.gasto) },
              { nome: 'Faturamento', cor: 'var(--c-series-2)', valores: m.serie.map((p) => p.faturamento) },
            ]}
            formatar={(v) => `R$ ${Math.round(v).toLocaleString('pt-BR')}`}
          />
        </div>
        <div className="rounded-card border border-line bg-surface p-4">
          <GraficoLinhas
            titulo="ROAS por dia"
            dias={dias_}
            series={[{ nome: 'ROAS', cor: 'var(--c-series-1)', valores: m.serie.map((p) => (p.gasto ? p.faturamento / p.gasto : null)) }]}
            formatar={(v) => `${v.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}x`}
            referencia={oferta.roas_minimo ? { valor: Number(oferta.roas_minimo), nome: 'ROAS mínimo' } : null}
          />
        </div>
      </div>

      <section>
        <h2 className="mb-3 text-base font-semibold">
          <Dica conteudo="Os 5 anúncios com mais faturamento no período, somando todas as contas." lado="esquerda">
            Top 5 anúncios
          </Dica>
        </h2>
        {top.length === 0 ? (
          <p className="text-sm text-muted">Nenhum anúncio com gasto ou venda no período.</p>
        ) : (
          <ol className="divide-y divide-line rounded-card border border-line bg-surface">
            {top.map((l, i) => {
              const id = l.cards[0]
              const c = CLASSES[l.classe]
              return (
                <li key={id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 text-sm">
                  <span className="w-5 text-muted tabular-nums">{i + 1}.</span>
                  <span className="min-w-0 flex-1 truncate font-mono font-medium">{nomes.get(id) ?? `AD${l.adNum}-H${l.hookNum}-M${l.varNum}`}</span>
                  {c.selo && (
                    <Selo tom={c.tom}>
                      <span aria-hidden>{c.icone}</span>
                      {c.nome}
                    </Selo>
                  )}
                  <span className="tabular-nums text-muted">
                    {reais(l.gasto)} → <span className="text-ink">{reais(l.faturamento)}</span> · {vezes(roasDe(l))} · {l.vendas}v
                  </span>
                  <span className="flex gap-3">
                    <Link to={`/quadros/${oferta.id}?card=${id}`} className="text-accent-strong hover:underline">
                      Abrir
                    </Link>
                    <button onClick={() => setVariacoesDe(id)} className="text-accent-strong hover:underline">
                      Gerar variações
                    </button>
                  </span>
                </li>
              )
            })}
          </ol>
        )}
      </section>

      {variacoesDe && (
        <ModalGerarVariacoes
          cardId={variacoesDe}
          ctx={{ listas, ofertas, contas }}
          onFechar={() => setVariacoesDe(null)}
          onCriados={() => setVariacoesDe(null)}
        />
      )}
    </>
  )
}

// ---------------------------------------------------------------------
// Produção
// ---------------------------------------------------------------------
function Producao({ ofertaId, dias, listas }: { ofertaId: string; dias: number; listas: Lista[] }) {
  const [p, setP] = useState<Awaited<ReturnType<typeof buscarProducao>> | null>(null)
  const [classes, setClasses] = useState<{ vencedores: number; perdedores: number } | null>(null)
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    setP(null)
    buscarProducao(ofertaId, dias).then(setP, (e: Error) => setErro(e.message))
    ops()
      .rpc('ranking', { p_oferta: ofertaId, p_dias: null, p_nivel: 'anuncio' })
      .then(({ data }) => {
        const l = (data ?? []) as { classificacao: string }[]
        setClasses({ vencedores: l.filter((x) => x.classificacao === 'vencedor').length, perdedores: l.filter((x) => x.classificacao === 'perdedor').length })
      })
  }, [ofertaId, dias])

  if (erro) return <Aviso tom="ruim">Não foi possível carregar a produção: {erro}</Aviso>
  if (!p) return <Carregando linhas={2} altura="h-16" />

  const agrupar = (f: (r: Rejeicao) => string) =>
    [...p.rejeicoes.reduce((m, r) => m.set(f(r), (m.get(f(r)) ?? 0) + 1), new Map<string, number>())].sort((a, b) => b[1] - a[1])
  const porConta = agrupar((r) => r.conta_apelido ?? '?')
  const porCategoria = agrupar((r) => CATEGORIAS_REJEICAO.find((c) => c.valor === r.categoria_rejeicao)?.nome ?? 'Sem categoria')
  const ativas = listas.filter((l) => !l.arquivada)

  return (
    <section>
      <h2 className="mb-3 text-base font-semibold">Produção</h2>
      <div className="grid gap-6 md:grid-cols-2">
        <div className="rounded-card border border-line bg-surface p-4">
          <p className="mb-2 text-sm font-medium">Cards por lista</p>
          <ul className="space-y-1 text-sm">
            {ativas.map((l) => (
              <li key={l.id} className="flex items-center gap-2">
                <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: l.cor ?? undefined }} />
                <span className="flex-1">{l.nome}</span>
                <span className="tabular-nums text-muted">{p.porLista.get(l.id) ?? 0}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Mini nome="Ads rodando" valor={p.rodando} ajuda="Cards com pelo menos uma conta em “Rodando”." />
            <Mini nome="Com troféu" valor={p.trofeus} ajuda="Vencedores confirmados por vocês (troféu no card)." />
            <Mini nome="Vencedores" valor={classes?.vencedores} ajuda="Classificação automática, no período de avaliação da oferta." />
            <Mini nome="Perdedores" valor={classes?.perdedores} ajuda="Classificação automática, no período de avaliação da oferta." />
          </div>
          <div className="rounded-card border border-line bg-surface p-4 text-sm">
            <p className="mb-2 font-medium">
              <Dica conteudo="Quantas vezes uma conta de um card desta oferta foi marcada como Rejeitado no período." lado="esquerda">
                Rejeições no período: {p.rejeicoes.length}
              </Dica>
            </p>
            {p.rejeicoes.length > 0 && (
              <div className="grid grid-cols-2 gap-4">
                <ul className="space-y-0.5">
                  <li className="text-xs text-muted">Por conta</li>
                  {porConta.map(([k, n]) => (
                    <li key={k} className="flex justify-between gap-2">
                      <span className="font-mono text-xs">{k}</span>
                      <span className="tabular-nums">{n}</span>
                    </li>
                  ))}
                </ul>
                <ul className="space-y-0.5">
                  <li className="text-xs text-muted">Por categoria</li>
                  {porCategoria.map(([k, n]) => (
                    <li key={k} className="flex justify-between gap-2">
                      <span className="truncate">{k}</span>
                      <span className="tabular-nums">{n}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}

function Mini({ nome, valor, ajuda }: { nome: string; valor: number | undefined; ajuda: string }) {
  return (
    <div className="rounded-card border border-line bg-surface px-4 py-3">
      <p className="text-xs text-muted">
        <Dica conteudo={ajuda} lado="esquerda">
          {nome}
        </Dica>
      </p>
      <p className="mt-1 font-display text-xl font-semibold tabular-nums">{valor ?? '—'}</p>
    </div>
  )
}

// ---------------------------------------------------------------------
// Links
// ---------------------------------------------------------------------
const pequeno = 'w-full rounded-md border border-line bg-surface px-2 py-1 text-sm outline-none focus:border-muted'

function Links({ ofertaId, onMudou }: { ofertaId: string; onMudou: () => void }) {
  const toast = useToast()
  const [links, setLinks] = useState<LinkOferta[] | null>(null)
  const [editando, setEditando] = useState<LinkOferta | 'novo' | null>(null)

  const carregar = useCallback(() => buscarLinks(ofertaId).then(setLinks, (e: Error) => toast('ruim', e.message)), [ofertaId, toast])
  useEffect(() => {
    carregar()
  }, [carregar])

  async function excluir(l: LinkOferta) {
    const { error } = await ops().from('ofertas_links').delete().eq('id', l.id)
    if (error) return toast('ruim', mensagemErro(error))
    carregar()
    onMudou()
  }

  return (
    <section>
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-base font-semibold">Links</h2>
        <button onClick={() => setEditando('novo')} className="rounded-control px-2 py-1 text-xs text-muted hover:bg-surface-2 hover:text-ink">
          + Link
        </button>
      </div>
      {!links ? (
        <Carregando linhas={2} />
      ) : (
        <ul className="space-y-1">
          {links.length === 0 && editando !== 'novo' && <li className="text-sm text-muted">Nenhum link ainda.</li>}
          {links.map((l) =>
            editando !== 'novo' && editando?.id === l.id ? (
              <li key={l.id}>
                <FormLink
                  link={l}
                  ofertaId={ofertaId}
                  proximaOrdem={links.length}
                  onFim={() => {
                    setEditando(null)
                    carregar()
                    onMudou()
                  }}
                />
              </li>
            ) : (
              <li key={l.id} className="group flex items-center gap-2 rounded-md px-1 py-1 hover:bg-surface-2">
                <IconeLink url={l.url} />
                <a href={normalizarUrl(l.url)} target="_blank" rel="noreferrer" className="min-w-0 flex-1 truncate text-sm hover:underline">
                  <span className="block truncate">{l.titulo}</span>
                  <span className="block truncate text-xs text-muted">{TIPOS_LINK.find((t) => t.valor === l.tipo)?.nome}</span>
                </a>
                <button onClick={() => setEditando(l)} className="text-xs text-muted opacity-0 group-hover:opacity-100 hover:text-ink focus:opacity-100">
                  Editar
                </button>
                <button onClick={() => excluir(l)} aria-label={`Excluir ${l.titulo}`} className="px-1 text-muted opacity-0 group-hover:opacity-100 hover:text-bad focus:opacity-100">
                  ×
                </button>
              </li>
            ),
          )}
          {editando === 'novo' && (
            <li>
              <FormLink
                link={null}
                ofertaId={ofertaId}
                proximaOrdem={links.length}
                onFim={() => {
                  setEditando(null)
                  carregar()
                  onMudou()
                }}
              />
            </li>
          )}
        </ul>
      )}
    </section>
  )
}

/** Ícone pelo domínio do link (Drive, Docs, YouTube...). */
function IconeLink({ url }: { url: string }) {
  const t = tipoDoLink(url)
  return (
    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-[10px] font-bold text-white" style={{ background: t.cor }} aria-hidden>
      {t.rotulo.slice(0, 2).toUpperCase()}
    </span>
  )
}

function FormLink({ link, ofertaId, proximaOrdem, onFim }: { link: LinkOferta | null; ofertaId: string; proximaOrdem: number; onFim: () => void }) {
  const toast = useToast()
  const [tipo, setTipo] = useState<TipoLink>(link?.tipo ?? 'vendas')
  const [titulo, setTitulo] = useState(link?.titulo ?? '')
  const [url, setUrl] = useState(link?.url ?? '')

  async function salvar() {
    if (!url.trim()) return
    const nomeTipo = TIPOS_LINK.find((t) => t.valor === tipo)!.nome
    const campos = { tipo, titulo: titulo.trim() || nomeTipo, url: url.trim() }
    const { error } = link
      ? await ops().from('ofertas_links').update(campos).eq('id', link.id)
      : await ops().from('ofertas_links').insert({ ...campos, oferta_id: ofertaId, ordem: proximaOrdem })
    if (error) return toast('ruim', mensagemErro(error))
    onFim()
  }

  return (
    <div className="space-y-1.5 rounded-control border border-line p-2">
      <select value={tipo} onChange={(e) => setTipo(e.target.value as TipoLink)} className={pequeno} aria-label="Tipo do link">
        {TIPOS_LINK.map((t) => (
          <option key={t.valor} value={t.valor}>
            {t.nome}
          </option>
        ))}
      </select>
      <input value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Título (opcional)" className={pequeno} />
      <input
        autoFocus
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && salvar()}
        placeholder="https://…"
        className={pequeno}
      />
      <div className="flex gap-2">
        <button onClick={salvar} disabled={!url.trim()} className="rounded-control bg-accent px-3 py-1 text-xs font-medium text-accent-ink disabled:opacity-40">
          Salvar
        </button>
        <button onClick={onFim} className="text-xs text-muted hover:text-ink">
          Cancelar
        </button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------
// Anotações
// ---------------------------------------------------------------------
function Anotacoes({ oferta, onMudou }: { oferta: OfertaCompleta; onMudou: () => void }) {
  const toast = useToast()
  const [editando, setEditando] = useState(false)
  const [texto, setTexto] = useState(oferta.anotacoes ?? '')

  async function sair() {
    setEditando(false)
    const novo = texto.trim() || null
    if (novo === (oferta.anotacoes?.trim() || null)) return
    const { error } = await ops().from('ofertas').update({ anotacoes: novo }).eq('id', oferta.id)
    if (error) return toast('ruim', mensagemErro(error))
    onMudou()
  }

  return (
    <section>
      <h2 className="mb-2 text-base font-semibold">Anotações</h2>
      {editando ? (
        <EditorTexto valor={texto} onMudar={setTexto} onSair={sair} autoFocus linhas={8} placeholder="Ideias, aprendizados, contatos…" />
      ) : (
        <div
          role="button"
          tabIndex={0}
          onClick={() => {
            setTexto(oferta.anotacoes ?? '')
            setEditando(true)
          }}
          onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), setEditando(true))}
          className="block w-full cursor-text rounded-control bg-surface-2 px-3 py-2 text-left hover:bg-line/60"
        >
          {oferta.anotacoes ? <TextoFormatado texto={oferta.anotacoes} /> : <span className="text-sm text-muted">Adicionar anotações…</span>}
        </div>
      )}
    </section>
  )
}

// ---------------------------------------------------------------------
// Histórico
// ---------------------------------------------------------------------
function Historico({ ofertaId, membros, versao }: { ofertaId: string; membros: Membro[]; versao: number }) {
  const [eventos, setEventos] = useState<EventoOferta[] | null>(null)
  useEffect(() => {
    buscarHistoricoOferta(ofertaId).then(setEventos, () => setEventos([]))
  }, [ofertaId, versao])
  const nome = (id: string | null) => membros.find((m) => m.user_id === id)?.nome ?? 'Sistema'

  return (
    <section>
      <h2 className="mb-2 text-base font-semibold">
        <Dica conteudo="Mudanças no checklist de lançamento e nos testes da oferta." lado="esquerda">
          Histórico
        </Dica>
      </h2>
      {!eventos ? (
        <Carregando linhas={3} />
      ) : eventos.length === 0 ? (
        <p className="text-sm text-muted">Nada registrado ainda.</p>
      ) : (
        <ul className="space-y-2 text-sm">
          {eventos.map((e) => (
            <li key={e.id}>
              <strong className="font-medium">{nome(e.autor_id)}</strong> {e.texto}
              <span className="block text-xs text-muted">{formatarDataHora(e.criado_em)}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
