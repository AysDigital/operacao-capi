import type { ReactNode } from 'react'
import { Dica, Selo } from '../../components/ds'
import {
  acessosDoAtivo,
  acessoValido,
  donaDe,
  infoStatus,
  nomeAtivo,
  nomeDe,
  ORIGENS,
  posseEAcesso,
  resumoPorTipo,
  STATUS_ATIVO,
  type Inventario,
  type Registro,
  type TipoAtivo,
  type TipoComStatus,
  type TipoTitular,
} from '../../lib/ativos'
import { diaBrasilia, formatarDiaIso } from '../../lib/format'
import { SITUACAO_AQUECIMENTO, situacaoDe } from '../../lib/contingencia'

/** Tipos de campo do formulário. */
export type TipoCampo = 'texto' | 'area' | 'data' | 'dinheiro' | 'idMeta' | 'opcoes' | 'sim_nao' | 'fornecedor' | 'cartao' | 'sigla' | 'moeda' | 'ultimos4' | 'dominio'

export type Campo = {
  chave: string
  rotulo: string
  tipo: TipoCampo
  obrigatorio?: boolean
  opcoes?: { valor: string; nome: string }[]
  placeholder?: string
  /** explicação curta, aberta na dica ao lado do rótulo */
  dica?: string
  /** ocupa só meia linha */
  meia?: boolean
}

const opcoesStatus = (t: TipoComStatus) =>
  Object.entries(STATUS_ATIVO[t]).map(([valor, s]) => ({ valor, nome: s.nome }))

const STATUS = (t: TipoComStatus): Campo => ({ chave: 'status', rotulo: 'Status', tipo: 'opcoes', opcoes: opcoesStatus(t), meia: true })
const OBS: Campo = { chave: 'observacoes', rotulo: 'Observações', tipo: 'area' }
const COMPRA: Campo[] = [
  { chave: 'fornecedor_id', rotulo: 'Fornecedor', tipo: 'fornecedor' },
  { chave: 'data_compra', rotulo: 'Data da compra', tipo: 'data', meia: true },
  { chave: 'custo', rotulo: 'Custo (R$)', tipo: 'dinheiro', meia: true, placeholder: '0,00' },
]

