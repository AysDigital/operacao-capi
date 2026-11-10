import { useState } from 'react'
import { Aviso, Modal, Selo } from '../../components/ds'
import { useToast } from '../../components/Toast'
import { Botao, BotaoExcluir, Campo, entrada } from '../../components/ui'
import { nomeDe, STATUS_ATIVO, type Inventario } from '../../lib/ativos'
import { mensagemErro } from '../../lib/cadastros'
import { diaAtual, NOME_TIPO, ordenarTarefas, progresso, STATUS_AQUECIMENTO, type Aquecimento, type TarefaAquecimento } from '../../lib/contingencia'
import { diaBrasilia, formatarDiaIso } from '../../lib/format'
import { ops } from '../../lib/supabase'
import { SeloStatusAtivo } from '../ativos/campos'

/** Marca/desmarca uma tarefa. */
export async function marcarTarefa(t: TarefaAquecimento, feito: boolean) {
  const { error } = await ops()
    .from('aquecimento_tarefas')
    .update({ feito, feito_em: feito ? new Date().toISOString() : null })
    .eq('id', t.id)
  return error
}

export function LinhaTarefa({ t, atrasada, onMudou }: { t: TarefaAquecimento; atrasada?: boolean; onMudou: (t: TarefaAquecimento) => void }) {
  const toast = useToast()
  const [ocupado, setOcupado] = useState(false)
  async function alternar() {
    setOcupado(true)
    const error = await marcarTarefa(t, !t.feito)
    setOcupado(false)
    if (error) return toast('ruim', mensagemErro(error))
    onMudou({ ...t, feito: !t.feito, feito_em: !t.feito ? new Date().toISOString() : null })
  }
  return (
    <li className={`flex items-start gap-2 rounded-control px-2 py-1.5 text-sm ${atrasada && !t.feito ? 'bg-bad-soft text-bad' : ''}`}>
      <input type="checkbox" checked={t.feito} onChange={alternar} disabled={ocupado} className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--c-accent)]" aria-label={t.texto} />
      <span className={`flex-1 ${t.feito ? 'text-muted line-through' : ''}`}>
        {atrasada && !t.feito && <span className="mr-1.5 text-xs font-semibold">D{t.dia} · atrasada</span>}
        {t.texto}
        {t.diaria && <span className="ml-1.5 text-xs text-muted">(todo dia)</span>}
      </span>
    </li>
  )
}

