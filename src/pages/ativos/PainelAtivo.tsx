import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Link } from 'react-router'
import { Aviso, BolinhaCor, Carregando, Dica, PainelLateral, Selo } from '../../components/ds'
import { useToast } from '../../components/Toast'
import { Botao, entrada } from '../../components/ui'
import {
  acessosDoAtivo,
  acessosDoTitular,
  acessoValido,
  acharAtivo,
  alcance,
  buscarAdsNasContas,
  buscarHistoricoStatus,
  caido,
  ehAcessavel,
  ehTitular,
  nomeAtivo,
  nomeDe,
  nomeNivel,
  NIVEIS,
  temStatus,
  TIPOS,
  type Acesso,
  type AdRodando,
  type EventoStatus,
  type Inventario,
  type TipoAcessavel,
  type TipoComStatus,
  type TipoAtivo,
  type TipoTitular,
} from '../../lib/ativos'
import { mensagemErro } from '../../lib/cadastros'
import { diaBrasilia, formatarDataHora, formatarDiaIso } from '../../lib/format'
import { STATUS_VEICULACAO, type StatusVeiculacao } from '../../lib/quadro'
import { ops } from '../../lib/supabase'
import { CAMPOS, mostrarCampo, SeloStatusAtivo } from './campos'
import { AquecimentoDoAtivo } from '../contingencia/AquecimentoDoAtivo'
import { ModalSimulacao, ModalStatus, SeletorStatus } from './Queda'

type OfertaResumo = { id: string; nome: string; codigo: string; idioma: string; cor: string | null }

function Bloco({ titulo, ajuda, children, acoes }: { titulo: string; ajuda?: string; children: ReactNode; acoes?: ReactNode }) {
  return (
    <section className="border-t border-line pt-4">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">
          {ajuda ? (
            <Dica conteudo={ajuda} lado="esquerda">
              {titulo}
            </Dica>
          ) : (
            titulo
          )}
        </h3>
        {acoes}
      </div>
      {children}
    </section>
  )
}

const linkAtivo = 'text-left font-medium hover:text-accent-strong hover:underline'

export function PainelAtivo({
  tipo,
  id,
  inv,
  onFechar,
  onMudou,
  onAbrir,
  onEditar,
}: {
  tipo: TipoAtivo
  id: string
  inv: Inventario
  onFechar: () => void
  onMudou: () => void
  onAbrir: (tipo: TipoAtivo, id: string) => void
  onEditar: () => void
}) {
  const r = acharAtivo(inv, tipo, id)
  const [mudarPara, setMudarPara] = useState<string | null>(null)
  const [simulando, setSimulando] = useState(false)
  const [versao, setVersao] = useState(0)

  if (!r)
    return (
      <PainelLateral titulo={TIPOS[tipo].um} onFechar={onFechar}>
        <Aviso tom="atencao">Este ativo não existe mais.</Aviso>
      </PainelLateral>
    )

  const mudou = () => {
    setVersao((v) => v + 1)
    onMudou()
  }

  return (
    <PainelLateral titulo={nomeDe(tipo, r)} onFechar={onFechar}>
      <div className="space-y-5">
        <div className="flex flex-wrap items-center gap-2">
          <Selo>{TIPOS[tipo].um}</Selo>
          {temStatus(tipo) && (
            <>
              <SeloStatusAtivo tipo={tipo} status={r.status} />
              <SeletorStatus tipo={tipo} atual={r.status as string} onEscolher={(s) => s !== r.status && setMudarPara(s)} />
            </>
          )}
          <span className="ml-auto flex gap-2">
            {ehTitular(tipo) && (
              <Botao variante="secundario" onClick={() => setSimulando(true)}>
                E se cair?
              </Botao>
            )}
            <Botao variante="secundario" onClick={onEditar}>
              Editar
            </Botao>
          </span>
        </div>

        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
          {CAMPOS[tipo]
            .filter((c) => c.chave !== 'status' && c.chave !== 'nome' && r[c.chave] != null && r[c.chave] !== '')
            .map((c) => (
              <div key={c.chave} className={c.tipo === 'area' ? 'col-span-2' : ''}>
                <dt className="text-xs text-muted">{c.rotulo}</dt>
                <dd className={`mt-0.5 ${c.tipo === 'area' ? 'whitespace-pre-wrap' : ''} ${c.tipo === 'idMeta' ? 'font-mono tabular-nums' : ''}`}>
                  {mostrarCampo(tipo, c, r, inv)}
                </dd>
              </div>
            ))}
        </dl>

        {(tipo === 'perfil' || tipo === 'conta' || tipo === 'pagina') && <AquecimentoDoAtivo key={id} tipo={tipo} id={id} inv={inv} onMudou={mudou} />}
        {ehAcessavel(tipo) && <Acessos tipo={tipo} id={id} inv={inv} onMudou={mudou} onAbrir={onAbrir} />}
        {ehTitular(tipo) && <PossuiAcessa tipo={tipo} id={id} inv={inv} onAbrir={onAbrir} />}
        <Uso tipo={tipo} id={id} inv={inv} onAbrir={onAbrir} versao={versao} />
        {temStatus(tipo) && <HistoricoStatus tipo={tipo} id={id} versao={versao} status={r.status as string} />}
      </div>

      {mudarPara && temStatus(tipo) && (
        <ModalStatus tipo={tipo} registro={r} para={mudarPara} onFechar={() => setMudarPara(null)} onMudou={mudou} />
      )}
      {simulando && ehTitular(tipo) && <ModalSimulacao tipo={tipo} registro={r} onFechar={() => setSimulando(false)} onAbrir={onAbrir} />}
    </PainelLateral>
  )
}

