import { useState, type FormEvent } from 'react'
import { Aviso, Dica, Interruptor, Modal } from '../../components/ds'
import { useToast } from '../../components/Toast'
import { Botao, BotaoExcluir, Campo as CampoForm, entrada } from '../../components/ui'
import { ligacoes, nomeDe, TABELA, TIPOS, temStatus, type Inventario, type Registro, type TipoAtivo } from '../../lib/ativos'
import { lerNumero, mensagemErro, normalizarIdConta, numeroParaTexto, soSigla } from '../../lib/cadastros'
import { ops } from '../../lib/supabase'
import { CAMPOS, type Campo } from './campos'

const ERROS: Record<string, string> = {
  contas_anuncio_apelido_key: 'Já existe uma conta com esse apelido.',
  contas_anuncio_meta_ad_account_id_key: 'Essa conta da Meta já está cadastrada.',
  bms_meta_id_key: 'Já existe uma BM com esse ID.',
  paginas_meta_id_key: 'Já existe uma página com esse ID.',
  pixels_meta_id_key: 'Já existe um pixel com esse ID.',
  dominios_dominio_key: 'Esse domínio já está cadastrado.',
}

type Valores = Record<string, string | boolean>

function valorInicial(c: Campo, r: Registro | null): string | boolean {
  const v = r?.[c.chave]
  if (c.tipo === 'sim_nao') return Boolean(v)
  if (c.tipo === 'dinheiro') return v == null ? '' : numeroParaTexto(Number(v))
  if (v == null) {
    if (c.chave === 'status') return c.opcoes?.[0]?.valor ?? ''
    if (c.chave === 'titular') return 'PJ'
    return ''
  }
  return String(v)
}

/** Limpa o domínio: sem "https://", sem caminho, em minúsculas. */
const limparDominio = (s: string) =>
  s
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/\/.*$/, '')

/** Confere e converte o que foi digitado. Devolve os campos para o banco ou os erros. */
function converter(campos: Campo[], v: Valores) {
  const saida: Record<string, unknown> = {}
  const erros: Record<string, string> = {}
  for (const c of campos) {
    const bruto = v[c.chave]
    if (c.tipo === 'sim_nao') {
      saida[c.chave] = Boolean(bruto)
      continue
    }
    let s = String(bruto ?? '').trim()
    if (c.obrigatorio && !s) {
      erros[c.chave] = `Informe ${c.rotulo.toLowerCase()}.`
      continue
    }
    switch (c.tipo) {
      case 'dinheiro': {
        const n = lerNumero(s)
        if (Number.isNaN(n)) erros[c.chave] = 'Use só números (ex.: 150,00).'
        saida[c.chave] = n
        continue
      }
      case 'idMeta':
        s = normalizarIdConta(s)
        if (s && !/^\d+$/.test(s)) erros[c.chave] = 'Use só os números do ID.'
        break
      case 'ultimos4':
        if (!/^\d{4}$/.test(s)) erros[c.chave] = 'Exatamente 4 números.'
        break
      case 'moeda':
        s = s.toUpperCase()
        if (s && !/^[A-Z]{3}$/.test(s)) erros[c.chave] = 'Três letras (USD, BRL, EUR).'
        break
      case 'dominio':
        s = limparDominio(s)
        if (s && !/^[a-z0-9.-]+\.[a-z]{2,}$/.test(s)) erros[c.chave] = 'Escreva só o domínio (ex.: minhaoferta.com).'
        break
    }
    saida[c.chave] = s || null
  }
  return { saida, erros }
}

