import { useState, type FormEvent } from 'react'
import { Aviso, CaixaTabela, Dica, Interruptor, Modal, tabela, Vazio } from '../../components/ds'
import { useToast } from '../../components/Toast'
import { Botao, BotaoExcluir, Campo, entrada } from '../../components/ui'
import { mensagemErro } from '../../lib/cadastros'
import { NOME_TIPO, TIPOS_AQUECIVEIS, type Rotina, type TarefaRotina, type TipoAquecivel } from '../../lib/contingencia'
import { ops } from '../../lib/supabase'

/**
 * Roteiros de aquecimento. O "padrão" de cada tipo é o que entra sozinho quando um
 * ativo é cadastrado. Criar, editar, duplicar e excluir, com as tarefas por dia.
 */
export function Rotinas({ rotinas, tarefas, onMudou }: { rotinas: Rotina[]; tarefas: TarefaRotina[]; onMudou: () => void }) {
  const toast = useToast()
  const [editando, setEditando] = useState<Rotina | 'nova' | null>(null)
  const [excluindo, setExcluindo] = useState<string | null>(null)

  async function excluir(r: Rotina) {
    const { error } = await ops().from('rotinas_aquecimento').delete().eq('id', r.id)
    setExcluindo(null)
    if (error) return toast('ruim', mensagemErro(error))
    toast('bom', 'Roteiro excluído. Os aquecimentos já iniciados continuam com o checklist deles.')
    onMudou()
  }

  async function duplicar(r: Rotina) {
    const { data, error } = await ops()
      .from('rotinas_aquecimento')
      .insert({ nome: `${r.nome} (cópia)`, tipo: r.tipo, duracao_dias: r.duracao_dias, ativa: r.ativa, descricao: r.descricao, padrao: false })
      .select('id')
      .single()
    if (error) return toast('ruim', mensagemErro(error))
    const minhas = tarefas.filter((t) => t.rotina_id === r.id)
    if (minhas.length) {
      const { error: e2 } = await ops()
        .from('rotinas_tarefas')
        .insert(minhas.map((t) => ({ rotina_id: data.id, dia: t.dia, texto: t.texto, ordem: t.ordem })))
      if (e2) return toast('ruim', mensagemErro(e2))
    }
    toast('bom', 'Roteiro duplicado.')
    onMudou()
  }

  const aberta = editando && editando !== 'nova' ? rotinas.find((r) => r.id === editando.id) ?? null : null

  return (
    <>
      <div className="mb-4 flex justify-end">
        <Botao onClick={() => setEditando('nova')}>Novo roteiro</Botao>
      </div>
      {rotinas.length === 0 ? (
        <Vazio titulo="Nenhum roteiro criado ainda" />
      ) : (
        <CaixaTabela>
          <table className={tabela.table}>
            <thead className={tabela.thead}>
              <tr className="text-left">
                <th className={tabela.th}>Roteiro</th>
                <th className={tabela.th}>Tipo</th>
                <th className={`${tabela.th} text-right`}>Dias</th>
                <th className={`${tabela.th} text-right`}>Tarefas</th>
                <th className={tabela.th}>
                  <Dica conteudo="O roteiro padrão de cada tipo é o que entra sozinho quando você cadastra um ativo novo em Ativos.">Uso</Dica>
                </th>
                <th className={tabela.th} />
              </tr>
            </thead>
            <tbody className={tabela.tbody}>
              {rotinas.map((r) => (
                <tr key={r.id} className="hover:bg-surface-2/60">
                  <td className={tabela.td}>
                    <button onClick={() => setEditando(r)} className="text-left font-medium hover:text-accent-strong hover:underline">
                      {r.nome}
                    </button>
                    {r.descricao && <span className="block text-xs text-muted">{r.descricao}</span>}
                  </td>
                  <td className={tabela.td}>{NOME_TIPO[r.tipo].um}</td>
                  <td className={`${tabela.td} text-right tabular-nums`}>{r.duracao_dias}</td>
                  <td className={`${tabela.td} text-right tabular-nums`}>{tarefas.filter((t) => t.rotina_id === r.id).length}</td>
                  <td className={tabela.td}>
                    {!r.ativa ? <span className="text-muted">○ Desativado</span> : r.padrao ? <span className="font-medium text-good">★ Padrão</span> : '✓ Ativo'}
                  </td>
                  <td className={`${tabela.td} text-right whitespace-nowrap`}>
                    {excluindo === r.id ? (
                      <span className="text-xs text-bad">
                        Excluir?{' '}
                        <button onClick={() => excluir(r)} className="rounded-control bg-bad px-2 py-0.5 font-medium text-white">
                          Excluir
                        </button>{' '}
                        <button onClick={() => setExcluindo(null)} className="px-1 text-muted hover:text-ink">
                          Cancelar
                        </button>
                      </span>
                    ) : (
                      <>
                        <button onClick={() => duplicar(r)} className="rounded-control px-2 py-0.5 text-xs text-muted hover:bg-surface-2 hover:text-ink">
                          Duplicar
                        </button>
                        <button onClick={() => setExcluindo(r.id)} className="rounded-control px-2 py-0.5 text-xs text-muted hover:bg-bad-soft hover:text-bad">
                          Excluir
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CaixaTabela>
      )}

      {editando && (
        <EditorRotina
          rotina={editando === 'nova' ? null : aberta}
          tarefas={aberta ? tarefas.filter((t) => t.rotina_id === aberta.id) : []}
          onFechar={() => setEditando(null)}
          onCriada={(r) => {
            onMudou()
            setEditando(r)
          }}
          onMudou={onMudou}
        />
      )}
    </>
  )
}

function EditorRotina({
  rotina,
  tarefas,
  onFechar,
  onCriada,
  onMudou,
}: {
  rotina: Rotina | null
  tarefas: TarefaRotina[]
  onFechar: () => void
  onCriada: (r: Rotina) => void
  onMudou: () => void
}) {
  const toast = useToast()
  const [nome, setNome] = useState(rotina?.nome ?? '')
  const [tipo, setTipo] = useState<TipoAquecivel>(rotina?.tipo ?? 'perfil')
  const [duracao, setDuracao] = useState(String(rotina?.duracao_dias ?? 14))
  const [ativa, setAtiva] = useState(rotina?.ativa ?? true)
  const [padrao, setPadrao] = useState(rotina?.padrao ?? false)
  const [descricao, setDescricao] = useState(rotina?.descricao ?? '')
  const [salvando, setSalvando] = useState(false)
  const [confirmar, setConfirmar] = useState(false)

  const dias = Math.max(1, Math.min(365, parseInt(duracao, 10) || 0))

  async function salvar(e?: FormEvent) {
    e?.preventDefault()
    if (!nome.trim()) return toast('ruim', 'Dê um nome ao roteiro.')
    if (!(parseInt(duracao, 10) >= 1)) return toast('ruim', 'A duração precisa ser de pelo menos 1 dia.')
    setSalvando(true)
    // só um padrão por tipo: tira o padrão dos outros antes
    if (padrao && ativa) {
      let q = ops().from('rotinas_aquecimento').update({ padrao: false }).eq('tipo', tipo).eq('padrao', true)
      if (rotina) q = q.neq('id', rotina.id)
      const { error } = await q
      if (error) {
        setSalvando(false)
        return toast('ruim', mensagemErro(error))
      }
    }
    const campos = { nome: nome.trim(), tipo, duracao_dias: dias, ativa, descricao: descricao.trim() || null, padrao: padrao && ativa }
    if (rotina) {
      const { error } = await ops().from('rotinas_aquecimento').update(campos).eq('id', rotina.id)
      setSalvando(false)
      if (error) return toast('ruim', mensagemErro(error))
      toast('bom', 'Roteiro salvo.')
      onMudou()
      onFechar()
    } else {
      const { data, error } = await ops().from('rotinas_aquecimento').insert(campos).select('id, nome, tipo, duracao_dias, ativa, descricao, padrao').single()
      setSalvando(false)
      if (error) return toast('ruim', mensagemErro(error))
      toast('bom', 'Roteiro criado. Agora monte as tarefas.')
      onCriada(data as Rotina)
    }
  }

  async function excluir() {
    if (!rotina) return
    const { error } = await ops().from('rotinas_aquecimento').delete().eq('id', rotina.id)
    if (error) return toast('ruim', mensagemErro(error))
    toast('bom', 'Roteiro excluído. Os aquecimentos já iniciados continuam com o checklist deles.')
    onMudou()
    onFechar()
  }

  return (
    <Modal
      titulo={rotina ? `Roteiro: ${rotina.nome}` : 'Novo roteiro'}
      largura="max-w-3xl"
      onFechar={onFechar}
      rodape={
        <>
          {rotina && !confirmar && <BotaoExcluir onClick={() => setConfirmar(true)}>Excluir</BotaoExcluir>}
          <Botao variante="secundario" onClick={onFechar} className="ml-auto">
            {rotina ? 'Fechar' : 'Cancelar'}
          </Botao>
          <Botao type="submit" form="form-rotina" disabled={salvando}>
            {salvando ? 'Salvando…' : rotina ? 'Salvar' : 'Criar e montar tarefas'}
          </Botao>
        </>
      }
    >
      <div className="space-y-5">
        {confirmar && (
          <Aviso
            tom="ruim"
            acao={
              <Botao onClick={excluir} className="shrink-0">
                Confirmar exclusão
              </Botao>
            }
            onFechar={() => setConfirmar(false)}
          >
            Excluir o roteiro {rotina?.nome}? Os aquecimentos já iniciados com ele não mudam.
          </Aviso>
        )}
        <form id="form-rotina" onSubmit={salvar} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-[1fr_9rem_7rem]">
            <Campo rotulo="Nome">
              <input autoFocus={!rotina} value={nome} onChange={(e) => setNome(e.target.value)} className={entrada} placeholder="Ex.: Perfil padrão" />
            </Campo>
            <Campo rotulo="Tipo de ativo">
              <select value={tipo} onChange={(e) => setTipo(e.target.value as TipoAquecivel)} className={entrada}>
                {TIPOS_AQUECIVEIS.map((t) => (
                  <option key={t} value={t}>
                    {NOME_TIPO[t].um}
                  </option>
                ))}
              </select>
            </Campo>
            <Campo rotulo="Duração (dias)">
              <input type="number" min={1} max={365} value={duracao} onChange={(e) => setDuracao(e.target.value)} className={entrada} />
            </Campo>
          </div>
          <Campo rotulo="Descrição (opcional)">
            <textarea value={descricao} onChange={(e) => setDescricao(e.target.value)} rows={2} className={`${entrada} resize-y`} />
          </Campo>
          <Interruptor ligado={ativa} onMudar={setAtiva} textoLigado="Ativo (aparece ao iniciar aquecimento)" textoDesligado="Desativado (não aparece ao iniciar)" />
          <Interruptor
            ligado={padrao && ativa}
            onMudar={setPadrao}
            textoLigado={`Padrão: todo ${NOME_TIPO[tipo].um.toLowerCase()} cadastrado em Ativos entra no aquecimento com este roteiro`}
            textoDesligado="Não é o padrão do tipo"
          />
        </form>

        {rotina && <TarefasDaRotina rotinaId={rotina.id} dias={rotina.duracao_dias} tarefas={tarefas} onMudou={onMudou} />}
      </div>
    </Modal>
  )
}

/** Tarefas por dia: "Todos os dias" + D1..Dn. Cada mudança grava na hora. */
function TarefasDaRotina({ rotinaId, dias, tarefas, onMudou }: { rotinaId: string; dias: number; tarefas: TarefaRotina[]; onMudou: () => void }) {
  const toast = useToast()
  const [novas, setNovas] = useState<Record<string, string>>({})
  const grupos: (number | null)[] = [null, ...Array.from({ length: dias }, (_, i) => i + 1)]
  const chave = (d: number | null) => (d == null ? 'todo' : String(d))
  const doDia = (d: number | null) => tarefas.filter((t) => t.dia === d).sort((a, b) => a.ordem - b.ordem)
  const foraDoPrazo = tarefas.filter((t) => t.dia != null && t.dia > dias)

  async function rodar(p: PromiseLike<{ error: unknown }>) {
    const { error } = await p
    if (error) toast('ruim', mensagemErro(error as never))
    onMudou()
  }

  function adicionar(d: number | null) {
    const texto = (novas[chave(d)] ?? '').trim()
    if (!texto) return
    setNovas((n) => ({ ...n, [chave(d)]: '' }))
    const ordem = Math.max(0, ...doDia(d).map((t) => t.ordem)) + 1024
    rodar(ops().from('rotinas_tarefas').insert({ rotina_id: rotinaId, dia: d, texto, ordem }))
  }

  function mover(t: TarefaRotina, delta: -1 | 1) {
    const lista = doDia(t.dia)
    const i = lista.findIndex((x) => x.id === t.id)
    const outro = lista[i + delta]
    if (!outro) return
    rodar(
      Promise.all([
        ops().from('rotinas_tarefas').update({ ordem: outro.ordem }).eq('id', t.id),
        ops().from('rotinas_tarefas').update({ ordem: t.ordem }).eq('id', outro.id),
      ]).then((r) => ({ error: r.find((x) => x.error)?.error ?? null })),
    )
  }

  const grupo = (d: number | null, titulo: string, lista: TarefaRotina[]) => (
    <section key={chave(d)} className="rounded-card border border-line p-3">
      <h4 className="mb-2 text-xs font-semibold text-muted">{titulo}</h4>
      <ul className="space-y-1">
        {lista.map((t, i) => (
          <li key={t.id} className="flex items-center gap-1.5">
            <input
              defaultValue={t.texto}
              onBlur={(e) => {
                const v = e.target.value.trim()
                if (v && v !== t.texto) rodar(ops().from('rotinas_tarefas').update({ texto: v }).eq('id', t.id))
              }}
              aria-label="Tarefa"
              className="min-w-0 flex-1 rounded-control border border-transparent bg-transparent px-2 py-1 text-sm hover:border-line focus:border-muted focus:outline-none"
            />
            <select
              value={t.dia ?? ''}
              onChange={(e) => rodar(ops().from('rotinas_tarefas').update({ dia: e.target.value ? Number(e.target.value) : null }).eq('id', t.id))}
              aria-label="Dia da tarefa"
              className="rounded-control border border-line bg-surface px-1 py-1 text-xs"
            >
              <option value="">Todo dia</option>
              {Array.from({ length: dias }, (_, k) => k + 1).map((n) => (
                <option key={n} value={n}>
                  D{n}
                </option>
              ))}
            </select>
            <button onClick={() => mover(t, -1)} disabled={i === 0} aria-label="Subir" className="rounded px-1.5 text-muted hover:bg-surface-2 disabled:opacity-30">
              ↑
            </button>
            <button onClick={() => mover(t, 1)} disabled={i === lista.length - 1} aria-label="Descer" className="rounded px-1.5 text-muted hover:bg-surface-2 disabled:opacity-30">
              ↓
            </button>
            <button
              onClick={() => rodar(ops().from('rotinas_tarefas').delete().eq('id', t.id))}
              aria-label="Excluir tarefa"
              className="rounded px-1.5 text-muted hover:bg-bad-soft hover:text-bad"
            >
              ✕
            </button>
          </li>
        ))}
      </ul>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          adicionar(d)
        }}
        className="mt-1.5 flex gap-1.5"
      >
        <input
          value={novas[chave(d)] ?? ''}
          onChange={(e) => setNovas((n) => ({ ...n, [chave(d)]: e.target.value }))}
          placeholder="+ Nova tarefa (Enter para adicionar)"
          aria-label={`Nova tarefa em ${titulo}`}
          className="min-w-0 flex-1 rounded-control border border-line bg-surface px-2 py-1 text-sm focus:border-muted focus:outline-none"
        />
      </form>
    </section>
  )

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold">Tarefas</h3>
      {grupo(null, 'Todos os dias', doDia(null))}
      <div className="grid gap-2 sm:grid-cols-2">{grupos.slice(1).map((d) => grupo(d, `D${d}`, doDia(d)))}</div>
      {foraDoPrazo.length > 0 && (
        <Aviso tom="atencao">
          {foraDoPrazo.length} tarefa(s) estão em dias depois da duração ({dias} dias) e não entram nos aquecimentos. Mude o dia delas ou aumente a duração.
        </Aviso>
      )}
    </div>
  )
}