/** Dona e compartilhamentos do ativo, com adicionar e remover. */
function Acessos({ tipo, id, inv, onMudou, onAbrir }: { tipo: TipoAcessavel; id: string; inv: Inventario; onMudou: () => void; onAbrir: (t: TipoAtivo, id: string) => void }) {
  const toast = useToast()
  const todos = acessosDoAtivo(inv, tipo, id)
  const ativos = todos.filter((a) => a.ativo)
  const dona = ativos.find((a) => a.papel === 'dona')
  const compartilhados = ativos.filter((a) => a.papel !== 'dona')
  const antigos = todos.filter((a) => !a.ativo)
  const [adicionando, setAdicionando] = useState(false)
  const [mexendo, setMexendo] = useState<string | null>(null)
  const validos = ativos.filter((a) => acessoValido(inv, a)).length

  async function remover(a: Acesso) {
    setMexendo(a.id)
    const { error } = await ops().from('acessos').update({ ativo: false, inativado_em: diaBrasilia(), motivo_inativo: 'Removido' }).eq('id', a.id)
    setMexendo(null)
    if (error) return toast('ruim', mensagemErro(error))
    toast('bom', 'Acesso removido (fica no histórico).')
    onMudou()
  }

  async function tornarDona(a: Acesso) {
    setMexendo(a.id)
    const { error } = await ops().from('acessos').update({ papel: 'dona' }).eq('id', a.id)
    setMexendo(null)
    if (error) return toast('ruim', mensagemErro(error))
    onMudou()
  }

  const linha = (a: Acesso) => {
    const titular = acharAtivo(inv, a.titular_tipo, a.titular_id)
    const caiu = caido(a.titular_tipo, titular?.status as string)
    return (
      <li key={a.id} className="flex flex-wrap items-center gap-x-2 gap-y-1 py-1.5 text-sm">
        <span className="text-xs text-muted">{TIPOS[a.titular_tipo].um}</span>
        <button onClick={() => onAbrir(a.titular_tipo, a.titular_id)} className={linkAtivo}>
          {nomeDe(a.titular_tipo, titular)}
        </button>
        {caiu && <SeloStatusAtivo tipo={a.titular_tipo} status={titular?.status} />}
        <span className="text-xs text-muted">
          {nomeNivel(a.nivel)} · desde {formatarDiaIso(a.desde)}
        </span>
        <span className="ml-auto flex gap-1">
          {!dona && a.papel !== 'dona' && (
            <button onClick={() => tornarDona(a)} disabled={mexendo === a.id} className="rounded-control px-2 py-0.5 text-xs text-muted hover:bg-surface-2 hover:text-ink">
              Tornar dona
            </button>
          )}
          <button onClick={() => remover(a)} disabled={mexendo === a.id} className="rounded-control px-2 py-0.5 text-xs text-muted hover:bg-bad-soft hover:text-bad">
            Remover
          </button>
        </span>
      </li>
    )
  }

  return (
    <Bloco
      titulo="Acessos"
      ajuda="A dona é a BM ou o perfil proprietário. Compartilhado = outras BMs e perfis que também acessam. O ativo só se perde numa queda quando não sobra nenhum acesso ativo."
    >
      {validos === 1 && (
        <div className="mb-2">
          <Aviso tom="atencao">Depende de uma única BM ou perfil. Se ela cair, este ativo se perde.</Aviso>
        </div>
      )}
      {ativos.length > 0 && validos === 0 && (
        <div className="mb-2">
          <Aviso tom="ruim">Nenhum acesso valendo: quem dava acesso está caído.</Aviso>
        </div>
      )}
      <p className="text-xs font-medium text-muted">Dona</p>
      {dona ? <ul>{linha(dona)}</ul> : <p className="py-1.5 text-sm text-muted">Sem dona cadastrada.</p>}
      <p className="mt-2 text-xs font-medium text-muted">Compartilhado com</p>
      {compartilhados.length ? <ul className="divide-y divide-line">{compartilhados.map(linha)}</ul> : <p className="py-1.5 text-sm text-muted">Ninguém.</p>}

      {!adicionando && (
        <div className="mt-2">
          <Botao variante="secundario" onClick={() => setAdicionando(true)}>
            {dona ? '+ Compartilhar com BM ou perfil' : '+ Definir dona ou compartilhar'}
          </Botao>
        </div>
      )}
      {adicionando && <NovoAcesso tipo={tipo} id={id} inv={inv} temDona={Boolean(dona)} onFechar={() => setAdicionando(false)} onMudou={onMudou} />}

      {antigos.length > 0 && (
        <details className="mt-2 text-sm">
          <summary className="cursor-pointer text-xs text-muted hover:text-ink">Acessos inativos ({antigos.length})</summary>
          <ul className="mt-1 space-y-1">
            {antigos.map((a) => (
              <li key={a.id} className="text-xs text-muted">
                {nomeAtivo(inv, a.titular_tipo, a.titular_id)} ({a.papel === 'dona' ? 'dona' : 'compartilhado'}) · {formatarDiaIso(a.desde)} a{' '}
                {formatarDiaIso(a.inativado_em)}
                {a.motivo_inativo && ` · ${a.motivo_inativo}`}
              </li>
            ))}
          </ul>
        </details>
      )}
    </Bloco>
  )
}

