import { useEffect, useMemo, useState } from 'react'
import { Aviso, Carregando, Modal } from '../../components/ds'
import { useToast } from '../../components/Toast'
import { Botao, Campo, entrada } from '../../components/ui'
import { mensagemErro } from '../../lib/cadastros'
import { casarAnunciosPeloNome, type ResultadoCasar } from '../../lib/metricas'
import { STATUS_VEICULACAO, type CardQuadro, type ContaQuadro, type Lista, type OfertaQuadro, type StatusVeiculacao } from '../../lib/quadro'
import { ops } from '../../lib/supabase'

/**
 * Veicular em lote: escolher vários cards (por lista) e várias contas, e criar
 * todas as veiculações de uma vez. Combinações que já existem são puladas.
 */
export function VeicularEmLote({
  cards,
  listas,
  contas,
  ofertas,
  ofertaId,
  onFechar,
  onFeito,
}: {
  cards: CardQuadro[]
  listas: Lista[]
  contas: ContaQuadro[]
  ofertas: OfertaQuadro[]
  ofertaId: string | null
  onFechar: () => void
  onFeito: () => void
}) {
  const toast = useToast()
  const doQuadro = cards.filter((c) => !c.arquivado && c.tipo === 'ad' && (!ofertaId || c.oferta_id === ofertaId))
  const comCards = listas.filter((l) => !l.arquivada && doQuadro.some((c) => c.lista_id === l.id))
  const inicial = comCards.find((l) => /pronto/i.test(l.nome))?.id ?? comCards[0]?.id ?? ''
  const [listasMarcadas, setListasMarcadas] = useState<Set<string>>(new Set(inicial ? [inicial] : []))
  const [soSemConta, setSoSemConta] = useState(false)
  const [marcados, setMarcados] = useState<Set<string>>(new Set())
  const [contasMarcadas, setContasMarcadas] = useState<Set<string>>(new Set())
  const [status, setStatus] = useState<StatusVeiculacao>('nao_subido')
  const [salvando, setSalvando] = useState(false)

  const daLista = useMemo(
    () =>
      doQuadro
        .filter((c) => listasMarcadas.has(c.lista_id) && (!soSemConta || c.veiculacoes.length === 0))
        .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR', { numeric: true })),
    [doQuadro, listasMarcadas, soSemConta],
  )
  // ao mudar as listas ou o filtro, já marca todos os cards que aparecem
  const chaveFiltro = [...listasMarcadas].sort().join(',') + soSemConta
  useEffect(() => setMarcados(new Set(daLista.map((c) => c.id))), [chaveFiltro]) // eslint-disable-line react-hooks/exhaustive-deps

  const ativas = contas.filter((c) => c.ativa).sort((a, b) => a.apelido.localeCompare(b.apelido, 'pt-BR', { numeric: true }))
  const escolhidos = daLista.filter((c) => marcados.has(c.id))
  const novas = escolhidos.flatMap((c) => [...contasMarcadas].filter((ct) => !c.veiculacoes.some((v) => v.conta_id === ct)).map((ct) => ({ card_id: c.id, conta_id: ct })))
  const jaTinham = escolhidos.length * contasMarcadas.size - novas.length
  const oferta = (id: string) => ofertas.find((o) => o.id === id)

  const alternar = (set: Set<string>, id: string) => {
    const n = new Set(set)
    if (n.has(id)) n.delete(id)
    else n.add(id)
    return n
  }

  async function criar() {
    if (!novas.length) return toast('ruim', 'Nada novo para criar: escolha cards e contas.')
    setSalvando(true)
    const { error } = await ops()
      .from('veiculacoes')
      .upsert(
        novas.map((n) => ({ ...n, status })),
        { onConflict: 'card_id,conta_id', ignoreDuplicates: true },
      )
    setSalvando(false)
    if (error) return toast('ruim', mensagemErro(error))
    toast('bom', `${novas.length} veiculação(ões) criada(s).`)
    onFeito()
    onFechar()
  }

  return (
    <Modal
      titulo="Veicular em lote"
      largura="max-w-3xl"
      onFechar={onFechar}
      rodape={
        <>
          <span className="text-sm text-muted">
            {escolhidos.length} card(s) × {contasMarcadas.size} conta(s)
            {jaTinham > 0 && ` · ${jaTinham} já existiam`}
          </span>
          <Botao variante="secundario" onClick={onFechar} className="ml-auto">
            Cancelar
          </Botao>
          <Botao onClick={criar} disabled={salvando || !novas.length}>
            {salvando ? 'Criando…' : `Criar ${novas.length} veiculação(ões)`}
          </Botao>
        </>
      }
    >
      <div className="grid gap-5 md:grid-cols-2">
        <div className="space-y-2">
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <p className="text-sm font-medium">Listas</p>
              <span className="flex gap-2 text-xs">
                <button onClick={() => setListasMarcadas(new Set(comCards.map((l) => l.id)))} className="text-info hover:underline">
                  Todas
                </button>
                <button onClick={() => setListasMarcadas(new Set())} className="text-info hover:underline">
                  Nenhuma
                </button>
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {comCards.map((l) => {
                const on = listasMarcadas.has(l.id)
                return (
                  <button
                    key={l.id}
                    onClick={() => setListasMarcadas((m) => alternar(m, l.id))}
                    className={`rounded-full border px-2.5 py-1 text-xs ${on ? 'border-accent bg-accent-soft font-medium text-accent-strong' : 'border-line text-muted hover:bg-surface-2'}`}
                  >
                    {on ? '✓ ' : ''}
                    {l.nome} ({doQuadro.filter((c) => c.lista_id === l.id).length})
                  </button>
                )
              })}
            </div>
          </div>
          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <input type="checkbox" checked={soSemConta} onChange={(e) => setSoSemConta(e.target.checked)} className="accent-[var(--c-accent)]" />
            Só cards sem nenhuma conta
          </label>
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted">
              {marcados.size} de {daLista.length} marcados
            </span>
            <span className="flex gap-2">
              <button onClick={() => setMarcados(new Set(daLista.map((c) => c.id)))} className="text-info hover:underline">
                Marcar todos
              </button>
              <button onClick={() => setMarcados(new Set())} className="text-info hover:underline">
                Desmarcar
              </button>
            </span>
          </div>
          <ul className="max-h-80 space-y-0.5 overflow-y-auto rounded-card border border-line p-1.5">
            {daLista.length === 0 && <li className="px-2 py-1 text-sm text-muted">{listasMarcadas.size ? 'Nenhum card com esse filtro.' : 'Escolha uma ou mais listas.'}</li>}
            {daLista.map((c) => (
              <li key={c.id}>
                <label className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-sm hover:bg-surface-2">
                  <input type="checkbox" checked={marcados.has(c.id)} onChange={() => setMarcados((m) => alternar(m, c.id))} className="accent-[var(--c-accent)]" />
                  <span className="font-mono text-xs">{c.nome}</span>
                  {!ofertaId && <span className="text-xs text-muted">{oferta(c.oferta_id)?.codigo}</span>}
                  {c.veiculacoes.length > 0 && (
                    <span className="ml-auto text-[11px] text-muted">
                      {c.veiculacoes.map((v) => contas.find((ct) => ct.id === v.conta_id)?.apelido).join(' ')}
                    </span>
                  )}
                </label>
              </li>
            ))}
          </ul>
        </div>

        <div className="space-y-4">
          <div>
            <p className="mb-1.5 text-sm font-medium">Contas</p>
            <ul className="max-h-64 space-y-0.5 overflow-y-auto rounded-card border border-line p-1.5">
              {ativas.map((c) => (
                <li key={c.id}>
                  <label className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-sm hover:bg-surface-2">
                    <input type="checkbox" checked={contasMarcadas.has(c.id)} onChange={() => setContasMarcadas((m) => alternar(m, c.id))} className="accent-[var(--c-accent)]" />
                    <span className="rounded-full bg-info-soft px-2 py-0.5 font-mono text-xs font-semibold text-info">{c.apelido}</span>
                    <span className="truncate text-xs text-muted">{c.nome}</span>
                  </label>
                </li>
              ))}
            </ul>
          </div>
          <Campo rotulo="Status das veiculações novas">
            <select value={status} onChange={(e) => setStatus(e.target.value as StatusVeiculacao)} className={entrada}>
              {(['nao_subido', 'em_analise'] as const).map((s) => (
                <option key={s} value={s}>
                  {STATUS_VEICULACAO[s].icone} {STATUS_VEICULACAO[s].nome}
                </option>
              ))}
            </select>
          </Campo>
          <p className="text-xs text-muted">Depois de subir os ADs na Meta, use "Preencher IDs da Meta" para o app achar o ID de cada anúncio pelo nome.</p>
        </div>
      </div>
    </Modal>
  )
}

