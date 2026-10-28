import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { Aviso, Carregando, Dica } from '../../../components/ds'
import { useToast } from '../../../components/Toast'
import type { CardDetalhe } from '../../../lib/card'
import { formatarCentavos, formatarDataHora } from '../../../lib/format'
import {
  atualizarMetricas,
  indicadores,
  numerosPorAnuncio,
  PERIODOS,
  somar,
  ultimaBusca,
  type Numeros,
} from '../../../lib/metricas'
import { gravarLocal, lerLocal, type ContaQuadro } from '../../../lib/quadro'
import { botaoPequeno, ICONES, TituloSecao } from './comum'

const brl = (v: number | null) => (v === null ? '—' : formatarCentavos(Math.round(v * 100)))
const pct = (v: number | null) => (v === null ? '—' : `${(v * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`)
const num = (v: number) => v.toLocaleString('pt-BR')
const roas = (v: number | null) => (v === null ? '—' : v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }))

/** Cartão compacto: nome (com dica), valor e uma informação. */
function Bloco({ nome, ajuda, valor, info, tom = '' }: { nome: string; ajuda: ReactNode; valor: ReactNode; info?: ReactNode; tom?: string }) {
  return (
    <div className="rounded-control border border-line bg-surface px-3 py-2">
      <p className="text-xs text-muted">
        <Dica conteudo={ajuda} lado="esquerda">
          {nome}
        </Dica>
      </p>
      <p className={`mt-0.5 font-display text-lg font-semibold tabular-nums ${tom}`}>{valor}</p>
      {info && <p className="text-[11px] text-muted">{info}</p>}
    </div>
  )
}

