import { useMemo, useState } from 'react'
import { CaixaTabela, Dica, Secao, tabela, Vazio } from '../../components/ds'
import { caido, infoStatus, nomeAtivo, TIPOS, type Inventario, type Registro, type TipoAtivo } from '../../lib/ativos'
import { diasEntre, type EventoLog } from '../../lib/contingencia'
import { diaBrasilia, formatarDiaIso } from '../../lib/format'
import { SeloStatusAtivo } from '../ativos/campos'

const PERIODOS = [
  { dias: 30, nome: '30 dias' },
  { dias: 90, nome: '90 dias' },
  { dias: 365, nome: '12 meses' },
  { dias: 0, nome: 'Tudo' },
]
const DIAS_MES = 30.44
const real = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const mesesTexto = (m: number) => (m < 1 ? `${Math.round(m * DIAS_MES)} dias` : `${m.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} meses`)

type Queda = { id: string; tipo: TipoAtivo; ativoId: string; ativo?: Registro; para: string; dia: string; motivo: string | null; fornecedor: string | null; durouDias: number | null }

/** Data de "nascimento" do ativo: compra (perfis e BMs) ou criação (contas). */
function inicioDe(tipo: TipoAtivo, r?: Registro): string | null {
  if (!r) return null
  if (tipo === 'perfil' || tipo === 'bm') return (r.data_compra as string) ?? null
  if (tipo === 'conta') return (r.data_criacao as string) ?? null
  return null
}