/** Roda o casamento pelo nome e mostra o resultado. */
export function PreencherIdsMeta({ ofertaId, onFechar, onFeito }: { ofertaId: string | null; onFechar: () => void; onFeito: () => void }) {
  const [r, setR] = useState<ResultadoCasar | null>(null)
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    casarAnunciosPeloNome(ofertaId).then(
      (res) => {
        setR(res)
        if (res.preenchidas) onFeito()
      },
      (e: Error) => setErro(e.message),
    )
  }, [ofertaId]) // eslint-disable-line react-hooks/exhaustive-deps

  const lista = (titulo: string, itens: string[], tom: 'atencao' | 'ruim') =>
    itens.length > 0 && (
      <details className="text-sm">
        <summary className={`cursor-pointer font-medium ${tom === 'ruim' ? 'text-bad' : 'text-warn'}`}>
          {titulo} ({itens.length})
        </summary>
        <ul className="mt-1 max-h-48 space-y-0.5 overflow-y-auto pl-4 text-xs text-muted">
          {itens.map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ul>
      </details>
    )

  return (
    <Modal titulo="Preencher IDs da Meta" onFechar={onFechar} largura="max-w-xl" rodape={<Botao onClick={onFechar} className="ml-auto">Fechar</Botao>}>
      {erro && <Aviso tom="ruim">{erro}</Aviso>}
      {!r && !erro && (
        <div className="space-y-2">
          <p className="text-sm text-muted">Buscando os anúncios de cada conta na Meta…</p>
          <Carregando linhas={3} altura="h-6" />
        </div>
      )}
      {r && (
        <div className="space-y-3">
          {r.pendentes === 0 ? (
            <Aviso tom="bom">Nenhuma veiculação sem ID: está tudo preenchido.</Aviso>
          ) : (
            <Aviso tom={r.preenchidas ? 'bom' : 'atencao'}>
              {r.preenchidas} de {r.pendentes} veiculação(ões) sem ID foram preenchidas.
            </Aviso>
          )}
          {lista('Não achei o anúncio na Meta', r.nao_achados, 'atencao')}
          {lista('Mais de um anúncio com o mesmo nome: escolha no card', r.duvidas, 'atencao')}
          {lista('Contas sem o ID da Meta (preencha em Ativos)', r.contas_sem_id, 'ruim')}
          {lista(
            'A Meta não respondeu',
            r.falhas.map((f) => `${f.conta}: ${f.erro}`),
            'ruim',
          )}
          <p className="text-xs text-muted">
            O app procura no nome do anúncio o padrão "ad12-h1-m2". Quem estava "Não subido" passa a ter o status do anúncio na Meta (rodando, em análise, pausado ou rejeitado).
          </p>
        </div>
      )}
    </Modal>
  )
}
