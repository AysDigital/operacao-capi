import { useState, type FormEvent } from 'react'
import { Aviso, CaixaTabela, Carregando, Interruptor, Modal, tabela, Vazio } from '../../components/ds'
import { useToast } from '../../components/Toast'
import { Botao, BotaoExcluir, Campo, entrada } from '../../components/ui'
import { contagem, mensagemErro, normalizarIdConta, soSigla, type ContaAnuncio } from '../../lib/cadastros'
import { ops } from '../../lib/supabase'
import { useCarregar } from '../../lib/useCarregar'

type Linha = ContaAnuncio & { veiculacoes: { count: number }[] }

const ERROS = {
  contas_anuncio_apelido_key: 'Já existe uma conta com esse apelido.',
  contas_anuncio_meta_ad_account_id_key: 'Essa conta do Meta já está cadastrada.',
}

/** Ativas primeiro; dentro de cada grupo, por apelido (C2 antes de C10). */
const ordenar = (a: Linha, b: Linha) =>
  Number(b.ativa) - Number(a.ativa) || a.apelido.localeCompare(b.apelido, 'pt-BR', { numeric: true })

export function ContasAnuncio() {
  const toast = useToast()
  const { dados, erro, recarregar } = useCarregar<Linha>(() =>
    ops().from('contas_anuncio').select('id, nome, apelido, bm_nome, meta_ad_account_id, ativa, veiculacoes(count)'),
  )
  const [editando, setEditando] = useState<Linha | 'nova' | null>(null)
  const [mudando, setMudando] = useState<string | null>(null)
  const [importando, setImportando] = useState(false)

  /** Traz do dashboard de vendas as contas que ainda não estão aqui (só número e nome). */
  async function importar() {
    setImportando(true)
    const { data, error } = await ops().rpc('importar_contas_dashboard')
    setImportando(false)
    if (error) return toast('ruim', mensagemErro(error))
    toast('bom', data ? `${data} conta(s) importada(s) do dashboard.` : 'Nenhuma conta nova no dashboard.')
    recarregar()
  }

  async function mudarAtiva(c: Linha, ativa: boolean) {
    setMudando(c.id)
    const { error } = await ops().from('contas_anuncio').update({ ativa }).eq('id', c.id)
    if (error) toast('ruim', mensagemErro(error))
    else {
      toast('bom', `${c.apelido} ${ativa ? 'ativada' : 'desativada'}.`)
      await recarregar()
    }
    setMudando(null)
  }

  const fechar = () => setEditando(null)
  const salvo = () => {
    setEditando(null)
    recarregar()
  }

  return (
    <>
      <div className="mb-4 flex justify-end gap-2">
        <Botao variante="secundario" onClick={importar} disabled={importando}>
          {importando ? 'Importando…' : 'Importar do dashboard'}
        </Botao>
        <Botao onClick={() => setEditando('nova')}>Nova conta</Botao>
      </div>

      {erro && <Aviso tom="ruim">Não foi possível carregar as contas: {erro}</Aviso>}
      {!dados && !erro && <Carregando linhas={4} altura="h-10" />}
      {dados?.length === 0 && <Vazio titulo="Nenhuma conta de anúncio cadastrada ainda" />}
      {dados && dados.length > 0 && (
        <CaixaTabela>
          <table className={tabela.table}>
            <thead className={tabela.thead}>
              <tr className="text-left">
                <th className={tabela.th}>Apelido</th>
                <th className={tabela.th}>Nome</th>
                <th className={tabela.th}>BM</th>
                <th className={tabela.th}>ID no Meta</th>
                <th className={tabela.th}>Situação</th>
                <th className={tabela.th}>
                  <span className="sr-only">Ações</span>
                </th>
              </tr>
            </thead>
            <tbody className={tabela.tbody}>
              {[...dados].sort(ordenar).map((c) => (
                <tr key={c.id} className={c.ativa ? '' : 'bg-surface-2/60 text-muted'}>
                  <td className={tabela.td}>
                    <span className={`rounded-full px-2 py-0.5 font-mono text-xs font-semibold ${c.ativa ? 'bg-info-soft text-info' : 'bg-surface-2 text-muted'}`}>
                      {c.apelido}
                    </span>
                  </td>
                  <td className={`${tabela.td} ${c.ativa ? 'font-medium' : ''}`}>{c.nome}</td>
                  <td className={tabela.td}>{c.bm_nome || '—'}</td>
                  <td className={`${tabela.td} font-mono tabular-nums`}>{c.meta_ad_account_id || '—'}</td>
                  <td className={tabela.td}>
                    <Interruptor
                      ligado={c.ativa}
                      onMudar={(v) => mudarAtiva(c, v)}
                      textoLigado="Ativa"
                      textoDesligado="Inativa"
                      desabilitado={mudando === c.id}
                    />
                  </td>
                  <td className={`${tabela.td} text-right`}>
                    <button onClick={() => setEditando(c)} className="text-muted hover:text-ink">
                      Editar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CaixaTabela>
      )}

      {editando && <ModalConta conta={editando === 'nova' ? null : editando} onFechar={fechar} onSalvo={salvo} />}
    </>
  )
}

function ModalConta({ conta, onFechar, onSalvo }: { conta: Linha | null; onFechar: () => void; onSalvo: () => void }) {
  const toast = useToast()
  const [apelido, setApelido] = useState(conta?.apelido ?? '')
  const [nome, setNome] = useState(conta?.nome ?? '')
  const [bm, setBm] = useState(conta?.bm_nome ?? '')
  const [idMeta, setIdMeta] = useState(conta?.meta_ad_account_id ?? '')
  const [ativa, setAtiva] = useState(conta?.ativa ?? true)
  const [salvando, setSalvando] = useState(false)
  const [confirmandoExclusao, setConfirmandoExclusao] = useState(false)
  const [tentou, setTentou] = useState(false)

  const veiculacoes = conta ? contagem(conta.veiculacoes) : 0
  const idNormalizado = normalizarIdConta(idMeta)
  const erroApelido = tentou && !apelido ? 'Informe o apelido.' : null
  const erroNome = tentou && !nome.trim() ? 'Informe o nome.' : null
  const erroId = idNormalizado && !/^\d+$/.test(idNormalizado) ? 'Use só os números do ID (com ou sem "act_").' : null

  async function salvar(e: FormEvent) {
    e.preventDefault()
    setTentou(true)
    if (!apelido || !nome.trim() || erroId) return
    setSalvando(true)
    const campos = { apelido, nome: nome.trim(), bm_nome: bm.trim() || null, meta_ad_account_id: idNormalizado || null, ativa }
    const { error } = conta
      ? await ops().from('contas_anuncio').update(campos).eq('id', conta.id)
      : await ops().from('contas_anuncio').insert(campos)
    setSalvando(false)
    if (error) return toast('ruim', mensagemErro(error, ERROS))
    toast('bom', conta ? 'Conta salva.' : 'Conta cadastrada.')
    onSalvo()
  }

  async function desativar() {
    if (!conta) return
    setSalvando(true)
    const { error } = await ops().from('contas_anuncio').update({ ativa: false }).eq('id', conta.id)
    setSalvando(false)
    if (error) return toast('ruim', mensagemErro(error))
    toast('bom', `${conta.apelido} desativada.`)
    onSalvo()
  }

  async function excluir() {
    if (!conta) return
    setSalvando(true)
    const { error } = await ops().from('contas_anuncio').delete().eq('id', conta.id)
    setSalvando(false)
    if (error) {
      toast('ruim', error.code === '23503' ? 'Esta conta tem veiculações e não pode ser excluída. Desative-a.' : mensagemErro(error))
      return
    }
    toast('bom', 'Conta excluída.')
    onSalvo()
  }

  return (
    <Modal
      titulo={conta ? `Editar ${conta.apelido}` : 'Nova conta de anúncio'}
      onFechar={onFechar}
      rodape={
        <>
          {conta && !confirmandoExclusao && (
            <BotaoExcluir onClick={() => setConfirmandoExclusao(true)} disabled={salvando}>
              Excluir
            </BotaoExcluir>
          )}
          <Botao variante="secundario" onClick={onFechar} className="ml-auto">
            Cancelar
          </Botao>
          <Botao type="submit" form="form-conta" disabled={salvando}>
            {salvando ? 'Salvando…' : 'Salvar'}
          </Botao>
        </>
      }
    >
      <form id="form-conta" onSubmit={salvar} className="space-y-4">
        <div className="grid grid-cols-[7rem_1fr] gap-3">
          <Campo rotulo="Apelido" erro={erroApelido}>
            <input
              value={apelido}
              onChange={(e) => setApelido(soSigla(e.target.value, 6))}
              className={`${entrada} font-mono uppercase`}
              placeholder="C1"
              autoFocus
            />
          </Campo>
          <Campo rotulo="Nome" erro={erroNome}>
            <input value={nome} onChange={(e) => setNome(e.target.value)} className={entrada} placeholder="Conta 01" />
          </Campo>
        </div>
        <p className="-mt-2 text-xs text-muted">O apelido é o que aparece nas pílulas dos cards.</p>
        <Campo rotulo="BM">
          <input value={bm} onChange={(e) => setBm(e.target.value)} className={entrada} placeholder="BM Mayarah" />
        </Campo>
        <Campo rotulo="ID da conta no Meta" erro={erroId}>
          <input
            value={idMeta}
            onChange={(e) => setIdMeta(e.target.value)}
            onBlur={() => setIdMeta(normalizarIdConta(idMeta))}
            className={`${entrada} font-mono`}
            placeholder="act_123456789012345"
            inputMode="numeric"
          />
        </Campo>
        <Interruptor ligado={ativa} onMudar={setAtiva} textoLigado="Ativa" textoDesligado="Inativa" />

        {confirmandoExclusao &&
          (veiculacoes > 0 ? (
            <Aviso
              tom="ruim"
              acao={
                conta?.ativa ? (
                  <Botao variante="secundario" onClick={desativar} disabled={salvando} className="shrink-0">
                    Desativar
                  </Botao>
                ) : undefined
              }
              onFechar={() => setConfirmandoExclusao(false)}
            >
              Esta conta tem {veiculacoes} {veiculacoes === 1 ? 'veiculação' : 'veiculações'} e não pode ser excluída
              {conta?.ativa ? '. Desative-a para tirá-la das listas.' : '. Ela já está inativa.'}
            </Aviso>
          ) : (
            <Aviso
              tom="ruim"
              acao={
                <Botao onClick={excluir} disabled={salvando} className="shrink-0">
                  Confirmar exclusão
                </Botao>
              }
              onFechar={() => setConfirmandoExclusao(false)}
            >
              Excluir a conta {conta?.apelido}? Isso não pode ser desfeito.
            </Aviso>
          ))}
      </form>
    </Modal>
  )
}
