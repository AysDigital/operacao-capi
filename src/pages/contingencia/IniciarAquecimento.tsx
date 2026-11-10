import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { Aviso, Modal } from '../../components/ds'
import { useToast } from '../../components/Toast'
import { Botao, Campo, entrada } from '../../components/ui'
import { caido, nomeDe, type Inventario } from '../../lib/ativos'
import { mensagemErro } from '../../lib/cadastros'
import { buscarRotinas, NOME_TIPO, TIPOS_AQUECIVEIS, type Rotina, type TipoAquecivel } from '../../lib/contingencia'
import { diaBrasilia } from '../../lib/format'
import { ops } from '../../lib/supabase'

/**
 * Iniciar um aquecimento: escolher o ativo (se não veio pronto), a rotina e a data de início.
 * Usado na Contingência e no painel do ativo em Ativos.
 */
export function IniciarAquecimento({
  inv,
  tipoInicial,
  ativoInicial,
  emAndamento,
  onFechar,
  onIniciado,
}: {
  inv: Inventario
  tipoInicial?: TipoAquecivel
  ativoInicial?: string
  /** "tipo:id" dos ativos que já têm aquecimento em andamento */
  emAndamento: Set<string>
  onFechar: () => void
  onIniciado: (id: string) => void
}) {
  const toast = useToast()
  const [rotinas, setRotinas] = useState<Rotina[] | null>(null)
  const [tipo, setTipo] = useState<TipoAquecivel>(tipoInicial ?? 'perfil')
  const [ativo, setAtivo] = useState(ativoInicial ?? '')
  const [rotina, setRotina] = useState('')
  const [inicio, setInicio] = useState(diaBrasilia())
  const [salvando, setSalvando] = useState(false)
  const fixo = Boolean(ativoInicial)

  useEffect(() => {
    buscarRotinas().then(
      (r) => setRotinas(r.rotinas.filter((x) => x.ativa)),
      () => setRotinas([]),
    )
  }, [])

  const daVez = (rotinas ?? []).filter((r) => r.tipo === tipo)
  useEffect(() => {
    if (!daVez.some((r) => r.id === rotina)) setRotina(daVez[0]?.id ?? '')
  }, [tipo, rotinas]) // eslint-disable-line react-hooks/exhaustive-deps

  const opcoes = inv[tipo]
    .filter((r) => !caido(tipo, r.status as string) && !emAndamento.has(`${tipo}:${r.id}`))
    .sort((a, b) => nomeDe(tipo, a).localeCompare(nomeDe(tipo, b), 'pt-BR', { numeric: true }))

  async function iniciar(e: FormEvent) {
    e.preventDefault()
    if (!ativo) return toast('ruim', 'Escolha o ativo.')
    if (!rotina) return toast('ruim', 'Escolha a rotina.')
    setSalvando(true)
    const { data, error } = await ops().rpc('iniciar_aquecimento', { p_tipo: tipo, p_id: ativo, p_rotina: rotina, p_inicio: inicio || null })
    setSalvando(false)
    if (error) return toast('ruim', mensagemErro(error, { aquecimentos_um_em_andamento: 'Este ativo já tem um aquecimento em andamento.' }))
    toast('bom', 'Aquecimento iniciado.')
    onIniciado(data as string)
  }

  const nomeFixo = fixo ? nomeDe(tipo, inv[tipo].find((r) => r.id === ativoInicial)) : ''

  return (
    <Modal
      titulo={fixo ? `Iniciar aquecimento: ${nomeFixo}` : 'Iniciar aquecimento'}
      onFechar={onFechar}
      rodape={
        <>
          <Botao variante="secundario" onClick={onFechar} className="ml-auto">
            Cancelar
          </Botao>
          <Botao type="submit" form="form-iniciar" disabled={salvando || !daVez.length}>
            {salvando ? 'Iniciando…' : 'Iniciar'}
          </Botao>
        </>
      }
    >
      <form id="form-iniciar" onSubmit={iniciar} className="space-y-4">
        {fixo && emAndamento.has(`${tipo}:${ativoInicial}`) && <Aviso tom="atencao">Este ativo já tem um aquecimento em andamento.</Aviso>}
        {!fixo && (
          <div className="grid gap-4 sm:grid-cols-[10rem_1fr]">
            <Campo rotulo="Tipo">
              <select
                value={tipo}
                onChange={(e) => {
                  setTipo(e.target.value as TipoAquecivel)
                  setAtivo('')
                }}
                className={entrada}
              >
                {TIPOS_AQUECIVEIS.map((t) => (
                  <option key={t} value={t}>
                    {NOME_TIPO[t].um}
                  </option>
                ))}
              </select>
            </Campo>
            <Campo rotulo={NOME_TIPO[tipo].um}>
              <select value={ativo} onChange={(e) => setAtivo(e.target.value)} className={entrada}>
                <option value="">Escolha…</option>
                {opcoes.map((r) => (
                  <option key={r.id} value={r.id}>
                    {nomeDe(tipo, r)}
                  </option>
                ))}
              </select>
            </Campo>
          </div>
        )}
        {rotinas && !daVez.length ? (
          <Aviso tom="atencao">
            Nenhuma rotina ativa para {NOME_TIPO[tipo].varios.toLowerCase()}.{' '}
            <Link to="/contingencia?aba=rotinas" className="font-medium underline" onClick={onFechar}>
              Criar uma rotina
            </Link>
          </Aviso>
        ) : (
          <div className="grid gap-4 sm:grid-cols-[1fr_11rem]">
            <Campo rotulo="Rotina">
              <select value={rotina} onChange={(e) => setRotina(e.target.value)} className={entrada} disabled={!rotinas}>
                {daVez.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.nome} ({r.duracao_dias} dias)
                  </option>
                ))}
              </select>
            </Campo>
            <Campo rotulo="Início">
              <input type="date" value={inicio} onChange={(e) => setInicio(e.target.value)} className={entrada} />
            </Campo>
          </div>
        )}
      </form>
    </Modal>
  )
}