/** Campos de cada tipo. O status só aparece ao criar: depois ele muda pelo painel (vai para o histórico). */
export const CAMPOS: Record<TipoAtivo, Campo[]> = {
  perfil: [
    { chave: 'nome', rotulo: 'Nome', tipo: 'texto', obrigatorio: true },
    STATUS('perfil'),
    { chave: 'origem', rotulo: 'Origem', tipo: 'opcoes', opcoes: ORIGENS, meia: true },
    ...COMPRA,
    { chave: 'navegador', rotulo: 'Navegador antidetect', tipo: 'texto', meia: true, placeholder: 'AdsPower, Dolphin…' },
    { chave: 'perfil_navegador', rotulo: 'Nome do perfil no navegador', tipo: 'texto', meia: true },
    { chave: 'proxy', rotulo: 'Proxy', tipo: 'texto', dica: 'Só uma referência para achar o proxy (ex.: "Proxy BR 03"). Nada de usuário ou senha.' },
    {
      chave: 'item_senhas',
      rotulo: 'Item no gerenciador de senhas',
      tipo: 'texto',
      dica: 'Só o NOME do item no gerenciador de senhas. Senha, código 2FA e cookies nunca entram aqui.',
    },
    OBS,
  ],
  bm: [
    { chave: 'nome', rotulo: 'Nome', tipo: 'texto', obrigatorio: true },
    { chave: 'meta_id', rotulo: 'ID na Meta', tipo: 'idMeta', meia: true },
    STATUS('bm'),
    { chave: 'verificada', rotulo: 'Verificada', tipo: 'sim_nao', meia: true },
    ...COMPRA,
    OBS,
  ],
  conta: [
    { chave: 'apelido', rotulo: 'Apelido', tipo: 'sigla', obrigatorio: true, meia: true, placeholder: 'AC01LUC', dica: 'AC + número da conta + 3 letras da BM (ex.: Conta 01 da BM 01 - Luciano → AC01LUC). É o que aparece nas pílulas dos cards.' },
    { chave: 'nome', rotulo: 'Nome', tipo: 'texto', obrigatorio: true, meia: true, placeholder: 'Conta 01' },
    { chave: 'meta_ad_account_id', rotulo: 'ID da conta na Meta', tipo: 'idMeta', placeholder: 'act_123456789012345' },
    STATUS('conta'),
    { chave: 'data_criacao', rotulo: 'Data de criação', tipo: 'data', meia: true },
    { chave: 'moeda', rotulo: 'Moeda', tipo: 'moeda', meia: true, placeholder: 'USD' },
    { chave: 'limite_gasto', rotulo: 'Limite de gasto', tipo: 'dinheiro', meia: true, placeholder: '0,00' },
    { chave: 'cartao_id', rotulo: 'Cartão', tipo: 'cartao' },
  ],
  pagina: [
    { chave: 'nome', rotulo: 'Nome', tipo: 'texto', obrigatorio: true },
    { chave: 'meta_id', rotulo: 'ID na Meta', tipo: 'idMeta', meia: true },
    STATUS('pagina'),
    OBS,
  ],
  pixel: [
    { chave: 'nome', rotulo: 'Nome', tipo: 'texto', obrigatorio: true },
    { chave: 'meta_id', rotulo: 'ID na Meta', tipo: 'idMeta', meia: true },
    STATUS('pixel'),
    OBS,
  ],
  dominio: [
    { chave: 'dominio', rotulo: 'Domínio', tipo: 'dominio', obrigatorio: true, placeholder: 'minhaoferta.com' },
    { chave: 'registrador', rotulo: 'Registrador', tipo: 'texto', meia: true, placeholder: 'Hostinger, GoDaddy…' },
    { chave: 'vencimento', rotulo: 'Vencimento', tipo: 'data', meia: true },
    OBS,
  ],
  cartao: [
    { chave: 'apelido', rotulo: 'Apelido', tipo: 'texto', obrigatorio: true, placeholder: 'Nubank PJ' },
    {
      chave: 'ultimos4',
      rotulo: 'Últimos 4 dígitos',
      tipo: 'ultimos4',
      obrigatorio: true,
      meia: true,
      placeholder: '1234',
      dica: 'Só os 4 últimos. Número completo, validade e CVV nunca entram no sistema.',
    },
    { chave: 'titular', rotulo: 'Titular', tipo: 'opcoes', meia: true, opcoes: [{ valor: 'PJ', nome: 'PJ' }, { valor: 'PF', nome: 'PF' }] },
    { chave: 'banco', rotulo: 'Banco', tipo: 'texto' },
  ],
  fornecedor: [
    { chave: 'nome', rotulo: 'Nome', tipo: 'texto', obrigatorio: true },
    { chave: 'contato', rotulo: 'Contato', tipo: 'texto', placeholder: 'Telegram, WhatsApp, site…' },
    { chave: 'vende', rotulo: 'O que vende', tipo: 'texto', placeholder: 'Perfis, BMs…' },
    OBS,
  ],
}

/** Status de qualquer ativo: ícone, texto e cor. */
export function SeloStatusAtivo({ tipo, status }: { tipo: TipoAtivo; status: unknown }) {
  const s = infoStatus(tipo, status as string)
  if (!s) return null
  return (
    <Selo tom={s.tom}>
      <span aria-hidden>{s.icone}</span>
      {s.nome}
    </Selo>
  )
}

/** Situação na Contingência (perfis, BMs, contas e páginas). */
export function SeloAquecimento({ r, soPendente }: { r: Registro; soPendente?: boolean }) {
  const s = situacaoDe(r)
  if (soPendente && s === 'pronto') return null
  const info = SITUACAO_AQUECIMENTO[s]
  return (
    <Selo tom={info.tom}>
      <span aria-hidden>{info.icone}</span>
      {info.nome}
    </Selo>
  )
}

export const valorTexto = (v: unknown) => (v == null || v === '' ? '—' : String(v))
export const dinheiro = (v: unknown, moeda = 'BRL') =>
  v == null ? '—' : Number(v).toLocaleString('pt-BR', { style: 'currency', currency: moeda.length === 3 ? moeda : 'BRL' })

/** Quantos dias faltam para uma data (negativo = já passou). */
export function diasAte(dia: string) {
  return Math.round((new Date(`${dia}T12:00:00Z`).getTime() - new Date(`${diaBrasilia()}T12:00:00Z`).getTime()) / 86_400_000)
}

export function SeloVencimento({ dia }: { dia: unknown }) {
  if (!dia) return <span className="text-muted">—</span>
  const d = diasAte(String(dia))
  const data = formatarDiaIso(String(dia))
  if (d < 0)
    return (
      <Selo tom="ruim">
        <span aria-hidden>!</span>Venceu em {data}
      </Selo>
    )
  if (d <= 30)
    return (
      <Selo tom="atencao">
        <span aria-hidden>◐</span>
        {data} ({d === 0 ? 'hoje' : `${d} dia${d === 1 ? '' : 's'}`})
      </Selo>
    )
  return <span className="tabular-nums">{data}</span>
}

