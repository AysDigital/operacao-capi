import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router'
import { Aviso, CaixaTabela, Carregando, Dica, Selo, tabela, Vazio } from '../components/ds'
import { useToast } from '../components/Toast'
import { TituloPagina } from '../components/ui'
import { mensagemErro } from '../lib/cadastros'
import { formatarCentavos } from '../lib/format'
import { EVENTO_METRICAS, indicadores, somar } from '../lib/metricas'
import { buscarCards, gravarLocal, lerLocal, type CardQuadro, type Veiculacao } from '../lib/quadro'
import { AJUDA_CLASSES, buscarRanking, CLASSES, NIVEIS, type Classe, type LinhaRanking, type Nivel } from '../lib/ranking'
import { ops } from '../lib/supabase'
import { AvisosDados } from './quadro/AvisosDados'
import { PilulasContas } from './quadro/Cartao'
import { ModalGerarVariacoes } from './quadro/card/Versoes'
import { buscarBase, type Base } from './quadro/Quadros'

const PERIODOS = [
  { valor: 7, nome: '7 dias' },
  { valor: 14, nome: '14 dias' },
  { valor: 30, nome: '30 dias' },
  { valor: 0, nome: 'Tudo' },
]

type Prefs = { oferta: string; dias: number; nivel: Nivel; classe: Classe | ''; ordem: Coluna; desc: boolean }
const PREFS_PADRAO: Prefs = { oferta: '', dias: 7, nivel: 'anuncio', classe: '', ordem: 'gasto', desc: true }

type Coluna = 'nome' | 'classe' | 'gasto' | 'faturamento' | 'roas' | 'vendas' | 'cpa' | 'ctr' | 'hook'

/** Linha pronta para a tabela. */
type Linha = LinhaRanking & {
  chave: string
  nome: string
  card: CardQuadro | null
  veiculacoes: Veiculacao[]
  lista: string
  ind: ReturnType<typeof indicadores>
}

const ORDEM_CLASSE: Record<Classe, number> = { vencedor: 0, promissor: 1, em_teste: 2, perdedor: 3, sem_dados: 4 }

const VALOR: Record<Coluna, (l: Linha) => number | string | null> = {
  nome: (l) => l.nome,
  classe: (l) => -ORDEM_CLASSE[l.classe],
  gasto: (l) => l.gasto,
  faturamento: (l) => l.faturamento,
  roas: (l) => l.ind.roas,
  vendas: (l) => l.vendas,
  cpa: (l) => (l.ind.cpa === null ? null : -l.ind.cpa),
  ctr: (l) => l.ind.ctr,
  hook: (l) => l.ind.hookRate,
}

const brl = (v: number | null) => (v === null ? '—' : formatarCentavos(Math.round(v * 100)))
const pct = (v: number | null) => (v === null ? '—' : `${(v * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`)
const roas = (v: number | null) => (v === null ? '—' : `${v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}x`)

const botaoFiltro = (ativo: boolean) =>
  `rounded-full px-2.5 py-1 text-xs ${ativo ? 'bg-ink text-page' : 'bg-surface-2 text-muted hover:text-ink'}`
const caixa = 'rounded-control border border-line bg-surface px-2.5 py-1.5 text-sm outline-none focus:border-muted'