/** Aquecimento completo: todas as tarefas por dia, observações, concluir e interromper. */
export function ModalAquecimento({ aq, inv, onFechar, onMudou }: { aq: Aquecimento; inv: Inventario; onFechar: () => void; onMudou: () => void }) {
  const toast = useToast()
  const [tarefas, setTarefas] = useState(ordenarTarefas(aq.tarefas))
  const [obs, setObs] = useState(aq.observacoes ?? '')
  const [acao, setAcao] = useState<'concluir' | 'interromper' | null>(null)
  const [motivo, setMotivo] = useState('')
  const [fim, setFim] = useState(diaBrasilia())
  const [salvando, setSalvando] = useState(false)
  const [depois, setDepois] = useState<'concluido' | 'interrompido' | null>(null)
  const [confirmarExcluir, setConfirmarExcluir] = useState(false)

  const ativo = inv[aq.ativo_tipo].find((r) => r.id === aq.ativo_id)
  const atual: Aquecimento = { ...aq, tarefas }
  const dia = diaAtual(atual)
  const p = progresso(atual)
  const dias = [...new Set(tarefas.map((t) => t.dia))].sort((a, b) => a - b)
  const st = STATUS_AQUECIMENTO.find((s) => s.valor === aq.status)!

  async function salvarObs() {
    if ((aq.observacoes ?? '') === obs) return
    const { error } = await ops().from('aquecimentos').update({ observacoes: obs.trim() || null }).eq('id', aq.id)
    if (error) toast('ruim', mensagemErro(error))
    else onMudou()
  }

  async function finalizar() {
    if (acao === 'interromper' && !motivo.trim()) return toast('ruim', 'Escreva o motivo.')
    setSalvando(true)
    const status = acao === 'concluir' ? 'concluido' : 'interrompido'
    const { error } = await ops()
      .from('aquecimentos')
      .update({ status, fim: fim || diaBrasilia(), motivo: acao === 'interromper' ? motivo.trim() : null, observacoes: obs.trim() || null })
      .eq('id', aq.id)
    setSalvando(false)
    if (error) return toast('ruim', mensagemErro(error))
    onMudou()
    setDepois(status)
  }

  async function excluir() {
    const { error } = await ops().from('aquecimentos').delete().eq('id', aq.id)
    if (error) return toast('ruim', mensagemErro(error))
    toast('bom', 'Aquecimento excluído.')
    onMudou()
    onFechar()
  }

  if (depois) return <DepoisDoAquecimento aq={aq} inv={inv} resultado={depois} onFechar={onFechar} onMudou={onMudou} />

  return (
    <Modal
      titulo={`Aquecimento: ${nomeDe(aq.ativo_tipo, ativo)}`}
      largura="max-w-3xl"
      onFechar={() => {
        salvarObs()
        onFechar()
      }}
      rodape={
        aq.status === 'andamento' && !acao ? (
          <>
            {!confirmarExcluir && <BotaoExcluir onClick={() => setConfirmarExcluir(true)}>Excluir</BotaoExcluir>}
            <Botao variante="secundario" onClick={() => setAcao('interromper')} className="ml-auto">
              Interromper
            </Botao>
            <Botao onClick={() => setAcao('concluir')}>Concluir</Botao>
          </>
        ) : acao ? (
          <>
            <Botao variante="secundario" onClick={() => setAcao(null)} className="ml-auto">
              Voltar
            </Botao>
            <Botao onClick={finalizar} disabled={salvando}>
              {salvando ? 'Salvando…' : acao === 'concluir' ? 'Confirmar conclusão' : 'Confirmar interrupção'}
            </Botao>
          </>
        ) : (
          <>
            {!confirmarExcluir && <BotaoExcluir onClick={() => setConfirmarExcluir(true)}>Excluir</BotaoExcluir>}
            <Botao variante="secundario" onClick={onFechar} className="ml-auto">
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
            Excluir este aquecimento e todas as tarefas dele? O ativo não muda.
          </Aviso>
        )}

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
          <Selo tom={aq.status === 'concluido' ? 'bom' : aq.status === 'interrompido' ? 'ruim' : 'atencao'}>
            <span aria-hidden>{st.icone}</span>
            {st.nome}
          </Selo>
          <span className="text-muted">{NOME_TIPO[aq.ativo_tipo].um}</span>
          {ativo && <SeloStatusAtivo tipo={aq.ativo_tipo} status={ativo.status} />}
          <span>{aq.rotina_nome}</span>
          <span className="text-muted">
            início {formatarDiaIso(aq.inicio)}
            {aq.fim && ` · fim ${formatarDiaIso(aq.fim)}`}
          </span>
          <span className="ml-auto font-medium tabular-nums">
            {aq.status === 'andamento' && `D${dia} de ${aq.duracao_dias} · `}
            {p.feitas}/{p.total} tarefas
          </span>
        </div>
        {aq.motivo && <Aviso tom="ruim">Motivo da interrupção: {aq.motivo}</Aviso>}

        {acao && (
          <div className="grid gap-3 rounded-card border border-line bg-surface-2/50 p-3 sm:grid-cols-[1fr_11rem]">
            {acao === 'interromper' ? (
              <Campo rotulo="Motivo">
                <input autoFocus value={motivo} onChange={(e) => setMotivo(e.target.value)} className={entrada} placeholder="Ex.: perfil pediu checkpoint no D5" />
              </Campo>
            ) : (
              <p className="self-end pb-2 text-sm text-muted">
                {p.feitas < p.total ? `Ainda há ${p.total - p.feitas} tarefa(s) sem marcar. Pode concluir assim mesmo.` : 'Todas as tarefas foram feitas.'}
              </p>
            )}
            <Campo rotulo="Data do fim">
              <input type="date" value={fim} max={diaBrasilia()} onChange={(e) => setFim(e.target.value)} className={entrada} />
            </Campo>
          </div>
        )}

        <div className="space-y-3">
          {dias.length === 0 && <p className="text-sm text-muted">A rotina não tinha tarefas.</p>}
          {dias.map((d) => (
            <section key={d}>
              <h3 className={`mb-1 text-xs font-semibold ${aq.status === 'andamento' && d === dia ? 'text-accent-strong' : 'text-muted'}`}>
                D{d}
                {aq.status === 'andamento' && d === dia && ' · hoje'}
              </h3>
              <ul>
                {tarefas
                  .filter((t) => t.dia === d)
                  .map((t) => (
                    <LinhaTarefa
                      key={t.id}
                      t={t}
                      atrasada={aq.status === 'andamento' && d < dia}
                      onMudou={(n) => {
                        setTarefas((ts) => ts.map((x) => (x.id === n.id ? n : x)))
                        onMudou()
                      }}
                    />
                  ))}
              </ul>
            </section>
          ))}
        </div>

        <Campo rotulo="Observações">
          <textarea value={obs} onChange={(e) => setObs(e.target.value)} onBlur={salvarObs} rows={3} className={`${entrada} resize-y`} />
        </Campo>
      </div>
    </Modal>
  )
}