/** Valor de um campo para leitura (painel). */
export function mostrarCampo(tipo: TipoAtivo, c: Campo, r: Registro, inv: Inventario): ReactNode {
  const v = r[c.chave]
  switch (c.tipo) {
    case 'data':
      return c.chave === 'vencimento' ? <SeloVencimento dia={v} /> : formatarDiaIso(v as string)
    case 'dinheiro':
      return dinheiro(v, c.chave === 'limite_gasto' ? String(r.moeda ?? 'BRL') : 'BRL')
    case 'sim_nao':
      return v ? '✓ Sim' : 'Não'
    case 'opcoes':
      return c.chave === 'status' ? <SeloStatusAtivo tipo={tipo} status={v} /> : (c.opcoes?.find((o) => o.valor === v)?.nome ?? valorTexto(v))
    case 'fornecedor':
      return v ? nomeAtivo(inv, 'fornecedor', v as string) : '—'
    case 'cartao':
      return v ? nomeAtivo(inv, 'cartao', v as string) : '—'
    default:
      return valorTexto(v)
  }
}

/** Coluna de tabela. */
export type Coluna = { rotulo: ReactNode; valor: (r: Registro) => ReactNode; classe?: string }

/** "Dona" e quantos compartilhamentos valendo. */
function ColunaAcesso({ inv, tipo, r }: { inv: Inventario; tipo: TipoAtivo; r: Registro }) {
  const dona = donaDe(inv, tipo, r.id)
  const outros = acessosDoAtivo(inv, tipo, r.id).filter((a) => a.ativo && a.papel !== 'dona').length
  const validos = acessosDoAtivo(inv, tipo, r.id).filter((a) => acessoValido(inv, a)).length
  return (
    <span className="whitespace-nowrap">
      {dona ? nomeAtivo(inv, dona.titular_tipo, dona.titular_id) : <span className="text-muted">Sem dona</span>}
      {outros > 0 && <span className="text-muted"> +{outros}</span>}
      {validos === 1 && (
        <span className="ml-1.5 text-warn" title="Depende de uma única BM ou perfil">
          ◐
        </span>
      )}
    </span>
  )
}

const ofertasDe = (inv: Inventario, campo: 'pagina_id' | 'pixel_id' | 'dominio_id', id: string) =>
  inv.ofertasAtivos.filter((o) => o[campo] === id).length

const num = 'text-right tabular-nums'

