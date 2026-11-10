import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router'
import { Botao } from '../../components/ui'
import { type Inventario } from '../../lib/ativos'
import { buscarAquecimentos, diaAtual, progresso, STATUS_AQUECIMENTO, type Aquecimento, type TipoAquecivel } from '../../lib/contingencia'
import { formatarDiaIso } from '../../lib/format'
import { IniciarAquecimento } from './IniciarAquecimento'

/** Bloco "Aquecimento" no painel do ativo em Ativos (perfis, contas e páginas). */
export function AquecimentoDoAtivo({ tipo, id, inv, onMudou }: { tipo: TipoAquecivel; id: string; inv: Inventario; onMudou: () => void }) {
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

  return (
    <section className="border-t border-line pt-4">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">Aquecimento</h3>
        {!atual && (
          <Botao variante="secundario" onClick={() => setIniciando(true)}>
            Iniciar aquecimento
          </Botao>
        )}
      </div>
      {atual ? (
        <p className="text-sm">
          <span className="font-medium">{atual.rotina_nome}</span>
          <span className="text-muted">
            {' '}
            · D{diaAtual(atual)} de {atual.duracao_dias} · {progresso(atual).feitas}/{progresso(atual).total} tarefas
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
