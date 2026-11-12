import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router'
import { Aviso, CaixaTabela, Carregando, tabela, Vazio } from '../components/ds'
import { useToast } from '../components/Toast'
import { Botao, TituloPagina } from '../components/ui'
import {
  buscarInventario,
  caido,
  dependentesUnicos,
  nomeAtivo,
  ORDEM_ABAS,
  STATUS_ATIVO,
  temStatus,
  tipoDaAba,
  TIPOS,
  type Inventario,
  type Registro,
  type TipoAtivo,
} from '../lib/ativos'
import { mensagemErro } from '../lib/cadastros'
import { buscarReserva, situacaoReserva, type Reserva } from '../lib/contingencia'
import { buscarNomesContas } from '../lib/metricas'
import { ops } from '../lib/supabase'
import { colunas, textoBusca } from './ativos/campos'
import { ModalAtivo } from './ativos/ModalAtivo'
import { PainelAtivo } from './ativos/PainelAtivo'
import { QuadroContas } from './ativos/QuadroContas'
import { AvisoReserva } from './contingencia/Reserva'

const busca = 'w-full rounded-control border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-muted sm:w-64'

export function Ativos() {
  const [params, setParams] = useSearchParams()
  const tipo = tipoDaAba(params.get('aba'))
  const aberto = params.get('id')
  const toast = useToast()
  const [inv, setInv] = useState<Inventario | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [texto, setTexto] = useState('')
  const [filtroStatus, setFiltroStatus] = useState('')
  const [editando, setEditando] = useState<Registro | 'novo' | null>(null)
  const [verDependentes, setVerDependentes] = useState(false)
  const [importando, setImportando] = useState(false)
  const [buscandoNomes, setBuscandoNomes] = useState(false)

  const carregar = useCallback(() => buscarInventario().then(setInv, (e: Error) => setErro(e.message)), [])
  useEffect(() => {
    carregar()
  }, [carregar])

  const ver = tipo === 'conta' && params.get('ver') === 'quadro' ? 'quadro' : 'lista'
  const quadro = ver === 'quadro'
  const abrir = (t: TipoAtivo, id: string | null) => {
    const p: Record<string, string> = { aba: TIPOS[t].aba }
    if (id) p.id = id
    if (t === 'conta' && quadro) p.ver = 'quadro'
    setParams(p)
  }
  const trocarAba = (t: TipoAtivo) => {
    setTexto('')
    setFiltroStatus('')
    abrir(t, null)
  }

  const dependentes = useMemo(() => (inv ? dependentesUnicos(inv) : []), [inv])

  // Reserva mínima da Contingência (só avisa; nada muda aqui).
  const [reserva, setReserva] = useState<Reserva | null>(null)
  useEffect(() => {
    buscarReserva().then(setReserva, () => setReserva(null))
  }, [inv])
  const reservaAbaixo = useMemo(() => (inv && reserva ? situacaoReserva(inv, reserva).filter((s) => s.abaixo) : []), [inv, reserva])

  const linhas = useMemo(() => {
    if (!inv) return []
    const q = texto.trim().toLowerCase()
    return inv[tipo]
      .filter((r) => !filtroStatus || r.status === filtroStatus)
      .filter((r) => !q || textoBusca(tipo, r, inv).includes(q))
      .sort((a, b) =>
        tipo === 'conta'
          ? String(a.apelido).localeCompare(String(b.apelido), 'pt-BR', { numeric: true })
          : textoBusca(tipo, a, inv).localeCompare(textoBusca(tipo, b, inv), 'pt-BR', { numeric: true }),
      )
  }, [inv, tipo, texto, filtroStatus])

  /** Com status: primeiro os ativos, depois os desativados/restritos. Sem status: um grupo só. */
  const grupos = useMemo(() => {
    if (!temStatus(tipo)) return [{ titulo: null as string | null, linhas }]
    return [
      { titulo: 'Ativos', linhas: linhas.filter((r) => !caido(tipo, r.status as string)) },
      { titulo: 'Desativados e restritos', linhas: linhas.filter((r) => caido(tipo, r.status as string)) },
    ].filter((g) => g.linhas.length > 0)
  }, [linhas, tipo])

  /** Traz do dashboard de vendas as contas que ainda não estão aqui (só número e nome). */
  async function importar() {
    setImportando(true)
    const { data, error } = await ops().rpc('importar_contas_dashboard')
    setImportando(false)
    if (error) return toast('ruim', mensagemErro(error))
    toast('bom', data ? `${data} conta(s) importada(s) do dashboard.` : 'Nenhuma conta nova no dashboard.')
    carregar()
  }

  /** Troca o nome de cada conta pelo nome que ela tem na Meta (o apelido CXX não muda). */
  async function nomesDaMeta() {
    setBuscandoNomes(true)
    try {
      const r = await buscarNomesContas()
      const partes = [r.atualizadas ? `${r.atualizadas} conta(s) com o nome atualizado.` : 'Todos os nomes já estavam iguais aos da Meta.']
      if (r.falhas.length) partes.push(`A Meta não respondeu para: ${r.falhas.map((f) => f.conta).join(', ')}.`)
      if (r.sem_id.length) partes.push(`Sem ID da Meta (preencha em Editar): ${r.sem_id.join(', ')}.`)
      toast(r.falhas.length ? 'ruim' : 'bom', partes.join(' '))
      carregar()
    } catch (e) {
      toast('ruim', (e as Error).message)
    } finally {
      setBuscandoNomes(false)
    }
  }

  const t = TIPOS[tipo]
  const cols = inv ? colunas(tipo, inv) : []

  return (
    <>
      <TituloPagina
        subtitulo="Inventário de perfis, BMs, contas, páginas, pixels, domínios, cartões e fornecedores. Cada ativo tem uma dona e pode estar compartilhado; só se perde numa queda quando não sobra nenhum acesso ativo."
      >
        Ativos
      </TituloPagina>

      {erro && <Aviso tom="ruim">Não foi possível carregar os ativos: {erro}</Aviso>}

      {reservaAbaixo.length > 0 && (
        <div className="mb-3">
          <AvisoReserva abaixo={reservaAbaixo} comLink />
        </div>
      )}

      {inv && dependentes.length > 0 && (
        <div className="mb-5">
          <Aviso
            tom="atencao"
            acao={
              <button onClick={() => setVerDependentes((v) => !v)} className="shrink-0 text-sm font-medium underline-offset-2 hover:underline">
                {verDependentes ? 'Esconder' : 'Ver quais'}
              </button>
            }
          >
            {dependentes.length} {dependentes.length === 1 ? 'ativo depende' : 'ativos dependem'} de uma única BM ou perfil (sem compartilhamento). São os que
            você perde numa queda.
            {verDependentes && (
              <ul className="mt-2 space-y-1">
                {dependentes.map((d) => (
                  <li key={`${d.tipo}:${d.id}`}>
                    <span className="mr-1.5 text-xs opacity-80">{TIPOS[d.tipo].um}</span>
                    <button onClick={() => abrir(d.tipo, d.id)} className="font-medium hover:underline">
                      {d.nome}
                    </button>
                    <span className="opacity-80"> só por {nomeAtivo(inv, d.via.titular_tipo, d.via.titular_id)}</span>
                  </li>
                ))}
              </ul>
            )}
          </Aviso>
        </div>
      )}

      <nav className="mb-4 flex gap-1 overflow-x-auto border-b border-line" aria-label="Tipos de ativo">
        {ORDEM_ABAS.map((a) => (
          <button
            key={a}
            onClick={() => trocarAba(a)}
            aria-current={a === tipo ? 'page' : undefined}
            className={`-mb-px shrink-0 border-b-2 px-3 py-2 text-sm whitespace-nowrap transition-colors ${
              a === tipo ? 'border-accent font-medium text-accent-strong' : 'border-transparent text-muted hover:text-ink'
            }`}
          >
            {TIPOS[a].varios}
            {inv && <span className="ml-1.5 text-xs text-muted tabular-nums">{inv[a].length}</span>}
          </button>
        ))}
      </nav>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        {tipo === 'conta' && (
          <div role="group" aria-label="Como ver as contas" className="flex rounded-control border border-line bg-surface p-0.5 text-sm">
            {(['lista', 'quadro'] as const).map((v) => (
              <button
                key={v}
                onClick={() => setParams(v === 'quadro' ? { aba: t.aba, ver: 'quadro' } : { aba: t.aba })}
                aria-pressed={ver === v}
                className={`rounded px-3 py-1.5 ${ver === v ? 'bg-surface-2 font-medium text-ink' : 'text-muted hover:text-ink'}`}
              >
                {v === 'lista' ? 'Lista' : 'Quadro de uso'}
              </button>
            ))}
          </div>
        )}
        {!quadro && <input value={texto} onChange={(e) => setTexto(e.target.value)} placeholder={`Buscar ${t.varios.toLowerCase()}…`} aria-label="Buscar" className={busca} />}
        {temStatus(tipo) && !quadro && (
          <select value={filtroStatus} onChange={(e) => setFiltroStatus(e.target.value)} aria-label="Filtrar por status" className="rounded-control border border-line bg-surface px-2 py-2 text-sm">
            <option value="">Todos os status</option>
            {Object.entries(STATUS_ATIVO[tipo]).map(([v, s]) => (
              <option key={v} value={v}>
                {s.icone} {s.nome}
              </option>
            ))}
          </select>
        )}
        <span className="ml-auto flex gap-2">
          {tipo === 'conta' && (
            <Botao variante="secundario" onClick={nomesDaMeta} disabled={buscandoNomes}>
              {buscandoNomes ? 'Buscando…' : 'Buscar nomes na Meta'}
            </Botao>
          )}
          {tipo === 'conta' && (
            <Botao variante="secundario" onClick={importar} disabled={importando}>
              {importando ? 'Importando…' : 'Importar do dashboard'}
            </Botao>
          )}
          <Botao onClick={() => setEditando('novo')} disabled={!inv}>
            {t.nova ? 'Nova' : 'Novo'} {t.um.toLowerCase()}
          </Botao>
        </span>
      </div>

      {!inv && !erro && <Carregando linhas={5} altura="h-10" />}
      {inv && inv[tipo].length === 0 && <Vazio titulo={`Nenhum${t.nova ? 'a' : ''} ${t.um.toLowerCase()} cadastrad${t.nova ? 'a' : 'o'} ainda`} />}
      {inv && quadro && <QuadroContas inv={inv} onMudou={carregar} onAbrir={abrir} />}
      {inv && !quadro && inv[tipo].length > 0 && linhas.length === 0 && <Vazio titulo="Nada encontrado com essa busca" />}
      {inv && !quadro && linhas.length > 0 && (
        <CaixaTabela>
          <table className={tabela.table}>
            <thead className={tabela.thead}>
              <tr className="text-left">
                {cols.map((c, i) => (
                  <th key={i} className={`${tabela.th} ${c.classe ?? ''}`}>
                    {c.rotulo}
                  </th>
                ))}
              </tr>
            </thead>
            {grupos.map((g) => (
              <tbody key={g.titulo ?? 'todos'} className={tabela.tbody}>
                {g.titulo && (
                  <tr className="bg-surface-2/70">
                    <th colSpan={cols.length} scope="colgroup" className="px-4 py-2 text-left text-xs font-semibold tracking-wide text-muted uppercase">
                      {g.titulo} <span className="ml-1 font-normal tabular-nums">{g.linhas.length}</span>
                    </th>
                  </tr>
                )}
                {g.linhas.map((r) => (
                  <tr
                    key={r.id}
                    onClick={() => abrir(tipo, r.id)}
                    onKeyDown={(e) => e.key === 'Enter' && abrir(tipo, r.id)}
                    tabIndex={0}
                    className={`cursor-pointer hover:bg-surface-2/60 focus:bg-surface-2/60 focus:outline-none ${r.id === aberto ? 'bg-surface-2/60' : ''}`}
                  >
                    {cols.map((c, i) => (
                      <td key={i} className={`${tabela.td} ${c.classe ?? ''}`}>
                        {c.valor(r)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            ))}
          </table>
        </CaixaTabela>
      )}

      {inv && aberto && !editando && (
        <PainelAtivo
          tipo={tipo}
          id={aberto}
          inv={inv}
          onFechar={() => abrir(tipo, null)}
          onMudou={carregar}
          onAbrir={abrir}
          onEditar={() => setEditando(inv[tipo].find((r) => r.id === aberto) ?? null)}
        />
      )}

      {inv && editando && (
        <ModalAtivo
          tipo={tipo}
          registro={editando === 'novo' ? null : editando}
          inv={inv}
          onFechar={() => setEditando(null)}
          onSalvo={(id) => {
            setEditando(null)
            carregar()
            abrir(tipo, id)
          }}
        />
      )}
    </>
  )
}