export function Metricas({ card, contas, versao }: { card: CardDetalhe; contas: ContaQuadro[]; versao: number }) {
  const toast = useToast()
  const [dias, setDias] = useState<number>(() => lerLocal('metricas_periodo', 30))
  const [porAnuncio, setPorAnuncio] = useState<Map<string, Numeros> | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [ultima, setUltima] = useState<string | null>(null)
  const [atualizando, setAtualizando] = useState(false)
  const [porConta, setPorConta] = useState(false)

  const comId = card.veiculacoes.filter((v) => v.meta_ad_id)
  const ids = comId.map((v) => v.meta_ad_id!)
  const chave = ids.join(',')

  const carregar = useCallback(async () => {
    if (!chave) return
    try {
      setPorAnuncio(await numerosPorAnuncio(chave.split(','), dias))
      setUltima(await ultimaBusca())
      setErro(null)
    } catch (e) {
      setErro((e as Error).message)
    }
  }, [chave, dias])

  useEffect(() => {
    carregar()
  }, [carregar, versao])

  async function atualizar() {
    setAtualizando(true)
    try {
      const r = await atualizarMetricas()
      if (r.falhas.length) toast('ruim', `Meta: ${r.falhas.map((f) => `${f.conta} (${f.erro})`).join('; ')}`)
      else toast('bom', 'Métricas da Meta atualizadas.')
      await carregar()
    } catch (e) {
      toast('ruim', `Não foi possível buscar na Meta: ${(e as Error).message}`)
    } finally {
      setAtualizando(false)
    }
  }

  const titulo = (
    <TituloSecao
      icone={ICONES.metricas}
      acoes={
        comId.length > 0 && (
          <div className="flex gap-1">
            {PERIODOS.map((p) => (
              <button
                key={p.valor}
                onClick={() => {
                  setDias(p.valor)
                  gravarLocal('metricas_periodo', p.valor)
                }}
                className={`rounded-full px-2.5 py-0.5 text-xs ${dias === p.valor ? 'bg-ink text-page' : 'bg-surface-2 text-muted hover:text-ink'}`}
              >
                {p.nome}
              </button>
            ))}
          </div>
        )
      }
    >
      Métricas
    </TituloSecao>
  )

  if (!comId.length) {
    return (
      <section>
        {titulo}
        <p className="text-sm text-muted">Preencha o ID do anúncio nas veiculações para ver gasto, vendas e ROAS deste card.</p>
      </section>
    )
  }

  if (erro) {
    return (
      <section>
        {titulo}
        <Aviso tom="ruim">Não foi possível carregar as métricas: {erro}</Aviso>
      </section>
    )
  }

  if (!porAnuncio) {
    return (
      <section>
        {titulo}
        <Carregando linhas={2} altura="h-14" />
      </section>
    )
  }

  const total = somar([...porAnuncio.values()])
  const i = indicadores(total)
  const porContaId = new Map(contas.map((c) => [c.id, c]))

  return (
    <section>
      {titulo}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Bloco nome="Gasto" ajuda="Gasto na Meta no período, em reais (contas em dólar convertidas pela PTAX do dia), sem IOF." valor={brl(total.gasto)} info={`${num(total.impressoes)} impressões`} />
        <Bloco
          nome="Faturamento"
          ajuda="Vendas aprovadas no dashboard com o ID deste anúncio, somando produto principal, upsell e downsell. Reembolsos e chargebacks ficam de fora."
          valor={brl(total.faturamento)}
          info={total.reembolsos ? `${total.reembolsos} reembolso(s) · ${brl(total.valorReembolsado)}` : `líquido ${brl(total.faturamentoLiquido)}`}
        />
        <Bloco
          nome="ROAS"
          ajuda="Faturamento ÷ gasto. Acima de 1, o anúncio trouxe mais do que custou."
          valor={roas(i.roas)}
          tom={i.roas === null ? '' : i.roas >= 1 ? 'text-good' : 'text-bad'}
        />
        <Bloco
          nome="Vendas"
          ajuda="Vendas aprovadas do produto principal. Upsell e downsell aparecem embaixo."
          valor={num(total.vendas)}
          info={total.vendasExtras ? `+${total.vendasExtras} upsell/downsell` : `${num(total.comprasMeta)} compras na Meta`}
        />
        <Bloco nome="CPA" ajuda="Gasto ÷ vendas do produto principal." valor={brl(i.cpa)} />
        <Bloco nome="CPM" ajuda="Custo por mil impressões." valor={brl(i.cpm)} />
        <Bloco nome="CTR (link)" ajuda="Cliques no link ÷ impressões." valor={pct(i.ctr)} info={`${num(total.cliquesLink)} cliques`} />
        <Bloco
          nome="Hook rate"
          ajuda="Visualizações de 3 segundos ÷ impressões: quanto do público o começo do vídeo segura. Hold rate = ThruPlays ÷ visualizações de 3 s."
          valor={pct(i.hookRate)}
          info={`hold ${pct(i.holdRate)}`}
        />
      </div>

      {comId.length > 1 && (
        <button onClick={() => setPorConta((v) => !v)} className={`${botaoPequeno} mt-2 bg-surface-2`}>
          {porConta ? 'Ocultar por conta' : 'Ver por conta'}
        </button>
      )}
      {porConta && (
        <div className="mt-2 overflow-x-auto rounded-control border border-line">
          <table className="w-full text-xs">
            <thead className="border-b border-line text-muted">
              <tr className="text-left">
                <th className="px-2 py-1.5 font-medium">Conta</th>
                <th className="px-2 py-1.5 text-right font-medium">Gasto</th>
                <th className="px-2 py-1.5 text-right font-medium">Vendas</th>
                <th className="px-2 py-1.5 text-right font-medium">Faturamento</th>
                <th className="px-2 py-1.5 text-right font-medium">ROAS</th>
                <th className="px-2 py-1.5 text-right font-medium">CPA</th>
                <th className="px-2 py-1.5 text-right font-medium">CTR</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line tabular-nums">
              {comId.map((v) => {
                const n = porAnuncio.get(v.meta_ad_id!)!
                const x = indicadores(n)
                return (
                  <tr key={v.id}>
                    <td className="px-2 py-1.5 font-mono">{porContaId.get(v.conta_id)?.apelido ?? '?'}</td>
                    <td className="px-2 py-1.5 text-right">{brl(n.gasto)}</td>
                    <td className="px-2 py-1.5 text-right">{num(n.vendas)}</td>
                    <td className="px-2 py-1.5 text-right">{brl(n.faturamento)}</td>
                    <td className="px-2 py-1.5 text-right">{roas(x.roas)}</td>
                    <td className="px-2 py-1.5 text-right">{brl(x.cpa)}</td>
                    <td className="px-2 py-1.5 text-right">{pct(x.ctr)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <p className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted">
        Meta atualizada {ultima ? `em ${formatarDataHora(ultima)}` : 'ainda não'} · vendas ao vivo do dashboard
        <button onClick={atualizar} disabled={atualizando} className={`${botaoPequeno} bg-surface-2 disabled:opacity-50`}>
          {atualizando ? 'Buscando na Meta…' : 'Atualizar agora'}
        </button>
      </p>
    </section>
  )
}