/**
 * Depois de concluir ou interromper: pergunta se quer mudar o status do ativo
 * (e, para conta, a coluna do quadro de uso). Nada muda sem a usuária confirmar.
 */
function DepoisDoAquecimento({
  aq,
  inv,
  resultado,
  onFechar,
  onMudou,
}: {
  aq: Aquecimento
  inv: Inventario
  resultado: 'concluido' | 'interrompido'
  onFechar: () => void
  onMudou: () => void
}) {
  const toast = useToast()
  const ativo = inv[aq.ativo_tipo].find((r) => r.id === aq.ativo_id)
  const atualStatus = (ativo?.status as string) ?? ''
  const sugestao = resultado === 'concluido' && aq.ativo_tipo === 'perfil' ? 'pronto' : atualStatus
  const [status, setStatus] = useState(sugestao)
  const [uso, setUso] = useState((ativo?.uso as string) ?? 'parada')
  const [salvando, setSalvando] = useState(false)

  async function aplicar() {
    setSalvando(true)
    if (status !== atualStatus) {
      const { error } = await ops().rpc('mudar_status_ativo', {
        p_tipo: aq.ativo_tipo,
        p_id: aq.ativo_id,
        p_status: status,
        p_motivo: `Aquecimento ${resultado === 'concluido' ? 'concluído' : 'interrompido'} (${aq.rotina_nome})`,
        p_data: diaBrasilia(),
      })
      if (error) {
        setSalvando(false)
        return toast('ruim', mensagemErro(error))
      }
    }
    if (aq.ativo_tipo === 'conta' && uso !== ((ativo?.uso as string) ?? 'parada')) {
      const { error } = await ops()
        .from('contas_anuncio')
        .update({ uso, uso_desde: diaBrasilia(), uso_posicao: Date.now(), ...(uso === 'parada' ? { uso_oferta_id: null } : {}) })
        .eq('id', aq.ativo_id)
      if (error) {
        setSalvando(false)
        return toast('ruim', mensagemErro(error))
      }
    }
    setSalvando(false)
    toast('bom', 'Ativo atualizado.')
    onMudou()
    onFechar()
  }

  return (
    <Modal
      titulo={resultado === 'concluido' ? 'Aquecimento concluído' : 'Aquecimento interrompido'}
      onFechar={onFechar}
      rodape={
        <>
          <Botao variante="secundario" onClick={onFechar} className="ml-auto">
            Deixar como está
          </Botao>
          <Botao onClick={aplicar} disabled={salvando}>
            {salvando ? 'Salvando…' : 'Aplicar'}
          </Botao>
        </>
      }
    >
      <div className="space-y-4">
        <p className="text-sm">Quer mudar alguma coisa em {nomeDe(aq.ativo_tipo, ativo)}? Nada muda se você escolher "Deixar como está".</p>
        <Campo rotulo="Status do ativo">
          <select value={status} onChange={(e) => setStatus(e.target.value)} className={entrada}>
            {Object.entries(STATUS_ATIVO[aq.ativo_tipo]).map(([v, s]) => (
              <option key={v} value={v}>
                {s.icone} {s.nome}
                {v === atualStatus ? ' (atual)' : ''}
              </option>
            ))}
          </select>
        </Campo>
        {aq.ativo_tipo === 'conta' && (
          <Campo rotulo="Coluna no quadro de uso">
            <select value={uso} onChange={(e) => setUso(e.target.value)} className={entrada}>
              <option value="veiculando">▶ Veiculando ads</option>
              <option value="aquecimento">◐ Aquecimento</option>
              <option value="parada">○ Sem uso</option>
            </select>
          </Campo>
        )}
      </div>
    </Modal>
  )
}
