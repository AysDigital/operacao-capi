import { useState } from 'react'
import { Aviso, Modal, Selo } from '../../components/ds'
import { useToast } from '../../components/Toast'
import { Botao, BotaoExcluir, Campo, entrada } from '../../components/ui'
import { nomeDe, type Inventario } from '../../lib/ativos'
import { mensagemErro } from '../../lib/cadastros'
import { atrasado, diaAtual, diaDoQuadro, NOME_TIPO, ordenarTarefas, progresso, STATUS_AQUECIMENTO, type Aquecimento, type TarefaAquecimento } from '../../lib/contingencia'
import { diaBrasilia, formatarDiaIso } from '../../lib/format'
import { ops } from '../../lib/supabase'
import { SeloStatusAtivo } from '../ativos/campos'

/**
 * Card do aquecimento: checklist por dia. Marcou tudo, o banco conclui o
 * aquecimento e o ativo fica "Pronto" (desmarcar reabre).
 */
export function ModalAquecimento({ aq, inv, onFechar, onMudou }: { aq: Aquecimento; inv: Inventario; onFechar: () => void; onMudou: () => void }) {
  const toast = useToast()
  const [tarefas, setTarefas] = useState(ordenarTarefas(aq.tarefas))
  const [obs, setObs] = useState(aq.observacoes ?? '')
  const [interrompendo, setInterrompendo] = useState(false)
  const [motivo, setMotivo] = useState('')
  const [confirmarExcluir, setConfirmarExcluir] = useState(false)
  const [ocupado, setOcupado] = useState(false)

  const ativo = inv[aq.ativo_tipo].find((r) => r.id === aq.ativo_id)
  const atual: Aquecimento = { ...aq, tarefas }
  const p = progresso(atual)
  const diaCard = diaDoQuadro(atual)
  const hoje = Math.min(diaAtual(atual), aq.duracao_dias)
  const dias = [...new Set(tarefas.map((t) => t.dia))].sort((a, b) => a - b)
  const andamento = aq.status !== 'interrompido'
  const st = STATUS_AQUECIMENTO.find((s) => s.valor === aq.status)!

  /** Marca/desmarca tarefas; avisa quando o checklist fecha. */
  async function marcar(lista: TarefaAquecimento[], feito: boolean) {
    const ids = lista.filter((t) => t.feito !== feito).map((t) => t.id)
    if (!ids.length) return
    setOcupado(true)
    const quando = feito ? new Date().toISOString() : null
    const { error } = await ops().from('aquecimento_tarefas').update({ feito, feito_em: quando }).in('id', ids)
    setOcupado(false)
    if (error) return toast('ruim', mensagemErro(error))
    const novas = tarefas.map((t) => (ids.includes(t.id) ? { ...t, feito, feito_em: quando } : t))
    setTarefas(novas)
    if (feito && novas.every((t) => t.feito)) toast('bom', `${nomeDe(aq.ativo_tipo, ativo)} está pronto para uso.`)
    onMudou()
  }

  async function salvarObs() {
    if ((aq.observacoes ?? '') === obs) return
    const { error } = await ops().from('aquecimentos').update({ observacoes: obs.trim() || null }).eq('id', aq.id)
    if (error) toast('ruim', mensagemErro(error))
    else onMudou()
  }

  async function interromper() {
    if (!motivo.trim()) return toast('ruim', 'Escreva o motivo.')
    setOcupado(true)
    const { error } = await ops()
      .from('aquecimentos')
      .update({ status: 'interrompido', fim: diaBrasilia(), motivo: motivo.trim(), observacoes: obs.trim() || null })
      .eq('id', aq.id)
    setOcupado(false)
    if (error) return toast('ruim', mensagemErro(error))
    toast('bom', 'Aquecimento interrompido. O ativo voltou para "A classificar".')
    onMudou()
    onFechar()
  }

  async function excluir() {
    const { error } = await ops().from('aquecimentos').delete().eq('id', aq.id)
    if (error) return toast('ruim', mensagemErro(error))
    toast('bom', 'Aquecimento excluído.')
    onMudou()
    onFechar()
  }

  return (
    <Modal
      titulo={nomeDe(aq.ativo_tipo, ativo)}
      largura="max-w-3xl"
      onFechar={() => {
        salvarObs()
        onFechar()
      }}
      rodape={
        interrompendo ? (
          <>
            <Botao variante="secundario" onClick={() => setInterrompendo(false)} className="ml-auto">
              Voltar
            </Botao>
            <Botao onClick={interromper} disabled={ocupado}>
              Confirmar interrupção
            </Botao>
          </>
        ) : (
          <>
            {!confirmarExcluir && <BotaoExcluir onClick={() => setConfirmarExcluir(true)}>Excluir</BotaoExcluir>}
            {aq.status === 'andamento' && (
              <>
                <Botao variante="secundario" onClick={() => setInterrompendo(true)} className="ml-auto">
                  Interromper
                </Botao>
                <Botao variante="secundario" onClick={() => marcar(tarefas, true)} disabled={ocupado}>
                  Marcar tudo (pronto)
                </Botao>
              </>
            )}
            <Botao onClick={onFechar} className={aq.status === 'andamento' ? '' : 'ml-auto'}>
              Fechar
            </Botao>
          </>
        )
      }
    >
      <div className="space-y-5">
        {confirmarExcluir && (
          <Aviso
            tom="ruim"
            acao={
              <Botao onClick={excluir} className="shrink-0">
                Confirmar exclusão
              </Botao>
            }
            onFechar={() => setConfirmarExcluir(false)}
          >
            Excluir este aquecimento e o checklist dele? {aq.status === 'andamento' && 'O ativo volta para "A classificar".'}
          </Aviso>
        )}

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
          <Selo tom={aq.status === 'concluido' ? 'bom' : aq.status === 'interrompido' ? 'ruim' : 'atencao'}>
            <span aria-hidden>{aq.status === 'concluido' ? '✓' : st.icone}</span>
            {aq.status === 'concluido' ? 'Pronto' : aq.status === 'andamento' ? `Dia ${diaCard}` : st.nome}
          </Selo>
          {atrasado(atual) && (
            <Selo tom="ruim">
              <span aria-hidden>!</span>
              Atrasado: hoje é D{hoje}
            </Selo>
          )}
          <span className="text-muted">{NOME_TIPO[aq.ativo_tipo].um}</span>
          {ativo && <SeloStatusAtivo tipo={aq.ativo_tipo} status={ativo.status} />}
          <span className="text-muted">
            {aq.rotina_nome} · início {formatarDiaIso(aq.inicio)}
            {aq.fim && ` · fim ${formatarDiaIso(aq.fim)}`}
          </span>
          <span className="ml-auto font-medium tabular-nums">
            {p.feitas}/{p.total} tarefas
          </span>
        </div>
        {aq.motivo && <Aviso tom="ruim">Motivo da interrupção: {aq.motivo}</Aviso>}

        {interrompendo && (
          <Campo rotulo="Por que parou?">
            <input autoFocus value={motivo} onChange={(e) => setMotivo(e.target.value)} className={entrada} placeholder="Ex.: perfil pediu checkpoint no D5" />
          </Campo>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          {dias.length === 0 && <p className="text-sm text-muted">Este aquecimento não tem tarefas.</p>}
          {dias.map((d) => {
            const doDia = tarefas.filter((t) => t.dia === d)
            const feitas = doDia.filter((t) => t.feito).length
            const completo = feitas === doDia.length
            const destaque = aq.status === 'andamento' && d === diaCard
            return (
              <section key={d} className={`rounded-card border p-3 ${destaque ? 'border-accent bg-accent-soft/30' : 'border-line'}`}>
                <header className="mb-1.5 flex items-center gap-2">
                  <h3 className={`text-sm font-semibold ${completo ? 'text-good' : ''}`}>
                    {completo && '✓ '}Dia {d}
                  </h3>
                  <span className="text-xs text-muted tabular-nums">
                    {feitas}/{doDia.length}
                  </span>
                  {andamento && (
                    <button
                      onClick={() => marcar(doDia, !completo)}
                      disabled={ocupado}
                      className="ml-auto rounded-control px-2 py-0.5 text-xs text-muted hover:bg-surface-2 hover:text-ink"
                    >
                      {completo ? 'Desmarcar todos' : 'Marcar todos'}
                    </button>
                  )}
                </header>
                <ul className="space-y-0.5">
                  {doDia.map((t) => (
                    <li key={t.id}>
                      <label className="flex cursor-pointer items-start gap-2 rounded-control px-1 py-1 text-sm hover:bg-surface-2">
                        <input
                          type="checkbox"
                          checked={t.feito}
                          onChange={() => marcar([t], !t.feito)}
                          disabled={ocupado || !andamento}
                          className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--c-accent)]"
                        />
                        <span className={t.feito ? 'text-muted line-through' : ''}>
                          {t.texto}
                          {t.diaria && <span className="ml-1.5 text-xs text-muted no-underline">(todo dia)</span>}
                        </span>
                      </label>
                    </li>
                  ))}
                </ul>
              </section>
            )
          })}
        </div>

        <Campo rotulo="Observações">
          <textarea value={obs} onChange={(e) => setObs(e.target.value)} onBlur={salvarObs} rows={3} className={`${entrada} resize-y`} />
        </Campo>
      </div>
    </Modal>
  )
}
