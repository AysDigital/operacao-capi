import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router'
import { Progresso } from './oferta/ChecklistOferta'
import { Aviso, BolinhaCor, CaixaTabela, Carregando, Dica, Modal, SeletorCor, Selo, tabela, Vazio } from '../components/ds'
import { useToast } from '../components/Toast'
import { Botao, BotaoExcluir, Campo, entrada, TituloPagina } from '../components/ui'
import {
  contagem,
  IDIOMAS,
  lerNumero,
  mensagemErro,
  numeroParaTexto,
  PALETA,
  PERIODOS_AVALIACAO,
  soSigla,
  STATUS_OFERTA,
  type Idioma,
  type Oferta,
  type StatusOferta,
} from '../lib/cadastros'
import { AJUDA_CLASSES } from '../lib/ranking'
import { ops } from '../lib/supabase'
import { useCarregar } from '../lib/useCarregar'

type Linha = Oferta & { cards: { count: number }[]; checklists?: { checklist_itens: { feito: boolean }[] }[] }

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
    ops().from('ofertas').select('id, nome, codigo, idioma, cor, status, cpa_alvo, roas_minimo, gasto_minimo, periodo_avaliacao, roas_avanca, roas_monitora, dias_validacao, gasto_nospend, escalando, metricas_desde, cards(count), checklists(checklist_itens(feito))').order('nome'),
  )
  const [editando, setEditando] = useState<Linha | 'nova' | null>(null)
  const navegar = useNavigate()

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
                <th className={`${tabela.th} w-40`}>
                  <Dica conteudo="Itens feitos do checklist de lançamento da oferta." lado="esquerda">
                    Checklist
                  </Dica>
                </th>
                <th className={tabela.th}>
                  <span className="sr-only">Ações</span>
                </th>
              </tr>
            </thead>
            <tbody className={tabela.tbody}>
              {dados.map((o) => (
                <tr key={o.id} onClick={() => navegar(`/ofertas/${o.id}`)} className="cursor-pointer hover:bg-surface-2">
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
                  <td className={tabela.td}>
                    {(() => {
                      const itens = (o.checklists ?? []).flatMap((c) => c.checklist_itens)
                      return itens.length ? <Progresso feitos={itens.filter((i) => i.feito).length} total={itens.length} fina /> : <span className="text-xs text-muted">—</span>
                    })()}
                  </td>
                  <td className={`${tabela.td} text-right`}>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        setEditando(o)
                      }}
                      className="text-muted hover:text-ink"
                    >
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

export function ModalOferta({ oferta, onFechar, onSalvo }: { oferta: Linha | null; onFechar: () => void; onSalvo: () => void }) {
  const toast = useToast()
  const [nome, setNome] = useState(oferta?.nome ?? '')
  const [codigo, setCodigo] = useState(oferta?.codigo ?? '')
  const [idioma, setIdioma] = useState<Idioma>(oferta?.idioma ?? 'EN')
  const [cor, setCor] = useState<string>(oferta?.cor ?? PALETA[0].hex)
  const [status, setStatus] = useState<StatusOferta>(oferta?.status ?? 'em_producao')
  const [cpaAlvo, setCpaAlvo] = useState(numeroParaTexto(oferta?.cpa_alvo ?? null))
  const [roasMinimo, setRoasMinimo] = useState(numeroParaTexto(oferta?.roas_minimo ?? null))
  const [gastoMinimo, setGastoMinimo] = useState(numeroParaTexto(oferta?.gasto_minimo ?? null))
  const [periodo, setPeriodo] = useState<number>(oferta?.periodo_avaliacao ?? 7)
  const [roasAvanca, setRoasAvanca] = useState(numeroParaTexto(oferta?.roas_avanca ?? 1.3))
  const [roasMonitora, setRoasMonitora] = useState(numeroParaTexto(oferta?.roas_monitora ?? 0.8))
  const [diasValidacao, setDiasValidacao] = useState(String(oferta?.dias_validacao ?? 3))
  const [gastoNospend, setGastoNospend] = useState(numeroParaTexto(oferta?.gasto_nospend ?? 5))
  const [escalando, setEscalando] = useState(oferta?.escalando ?? false)
  const [metricasDesde, setMetricasDesde] = useState(oferta?.metricas_desde ?? '')
  const [salvando, setSalvando] = useState(false)
  const [confirmandoExclusao, setConfirmandoExclusao] = useState(false)
  const [tentou, setTentou] = useState(false)

  const cards = oferta ? contagem(oferta.cards) : 0
  const previa = `${codigo || 'XX'}-${idioma}-AD1-H1-M1-VD`
  const renomeia = oferta && cards > 0 && (codigo !== oferta.codigo || idioma !== oferta.idioma)
  const erroNome = tentou && !nome.trim() ? 'Informe o nome.' : null
  const erroCodigo = tentou && !codigo ? 'Informe a sigla.' : null
  const regras = { cpa_alvo: lerNumero(cpaAlvo), roas_minimo: lerNumero(roasMinimo), gasto_minimo: lerNumero(gastoMinimo) }
  const erroNumero = (v: number | null, zeroOk = false) =>
    v !== null && (Number.isNaN(v) || v < 0 || (!zeroOk && v === 0)) ? 'Use um número maior que zero.' : null
  const manual = {
    roas_avanca: lerNumero(roasAvanca) ?? 1.3,
    roas_monitora: lerNumero(roasMonitora) ?? 0.8,
    dias_validacao: Math.round(lerNumero(diasValidacao) ?? 3),
    gasto_nospend: lerNumero(gastoNospend) ?? 5,
    escalando,
    metricas_desde: metricasDesde || null,
  }
  const erros = {
    cpa: erroNumero(regras.cpa_alvo),
    roas: erroNumero(regras.roas_minimo),
    gasto: erroNumero(regras.gasto_minimo, true),
    avanca: erroNumero(manual.roas_avanca),
    monitora: erroNumero(manual.roas_monitora) ?? (manual.roas_monitora > manual.roas_avanca ? 'Precisa ser menor que o ROAS para avançar.' : null),
    dias: Number.isNaN(manual.dias_validacao) || manual.dias_validacao < 1 || manual.dias_validacao > 30 ? 'De 1 a 30 dias.' : null,
    nospend: erroNumero(manual.gasto_nospend, true),
  }

  async function salvar(e: FormEvent) {
    e.preventDefault()
    setTentou(true)
    if (!nome.trim() || !codigo || Object.values(erros).some(Boolean)) return
    setSalvando(true)
    const campos = { nome: nome.trim(), codigo, idioma, cor, status, ...regras, ...manual, periodo_avaliacao: periodo }
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

        <fieldset className="space-y-3 rounded-control border border-line px-3 pt-2 pb-3">
          <legend className="px-1 text-sm font-medium">
            <Dica conteudo={`${AJUDA_CLASSES} Deixe em branco o que não quiser usar.`} lado="esquerda">
              Regras de performance
            </Dica>
          </legend>
          <div className="grid grid-cols-2 gap-3">
            <Campo rotulo="CPA alvo (R$)" erro={erros.cpa}>
              <input value={cpaAlvo} onChange={(e) => setCpaAlvo(e.target.value)} className={entrada} inputMode="decimal" placeholder="Ex.: 80" />
            </Campo>
            <Campo rotulo="ROAS mínimo" erro={erros.roas}>
              <input value={roasMinimo} onChange={(e) => setRoasMinimo(e.target.value)} className={entrada} inputMode="decimal" placeholder="Ex.: 1,5" />
            </Campo>
            <Campo rotulo="Gasto mínimo (R$)" erro={erros.gasto}>
              <input value={gastoMinimo} onChange={(e) => setGastoMinimo(e.target.value)} className={entrada} inputMode="decimal" placeholder="Ex.: 200" />
            </Campo>
            <Campo rotulo="Contar métricas a partir de">
              <input type="date" value={metricasDesde} onChange={(e) => setMetricasDesde(e.target.value)} className={entrada} />
            </Campo>
            <Campo rotulo="Período de avaliação">
              <select value={periodo} onChange={(e) => setPeriodo(Number(e.target.value))} className={entrada}>
                {PERIODOS_AVALIACAO.map((d) => (
                  <option key={d} value={d}>
                    Últimos {d} dias
                  </option>
                ))}
              </select>
            </Campo>
          </div>
          <div className="border-t border-line pt-3">
            <p className="mb-2 text-sm font-medium">
              <Dica
                conteudo="Fases por anúncio: Validação (D1 até o último dia de validação, contados desde que começou a rodar), depois Pré-escala, ou Escala quando a oferta está escalando. No fim da validação, o ROAS daqueles dias decide: acima do ROAS para avançar = Avança; entre os dois = Monitorar; abaixo ou sem gasto = Falhou. No-spend: rodando há 2+ dias gastando menos que o limite por dia (ontem e anteontem)."
                lado="esquerda"
              >
                Manual de tráfego (Bidcap)
              </Dica>
            </p>
            <div className="grid grid-cols-2 gap-3">
              <Campo rotulo="ROAS para avançar" erro={erros.avanca}>
                <input value={roasAvanca} onChange={(e) => setRoasAvanca(e.target.value)} className={entrada} inputMode="decimal" placeholder="1,3" />
              </Campo>
              <Campo rotulo="ROAS para monitorar" erro={erros.monitora}>
                <input value={roasMonitora} onChange={(e) => setRoasMonitora(e.target.value)} className={entrada} inputMode="decimal" placeholder="0,8" />
              </Campo>
              <Campo rotulo="Dias de validação" erro={erros.dias}>
                <input value={diasValidacao} onChange={(e) => setDiasValidacao(e.target.value)} className={entrada} inputMode="numeric" placeholder="3" />
              </Campo>
              <Campo rotulo="No-spend: gasto por dia abaixo de (R$)" erro={erros.nospend}>
                <input value={gastoNospend} onChange={(e) => setGastoNospend(e.target.value)} className={entrada} inputMode="decimal" placeholder="5" />
              </Campo>
            </div>
            <label className="mt-3 flex cursor-pointer items-center gap-2 text-sm">
              <input type="checkbox" checked={escalando} onChange={(e) => setEscalando(e.target.checked)} className="accent-[var(--c-accent)]" />
              Oferta em escala (depois da validação, a fase vira "Escala" em vez de "Pré-escala")
            </label>
          </div>
        </fieldset>

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
