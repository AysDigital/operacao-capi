import { useState, type FormEvent } from 'react'
import { Aviso, CaixaTabela, Carregando, Modal, SeletorCor, tabela, Vazio } from '../../components/ds'
import { useToast } from '../../components/Toast'
import { Botao, BotaoExcluir, Campo, entrada } from '../../components/ui'
import { contagem, mensagemErro, PALETA, type Etiqueta } from '../../lib/cadastros'
import { ops } from '../../lib/supabase'
import { useCarregar } from '../../lib/useCarregar'

type Linha = Etiqueta & { card_etiquetas: { count: number }[] }

/** Etiqueta como aparece no card: fundo na cor, texto escuro ou claro conforme o fundo. */
export function PilulaEtiqueta({ nome, cor }: { nome: string; cor: string | null }) {
  const hex = cor ?? '#7d786f'
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16))
  const clara = 0.299 * r + 0.587 * g + 0.114 * b > 160
  return (
    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${clara ? 'text-[#2b2a28]' : 'text-white'}`} style={{ background: hex }}>
      {nome}
    </span>
  )
}

export function Etiquetas() {
  const { dados, erro, recarregar } = useCarregar<Linha>(() =>
    ops().from('etiquetas').select('id, nome, cor, card_etiquetas(count)').order('nome'),
  )
  const [editando, setEditando] = useState<Linha | 'nova' | null>(null)

  return (
    <>
      <div className="mb-4 flex justify-end">
        <Botao onClick={() => setEditando('nova')}>Nova etiqueta</Botao>
      </div>

      {erro && <Aviso tom="ruim">Não foi possível carregar as etiquetas: {erro}</Aviso>}
      {!dados && !erro && <Carregando linhas={4} altura="h-10" />}
      {dados?.length === 0 && <Vazio titulo="Nenhuma etiqueta cadastrada ainda" />}
      {dados && dados.length > 0 && (
        <CaixaTabela>
          <table className={tabela.table}>
            <thead className={tabela.thead}>
              <tr className="text-left">
                <th className={tabela.th}>Etiqueta</th>
                <th className={`${tabela.th} text-right`}>Cards</th>
                <th className={tabela.th}>
                  <span className="sr-only">Ações</span>
                </th>
              </tr>
            </thead>
            <tbody className={tabela.tbody}>
              {dados.map((e) => (
                <tr key={e.id} onClick={() => setEditando(e)} className="cursor-pointer hover:bg-surface-2">
                  <td className={tabela.td}>
                    <PilulaEtiqueta nome={e.nome} cor={e.cor} />
                  </td>
                  <td className={tabela.num}>{contagem(e.card_etiquetas)}</td>
                  <td className={`${tabela.td} text-right`}>
                    <button onClick={() => setEditando(e)} className="text-muted hover:text-ink">
                      Editar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CaixaTabela>
      )}

      {editando && (
        <ModalEtiqueta
          etiqueta={editando === 'nova' ? null : editando}
          onFechar={() => setEditando(null)}
          onSalvo={() => {
            setEditando(null)
            recarregar()
          }}
        />
      )}
    </>
  )
}

function ModalEtiqueta({ etiqueta, onFechar, onSalvo }: { etiqueta: Linha | null; onFechar: () => void; onSalvo: () => void }) {
  const toast = useToast()
  const [nome, setNome] = useState(etiqueta?.nome ?? '')
  const [cor, setCor] = useState<string>(etiqueta?.cor ?? PALETA[0].hex)
  const [salvando, setSalvando] = useState(false)
  const [confirmandoExclusao, setConfirmandoExclusao] = useState(false)
  const [tentou, setTentou] = useState(false)

  const cards = etiqueta ? contagem(etiqueta.card_etiquetas) : 0
  const erroNome = tentou && !nome.trim() ? 'Informe o nome.' : null

  async function salvar(e: FormEvent) {
    e.preventDefault()
    setTentou(true)
    if (!nome.trim()) return
    setSalvando(true)
    const campos = { nome: nome.trim(), cor }
    const { error } = etiqueta
      ? await ops().from('etiquetas').update(campos).eq('id', etiqueta.id)
      : await ops().from('etiquetas').insert(campos)
    setSalvando(false)
    if (error) return toast('ruim', mensagemErro(error, { etiquetas_nome_key: `Já existe uma etiqueta chamada ${nome.trim()}.` }))
    toast('bom', etiqueta ? 'Etiqueta salva.' : 'Etiqueta criada.')
    onSalvo()
  }

  async function excluir() {
    if (!etiqueta) return
    setSalvando(true)
    // Tira dos cards antes, para o histórico de cada card registrar o nome da etiqueta.
    let { error } = await ops().from('card_etiquetas').delete().eq('etiqueta_id', etiqueta.id)
    if (!error) ({ error } = await ops().from('etiquetas').delete().eq('id', etiqueta.id))
    setSalvando(false)
    if (error) return toast('ruim', mensagemErro(error))
    toast('bom', 'Etiqueta excluída.')
    onSalvo()
  }

  return (
    <Modal
      titulo={etiqueta ? 'Editar etiqueta' : 'Nova etiqueta'}
      onFechar={onFechar}
      rodape={
        <>
          {etiqueta && !confirmandoExclusao && (
            <BotaoExcluir onClick={() => setConfirmandoExclusao(true)} disabled={salvando}>
              Excluir
            </BotaoExcluir>
          )}
          <Botao variante="secundario" onClick={onFechar} className="ml-auto">
            Cancelar
          </Botao>
          <Botao type="submit" form="form-etiqueta" disabled={salvando}>
            {salvando ? 'Salvando…' : 'Salvar'}
          </Botao>
        </>
      }
    >
      <form id="form-etiqueta" onSubmit={salvar} className="space-y-4">
        <Campo rotulo="Nome" erro={erroNome}>
          <input value={nome} onChange={(e) => setNome(e.target.value)} className={entrada} autoFocus placeholder="Ex.: Prioridade" />
        </Campo>
        <div className="text-sm font-medium">
          <p className="mb-2">Cor</p>
          <SeletorCor cores={PALETA} valor={cor} onMudar={setCor} />
        </div>
        <div className="flex items-center gap-2 text-sm">
          <span className="text-muted">Prévia:</span>
          <PilulaEtiqueta nome={nome.trim() || 'Etiqueta'} cor={cor} />
        </div>

        {confirmandoExclusao && (
          <Aviso
            tom="ruim"
            acao={
              <Botao onClick={excluir} disabled={salvando} className="shrink-0">
                Confirmar exclusão
              </Botao>
            }
            onFechar={() => setConfirmandoExclusao(false)}
          >
            Excluir a etiqueta {etiqueta?.nome}?{' '}
            {cards > 0 ? `Ela está em ${cards} ${cards === 1 ? 'card' : 'cards'} e vai sair de todos.` : 'Ela não está em nenhum card.'}
          </Aviso>
        )}
      </form>
    </Modal>
  )
}
