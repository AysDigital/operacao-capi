import { useState, type FormEvent } from 'react'
import { Aviso, BolinhaCor, CaixaTabela, Carregando, Modal, SeletorCor, Selo, tabela, Vazio } from '../components/ds'
import { useToast } from '../components/Toast'
import { Botao, BotaoExcluir, Campo, entrada, TituloPagina } from '../components/ui'
import {
  contagem,
  IDIOMAS,
  mensagemErro,
  PALETA,
  soSigla,
  STATUS_OFERTA,
  type Idioma,
  type Oferta,
  type StatusOferta,
} from '../lib/cadastros'
import { ops } from '../lib/supabase'
import { useCarregar } from '../lib/useCarregar'

type Linha = Oferta & { cards: { count: number }[] }

export function SeloStatusOferta({ status }: { status: StatusOferta }) {
  const s = STATUS_OFERTA[status]
  return (
    <Selo tom={s.tom}>
      <span aria-hidden>{s.icone}</span>
      {s.nome}
    </Selo>
  )
}

export function Ofertas() {
  const { dados, erro, recarregar } = useCarregar<Linha>(() =>
    ops().from('ofertas').select('id, nome, codigo, idioma, cor, status, cards(count)').order('nome'),
  )
  const [editando, setEditando] = useState<Linha | 'nova' | null>(null)

  return (
    <>
      <TituloPagina
        subtitulo="Cada oferta tem o seu quadro. A sigla e o idioma formam o começo do nome dos ads."
        acoes={<Botao onClick={() => setEditando('nova')}>Nova oferta</Botao>}
      >
        Ofertas
      </TituloPagina>

      {erro && <Aviso tom="ruim">Não foi possível carregar as ofertas: {erro}</Aviso>}
      {!dados && !erro && <Carregando linhas={4} altura="h-10" />}
      {dados?.length === 0 && (
        <Vazio titulo="Nenhuma oferta cadastrada ainda">
          <Botao onClick={() => setEditando('nova')} className="mt-3">
            Cadastrar a primeira
          </Botao>
        </Vazio>
      )}
      {dados && dados.length > 0 && (
        <CaixaTabela>
          <table className={tabela.table}>
            <thead className={tabela.thead}>
              <tr className="text-left">
                <th className={`${tabela.th} w-10`}>
                  <span className="sr-only">Cor</span>
                </th>
                <th className={tabela.th}>Nome</th>
                <th className={tabela.th}>Sigla</th>
                <th className={tabela.th}>Idioma</th>
                <th className={tabela.th}>Status</th>
                <th className={`${tabela.th} text-right`}>Cards</th>
                <th className={tabela.th}>
                  <span className="sr-only">Ações</span>
                </th>
              </tr>
            </thead>
            <tbody className={tabela.tbody}>
              {dados.map((o) => (
                <tr key={o.id} onClick={() => setEditando(o)} className="cursor-pointer hover:bg-surface-2">
                  <td className={tabela.td}>
                    <BolinhaCor cor={o.cor} />
                  </td>
                  <td className={`${tabela.td} font-medium`}>{o.nome}</td>
                  <td className={`${tabela.td} font-mono`}>{o.codigo}</td>
                  <td className={tabela.td}>{o.idioma}</td>
                  <td className={tabela.td}>
                    <SeloStatusOferta status={o.status} />
                  </td>
                  <td className={tabela.num}>{contagem(o.cards)}</td>
                  <td className={`${tabela.td} text-right`}>
                    <button onClick={() => setEditando(o)} className="text-muted hover:text-ink">
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
        <ModalOferta
          oferta={editando === 'nova' ? null : editando}
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

function ModalOferta({ oferta, onFechar, onSalvo }: { oferta: Linha | null; onFechar: () => void; onSalvo: () => void }) {
  const toast = useToast()
  const [nome, setNome] = useState(oferta?.nome ?? '')
  const [codigo, setCodigo] = useState(oferta?.codigo ?? '')
  const [idioma, setIdioma] = useState<Idioma>(oferta?.idioma ?? 'EN')
  const [cor, setCor] = useState<string>(oferta?.cor ?? PALETA[0].hex)
  const [status, setStatus] = useState<StatusOferta>(oferta?.status ?? 'em_producao')
  const [salvando, setSalvando] = useState(false)
  const [confirmandoExclusao, setConfirmandoExclusao] = useState(false)
  const [tentou, setTentou] = useState(false)

  const cards = oferta ? contagem(oferta.cards) : 0
  const previa = `${codigo || 'XX'}-${idioma}-AD1-H1-M1-VD`
  const renomeia = oferta && cards > 0 && (codigo !== oferta.codigo || idioma !== oferta.idioma)
  const erroNome = tentou && !nome.trim() ? 'Informe o nome.' : null
  const erroCodigo = tentou && !codigo ? 'Informe a sigla.' : null

  async function salvar(e: FormEvent) {
    e.preventDefault()
    setTentou(true)
    if (!nome.trim() || !codigo) return
    setSalvando(true)
    const campos = { nome: nome.trim(), codigo, idioma, cor, status }
    const { error } = oferta
      ? await ops().from('ofertas').update(campos).eq('id', oferta.id)
      : await ops().from('ofertas').insert(campos)
    setSalvando(false)
    if (error) {
      toast('ruim', mensagemErro(error, { ofertas_codigo_idioma_key: `Já existe uma oferta com a sigla ${codigo} em ${idioma}.` }))
      return
    }
    toast('bom', oferta ? (renomeia ? 'Oferta salva e nomes dos ads atualizados.' : 'Oferta salva.') : 'Oferta cadastrada.')
    onSalvo()
  }

  async function pausar() {
    if (!oferta) return
    setSalvando(true)
    const { error } = await ops().from('ofertas').update({ status: 'pausada' }).eq('id', oferta.id)
    setSalvando(false)
    if (error) return toast('ruim', mensagemErro(error))
    toast('bom', 'Oferta pausada.')
    onSalvo()
  }

  async function excluir() {
    if (!oferta) return
    setSalvando(true)
    const { error } = await ops().from('ofertas').delete().eq('id', oferta.id)
    setSalvando(false)
    if (error) {
      toast('ruim', error.code === '23503' ? 'Esta oferta tem cards e não pode ser excluída. Mude o status para Pausada.' : mensagemErro(error))
      return
    }
    toast('bom', 'Oferta excluída.')
    onSalvo()
  }

  return (
    <Modal
      titulo={oferta ? 'Editar oferta' : 'Nova oferta'}
      onFechar={onFechar}
      rodape={
        <>
          {oferta && !confirmandoExclusao && (
            <BotaoExcluir onClick={() => setConfirmandoExclusao(true)} disabled={salvando}>
              Excluir
            </BotaoExcluir>
          )}
          <Botao variante="secundario" onClick={onFechar} className="ml-auto">
            Cancelar
          </Botao>
          <Botao type="submit" form="form-oferta" disabled={salvando}>
            {salvando ? 'Salvando…' : 'Salvar'}
          </Botao>
        </>
      }
    >
      <form id="form-oferta" onSubmit={salvar} className="space-y-4">
        <Campo rotulo="Nome" erro={erroNome}>
          <input value={nome} onChange={(e) => setNome(e.target.value)} className={entrada} autoFocus placeholder="Ex.: Protocolo Calvície" />
        </Campo>
        <div className="grid grid-cols-2 gap-3">
          <Campo rotulo="Sigla" erro={erroCodigo}>
            <input
              value={codigo}
              onChange={(e) => setCodigo(soSigla(e.target.value, 8))}
              className={`${entrada} font-mono uppercase`}
              placeholder="PC"
            />
          </Campo>
          <Campo rotulo="Idioma">
            <select value={idioma} onChange={(e) => setIdioma(e.target.value as Idioma)} className={entrada}>
              {IDIOMAS.map((i) => (
                <option key={i}>{i}</option>
              ))}
            </select>
          </Campo>
        </div>

        <div className="rounded-control bg-surface-2 px-3 py-2 text-sm">
          <span className="text-muted">Nome dos ads: </span>
          <span className="font-mono font-medium">{previa}</span>
        </div>

        {renomeia && (
          <Aviso tom="atencao">
            Esta oferta tem {cards} {cards === 1 ? 'card' : 'cards'}. Ao salvar, os nomes dos ads passam a começar com{' '}
            <strong className="font-mono">
              {codigo}-{idioma}
            </strong>
            .
          </Aviso>
        )}

        <Campo rotulo="Status">
          <select value={status} onChange={(e) => setStatus(e.target.value as StatusOferta)} className={entrada}>
            {Object.entries(STATUS_OFERTA).map(([valor, s]) => (
              <option key={valor} value={valor}>
                {s.nome}
              </option>
            ))}
          </select>
        </Campo>

        <div className="text-sm font-medium">
          <p className="mb-2">Cor</p>
          <SeletorCor cores={PALETA} valor={cor} onMudar={setCor} />
        </div>

        {confirmandoExclusao &&
          (cards > 0 ? (
            <Aviso
              tom="ruim"
              acao={
                oferta?.status !== 'pausada' ? (
                  <Botao variante="secundario" onClick={pausar} disabled={salvando} className="shrink-0">
                    Mudar para pausada
                  </Botao>
                ) : undefined
              }
              onFechar={() => setConfirmandoExclusao(false)}
            >
              Esta oferta tem {cards} {cards === 1 ? 'card' : 'cards'} e não pode ser excluída. Para tirá-la de circulação, mude o status para
              Pausada.
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
              Excluir a oferta {oferta?.nome}? Isso não pode ser desfeito.
            </Aviso>
          ))}
      </form>
    </Modal>
  )
}