export function ModalAtivo({
  tipo,
  registro,
  inv,
  onFechar,
  onSalvo,
}: {
  tipo: TipoAtivo
  registro: Registro | null
  inv: Inventario
  onFechar: () => void
  /** id do ativo criado ou salvo; null se foi excluído */
  onSalvo: (id: string | null) => void
}) {
  const toast = useToast()
  // ao editar, o status muda pelo painel (vai para o histórico com motivo e data)
  const campos = CAMPOS[tipo].filter((c) => !(registro && c.chave === 'status'))
  const [v, setV] = useState<Valores>(() => Object.fromEntries(campos.map((c) => [c.chave, valorInicial(c, registro)])))
  const [tentou, setTentou] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [excluindo, setExcluindo] = useState(false)
  const { saida, erros } = converter(campos, v)
  const t = TIPOS[tipo]
  const presas = registro ? ligacoes(inv, tipo, registro) : []

  async function salvar(e: FormEvent) {
    e.preventDefault()
    setTentou(true)
    if (Object.keys(erros).length) return
    setSalvando(true)
    const tabela = ops().from(TABELA[tipo])
    const { data, error } = registro
      ? await tabela.update(saida).eq('id', registro.id).select('id').single()
      : await tabela.insert(saida).select('id').single()
    setSalvando(false)
    if (error) return toast('ruim', mensagemErro(error, ERROS))
    toast('bom', registro ? 'Salvo.' : `${t.um} cadastrad${t.nova ? 'a' : 'o'}.`)
    onSalvo((data as { id: string }).id)
  }

  async function excluir() {
    if (!registro) return
    setSalvando(true)
    const { error } = await ops().from(TABELA[tipo]).delete().eq('id', registro.id)
    setSalvando(false)
    if (error) {
      toast('ruim', error.code === '23503' ? `Ainda há ligações com este ${t.um.toLowerCase()}. Mude o status em vez de excluir.` : mensagemErro(error))
      return
    }
    toast('bom', 'Excluído.')
    onSalvo(null)
  }

  const mudar = (chave: string, valor: string | boolean) => setV((x) => ({ ...x, [chave]: valor }))

  return (
    <Modal
      titulo={registro ? `Editar ${nomeDe(tipo, registro)}` : `${t.nova ? 'Nova' : 'Novo'} ${t.um.toLowerCase()}`}
      onFechar={onFechar}
      rodape={
        <>
          {registro && !excluindo && (
            <BotaoExcluir onClick={() => setExcluindo(true)} disabled={salvando}>
              Excluir
            </BotaoExcluir>
          )}
          <Botao variante="secundario" onClick={onFechar} className="ml-auto">
            Cancelar
          </Botao>
          <Botao type="submit" form="form-ativo" disabled={salvando}>
            {salvando ? 'Salvando…' : 'Salvar'}
          </Botao>
        </>
      }
    >
      <form id="form-ativo" onSubmit={salvar} className="grid grid-cols-2 gap-x-3 gap-y-4">
        {campos.map((c) => (
          <div key={c.chave} className={c.meia ? 'col-span-2 sm:col-span-1' : 'col-span-2'}>
            <CampoEntrada campo={c} valor={v[c.chave]} onMudar={(x) => mudar(c.chave, x)} erro={tentou ? erros[c.chave] : undefined} inv={inv} />
          </div>
        ))}

        {excluindo && (
          <div className="col-span-2">
            {presas.length > 0 ? (
              <Aviso tom="ruim" onFechar={() => setExcluindo(false)}>
                Não dá para excluir: {presas.join(', ')}.{' '}
                {temStatus(tipo) ? 'Mude o status (ex.: desativada, morto) para guardar o histórico.' : 'Remova as ligações antes.'}
              </Aviso>
            ) : (
              <Aviso
                tom="ruim"
                acao={
                  <Botao onClick={excluir} disabled={salvando} className="shrink-0">
                    Confirmar exclusão
                  </Botao>
                }
                onFechar={() => setExcluindo(false)}
              >
                Excluir {registro ? nomeDe(tipo, registro) : ''}? Isso não pode ser desfeito.
              </Aviso>
            )}
          </div>
        )}
      </form>
    </Modal>
  )
}

function CampoEntrada({
  campo: c,
  valor,
  onMudar,
  erro,
  inv,
}: {
  campo: Campo
  valor: string | boolean
  onMudar: (v: string | boolean) => void
  erro?: string
  inv: Inventario
}) {
  const rotulo = c.dica ? (
    <Dica conteudo={c.dica} lado="esquerda">
      {c.rotulo}
    </Dica>
  ) : (
    c.rotulo
  )
  if (c.tipo === 'sim_nao')
    return (
      <div className="text-sm font-medium">
        {rotulo}
        <div className="mt-2.5">
          <Interruptor ligado={Boolean(valor)} onMudar={onMudar} textoLigado="Sim" textoDesligado="Não" />
        </div>
      </div>
    )

  const s = String(valor ?? '')
  let controle
  if (c.tipo === 'area') {
    controle = <textarea value={s} onChange={(e) => onMudar(e.target.value)} rows={3} className={`${entrada} resize-y`} />
  } else if (c.tipo === 'opcoes' || c.tipo === 'fornecedor' || c.tipo === 'cartao') {
    const opcoes =
      c.tipo === 'opcoes'
        ? (c.opcoes ?? [])
        : (c.tipo === 'fornecedor' ? inv.fornecedor : inv.cartao).map((r) => ({ valor: r.id, nome: nomeDe(c.tipo as TipoAtivo, r) }))
    controle = (
      <select value={s} onChange={(e) => onMudar(e.target.value)} className={entrada}>
        {(c.tipo !== 'opcoes' || !c.obrigatorio) && c.chave !== 'status' && c.chave !== 'titular' && <option value="">—</option>}
        {opcoes.map((o) => (
          <option key={o.valor} value={o.valor}>
            {o.nome}
          </option>
        ))}
      </select>
    )
  } else {
    const mono = ['idMeta', 'sigla', 'ultimos4', 'moeda'].includes(c.tipo)
    controle = (
      <input
        type={c.tipo === 'data' ? 'date' : 'text'}
        value={s}
        onChange={(e) => {
          const x = e.target.value
          onMudar(
            c.tipo === 'sigla' ? soSigla(x, 8) : c.tipo === 'ultimos4' ? x.replace(/\D/g, '').slice(0, 4) : c.tipo === 'moeda' ? x.toUpperCase().slice(0, 3) : x,
          )
        }}
        onBlur={c.tipo === 'idMeta' ? () => onMudar(normalizarIdConta(s)) : undefined}
        placeholder={c.placeholder}
        inputMode={['idMeta', 'ultimos4', 'dinheiro'].includes(c.tipo) ? 'decimal' : undefined}
        autoComplete="off"
        className={`${entrada} ${mono ? 'font-mono' : ''}`}
      />
    )
  }
  return (
    <CampoForm rotulo={rotulo} erro={erro}>
      {controle}
    </CampoForm>
  )
}
