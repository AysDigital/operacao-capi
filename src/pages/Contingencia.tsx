import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router'
import { Aviso, Carregando } from '../components/ds'
import { TituloPagina } from '../components/ui'
import { buscarInventario, caido, type Inventario } from '../lib/ativos'
import {
  buscarAquecimentos,
  buscarHistoricoReal,
  buscarReserva,
  buscarRotinas,
  situacaoDe,
  situacaoReserva,
  TIPOS_AQUECIVEIS,
  type Aquecimento,
  type EventoLog,
  type Reserva,
  type Rotina,
  type TarefaRotina,
} from '../lib/contingencia'
import { Classificar } from './contingencia/Classificar'
import { ModalAquecimento } from './contingencia/ModalAquecimento'
import { QuadroAquecimentos } from './contingencia/QuadroAquecimentos'
import { Quedas } from './contingencia/Quedas'
import { PainelReserva } from './contingencia/Reserva'
import { Rotinas } from './contingencia/Rotinas'

const ABAS = [
  { valor: 'quadro', nome: 'Aquecimento' },
  { valor: 'classificar', nome: 'A classificar' },
  { valor: 'roteiros', nome: 'Roteiros padrão' },
  { valor: 'quedas', nome: 'Quedas' },
] as const
type Aba = (typeof ABAS)[number]['valor']

type Dados = {
  inv: Inventario
  aquecimentos: Aquecimento[]
  rotinas: Rotina[]
  tarefasRotina: TarefaRotina[]
  reserva: Reserva
  historico: EventoLog[]
}

/**
 * Contingência: todo perfil, BM, conta ou página cadastrado em Ativos entra no
 * quadro de aquecimento com o roteiro padrão do tipo. Checklist completo = Pronto.
 */
export function Contingencia() {
  const [params, setParams] = useSearchParams()
  const aba = (ABAS.some((a) => a.valor === params.get('aba')) ? params.get('aba') : 'quadro') as Aba
  const [dados, setDados] = useState<Dados | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [aberto, setAberto] = useState<string | null>(null)

  const carregar = useCallback(
    () =>
      Promise.all([buscarInventario(), buscarAquecimentos(), buscarRotinas(), buscarReserva(), buscarHistoricoReal()]).then(
        ([inv, aquecimentos, r, reserva, historico]) => setDados({ inv, aquecimentos, rotinas: r.rotinas, tarefasRotina: r.tarefas, reserva, historico }),
        (e: Error) => setErro(e.message),
      ),
    [],
  )
  useEffect(() => {
    carregar()
  }, [carregar])

  const situacao = useMemo(() => (dados ? situacaoReserva(dados.inv, dados.reserva) : []), [dados])
  const contagem = useMemo(() => {
    const n = { quadro: 0, classificar: 0 }
    if (!dados) return n
    n.quadro = dados.aquecimentos.filter((a) => a.status === 'andamento').length
    for (const t of TIPOS_AQUECIVEIS)
      n.classificar += dados.inv[t].filter((r) => !caido(t, r.status as string) && situacaoDe(r) === 'a_classificar').length
    return n
  }, [dados])

  const aquecimentoAberto = dados?.aquecimentos.find((a) => a.id === aberto)

  return (
    <>
      <TituloPagina>Contingência</TituloPagina>

      {erro && <Aviso tom="ruim">Não foi possível carregar a Contingência: {erro}</Aviso>}
      {!dados && !erro && <Carregando linhas={4} altura="h-16" />}

      {dados && (
        <>
          <PainelReserva situacao={situacao} reserva={dados.reserva} onMudou={carregar} />

          <nav className="mb-5 flex gap-1 overflow-x-auto border-b border-line" aria-label="Seções da Contingência">
            {ABAS.map((a) => {
              const n = a.valor === 'quadro' || a.valor === 'classificar' ? contagem[a.valor] : 0
              return (
                <button
                  key={a.valor}
                  onClick={() => setParams(a.valor === 'quadro' ? {} : { aba: a.valor }, { replace: true })}
                  aria-current={aba === a.valor ? 'page' : undefined}
                  className={`-mb-px shrink-0 border-b-2 px-3 py-2 text-sm whitespace-nowrap transition-colors ${
                    aba === a.valor ? 'border-accent font-medium text-accent-strong' : 'border-transparent text-muted hover:text-ink'
                  }`}
                >
                  {a.nome}
                  {n > 0 && <span className={`ml-1.5 text-xs tabular-nums ${a.valor === 'classificar' ? 'font-semibold text-warn' : 'text-muted'}`}>{n}</span>}
                </button>
              )
            })}
          </nav>

          {aba === 'quadro' && (
            <QuadroAquecimentos
              inv={dados.inv}
              aquecimentos={dados.aquecimentos}
              aClassificar={contagem.classificar}
              onAbrir={(a) => setAberto(a.id)}
              onClassificar={() => setParams({ aba: 'classificar' }, { replace: true })}
            />
          )}
          {aba === 'classificar' && <Classificar inv={dados.inv} rotinas={dados.rotinas} onMudou={carregar} />}
          {aba === 'roteiros' && <Rotinas rotinas={dados.rotinas} tarefas={dados.tarefasRotina} onMudou={carregar} />}
          {aba === 'quedas' && <Quedas inv={dados.inv} historico={dados.historico} />}

          {aquecimentoAberto && <ModalAquecimento key={aquecimentoAberto.id} aq={aquecimentoAberto} inv={dados.inv} onFechar={() => setAberto(null)} onMudou={carregar} />}
        </>
      )}
    </>
  )
}
