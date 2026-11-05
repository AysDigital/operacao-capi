import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Aviso, BolinhaCor, CaixaTabela, Carregando, Dica, Modal, PilulaCor, tabela, Vazio } from '../components/ds'
import { useToast } from '../components/Toast'
import { Botao, BotaoExcluir, Campo, entrada, TituloPagina } from '../components/ui'
import { mensagemErro, soSigla, type Etiqueta } from '../lib/cadastros'
import { buscarModelos, FORMATOS, type AnexoModelo, type ChecklistModelo, type Modelo } from '../lib/modelos'
import { TIPOS, type Lista, type OfertaQuadro, type TipoCard } from '../lib/quadro'
import { ops } from '../lib/supabase'
import { EditorTexto } from './quadro/card/Texto'

type Base = { modelos: Modelo[]; ofertas: OfertaQuadro[]; listas: Lista[]; etiquetas: Etiqueta[] }

async function buscarTudo(): Promise<Base> {
  const [modelos, ofertas, listas, etiquetas] = await Promise.all([
    buscarModelos(),
    ops().from('ofertas').select('id, nome, codigo, idioma, cor, status').order('nome'),
    ops().from('listas').select('id, nome, ordem, cor, arquivada').order('ordem'),
    ops().from('etiquetas').select('id, nome, cor').order('nome'),
  ])
  const erro = ofertas.error ?? listas.error ?? etiquetas.error
  if (erro) throw new Error(erro.message)
  return { modelos, ofertas: ofertas.data as OfertaQuadro[], listas: listas.data ?? [], etiquetas: etiquetas.data ?? [] }
}

const nomeTipo = (t: TipoCard) => TIPOS.find((x) => x.valor === t)?.nome ?? t

/** Grava os campos e troca as etiquetas do modelo. Devolve o id. */
async function gravarModelo(id: string | null, campos: Omit<Modelo, 'id' | 'etiquetas'>, etiquetas: string[]) {
  const r = id
    ? await ops().from('modelos_card').update(campos).eq('id', id).select('id').single()
    : await ops().from('modelos_card').insert(campos).select('id').single()
  if (r.error) return { error: r.error, id: null }
  const novoId = r.data.id as string
  let { error } = await ops().from('modelos_card_etiquetas').delete().eq('modelo_id', novoId)
  if (!error && etiquetas.length) {
    ;({ error } = await ops()
      .from('modelos_card_etiquetas')
      .insert(etiquetas.map((etiqueta_id) => ({ modelo_id: novoId, etiqueta_id }))))
  }
  return { error, id: novoId }
}

const camposDe = ({ id: _id, etiquetas: _e, ...resto }: Modelo) => resto

