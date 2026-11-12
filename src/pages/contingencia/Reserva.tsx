import { useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { Aviso, Dica, Modal } from '../../components/ds'
import { useToast } from '../../components/Toast'
import { Botao, Campo, entrada } from '../../components/ui'
import { mensagemErro } from '../../lib/cadastros'
import { NOME_TIPO, TIPOS_AQUECIVEIS, type Reserva, type SituacaoReserva } from '../../lib/contingencia'
import { ops } from '../../lib/supabase'

const EXPLICACAO =
  'Pronto = não caído, com aquecimento "Pronto" e sem uso agora: perfil fora de "Em uso"; conta na coluna "Sem uso" do quadro de uso; página sem oferta ligada; BM pronta.'

/** Painel do topo da Contingência: prontos × mínimo por tipo. */
export function PainelReserva({ situacao, reserva, onMudou }: { situacao: SituacaoReserva[]; reserva: Reserva; onMudou: () => void }) {
  const [configurando, setConfigurando] = useState(false)
  const abaixo = situacao.filter((s) => s.abaixo)
  return (
    <section className="mb-6">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">
          <Dica conteudo={EXPLICACAO} lado="esquerda">
            Reserva de prontos
          </Dica>
        </h2>
        <button onClick={() => setConfigurando(true)} className="rounded-control px-2 py-1 text-xs text-muted hover:bg-surface-2 hover:text-ink">
          Configurar mínimo
        </button>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {situacao.map((s) => (
          <div key={s.tipo} className={`rounded-card border p-3 ${s.abaixo ? 'border-bad/50 bg-bad-soft/40' : 'border-line bg-surface'}`}>
            <p className="text-xs text-muted">{NOME_TIPO[s.tipo].varios} prontos</p>
            <p className="mt-1 flex items-baseline gap-1.5">
              <span className={`text-2xl font-semibold tabular-nums ${s.abaixo ? 'text-bad' : ''}`}>{s.prontos}</span>
              <span className="text-sm text-muted">de {s.minimo} no mínimo</span>
            </p>
            <p className={`mt-1 text-xs ${s.abaixo ? 'text-bad' : 'text-good'}`}>
              {s.minimo === 0 ? <span className="text-muted">Sem mínimo definido</span> : s.abaixo ? `! Faltam ${s.minimo - s.prontos}` : '✓ Reserva ok'}
            </p>
          </div>
        ))}
      </div>
      {abaixo.length > 0 && (
        <div className="mt-3">
          <AvisoReserva abaixo={abaixo} />
        </div>
      )}
      {configurando && <ConfigurarReserva reserva={reserva} onFechar={() => setConfigurando(false)} onSalvo={onMudou} />}
    </section>
  )
}

/** Alerta de reserva abaixo do mínimo (Contingência e Ativos). */
export function AvisoReserva({ abaixo, comLink }: { abaixo: SituacaoReserva[]; comLink?: boolean }) {
  return (
    <Aviso
      tom="ruim"
      acao={
        comLink ? (
          <Link to="/contingencia" className="shrink-0 text-sm font-medium underline-offset-2 hover:underline">
            Ver Contingência
          </Link>
        ) : undefined
      }
    >
      Reserva abaixo do mínimo:{' '}
      {abaixo.map((s, i) => (
        <span key={s.tipo}>
          {i > 0 && ', '}
          {NOME_TIPO[s.tipo].varios.toLowerCase()} {s.prontos} de {s.minimo}
        </span>
      ))}
      .
    </Aviso>
  )
}

function ConfigurarReserva({ reserva, onFechar, onSalvo }: { reserva: Reserva; onFechar: () => void; onSalvo: () => void }) {
  const toast = useToast()
  const [valores, setValores] = useState<Record<string, string>>(Object.fromEntries(TIPOS_AQUECIVEIS.map((t) => [t, String(reserva[t])])))
  const [salvando, setSalvando] = useState(false)

  async function salvar(e: FormEvent) {
    e.preventDefault()
    setSalvando(true)
    const linhas = TIPOS_AQUECIVEIS.map((t) => ({ tipo: t, minimo: Math.max(0, Math.min(999, parseInt(valores[t], 10) || 0)) }))
    const { error } = await ops().from('reserva_minima').upsert(linhas)
    setSalvando(false)
    if (error) return toast('ruim', mensagemErro(error))
    toast('bom', 'Reserva mínima salva.')
    onSalvo()
    onFechar()
  }

  return (
    <Modal
      titulo="Reserva mínima"
      onFechar={onFechar}
      rodape={
        <>
          <Botao variante="secundario" onClick={onFechar} className="ml-auto">
            Cancelar
          </Botao>
          <Botao type="submit" form="form-reserva" disabled={salvando}>
            {salvando ? 'Salvando…' : 'Salvar'}
          </Botao>
        </>
      }
    >
      <form id="form-reserva" onSubmit={salvar} className="grid gap-4 sm:grid-cols-4">
        {TIPOS_AQUECIVEIS.map((t) => (
          <Campo key={t} rotulo={NOME_TIPO[t].varios}>
            <input type="number" min={0} max={999} value={valores[t]} onChange={(e) => setValores((v) => ({ ...v, [t]: e.target.value }))} className={entrada} />
          </Campo>
        ))}
      </form>
      <p className="mt-3 text-xs text-muted">{EXPLICACAO}</p>
    </Modal>
  )
}