export function colunas(tipo: TipoAtivo, inv: Inventario): Coluna[] {
  const nome: Coluna = { rotulo: 'Nome', valor: (r) => <span className="font-medium">{nomeDe(tipo, r)}</span> }
  const status: Coluna = { rotulo: 'Status', valor: (r) => <SeloStatusAtivo tipo={tipo} status={r.status} /> }
  const idMeta = (chave: string): Coluna => ({ rotulo: 'ID na Meta', valor: (r) => <span className="font-mono text-xs tabular-nums">{valorTexto(r[chave])}</span> })
  const acesso: Coluna = {
    rotulo: 'Dona',
    valor: (r) => <ColunaAcesso inv={inv} tipo={tipo} r={r} />,
  }
  const quem = tipo === 'bm' ? 'esta BM' : 'este perfil'
  const daTitular = (papel: 'dona' | 'compartilhado'): Coluna => ({
    rotulo: (
      <Dica
        lado="direita"
        conteudo={
          papel === 'dona'
            ? `Tudo o que ${quem} tem como dona${tipo === 'perfil' ? ', somando o que as BMs dele possuem (contas, páginas, pixels)' : ''}. Se cair, esses ativos só continuam acessíveis se estiverem compartilhados com outra BM ou perfil.`
            : `Ativos que ${quem} alcança sem ser a dona: foram compartilhados com ${tipo === 'perfil' ? 'ele ou com as BMs dele' : 'ela'}. É o que funciona como reserva quando a dona deles cai.`
        }
      >
        {papel === 'dona' ? 'Possui' : 'Acessa'}
      </Dica>
    ),
    classe: num,
    valor: (r) => {
      const pa = posseEAcesso(inv, tipo as TipoTitular, r.id)
      const itens = papel === 'dona' ? pa.possui : pa.acessa
      return itens.length ? <span title={resumoPorTipo(itens)}>{itens.length}</span> : '—'
    },
  })
  const aquecimento: Coluna = {
    rotulo: (
      <Dica lado="direita" conteudo="Situação na Contingência: Aquecendo (no quadro de aquecimento), Pronto (checklist completo ou marcado como pronto) ou A classificar.">
        Aquecimento
      </Dica>
    ),
    valor: (r) => <SeloAquecimento r={r} />,
  }
  const fornecedor: Coluna = {
    rotulo: 'Fornecedor',
    valor: (r) =>
      r.fornecedor_id ? nomeAtivo(inv, 'fornecedor', r.fornecedor_id as string) : r.origem === 'proprio' ? <span className="text-muted">Pessoal</span> : '—',
  }

  switch (tipo) {
    case 'perfil':
      return [
        nome,
        status,
        aquecimento,
        { rotulo: 'Origem', valor: (r) => ORIGENS.find((o) => o.valor === r.origem)?.nome ?? '—' },
        fornecedor,
        daTitular('dona'),
        daTitular('compartilhado'),
      ]
    case 'bm':
      return [
        nome,
        status,
        aquecimento,
        { rotulo: 'Verificada', valor: (r) => (r.verificada ? '✓ Sim' : <span className="text-muted">Não</span>) },
        idMeta('meta_id'),
        acesso,
        daTitular('dona'),
        daTitular('compartilhado'),
      ]
    case 'conta':
      return [
        {
          rotulo: 'Apelido',
          valor: (r) => <span className="rounded-full bg-info-soft px-2 py-0.5 font-mono text-xs font-semibold text-info">{String(r.apelido)}</span>,
        },
        { rotulo: 'Nome', valor: (r) => <span className="font-medium">{String(r.nome)}</span> },
        status,
        aquecimento,
        acesso,
        idMeta('meta_ad_account_id'),
        { rotulo: 'Limite', classe: num, valor: (r) => (r.limite_gasto == null ? '—' : dinheiro(r.limite_gasto, String(r.moeda ?? 'BRL'))) },
        { rotulo: 'Cartão', valor: (r) => (r.cartao_id ? nomeAtivo(inv, 'cartao', r.cartao_id as string) : '—') },
      ]
    case 'pagina':
      return [nome, status, aquecimento, idMeta('meta_id'), acesso, { rotulo: 'Ofertas', classe: num, valor: (r) => ofertasDe(inv, 'pagina_id', r.id) || '—' }]
    case 'pixel':
      return [nome, status, idMeta('meta_id'), acesso, { rotulo: 'Ofertas', classe: num, valor: (r) => ofertasDe(inv, 'pixel_id', r.id) || '—' }]
    case 'dominio':
      return [
        nome,
        { rotulo: 'Registrador', valor: (r) => valorTexto(r.registrador) },
        { rotulo: 'Vencimento', valor: (r) => <SeloVencimento dia={r.vencimento} /> },
        { rotulo: 'Ofertas', classe: num, valor: (r) => ofertasDe(inv, 'dominio_id', r.id) || '—' },
      ]
    case 'cartao':
      return [
        nome,
        { rotulo: 'Banco', valor: (r) => valorTexto(r.banco) },
        { rotulo: 'Titular', valor: (r) => valorTexto(r.titular) },
        { rotulo: 'Contas', classe: num, valor: (r) => inv.conta.filter((c) => c.cartao_id === r.id).length || '—' },
      ]
    case 'fornecedor':
      return [
        nome,
        { rotulo: 'Contato', valor: (r) => valorTexto(r.contato) },
        { rotulo: 'O que vende', valor: (r) => valorTexto(r.vende) },
        { rotulo: 'Perfis', classe: num, valor: (r) => inv.perfil.filter((p) => p.fornecedor_id === r.id).length || '—' },
        { rotulo: 'BMs', classe: num, valor: (r) => inv.bm.filter((b) => b.fornecedor_id === r.id).length || '—' },
      ]
  }
}

/** Texto usado na busca da tabela. */
export function textoBusca(tipo: TipoAtivo, r: Registro, inv: Inventario) {
  const partes = CAMPOS[tipo].map((c) => mostrarTexto(c, r, inv))
  return [nomeDe(tipo, r), ...partes].join(' ').toLowerCase()
}
function mostrarTexto(c: Campo, r: Registro, inv: Inventario) {
  const v = r[c.chave]
  if (v == null) return ''
  if (c.tipo === 'fornecedor') return nomeAtivo(inv, 'fornecedor', v as string)
  if (c.tipo === 'cartao') return nomeAtivo(inv, 'cartao', v as string)
  if (c.tipo === 'opcoes') return c.opcoes?.find((o) => o.valor === v)?.nome ?? String(v)
  return String(v)
}