export function Modelos() {
  const toast = useToast()
  const [base, setBase] = useState<Base | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [editando, setEditando] = useState<Modelo | 'novo' | null>(null)

  const recarregar = useCallback(() => buscarTudo().then(setBase, (e: Error) => setErro(e.message)), [])
  useEffect(() => {
    recarregar()
  }, [recarregar])

  async function duplicar(m: Modelo) {
    const { error } = await gravarModelo(null, { ...camposDe(m), nome: `${m.nome} (cópia)` }, m.etiquetas)
    if (error) return toast('ruim', mensagemErro(error))
    toast('bom', `Modelo duplicado: ${m.nome} (cópia).`)
    recarregar()
  }

  const oferta = (id: string | null) => base?.ofertas.find((o) => o.id === id)
  const lista = (id: string | null) => base?.listas.find((l) => l.id === id)

  return (
    <>
      <TituloPagina
        subtitulo="Modelos de card: o card nasce com tipo, formato, etiquetas, descrição, anexos, checklists e prazo do modelo. Use no “+ Adicionar card” de cada lista ou no botão “Novo a partir de modelo” do quadro."
        acoes={<Botao onClick={() => setEditando('novo')}>Novo modelo</Botao>}
      >
        Modelos
      </TituloPagina>

      {erro && <Aviso tom="ruim">Não foi possível carregar os modelos: {erro}</Aviso>}
      {!base && !erro && <Carregando linhas={4} altura="h-10" />}
      {base?.modelos.length === 0 && (
        <Vazio titulo="Nenhum modelo ainda">
          <p className="mt-1 text-sm text-muted">Crie aqui ou, num card pronto, use “Salvar como modelo”.</p>
        </Vazio>
      )}
      {base && base.modelos.length > 0 && (
        <CaixaTabela>
          <table className={tabela.table}>
            <thead className={tabela.thead}>
              <tr className="text-left">
                <th className={tabela.th}>Modelo</th>
                <th className={tabela.th}>Oferta</th>
                <th className={tabela.th}>Tipo</th>
                <th className={tabela.th}>Formato</th>
                <th className={tabela.th}>Lista padrão</th>
                <th className={tabela.th}>
                  <span className="sr-only">Ações</span>
                </th>
              </tr>
            </thead>
            <tbody className={tabela.tbody}>
              {base.modelos.map((m) => {
                const o = oferta(m.oferta_id)
                const l = lista(m.lista_id)
                return (
                  <tr key={m.id} onClick={() => setEditando(m)} className="cursor-pointer hover:bg-surface-2">
                    <td className={`${tabela.td} font-medium`}>{m.nome}</td>
                    <td className={tabela.td}>
                      {o ? (
                        <span className="inline-flex items-center gap-1.5">
                          <BolinhaCor cor={o.cor} tamanho="h-2.5 w-2.5" />
                          <span className="font-mono text-xs font-semibold">
                            {o.codigo}-{o.idioma}
                          </span>
                        </span>
                      ) : (
                        <span className="text-muted">Todas</span>
                      )}
                    </td>
                    <td className={tabela.td}>{nomeTipo(m.tipo)}</td>
                    <td className={`${tabela.td} font-mono text-xs`}>{m.formato ?? '—'}</td>
                    <td className={tabela.td}>{l ? l.nome : <span className="text-muted">—</span>}</td>
                    <td className={`${tabela.td} whitespace-nowrap text-right`}>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          duplicar(m)
                        }}
                        className="mr-3 text-muted hover:text-ink"
                      >
                        Duplicar
                      </button>
                      <button onClick={() => setEditando(m)} className="text-muted hover:text-ink">
                        Editar
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </CaixaTabela>
      )}

      {editando && base && (
        <EditorModelo
          modelo={editando === 'novo' ? null : editando}
          ofertas={base.ofertas}
          listas={base.listas}
          etiquetas={base.etiquetas}
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

// ---------------------------------------------------------------------
// Editor
// ---------------------------------------------------------------------
const pequeno = 'w-full rounded-md border border-line bg-surface px-2 py-1 text-sm outline-none focus:border-muted'
const botaoTexto = 'rounded-control px-2 py-1 text-xs text-muted hover:bg-surface-2 hover:text-ink'

function EditorModelo({
  modelo,
  ofertas,
  listas,
  etiquetas,
  onFechar,
  onSalvo,
}: {
  modelo: Modelo | null
  ofertas: OfertaQuadro[]
  listas: Lista[]
  etiquetas: Etiqueta[]
  onFechar: () => void
  onSalvo: () => void
}) {
  const toast = useToast()
  const [nome, setNome] = useState(modelo?.nome ?? '')
  const [ofertaId, setOfertaId] = useState(modelo?.oferta_id ?? '')
  const [tipo, setTipo] = useState<TipoCard>(modelo?.tipo ?? 'ad')
  const [formato, setFormato] = useState(modelo?.formato ?? 'VD')
  const [listaId, setListaId] = useState(modelo?.lista_id ?? '')
  const [prazo, setPrazo] = useState(modelo?.prazo_dias === null || modelo?.prazo_dias === undefined ? '' : String(modelo.prazo_dias))
  const [marcadas, setMarcadas] = useState<string[]>(modelo?.etiquetas ?? [])
  const [descricao, setDescricao] = useState(modelo?.descricao ?? '')
  const [anexos, setAnexos] = useState<AnexoModelo[]>(modelo?.anexos ?? [])
  const [checklists, setChecklists] = useState<ChecklistModelo[]>(modelo?.checklists ?? [])
  const [salvando, setSalvando] = useState(false)
  const [tentou, setTentou] = useState(false)
  const [confirmarExclusao, setConfirmarExclusao] = useState(false)

  const ativasOuAtual = listas.filter((l) => !l.arquivada || l.id === listaId)
  const dias = prazo.trim() === '' ? null : Number(prazo)
  const erroNome = tentou && !nome.trim() ? 'Informe o nome.' : null
  const erroFormato = tentou && tipo === 'ad' && !formato ? 'Ad precisa de formato.' : null
  const erroPrazo = dias !== null && (!Number.isInteger(dias) || dias < 0 || dias > 365) ? 'Use um número de 0 a 365.' : null

  async function salvar(e: FormEvent) {
    e.preventDefault()
    setTentou(true)
    if (!nome.trim() || (tipo === 'ad' && !formato) || erroPrazo) return
    setSalvando(true)
    const { error } = await gravarModelo(
      modelo?.id ?? null,
      {
        nome: nome.trim(),
        oferta_id: ofertaId || null,
        tipo,
        formato: formato || null,
        lista_id: listaId || null,
        descricao: descricao.trim() || null,
        anexos: anexos.map((a) => ({ titulo: a.titulo.trim(), url: a.url.trim() })).filter((a) => a.titulo || a.url),
        checklists: checklists
          .map((c) => ({ titulo: c.titulo.trim() || 'Checklist', itens: c.itens.map((i) => i.trim()).filter(Boolean) }))
          .filter((c) => c.titulo || c.itens.length),
        prazo_dias: dias,
      },
      marcadas,
    )
    setSalvando(false)
    if (error) return toast('ruim', mensagemErro(error))
    toast('bom', modelo ? 'Modelo salvo.' : 'Modelo criado.')
    onSalvo()
  }

  async function excluir() {
    if (!modelo) return
    setSalvando(true)
    const { error } = await ops().from('modelos_card').delete().eq('id', modelo.id)
    setSalvando(false)
    if (error) return toast('ruim', mensagemErro(error))
    toast('bom', `Modelo ${modelo.nome} excluído.`)
    onSalvo()
  }

  const mudarAnexo = (i: number, campo: keyof AnexoModelo, v: string) => setAnexos((as) => as.map((a, j) => (j === i ? { ...a, [campo]: v } : a)))
  const mudarChecklist = (i: number, c: Partial<ChecklistModelo>) => setChecklists((cs) => cs.map((x, j) => (j === i ? { ...x, ...c } : x)))

  return (
    <Modal
      titulo={modelo ? 'Editar modelo' : 'Novo modelo'}
      largura="max-w-3xl"
      onFechar={onFechar}
      rodape={
        <>
          {modelo && !confirmarExclusao && (
            <BotaoExcluir onClick={() => setConfirmarExclusao(true)} disabled={salvando}>
              Excluir
            </BotaoExcluir>
          )}
          <Botao variante="secundario" onClick={onFechar} className="ml-auto">
            Cancelar
          </Botao>
          <Botao type="submit" form="form-modelo" disabled={salvando}>
            {salvando ? 'Salvando…' : 'Salvar'}
          </Botao>
        </>
      }
    >
      <form id="form-modelo" onSubmit={salvar} className="space-y-5">
        {confirmarExclusao && (
          <Aviso
            tom="ruim"
            acao={
              <Botao onClick={excluir} disabled={salvando} className="shrink-0">
                Confirmar exclusão
              </Botao>
            }
            onFechar={() => setConfirmarExclusao(false)}
          >
            Excluir o modelo {modelo?.nome}? Os cards já criados com ele não mudam.
          </Aviso>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <Campo rotulo="Nome do modelo" erro={erroNome}>
            <input value={nome} onChange={(e) => setNome(e.target.value)} className={entrada} autoFocus={!modelo} placeholder="Ex.: Ad vídeo padrão" />
          </Campo>
          <Campo rotulo={<Dica conteudo="Em branco, o modelo aparece em todas as ofertas. Com oferta, só no quadro dela e no “Todas as ofertas”.">Oferta</Dica>}>
            <select value={ofertaId} onChange={(e) => setOfertaId(e.target.value)} className={entrada}>
              <option value="">Todas as ofertas</option>
              {ofertas.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.codigo}-{o.idioma} · {o.nome}
                </option>
              ))}
            </select>
          </Campo>
        </div>

        <div className="grid gap-4 sm:grid-cols-4">
          <div className="text-sm font-medium sm:col-span-2">
            <p>Tipo</p>
            <div className="mt-1 flex gap-1" role="radiogroup" aria-label="Tipo">
              {TIPOS.map((t) => (
                <button
                  key={t.valor}
                  type="button"
                  role="radio"
                  aria-checked={tipo === t.valor}
                  onClick={() => setTipo(t.valor)}
                  className={`flex-1 rounded-control px-3 py-2 text-sm font-medium ${tipo === t.valor ? 'bg-ink text-page' : 'bg-surface-2 text-muted hover:text-ink'}`}
                >
                  {t.nome}
                </button>
              ))}
            </div>
          </div>
          <Campo rotulo="Formato" erro={erroFormato}>
            <input list="formatos-modelo" value={formato} onChange={(e) => setFormato(soSigla(e.target.value, 8))} className={`${entrada} font-mono uppercase`} placeholder={tipo === 'ad' ? 'VD' : 'opcional'} />
            <datalist id="formatos-modelo">
              {FORMATOS.map((f) => (
                <option key={f} value={f} />
              ))}
            </datalist>
          </Campo>
          <Campo rotulo={<Dica conteudo="Dias somados à data de criação do card. Em branco, o card nasce sem prazo.">Prazo</Dica>} erro={erroPrazo}>
            <div className="relative">
              <input type="number" min={0} max={365} value={prazo} onChange={(e) => setPrazo(e.target.value)} className={`${entrada} pr-12`} placeholder="—" />
              <span className="pointer-events-none absolute right-3 top-1/2 mt-0.5 -translate-y-1/2 text-xs text-muted">dias</span>
            </div>
          </Campo>
        </div>

        <Campo rotulo={<Dica conteudo="Usada no botão “Novo a partir de modelo”. No “+ Adicionar card”, o card nasce na lista onde você clicou.">Lista padrão</Dica>}>
          <select value={listaId} onChange={(e) => setListaId(e.target.value)} className={entrada}>
            <option value="">Escolher na hora</option>
            {ativasOuAtual.map((l) => (
              <option key={l.id} value={l.id}>
                {l.nome}
              </option>
            ))}
          </select>
        </Campo>

        <div className="text-sm font-medium">
          <p className="mb-1.5">Etiquetas</p>
          {etiquetas.length === 0 ? (
            <p className="text-sm font-normal text-muted">Nenhuma etiqueta cadastrada.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {etiquetas.map((e) => {
                const ligada = marcadas.includes(e.id)
                return (
                  <button
                    key={e.id}
                    type="button"
                    aria-pressed={ligada}
                    onClick={() => setMarcadas((m) => (ligada ? m.filter((x) => x !== e.id) : [...m, e.id]))}
                    className={`rounded-full ${ligada ? 'ring-2 ring-ink ring-offset-2 ring-offset-surface' : 'opacity-50 hover:opacity-100'}`}
                  >
                    <PilulaCor texto={e.nome} cor={e.cor} />
                  </button>
                )
              })}
            </div>
          )}
        </div>

        <div className="text-sm font-medium">
          <p className="mb-1.5">Descrição padrão</p>
          <EditorTexto valor={descricao} onMudar={setDescricao} linhas={6} placeholder="Ex.: roteiro de instruções para o editor…" />
        </div>

        <div className="text-sm font-medium">
          <p className="mb-1.5">
            <Dica conteudo="Anexo sem link não é criado no card (o card já tem os botões “+ Script” e “+ AD Finalizado”).">Anexos</Dica>
          </p>
          <div className="space-y-2">
            {anexos.map((a, i) => (
              <div key={i} className="grid grid-cols-[10rem_1fr_auto] gap-2">
                <input value={a.titulo} onChange={(e) => mudarAnexo(i, 'titulo', e.target.value)} placeholder="Título" aria-label="Título do anexo" className={pequeno} />
                <input value={a.url} onChange={(e) => mudarAnexo(i, 'url', e.target.value)} placeholder="Link (opcional)" aria-label="Link do anexo" className={pequeno} />
                <button type="button" onClick={() => setAnexos((as) => as.filter((_, j) => j !== i))} className={`${botaoTexto} hover:text-bad`} aria-label="Remover anexo">
                  ×
                </button>
              </div>
            ))}
            <button type="button" onClick={() => setAnexos((as) => [...as, { titulo: '', url: '' }])} className={botaoTexto}>
              + Anexo
            </button>
          </div>
        </div>

        <div className="text-sm font-medium">
          <p className="mb-1.5">Checklists</p>
          <div className="space-y-3">
            {checklists.map((c, i) => (
              <div key={i} className="rounded-control border border-line p-3">
                <div className="flex gap-2">
                  <input value={c.titulo} onChange={(e) => mudarChecklist(i, { titulo: e.target.value })} placeholder="Título do checklist" aria-label="Título do checklist" className={`${pequeno} font-medium`} />
                  <button type="button" onClick={() => setChecklists((cs) => cs.filter((_, j) => j !== i))} className={`${botaoTexto} hover:text-bad`}>
                    Remover
                  </button>
                </div>
                <textarea
                  value={c.itens.join('\n')}
                  onChange={(e) => mudarChecklist(i, { itens: e.target.value.split('\n') })}
                  rows={Math.max(3, c.itens.length + 1)}
                  placeholder="Um item por linha"
                  aria-label="Itens do checklist"
                  className={`${pequeno} mt-2 resize-y font-normal`}
                />
              </div>
            ))}
            <button type="button" onClick={() => setChecklists((cs) => [...cs, { titulo: 'Checklist', itens: [] }])} className={botaoTexto}>
              + Checklist
            </button>
          </div>
        </div>

      </form>
    </Modal>
  )
}
