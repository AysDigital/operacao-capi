import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router'
import { Aviso, Carregando } from '../components/ds'
import { Botao, TituloPagina } from '../components/ui'
import { buscarInventario, type Inventario } from '../lib/ativos'
import {
  buscarAquecimentos,
  buscarHistoricoReal,
  buscarReserva,
  buscarRotinas,
  situacaoReserva,
  type Aquecimento,
  type EventoLog,
  type Reserva,
  type Rotina,
  type TarefaAquecimento,
  type TarefaRotina,
} from '../lib/contingencia'
import { Hoje } from './contingencia/Hoje'
import { IniciarAquecimento } from './contingencia/IniciarAquecimento'
import { ModalAquecimento } from './contingencia/ModalAquecimento'
import { QuadroAquecimentos } from './contingencia/QuadroAquecimentos'
import { Quedas } from './contingencia/Quedas'
import { PainelReserva } from './contingencia/Reserva'
import { Rotinas } from './contingencia/Rotinas'

const ABAS = [
  { valor: 'hoje', nome: 'Hoje' },
  { valor: 'quadro', nome: 'Quadro' },
  { valor: 'rotinas', nome: 'Rotinas' },
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
 * Contingência: aquecimento, reserva e quedas. Usa os ativos de Ativos, mas não muda
 * status nem coluna do quadro de uso sozinha: quem decide é a usuária.
 */
export function Contingencia() {
  const [params, setParams] = useSearchParams()
  const aba = (ABAS.some((a) => a.valor === params.get('aba')) ? params.get('aba') : 'hoje') as Aba
  const [dados, setDados] = useState<Dados | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [aberto, setAberto] = useState<string | null>(null)
  const [iniciando, setIniciando] = useState(false)

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

  const situacao = useMemo(() => (dados ? situacaoReserva(dados.inv, dados.aquecimentos, dados.reserva) : []), [dados])
  const emAndamento = useMemo(
    () => new Set((dados?.aquecimentos ?? []).filter((a) => a.status === 'andamento').map((a) => `${a.ativo_tipo}:${a.ativo_id}`)),
    [dados],
  )

  /** Marcar tarefa na tela Hoje: atualiza só aquela tarefa, sem recarregar tudo. */
  const trocarTarefa = (t: TarefaAquecimento) =>
    setDados((d) => d && { ...d, aquecimentos: d.aquecimentos.map((a) => (a.id === t.aquecimento_id ? { ...a, tarefas: a.tarefas.map((x) => (x.id === t.id ? t : x)) } : a)) })

  const aquecimentoAberto = dados?.aquecimentos.find((a) => a.id === aberto)

  return (
    <>
      <TituloPagina
        acoes={
          <Botao onClick={() => setIniciando(true)} disabled={!dados}>
            Iniciar aquecimento
          </Botao>
        }
      >
        Contingência
      </TituloPagina>

      {erro && <Aviso tom="ruim">Não foi possível carregar a Contingência: {erro}</Aviso>}
      {!dados && !erro && <Carregando linhas={4} altura="h-16" />}

      {dados && (
        <>
          <PainelReserva situacao={situacao} reserva={dados.reserva} onMudou={carregar} />

          <nav className="mb-5 flex gap-1 overflow-x-auto border-b border-line" aria-label="Seções da Contingência">
            {ABAS.map((a) => (
              <button
                key={a.valor}
                onClick={() => setParams(a.valor === 'hoje' ? {} : { aba: a.valor }, { replace: true })}
                aria-current={aba === a.valor ? 'page' : undefined}
                className={`-mb-px shrink-0 border-b-2 px-3 py-2 text-sm whitespace-nowrap transition-colors ${
                  aba === a.valor ? 'border-accent font-medium text-accent-strong' : 'border-transparent text-muted hover:text-ink'
                }`}
              >
                {a.nome}
                {a.valor === 'hoje' && emAndamento.size > 0 && <span className="ml-1.5 text-xs text-muted tabular-nums">{emAndamento.size}</span>}
              </button>
            ))}
          </nav>

          {aba === 'hoje' && <Hoje inv={dados.inv} aquecimentos={dados.aquecimentos} onAbrir={(a) => setAberto(a.id)} onTarefa={trocarTarefa} />}
          {aba === 'quadro' && <QuadroAquecimentos inv={dados.inv} aquecimentos={dados.aquecimentos} onAbrir={(a) => setAberto(a.id)} />}
          {aba === 'rotinas' && <Rotinas rotinas={dados.rotinas} tarefas={dados.tarefasRotina} onMudou={carregar} />}
          {aba === 'quedas' && <Quedas inv={dados.inv} historico={dados.historico} />}

          {aquecimentoAberto && <ModalAquecimento key={aquecimentoAberto.id} aq={aquecimentoAberto} inv={dados.inv} onFechar={() => setAberto(null)} onMudou={carregar} />}
          {iniciando && (
            <IniciarAquecimento
              inv={dados.inv}
              emAndamento={emAndamento}
              onFechar={() => setIniciando(false)}
              onIniciado={(id) => {
                setIniciando(false)
                carregar().then(() => setAberto(id))
              }}
            />
          )}
        </>
      )}
    </>
  )
}