export function Ranking() {
  const toast = useToast()
  const navegar = useNavigate()
  const [prefs, setPrefsEstado] = useState<Prefs>(() => ({ ...PREFS_PADRAO, ...lerLocal<Partial<Prefs>>('ranking', {}) }))
  const [busca, setBusca] = useState('')
  const [base, setBase] = useState<Base | null>(null)
  const [linhas, setLinhas] = useState<LinhaRanking[] | null>(null)
  const [cards, setCards] = useState<Map<string, CardQuadro>>(new Map())
  const [erro, setErro] = useState<string | null>(null)
  const [variacoesDe, setVariacoesDe] = useState<string | null>(null)

  const setPrefs = (p: Partial<Prefs>) =>
    setPrefsEstado((atual) => {
      const novo = { ...atual, ...p }
      gravarLocal('ranking', novo)
      return novo
    })

  useEffect(() => {
    buscarBase().then(setBase, (e: Error) => setErro(e.message))
  }, [])

  const ofertaId = prefs.oferta && base?.ofertas.some((o) => o.id === prefs.oferta) ? prefs.oferta : null

  const carregar = useCallback(async () => {
    try {
      const [r, cs] = await Promise.all([buscarRanking(ofertaId, prefs.dias, prefs.nivel), buscarCards(ofertaId, false)])
      setLinhas(r)
      setCards(new Map(cs.map((c) => [c.id, c])))
      setErro(null)
    } catch (e) {
      setErro((e as Error).message)
    }
  }, [ofertaId, prefs.dias, prefs.nivel])

  useEffect(() => {
    if (!base) return
    setLinhas(null)
    carregar()
    window.addEventListener(EVENTO_METRICAS, carregar)
    return () => window.removeEventListener(EVENTO_METRICAS, carregar)
  }, [base, carregar])

  const ofertas = useMemo(() => new Map((base?.ofertas ?? []).map((o) => [o.id, o])), [base])
  const listas = useMemo(() => new Map((base?.listas ?? []).map((l) => [l.id, l.nome])), [base])
  const contas = useMemo(() => new Map((base?.contas ?? []).map((c) => [c.id, c])), [base])

  const prontas: Linha[] = useMemo(() => {
    const r = (linhas ?? []).map((l) => {
      const o = ofertas.get(l.ofertaId)
      const prefixo = `${o?.codigo ?? '?'}-${o?.idioma ?? '?'}-AD${l.adNum}`
      const doGrupo = l.cards.map((id) => cards.get(id)).filter((c) => c !== undefined)
      const card = prefs.nivel === 'anuncio' ? (doGrupo[0] ?? null) : null
      // contas onde está rodando (uma pílula por conta)
      const rodando = new Map<string, Veiculacao>()
      for (const c of doGrupo) for (const v of c.veiculacoes) if (v.status === 'rodando') rodando.set(v.conta_id, v)
      const nomesListas = [...new Set(doGrupo.map((c) => listas.get(c.lista_id) ?? '?'))]
      return {
        ...l,
        chave: l.cards.join(','),
        nome: card?.nome ?? (l.hookNum === null ? prefixo : `${prefixo}-H${l.hookNum}`),
        card,
        veiculacoes: [...rodando.values()],
        lista: nomesListas.length === 1 ? nomesListas[0] : `${nomesListas.length} listas`,
        ind: indicadores(l),
      }
    })
    const termo = busca.trim().toLowerCase()
    const filtradas = r.filter((l) => (!prefs.classe || l.classe === prefs.classe) && (!termo || l.nome.toLowerCase().includes(termo)))
    const valor = VALOR[prefs.ordem]
    return filtradas.sort((a, b) => {
      const va = valor(a)
      const vb = valor(b)
      if (va === vb) return b.gasto - a.gasto
      if (va === null) return 1
      if (vb === null) return -1
      const cmp = typeof va === 'string' ? va.localeCompare(String(vb), 'pt-BR', { numeric: true }) : va - (vb as number)
      return prefs.desc ? -cmp : cmp
    })
  }, [linhas, ofertas, cards, listas, prefs.nivel, prefs.classe, prefs.ordem, prefs.desc, busca])

  const total = useMemo(() => somar(prontas), [prontas])
  const indTotal = indicadores(total)

  async function alternarTrofeu(card: CardQuadro) {
    const { error } = await ops().from('cards').update({ vencedor: !card.vencedor }).eq('id', card.id)
    if (error) return toast('ruim', mensagemErro(error))
    setCards((cs) => new Map(cs).set(card.id, { ...card, vencedor: !card.vencedor }))
    toast('bom', card.vencedor ? `${card.nome}: troféu removido.` : `${card.nome} marcado como vencedor.`)
  }

  function ordenarPor(c: Coluna) {
    setPrefs(prefs.ordem === c ? { desc: !prefs.desc } : { ordem: c, desc: c !== 'nome' })
  }

  const Th = ({ coluna, children, ajuda, direita = true }: { coluna: Coluna; children: ReactNode; ajuda?: ReactNode; direita?: boolean }) => (
    <th className={`${tabela.th} ${direita ? 'text-right' : 'text-left'}`} aria-sort={prefs.ordem === coluna ? (prefs.desc ? 'descending' : 'ascending') : 'none'}>
      <button onClick={() => ordenarPor(coluna)} className={`inline-flex items-center gap-1 hover:text-ink ${prefs.ordem === coluna ? 'text-ink' : ''}`}>
        {ajuda ? <Dica conteudo={ajuda}>{children}</Dica> : children}
        <span aria-hidden className="text-[10px]">
          {prefs.ordem === coluna ? (prefs.desc ? '▼' : '▲') : ''}
        </span>
      </button>
    </th>
  )

  return (
    <>
      <TituloPagina subtitulo="Os anúncios com ID da Meta, com gasto (Meta) e vendas (dashboard) somando todas as contas. Agrupe por hook ou família para ver qual ângulo vence.">
        Ranking
      </TituloPagina>

      <AvisosDados />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <select value={ofertaId ?? ''} onChange={(e) => setPrefs({ oferta: e.target.value })} aria-label="Oferta" className={caixa}>
          <option value="">Todas as ofertas</option>
          {(base?.ofertas ?? []).map((o) => (
            <option key={o.id} value={o.id}>
              {o.codigo}-{o.idioma} · {o.nome}
              {o.status === 'pausada' ? ' (pausada)' : ''}
            </option>
          ))}
        </select>
        <div className="flex gap-1" role="group" aria-label="Período">
          {PERIODOS.map((p) => (
            <button key={p.valor} onClick={() => setPrefs({ dias: p.valor })} aria-pressed={prefs.dias === p.valor} className={botaoFiltro(prefs.dias === p.valor)}>
              {p.nome}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1" role="group" aria-label="Agrupar por">
          <span className="text-sm text-muted">Agrupar por</span>
          {NIVEIS.map((n) => (
            <button key={n.valor} onClick={() => setPrefs({ nivel: n.valor })} aria-pressed={prefs.nivel === n.valor} className={botaoFiltro(prefs.nivel === n.valor)}>
              {n.nome}
            </button>
          ))}
        </div>
        <select value={prefs.classe} onChange={(e) => setPrefs({ classe: e.target.value as Classe | '' })} aria-label="Classificação" className={caixa}>
          <option value="">Classificação</option>
          {Object.entries(CLASSES).map(([valor, c]) => (
            <option key={valor} value={valor}>
              {c.icone} {c.nome}
            </option>
          ))}
        </select>
        <input type="search" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar por nome" aria-label="Buscar por nome" className={`${caixa} w-44`} />
        {linhas && (
          <span className="ml-auto text-sm text-muted tabular-nums">
            {prontas.length} {prontas.length === 1 ? 'linha' : 'linhas'}
          </span>
        )}
      </div>

      {erro && <Aviso tom="ruim">Não foi possível carregar o ranking: {erro}</Aviso>}
      {!erro && !linhas && <Carregando linhas={6} altura="h-10" />}
      {linhas && prontas.length === 0 && (
        <Vazio titulo={linhas.length ? 'Nenhuma linha com esses filtros' : 'Nenhum anúncio com ID da Meta'}>
          {!linhas.length && 'Preencha o ID do anúncio nas veiculações dos cards para eles entrarem no ranking.'}
        </Vazio>
      )}

      {linhas && prontas.length > 0 && (
        <CaixaTabela>
          <table className={tabela.table}>
            <thead className={tabela.thead}>
              <tr>
                <Th coluna="nome" direita={false}>
                  {NIVEIS.find((n) => n.valor === prefs.nivel)!.nome}
                </Th>
                <Th coluna="classe" direita={false} ajuda={AJUDA_CLASSES}>
                  Classificação
                </Th>
                <Th coluna="gasto" ajuda="Gasto na Meta em reais (contas em dólar convertidas pela PTAX), sem IOF.">
                  Gasto
                </Th>
                <Th coluna="faturamento" ajuda="Vendas aprovadas no dashboard, com upsell e downsell.">
                  Faturamento
                </Th>
                <Th coluna="roas" ajuda="Faturamento ÷ gasto.">
                  ROAS
                </Th>
                <Th coluna="vendas" ajuda="Vendas aprovadas do produto principal.">
                  Vendas
                </Th>
                <Th coluna="cpa" ajuda="Gasto ÷ vendas do produto principal.">
                  CPA
                </Th>
                <Th coluna="ctr" ajuda="Cliques no link ÷ impressões.">
                  CTR
                </Th>
                <Th coluna="hook" ajuda="Visualizações de 3 segundos ÷ impressões.">
                  Hook rate
                </Th>
                <th className={`${tabela.th} text-left`}>Rodando em</th>
                <th className={`${tabela.th} text-left`}>Lista</th>
                <th className={tabela.th}>
                  <span className="sr-only">Ações</span>
                </th>
              </tr>
            </thead>
            <tbody className={tabela.tbody}>
              {prontas.map((l) => {
                const c = CLASSES[l.classe]
                return (
                  <tr key={l.chave} className="hover:bg-surface-2/60">
                    <td className={`${tabela.td} font-mono text-[13px] font-medium whitespace-nowrap`}>
                      {l.card?.vencedor && (
                        <span className="mr-1 text-warn" title="Vencedor confirmado (troféu)">
                          🏆
                        </span>
                      )}
                      {l.nome}
                      {prefs.nivel !== 'anuncio' && <span className="ml-1.5 font-sans text-xs font-normal text-muted">{l.cards.length} anúncio(s)</span>}
                    </td>
                    <td className={tabela.td}>
                      <Selo tom={c.tom}>
                        <span aria-hidden>{c.icone}</span>
                        {c.nome}
                      </Selo>
                    </td>
                    <td className={tabela.num}>{brl(l.gasto)}</td>
                    <td className={tabela.num}>{brl(l.faturamento)}</td>
                    <td className={`${tabela.num} ${l.ind.roas === null ? '' : l.ind.roas >= 1 ? 'text-good' : 'text-bad'}`}>{roas(l.ind.roas)}</td>
                    <td className={tabela.num}>
                      {l.vendas}
                      {l.vendasExtras > 0 && <span className="text-xs text-muted"> +{l.vendasExtras}</span>}
                    </td>
                    <td className={tabela.num}>{brl(l.ind.cpa)}</td>
                    <td className={tabela.num}>{pct(l.ind.ctr)}</td>
                    <td className={tabela.num}>{pct(l.ind.hookRate)}</td>
                    <td className={tabela.td}>
                      {l.veiculacoes.length ? <PilulasContas veiculacoes={l.veiculacoes} contas={contas} className="flex-wrap" /> : <span className="text-muted">—</span>}
                    </td>
                    <td className={`${tabela.td} whitespace-nowrap`}>{l.lista}</td>
                    <td className={`${tabela.td} text-right whitespace-nowrap`}>
                      {l.card ? (
                        <AcoesCard
                          card={l.card}
                          onAbrir={() => navegar(`/quadros/${l.card!.oferta_id}?card=${l.card!.id}`)}
                          onVariacoes={() => setVariacoesDe(l.card!.id)}
                          onTrofeu={() => alternarTrofeu(l.card!)}
                        />
                      ) : (
                        <button
                          onClick={() => {
                            setPrefs({ nivel: 'anuncio' })
                            setBusca(l.nome)
                          }}
                          className="text-sm text-muted hover:text-ink"
                        >
                          Ver anúncios
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot>
              <tr className={`${tabela.subtotal} border-t border-line`}>
                <td className={tabela.td}>Total</td>
                <td className={tabela.td} />
                <td className={tabela.num}>{brl(total.gasto)}</td>
                <td className={tabela.num}>{brl(total.faturamento)}</td>
                <td className={tabela.num}>{roas(indTotal.roas)}</td>
                <td className={tabela.num}>
                  {total.vendas}
                  {total.vendasExtras > 0 && <span className="text-xs font-normal text-muted"> +{total.vendasExtras}</span>}
                </td>
                <td className={tabela.num}>{brl(indTotal.cpa)}</td>
                <td className={tabela.num}>{pct(indTotal.ctr)}</td>
                <td className={tabela.num}>{pct(indTotal.hookRate)}</td>
                <td className={tabela.td} colSpan={3} />
              </tr>
            </tfoot>
          </table>
        </CaixaTabela>
      )}

      {variacoesDe && base && (
        <ModalGerarVariacoes
          cardId={variacoesDe}
          ctx={{ listas: base.listas, ofertas: base.ofertas, contas: base.contas }}
          onFechar={() => setVariacoesDe(null)}
          onCriados={() => {
            setVariacoesDe(null)
            carregar()
          }}
        />
      )}
    </>
  )
}

function AcoesCard({ card, onAbrir, onVariacoes, onTrofeu }: { card: CardQuadro; onAbrir: () => void; onVariacoes: () => void; onTrofeu: () => void }) {
  const botao = 'rounded-md px-2 py-1 text-xs text-muted hover:bg-surface-2 hover:text-ink'
  return (
    <div className="inline-flex items-center gap-0.5">
      <button onClick={onAbrir} className={botao}>
        Abrir
      </button>
      <button onClick={onVariacoes} className={botao}>
        Gerar variações
      </button>
      <button
        onClick={onTrofeu}
        aria-pressed={card.vencedor}
        title={card.vencedor ? 'Vencedor confirmado (clique para desmarcar)' : 'Marcar como vencedor (troféu)'}
        className={`${botao} ${card.vencedor ? 'bg-warn-soft text-warn' : ''}`}
      >
        {card.vencedor ? '🏆 Vencedor' : '🏆?'}
      </button>
    </div>
  )
}