/** Quedas (a partir do histórico real), resumo por fornecedor e quedas por mês. */
export function Quedas({ inv, historico }: { inv: Inventario; historico: EventoLog[] }) {
  const [periodo, setPeriodo] = useState(90)

  const todas: Queda[] = useMemo(
    () =>
      historico
        .filter((e) => e.de != null && caido(e.ativo_tipo as TipoAtivo, e.para) && !caido(e.ativo_tipo as TipoAtivo, e.de))
        .map((e) => {
          const tipo = e.ativo_tipo as TipoAtivo
          const ativo = inv[tipo]?.find((r) => r.id === e.ativo_id)
          const dia = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date(e.data))
          const ini = inicioDe(tipo, ativo)
          return {
            id: e.id,
            tipo,
            ativoId: e.ativo_id,
            ativo,
            para: e.para,
            dia,
            motivo: e.motivo,
            fornecedor: ativo?.fornecedor_id ? nomeAtivo(inv, 'fornecedor', ativo.fornecedor_id as string) : null,
            durouDias: ini ? diasEntre(ini, dia) : null,
          }
        }),
    [historico, inv],
  )

  const desde = periodo ? diaBrasilia(-periodo) : ''
  const lista = todas.filter((q) => !desde || q.dia >= desde)

  // Resumo por fornecedor: perfis e BMs comprados (os que têm fornecedor).
  const resumo = useMemo(() => {
    const ultimaQueda = new Map<string, string>()
    for (const q of todas) {
      const k = `${q.tipo}:${q.ativoId}`
      if (!ultimaQueda.has(k) || ultimaQueda.get(k)! < q.dia) ultimaQueda.set(k, q.dia)
    }
    return inv.fornecedor
      .map((f) => {
        const comprados = (['perfil', 'bm'] as const).flatMap((t) => inv[t].filter((r) => r.fornecedor_id === f.id).map((r) => ({ t, r })))
        const caidos = comprados.filter(({ t, r }) => caido(t, r.status as string))
        const vidas: { meses: number; custo: number | null }[] = []
        for (const { t, r } of caidos) {
          const ini = inicioDe(t, r)
          const fim = ultimaQueda.get(`${t}:${r.id}`)
          if (!ini || !fim) continue
          const meses = Math.max(diasEntre(ini, fim), 1) / DIAS_MES
          vidas.push({ meses, custo: r.custo == null ? null : Number(r.custo) })
        }
        const comCusto = vidas.filter((v) => v.custo != null)
        return {
          id: f.id,
          nome: String(f.nome),
          comprados: comprados.length,
          caidos: caidos.length,
          semData: caidos.length - vidas.length,
          vidaMedia: vidas.length ? vidas.reduce((s, v) => s + v.meses, 0) / vidas.length : null,
          custoMes: comCusto.length ? comCusto.reduce((s, v) => s + v.custo! / v.meses, 0) / comCusto.length : null,
        }
      })
      .filter((f) => f.comprados > 0)
      .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
  }, [inv, todas])

  // Quedas por mês (últimos 12 meses).
  const meses = useMemo(() => {
    const hoje = diaBrasilia()
    const [a, m] = hoje.split('-').map(Number)
    return Array.from({ length: 12 }, (_, i) => {
      const d = new Date(Date.UTC(a, m - 1 - (11 - i), 1))
      const chave = d.toISOString().slice(0, 7)
      return {
        chave,
        nome: new Intl.DateTimeFormat('pt-BR', { month: 'short', timeZone: 'UTC' }).format(d).replace('.', ''),
        total: todas.filter((q) => q.dia.startsWith(chave)).length,
      }
    })
  }, [todas])
  const maior = Math.max(1, ...meses.map((x) => x.total))

  return (
    <div className="space-y-8">
      <Secao titulo="Quedas por mês" ajuda="Quantos ativos caíram em cada mês (últimos 12 meses). Conta só mudanças de status reais, não as importações do inventário.">
        <div className="flex h-36 items-end gap-1.5 rounded-card border border-line bg-surface p-3" role="img" aria-label="Quedas por mês">
          {meses.map((x) => (
            <div key={x.chave} className="flex h-full flex-1 flex-col items-center justify-end gap-1" title={`${x.nome}: ${x.total} queda(s)`}>
              <span className="text-[11px] text-muted tabular-nums">{x.total || ''}</span>
              <div className="w-full max-w-8 rounded-t bg-bad/70" style={{ height: `${(x.total / maior) * 100}%`, minHeight: x.total ? 3 : 0 }} />
              <span className="text-[11px] text-muted">{x.nome}</span>
            </div>
          ))}
        </div>
      </Secao>

      <Secao
        titulo="Fornecedores"
        ajuda="Perfis e BMs comprados de cada fornecedor. Vida útil = da data da compra até a queda. Custo por mês = custo ÷ meses que durou (média dos que caíram e têm custo e data de compra)."
      >
        {resumo.length === 0 ? (
          <p className="text-sm text-muted">Nenhum perfil ou BM com fornecedor cadastrado.</p>
        ) : (
          <CaixaTabela>
            <table className={tabela.table}>
              <thead className={tabela.thead}>
                <tr className="text-left">
                  <th className={tabela.th}>Fornecedor</th>
                  <th className={`${tabela.th} text-right`}>Comprados</th>
                  <th className={`${tabela.th} text-right`}>Caíram</th>
                  <th className={`${tabela.th} text-right`}>Vida útil média</th>
                  <th className={`${tabela.th} text-right`}>Custo por mês de vida</th>
                </tr>
              </thead>
              <tbody className={tabela.tbody}>
                {resumo.map((f) => (
                  <tr key={f.id}>
                    <td className={`${tabela.td} font-medium`}>{f.nome}</td>
                    <td className={`${tabela.td} text-right tabular-nums`}>{f.comprados}</td>
                    <td className={`${tabela.td} text-right tabular-nums`}>
                      {f.caidos}
                      {f.comprados > 0 && <span className="ml-1 text-xs text-muted">({Math.round((f.caidos / f.comprados) * 100)}%)</span>}
                    </td>
                    <td className={`${tabela.td} text-right tabular-nums`}>
                      {f.vidaMedia == null ? '—' : mesesTexto(f.vidaMedia)}
                      {f.semData > 0 && (
                        <span className="ml-1 align-middle">
                          <Dica conteudo={`${f.semData} caído(s) sem data de compra ou sem queda registrada no histórico: ficam fora da média.`} lado="direita" />
                        </span>
                      )}
                    </td>
                    <td className={`${tabela.td} text-right tabular-nums`}>{f.custoMes == null ? '—' : real(f.custoMes)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CaixaTabela>
        )}
      </Secao>

      <Secao
        titulo="Quedas no período"
        acoes={
          <select value={periodo} onChange={(e) => setPeriodo(Number(e.target.value))} aria-label="Período" className="rounded-control border border-line bg-surface px-2 py-1.5 text-sm">
            {PERIODOS.map((p) => (
              <option key={p.dias} value={p.dias}>
                {p.nome}
              </option>
            ))}
          </select>
        }
      >
        {lista.length === 0 ? (
          <Vazio titulo="Nenhuma queda registrada no período" />
        ) : (
          <CaixaTabela>
            <table className={tabela.table}>
              <thead className={tabela.thead}>
                <tr className="text-left">
                  <th className={tabela.th}>Data</th>
                  <th className={tabela.th}>Ativo</th>
                  <th className={tabela.th}>Tipo</th>
                  <th className={tabela.th}>Ficou</th>
                  <th className={tabela.th}>Fornecedor</th>
                  <th className={tabela.th}>Motivo</th>
                  <th className={`${tabela.th} text-right`}>Durou</th>
                </tr>
              </thead>
              <tbody className={tabela.tbody}>
                {lista.map((q) => (
                  <tr key={q.id}>
                    <td className={`${tabela.td} whitespace-nowrap tabular-nums`}>{formatarDiaIso(q.dia)}</td>
                    <td className={`${tabela.td} font-medium`}>{q.ativo ? nomeAtivo(inv, q.tipo, q.ativoId) : <span className="text-muted">(excluído)</span>}</td>
                    <td className={tabela.td}>{TIPOS[q.tipo].um}</td>
                    <td className={tabela.td}>{infoStatus(q.tipo, q.para) ? <SeloStatusAtivo tipo={q.tipo} status={q.para} /> : q.para}</td>
                    <td className={tabela.td}>{q.fornecedor ?? '—'}</td>
                    <td className={tabela.td}>{q.motivo ?? '—'}</td>
                    <td className={`${tabela.td} text-right whitespace-nowrap tabular-nums`}>{q.durouDias == null ? '—' : mesesTexto(q.durouDias / DIAS_MES)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CaixaTabela>
        )}
      </Secao>
    </div>
  )
}