function NovoAcesso({
  tipo,
  id,
  inv,
  temDona,
  onFechar,
  onMudou,
}: {
  tipo: TipoAcessavel
  id: string
  inv: Inventario
  temDona: boolean
  onFechar: () => void
  onMudou: () => void
}) {
  const toast = useToast()
  const jaTem = new Set(acessosDoAtivo(inv, tipo, id).filter((a) => a.ativo).map((a) => `${a.titular_tipo}:${a.titular_id}`))
  const opcoes = (t: TipoTitular) => inv[t].filter((x) => !(t === tipo && x.id === id) && !jaTem.has(`${t}:${x.id}`))
  const [titular, setTitular] = useState('')
  const [papel, setPapel] = useState<'dona' | 'compartilhado'>(temDona ? 'compartilhado' : 'dona')
  const [nivel, setNivel] = useState('admin')
  const [desde, setDesde] = useState(diaBrasilia())
  const [salvando, setSalvando] = useState(false)

  async function salvar() {
    if (!titular) return toast('ruim', 'Escolha a BM ou o perfil.')
    const [tt, tid] = titular.split(':') as [TipoTitular, string]
    setSalvando(true)
    const { error } = await ops()
      .from('acessos')
      .insert({ [`${tipo}_id`]: id, [`por_${tt}_id`]: tid, papel, nivel, desde })
    setSalvando(false)
    if (error)
      return toast(
        'ruim',
        mensagemErro(error, {
          acessos_uma_dona: 'Este ativo já tem uma dona. Remova a atual antes de pôr outra.',
          acessos_sem_repetir: 'Essa BM ou perfil já tem acesso.',
        }),
      )
    toast('bom', 'Acesso adicionado.')
    onFechar()
    onMudou()
  }

  const sel = 'rounded-control border border-line bg-surface px-2 py-1.5 text-sm'
  return (
    <div className="mt-3 space-y-2 rounded-card border border-line bg-surface-2/50 p-3">
      <select value={titular} onChange={(e) => setTitular(e.target.value)} className={`${entrada} mt-0`} aria-label="Quem tem acesso" autoFocus>
        <option value="">Escolha a BM ou o perfil…</option>
        {(['bm', 'perfil'] as const).map((t) => (
          <optgroup key={t} label={TIPOS[t].varios}>
            {opcoes(t).map((x) => (
              <option key={x.id} value={`${t}:${x.id}`}>
                {nomeDe(t, x)}
                {caido(t, x.status as string) ? ' (caída)' : ''}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
      <div className="flex flex-wrap items-center gap-2">
        <select value={papel} onChange={(e) => setPapel(e.target.value as 'dona' | 'compartilhado')} className={sel} aria-label="Papel">
          <option value="dona" disabled={temDona}>
            Dona{temDona ? ' (já tem)' : ''}
          </option>
          <option value="compartilhado">Compartilhado</option>
        </select>
        <select value={nivel} onChange={(e) => setNivel(e.target.value)} className={sel} aria-label="Nível">
          {NIVEIS.map((n) => (
            <option key={n.valor} value={n.valor}>
              {n.nome}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-1.5 text-xs text-muted">
          desde
          <input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} className={sel} />
        </label>
        <span className="ml-auto flex gap-2">
          <Botao variante="secundario" onClick={onFechar}>
            Cancelar
          </Botao>
          <Botao onClick={salvar} disabled={salvando}>
            Adicionar
          </Botao>
        </span>
      </div>
    </div>
  )
}

/** Para BMs e perfis: o que possuem (dona) e o que acessam (compartilhado). */
function PossuiAcessa({ tipo, id, inv, onAbrir }: { tipo: TipoTitular; id: string; inv: Inventario; onAbrir: (t: TipoAtivo, id: string) => void }) {
  const dados = acessosDoTitular(inv, tipo, id).filter((a) => a.ativo)
  const lista = (papel: 'dona' | 'compartilhado') => {
    const itens = dados.filter((a) => (papel === 'dona' ? a.papel === 'dona' : a.papel !== 'dona'))
    if (!itens.length) return <p className="py-1 text-sm text-muted">Nada.</p>
    return (
      <ul className="space-y-1 text-sm">
        {itens.map((a) => (
          <li key={a.id} className="flex flex-wrap items-center gap-x-2">
            <span className="w-14 shrink-0 text-xs text-muted">{TIPOS[a.ativo_tipo].um}</span>
            <button onClick={() => onAbrir(a.ativo_tipo, a.ativo_id)} className={linkAtivo}>
              {nomeAtivo(inv, a.ativo_tipo, a.ativo_id)}
            </button>
            <span className="text-xs text-muted">{nomeNivel(a.nivel)}</span>
          </li>
        ))}
      </ul>
    )
  }
  return (
    <Bloco titulo="O que ela possui e acessa">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <p className="mb-1 text-xs font-medium text-muted">Possui (dona)</p>
          {lista('dona')}
        </div>
        <div>
          <p className="mb-1 text-xs font-medium text-muted">Acessa (compartilhado)</p>
          {lista('compartilhado')}
        </div>
      </div>
    </Bloco>
  )
}

/** Ofertas e ads rodando que usam o ativo (pelas contas e pelos ativos de cada oferta). */
function Uso({ tipo, id, inv, onAbrir, versao }: { tipo: TipoAtivo; id: string; inv: Inventario; onAbrir: (t: TipoAtivo, id: string) => void; versao: number }) {
  const { contas, paginas, pixels, dominios } = useMemo(() => {
    const alc = ehTitular(tipo) ? alcance(inv, tipo, id) : [{ tipo: tipo as TipoAcessavel, id }]
    const de = (t: string) => alc.filter((a) => a.tipo === t).map((a) => a.id)
    return { contas: de('conta'), paginas: de('pagina'), pixels: de('pixel'), dominios: tipo === 'dominio' ? [id] : [] }
  }, [tipo, id, inv])
  const [ads, setAds] = useState<AdRodando[] | null>(null)
  const [ofertas, setOfertas] = useState<OfertaResumo[]>([])
  const [erro, setErro] = useState<string | null>(null)
  const chave = contas.join(',')

  useEffect(() => {
    buscarAdsNasContas(contas).then(setAds, (e: Error) => setErro(e.message))
    ops()
      .from('ofertas')
      .select('id, nome, codigo, idioma, cor')
      .then(({ data }) => setOfertas((data ?? []) as OfertaResumo[]))
    // chave resume a lista de contas
  }, [chave, versao])

  if (tipo === 'cartao') {
    const usam = inv.conta.filter((c) => c.cartao_id === id)
    return (
      <Bloco titulo="Contas que usam este cartão">
        {usam.length ? (
          <ul className="space-y-1 text-sm">
            {usam.map((c) => (
              <li key={c.id}>
                <button onClick={() => onAbrir('conta', c.id)} className={linkAtivo}>
                  {nomeDe('conta', c)}
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted">Nenhuma.</p>
        )}
      </Bloco>
    )
  }
  if (tipo === 'fornecedor') {
    const comprados = [...inv.perfil.map((p) => ['perfil', p] as const), ...inv.bm.map((b) => ['bm', b] as const)].filter(([, x]) => x.fornecedor_id === id)
    return (
      <Bloco titulo="Comprados deste fornecedor">
        {comprados.length ? (
          <ul className="space-y-1 text-sm">
            {comprados.map(([t, x]) => (
              <li key={x.id} className="flex flex-wrap items-center gap-x-2">
                <span className="w-14 text-xs text-muted">{TIPOS[t].um}</span>
                <button onClick={() => onAbrir(t, x.id)} className={linkAtivo}>
                  {nomeDe(t, x)}
                </button>
                <SeloStatusAtivo tipo={t} status={x.status} />
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted">Nada cadastrado.</p>
        )}
      </Bloco>
    )
  }

  // ofertas: pelos ads rodando nas contas + pelas páginas, pixels e domínios ligados à oferta
  const motivos = new Map<string, Set<string>>()
  const marcar = (oferta: string, m: string) => motivos.set(oferta, (motivos.get(oferta) ?? new Set()).add(m))
  for (const a of ads ?? []) marcar(a.oferta_id, `ads em ${nomeAtivo(inv, 'conta', a.conta_id).split(' · ')[0]}`)
  for (const o of inv.ofertasAtivos) {
    if (o.pagina_id && paginas.includes(o.pagina_id)) marcar(o.oferta_id, `página ${nomeAtivo(inv, 'pagina', o.pagina_id)}`)
    if (o.pixel_id && pixels.includes(o.pixel_id)) marcar(o.oferta_id, `pixel ${nomeAtivo(inv, 'pixel', o.pixel_id)}`)
    if (o.dominio_id && dominios.includes(o.dominio_id)) marcar(o.oferta_id, `domínio ${nomeAtivo(inv, 'dominio', o.dominio_id)}`)
  }
  const lista = ofertas.filter((o) => motivos.has(o.id)).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))

  return (
    <Bloco
      titulo="Ofertas e ads rodando"
      ajuda={
        ehTitular(tipo)
          ? 'Pelas contas, páginas e pixels que ela alcança (direto ou por outras BMs e perfis que acessa).'
          : 'Pelas veiculações (ads rodando ou em análise) e pelos ativos ligados a cada oferta.'
      }
    >
      {erro && <Aviso tom="ruim">Não foi possível carregar: {erro}</Aviso>}
      {!ads && !erro && <Carregando linhas={2} />}
      {ads && lista.length === 0 && <p className="text-sm text-muted">Nenhuma oferta usa este ativo agora.</p>}
      {ads && lista.length > 0 && (
        <ul className="space-y-3 text-sm">
          {lista.map((o) => {
            const seus = ads.filter((a) => a.oferta_id === o.id)
            return (
              <li key={o.id}>
                <Link to={`/ofertas/${o.id}`} className="inline-flex items-center gap-2 font-medium hover:text-accent-strong hover:underline">
                  <BolinhaCor cor={o.cor} />
                  <span className="font-mono text-xs">
                    {o.codigo}-{o.idioma}
                  </span>
                  {o.nome}
                </Link>
                <span className="block text-xs text-muted">{[...(motivos.get(o.id) ?? [])].join(' · ')}</span>
                {seus.length > 0 && (
                  <ul className="mt-1 flex flex-wrap gap-1.5">
                    {seus.map((a) => {
                      const s = STATUS_VEICULACAO[a.status as StatusVeiculacao]
                      return (
                        <li key={`${a.card_id}:${a.conta_id}`}>
                          <Link
                            to={`/quadros/${a.oferta_id}?card=${a.card_id}`}
                            title={`${s?.nome ?? a.status} em ${nomeAtivo(inv, 'conta', a.conta_id)}`}
                            className="inline-block rounded-full bg-surface-2 px-2 py-0.5 font-mono text-[11px] hover:bg-line"
                          >
                            {s?.icone} {a.nome}
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
    </Bloco>
  )
}

function HistoricoStatus({ tipo, id, versao, status }: { tipo: TipoComStatus; id: string; versao: number; status: string }) {
  const [eventos, setEventos] = useState<EventoStatus[] | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  useEffect(() => {
    buscarHistoricoStatus(tipo, id).then(setEventos, (e: Error) => setErro(e.message))
  }, [tipo, id, versao, status])

  return (
    <Bloco titulo="Histórico de status">
      {erro && <Aviso tom="ruim">Não foi possível carregar: {erro}</Aviso>}
      {!eventos && !erro && <Carregando linhas={2} />}
      {eventos?.length === 0 && <p className="text-sm text-muted">Sem mudanças registradas.</p>}
      {eventos && eventos.length > 0 && (
        <ol className="space-y-2 text-sm">
          {eventos.map((e) => (
            <li key={e.id} className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="w-32 shrink-0 text-xs text-muted tabular-nums">{formatarDataHora(e.data)}</span>
              {e.de && (
                <>
                  <SeloStatusAtivo tipo={tipo} status={e.de} />
                  <span aria-hidden className="text-muted">
                    →
                  </span>
                </>
              )}
              <SeloStatusAtivo tipo={tipo} status={e.para} />
              {e.motivo && <span className="basis-full pl-[8.5rem] text-xs text-muted">{e.motivo}</span>}
            </li>
          ))}
        </ol>
      )}
    </Bloco>
  )
}
