import { useState } from 'react'
import { Aviso, CaixaTabela, tabela, Vazio } from '../../components/ds'
import { useToast } from '../../components/Toast'
import { Botao } from '../../components/ui'
import { caido, nomeDe, TABELA, type Inventario, type Registro } from '../../lib/ativos'
import { mensagemErro } from '../../lib/cadastros'
import { NOME_TIPO, situacaoDe, TIPOS_AQUECIVEIS, type Rotina, type TipoAquecivel } from '../../lib/contingencia'
import { ops } from '../../lib/supabase'
import { SeloStatusAtivo } from '../ativos/campos'

/**
 * Ativos que já existiam antes da contingência padrão (ou cadastrados sem roteiro padrão):
 * para cada um, a usuária diz se já está pronto ou se precisa aquecer.
 * Caídos não aparecem.
 */
export function Classificar({ inv, rotinas, onMudou }: { inv: Inventario; rotinas: Rotina[]; onMudou: () => void }) {
  const grupos = TIPOS_AQUECIVEIS.map((tipo) => ({
    tipo,
    itens: inv[tipo]
      .filter((r) => !caido(tipo, r.status as string) && situacaoDe(r) === 'a_classificar')
      .sort((a, b) => nomeDe(tipo, a).localeCompare(nomeDe(tipo, b), 'pt-BR', { numeric: true })),
    padrao: rotinas.find((r) => r.tipo === tipo && r.padrao && r.ativa),
  })).filter((g) => g.itens.length)

  if (!grupos.length) return <Vazio titulo="Tudo classificado: nenhum ativo esperando." />

  return (
    <div className="space-y-6">
      {grupos.map((g) => (
        <Grupo key={g.tipo} tipo={g.tipo} itens={g.itens} padrao={g.padrao} onMudou={onMudou} />
      ))}
    </div>
  )
}

function Grupo({ tipo, itens, padrao, onMudou }: { tipo: TipoAquecivel; itens: Registro[]; padrao?: Rotina; onMudou: () => void }) {
  const toast = useToast()
  const [marcados, setMarcados] = useState<Set<string>>(new Set())
  const [salvando, setSalvando] = useState(false)
  const todos = marcados.size === itens.length
  const alvo = (ids?: string[]) => ids ?? [...marcados]

  async function pronto(ids?: string[]) {
    const lista = alvo(ids)
    if (!lista.length) return
    setSalvando(true)
    const { error } = await ops().from(TABELA[tipo]).update({ aquecimento: 'pronto' }).in('id', lista)
    setSalvando(false)
    if (error) return toast('ruim', mensagemErro(error))
    toast('bom', `${lista.length} marcado(s) como pronto(s).`)
    setMarcados(new Set())
    onMudou()
  }

  async function aquecer(ids?: string[]) {
    const lista = alvo(ids)
    if (!lista.length) return
    setSalvando(true)
    const { data, error } = await ops().rpc('aquecer_com_padrao', { p_tipo: tipo, p_ids: lista })
    setSalvando(false)
    if (error) return toast('ruim', mensagemErro(error))
    toast('bom', `${data} entraram no aquecimento (Dia 1).`)
    setMarcados(new Set())
    onMudou()
  }

  return (
    <section>
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <h2 className="text-sm font-semibold">
          {NOME_TIPO[tipo].varios} <span className="font-normal text-muted tabular-nums">{itens.length}</span>
        </h2>
        {marcados.size > 0 && (
          <span className="ml-auto flex flex-wrap items-center gap-2">
            <span className="text-xs text-muted">{marcados.size} selecionado(s)</span>
            <Botao variante="secundario" onClick={() => pronto()} disabled={salvando}>
              ✓ Já estão prontos
            </Botao>
            <Botao onClick={() => aquecer()} disabled={salvando || !padrao}>
              ◐ Precisam aquecer
            </Botao>
          </span>
        )}
      </div>
      {!padrao && (
        <div className="mb-2">
          <Aviso tom="atencao">Não há roteiro padrão ativo para {NOME_TIPO[tipo].varios.toLowerCase()}: crie ou marque um em "Roteiros padrão" para mandar para o aquecimento.</Aviso>
        </div>
      )}
      <CaixaTabela>
        <table className={tabela.table}>
          <thead className={tabela.thead}>
            <tr className="text-left">
              <th className={`${tabela.th} w-8`}>
                <input
                  type="checkbox"
                  checked={todos}
                  onChange={() => setMarcados(todos ? new Set() : new Set(itens.map((r) => r.id)))}
                  aria-label="Selecionar todos"
                  className="accent-[var(--c-accent)]"
                />
              </th>
              <th className={tabela.th}>{NOME_TIPO[tipo].um}</th>
              <th className={tabela.th}>Status</th>
              <th className={tabela.th} />
            </tr>
          </thead>
          <tbody className={tabela.tbody}>
            {itens.map((r) => (
              <tr key={r.id} className="hover:bg-surface-2/60">
                <td className={tabela.td}>
                  <input
                    type="checkbox"
                    checked={marcados.has(r.id)}
                    onChange={() =>
                      setMarcados((m) => {
                        const n = new Set(m)
                        if (n.has(r.id)) n.delete(r.id)
                        else n.add(r.id)
                        return n
                      })
                    }
                    aria-label={nomeDe(tipo, r)}
                    className="accent-[var(--c-accent)]"
                  />
                </td>
                <td className={`${tabela.td} font-medium`}>{nomeDe(tipo, r)}</td>
                <td className={tabela.td}>
                  <SeloStatusAtivo tipo={tipo} status={r.status} />
                </td>
                <td className={`${tabela.td} text-right whitespace-nowrap`}>
                  <button onClick={() => pronto([r.id])} disabled={salvando} className="rounded-control px-2 py-0.5 text-xs text-good hover:bg-good-soft">
                    ✓ Pronto
                  </button>
                  <button
                    onClick={() => aquecer([r.id])}
                    disabled={salvando || !padrao}
                    className="ml-1 rounded-control px-2 py-0.5 text-xs text-warn hover:bg-warn-soft disabled:opacity-40"
                  >
                    ◐ Precisa aquecer
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </CaixaTabela>
    </section>
  )
}
