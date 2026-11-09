import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { Aviso, BolinhaCor, Carregando, Dica, Modal } from '../../components/ds'
import { useToast } from '../../components/Toast'
import { Botao, Campo, entrada } from '../../components/ui'
import {
  caido,
  ehTitular,
  infoStatus,
  nomeDe,
  simularQueda,
  STATUS_ATIVO,
  TIPOS,
  type Registro,
  type ResultadoQueda,
  type TipoAtivo,
  type TipoComStatus,
  type TipoTitular,
} from '../../lib/ativos'
import { mensagemErro } from '../../lib/cadastros'
import { diaBrasilia } from '../../lib/format'
import { STATUS_VEICULACAO, type StatusVeiculacao } from '../../lib/quadro'
import { ops } from '../../lib/supabase'
import { SeloStatusAtivo } from './campos'

/** Perdidos x seguros, e embaixo as ofertas e ads afetados. */
export function ResultadoDaQueda({ r, onAbrir }: { r: ResultadoQueda; onAbrir?: (tipo: TipoAtivo, id: string) => void }) {
  const nada = !r.perdidos.length && !r.seguros.length
  if (nada) return <p className="text-sm text-muted">Nenhum ativo depende dela: não há acessos ativos dados por ela.</p>
  const nomeItem = (tipo: TipoAtivo, id: string, nome: string) =>
    onAbrir ? (
      <button onClick={() => onAbrir(tipo, id)} className="text-left font-medium hover:text-accent-strong hover:underline">
        {nome}
      </button>
    ) : (
      <span className="font-medium">{nome}</span>
    )

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-card border border-bad/40 bg-bad-soft/40 p-3">
          <h3 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-bad">
            <span aria-hidden>✕</span> Perdidos ({r.perdidos.length})
          </h3>
          {r.perdidos.length === 0 ? (
            <p className="text-sm text-muted">Nenhum: tudo continua acessível.</p>
          ) : (
            <ul className="space-y-1.5 text-sm">
              {r.perdidos.map((p) => (
                <li key={`${p.tipo}:${p.id}`} className="flex flex-wrap items-center gap-x-2">
                  <span className="text-xs text-muted">{TIPOS[p.tipo].um}</span>
                  {nomeItem(p.tipo, p.id, p.nome)}
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="rounded-card border border-good/40 bg-good-soft/40 p-3">
          <h3 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-good">
            <span aria-hidden>✓</span> Seguros ({r.seguros.length})
          </h3>
          {r.seguros.length === 0 ? (
            <p className="text-sm text-muted">Nenhum.</p>
          ) : (
            <ul className="space-y-1.5 text-sm">
              {r.seguros.map((s) => (
                <li key={`${s.tipo}:${s.id}`}>
                  <span className="mr-2 text-xs text-muted">{TIPOS[s.tipo].um}</span>
                  {nomeItem(s.tipo, s.id, s.nome)}
                  <span className="block text-xs text-muted">via {(s.via ?? []).map((v) => `${v.nome}${v.papel === 'dona' ? ' (dona)' : ''}`).join(', ')}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div>
        <h3 className="mb-2 text-sm font-semibold">
          <Dica conteudo="Ofertas que usam uma conta, página ou pixel perdido, e os ads rodando ou em análise nas contas perdidas." lado="esquerda">
            Ofertas e ads afetados
          </Dica>
        </h3>
        {r.ofertas.length === 0 ? (
          <p className="text-sm text-muted">Nenhuma oferta afetada.</p>
        ) : (
          <ul className="space-y-3 text-sm">
            {r.ofertas.map((o) => {
              const ads = r.ads.filter((a) => a.oferta_id === o.id)
              return (
                <li key={o.id}>
                  <Link to={`/ofertas/${o.id}`} className="inline-flex items-center gap-2 font-medium hover:text-accent-strong hover:underline">
                    <BolinhaCor cor={o.cor} />
                    <span className="font-mono text-xs">
                      {o.codigo}-{o.idioma}
                    </span>
                    {o.nome}
                  </Link>
                  <span className="block text-xs text-muted">{o.por.join(' · ')}</span>
                  {ads.length > 0 && (
                    <ul className="mt-1 flex flex-wrap gap-1.5">
                      {ads.map((a) => {
                        const s = STATUS_VEICULACAO[a.status as StatusVeiculacao]
                        return (
                          <li key={`${a.card_id}:${a.conta}`}>
                            <Link
                              to={`/quadros/${a.oferta_id}?card=${a.card_id}`}
                              className="inline-block rounded-full bg-surface-2 px-2 py-0.5 font-mono text-[11px] hover:bg-line"
                              title={`${s?.nome ?? a.status} em ${a.conta}`}
                            >
                              {a.nome} · {a.conta}
                            </Link>
                          </li>
                        )
                      })}
                    </ul>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}

/** Janela "E se cair?": só simula, não muda nada. */
export function ModalSimulacao({
  tipo,
  registro,
  onFechar,
  onAbrir,
}: {
  tipo: TipoTitular
  registro: Registro
  onFechar: () => void
  onAbrir: (tipo: TipoAtivo, id: string) => void
}) {
  const [r, setR] = useState<ResultadoQueda | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  useEffect(() => {
    simularQueda(tipo, registro.id).then(setR, (e: Error) => setErro(e.message))
  }, [tipo, registro.id])

  return (
    <Modal titulo={`E se ${nomeDe(tipo, registro)} cair?`} onFechar={onFechar} largura="max-w-3xl">
      {erro && <Aviso tom="ruim">Não foi possível simular: {erro}</Aviso>}
      {!r && !erro && <Carregando linhas={4} altura="h-8" />}
      {r && (
        <ResultadoDaQueda
          r={r}
          onAbrir={(t, id) => {
            onFechar()
            onAbrir(t, id)
          }}
        />
      )}
    </Modal>
  )
}

/**
 * Mudar o status: pede motivo e data (vão para o histórico). Se for a queda de uma
 * BM ou perfil, mostra antes o que vai se perder e, depois de confirmar, o resultado.
 */
export function ModalStatus({
  tipo,
  registro,
  para,
  onFechar,
  onMudou,
  onAbrir,
}: {
  tipo: TipoComStatus
  registro: Registro
  para: string
  onFechar: () => void
  onMudou: () => void
  onAbrir: (tipo: TipoAtivo, id: string) => void
}) {
  const toast = useToast()
  const de = registro.status as string
  const queda = ehTitular(tipo) && caido(tipo, para) && !caido(tipo, de)
  const [motivo, setMotivo] = useState('')
  const [data, setData] = useState(diaBrasilia())
  const [previa, setPrevia] = useState<ResultadoQueda | null>(null)
  const [resultado, setResultado] = useState<ResultadoQueda | null>(null)
  const [salvando, setSalvando] = useState(false)
  const s = infoStatus(tipo, para)

  useEffect(() => {
    if (queda) simularQueda(tipo as TipoTitular, registro.id).then(setPrevia, () => setPrevia(null))
  }, [queda, tipo, registro.id])

  async function confirmar() {
    if (queda && !motivo.trim()) return toast('ruim', 'Escreva o motivo da queda.')
    setSalvando(true)
    const { data: res, error } = await ops().rpc('mudar_status_ativo', {
      p_tipo: tipo,
      p_id: registro.id,
      p_status: para,
      p_motivo: motivo.trim() || null,
      p_data: data || null,
    })
    setSalvando(false)
    if (error) return toast('ruim', mensagemErro(error))
    onMudou()
    if (queda && res) setResultado(res as ResultadoQueda)
    else {
      toast('bom', `Status: ${s?.nome ?? para}.`)
      onFechar()
    }
  }

  if (resultado)
    return (
      <Modal titulo="Queda registrada" onFechar={onFechar} largura="max-w-3xl" rodape={<Botao onClick={onFechar} className="ml-auto">Entendi</Botao>}>
        <div className="space-y-4">
          <Aviso tom="ruim">
            {nomeDe(tipo, registro)} ficou {s?.nome.toLowerCase()}. Os acessos que ela dava ficaram inativos (guardados no histórico).
            {resultado.perdidos.length > 0 && ` ${resultado.perdidos.length} ativo(s) ficaram sem nenhum acesso.`}
          </Aviso>
          <ResultadoDaQueda
            r={resultado}
            onAbrir={(t, id) => {
              onFechar()
              onAbrir(t, id)
            }}
          />
        </div>
      </Modal>
    )

  return (
    <Modal
      titulo={queda ? `Registrar queda de ${nomeDe(tipo, registro)}` : `Mudar status de ${nomeDe(tipo, registro)}`}
      onFechar={onFechar}
      largura={queda ? 'max-w-3xl' : 'max-w-lg'}
      rodape={
        <>
          <Botao variante="secundario" onClick={onFechar} className="ml-auto">
            Cancelar
          </Botao>
          <Botao onClick={confirmar} disabled={salvando}>
            {salvando ? 'Salvando…' : queda ? 'Registrar queda' : 'Mudar status'}
          </Botao>
        </>
      }
    >
      <div className="space-y-4">
        <p className="flex flex-wrap items-center gap-2 text-sm">
          <SeloStatusAtivo tipo={tipo} status={de} />
          <span aria-hidden>→</span>
          <SeloStatusAtivo tipo={tipo} status={para} />
        </p>
        <div className="grid gap-3 sm:grid-cols-[1fr_11rem]">
          <Campo rotulo={queda ? 'Motivo' : 'Motivo (opcional)'}>
            <input value={motivo} onChange={(e) => setMotivo(e.target.value)} className={entrada} placeholder={queda ? 'Ex.: política de anúncios, checkpoint de identidade' : ''} autoFocus />
          </Campo>
          <Campo rotulo="Data">
            <input type="date" value={data} max={diaBrasilia()} onChange={(e) => setData(e.target.value)} className={entrada} />
          </Campo>
        </div>
        {queda && (
          <div>
            <h3 className="mb-2 text-sm font-semibold">O que acontece com esta queda</h3>
            {previa ? <ResultadoDaQueda r={previa} /> : <Carregando linhas={3} altura="h-8" />}
          </div>
        )}
      </div>
    </Modal>
  )
}

/** Seletor de status do painel (abre o ModalStatus ao escolher). */
export function SeletorStatus({ tipo, atual, onEscolher }: { tipo: TipoComStatus; atual: string; onEscolher: (s: string) => void }) {
  return (
    <select
      value={atual}
      onChange={(e) => onEscolher(e.target.value)}
      aria-label="Mudar status"
      className="rounded-control border border-line bg-surface px-2 py-1.5 text-sm"
    >
      {Object.entries(STATUS_ATIVO[tipo]).map(([v, s]) => (
        <option key={v} value={v}>
          {s.icone} {s.nome}
        </option>
      ))}
    </select>
  )
}
