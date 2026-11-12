import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router'
import { useToast } from '../../components/Toast'
import { Botao } from '../../components/ui'
import { TABELA, type Inventario } from '../../lib/ativos'
import { mensagemErro } from '../../lib/cadastros'
import { buscarAquecimentos, diaDoQuadro, progresso, situacaoDe, STATUS_AQUECIMENTO, type Aquecimento, type TipoAquecivel } from '../../lib/contingencia'
import { ops } from '../../lib/supabase'
import { SeloAquecimento } from '../ativos/campos'
import { formatarDiaIso } from '../../lib/format'
import { IniciarAquecimento } from './IniciarAquecimento'

/** Bloco "Aquecimento" no painel do ativo em Ativos (perfis, BMs, contas e páginas). */
export function AquecimentoDoAtivo({ tipo, id, inv, onMudou }: { tipo: TipoAquecivel; id: string; inv: Inventario; onMudou: () => void }) {
  const toast = useToast()
  const registro = inv[tipo].find((r) => r.id === id)
  const [lista, setLista] = useState<Aquecimento[] | null>(null)
  const [iniciando, setIniciando] = useState(false)

  const carregar = useCallback(
    () =>
      buscarAquecimentos().then(
        (todos) => setLista(todos.filter((a) => a.ativo_tipo === tipo && a.ativo_id === id)),
        () => setLista([]),
      ),
    [tipo, id],
  )
  useEffect(() => {
    carregar()
  }, [carregar])

  if (!lista) return null
  const atual = lista.find((a) => a.status === 'andamento')
  const anteriores = lista.filter((a) => a.status !== 'andamento')

  async function marcarPronto() {
    const { error } = await ops().from(TABELA[tipo]).update({ aquecimento: 'pronto' }).eq('id', id)
    if (error) return toast('ruim', mensagemErro(error))
    toast('bom', 'Marcado como pronto.')
    onMudou()
  }

  return (
    <section className="border-t border-line pt-4">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-sm font-semibold">
          Aquecimento {registro && <SeloAquecimento r={registro} />}
        </h3>
        {!atual && (
          <span className="flex gap-2">
            {situacaoDe(registro) === 'a_classificar' && (
              <Botao variante="secundario" onClick={marcarPronto}>
                ✓ Já está pronto
              </Botao>
            )}
            <Botao variante="secundario" onClick={() => setIniciando(true)}>
              {situacaoDe(registro) === 'pronto' ? 'Aquecer de novo' : 'Iniciar aquecimento'}
            </Botao>
          </span>
        )}
      </div>
      {atual ? (
        <p className="text-sm">
          <span className="font-medium">{atual.rotina_nome}</span>
          <span className="text-muted">
            {' '}
            · no Dia {diaDoQuadro(atual)} de {atual.duracao_dias} · {progresso(atual).feitas}/{progresso(atual).total} tarefas
          </span>{' '}
          <Link to="/contingencia" className="text-accent-strong hover:underline">
            Abrir na Contingência
          </Link>
        </p>
      ) : (
        <p className="text-sm text-muted">Nenhum aquecimento em andamento.</p>
      )}
      {anteriores.length > 0 && (
        <ul className="mt-2 space-y-0.5 text-xs text-muted">
          {anteriores.map((a) => (
            <li key={a.id}>
              {STATUS_AQUECIMENTO.find((s) => s.valor === a.status)?.icone} {a.rotina_nome} · {formatarDiaIso(a.inicio)} a {formatarDiaIso(a.fim)}
              {a.motivo && ` · ${a.motivo}`}
            </li>
          ))}
        </ul>
      )}
      {iniciando && (
        <IniciarAquecimento
          inv={inv}
          tipoInicial={tipo}
          ativoInicial={id}
          emAndamento={new Set()}
          onFechar={() => setIniciando(false)}
          onIniciado={() => {
            setIniciando(false)
            carregar()
            onMudou()
          }}
        />
      )}
    </section>
  )
}
