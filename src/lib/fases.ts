import { ops } from './supabase'

/**
 * Fases do manual de tráfego (etapa 13). Cada veiculação que já rodou tem:
 * dia (D1 = o dia em que começou a rodar), fase (Validação, Pré-escala ou Escala)
 * e, quando a validação fecha, o veredito pelo ROAS daqueles dias.
 * A conta fica no banco (ops.fase_veiculacao).
 */
export type Fase = 'validacao' | 'pre_escala' | 'escala'
export type Veredito = 'avanca' | 'monitora' | 'falhou'

export type FaseVeiculacao = {
  veiculacao_id: string
  card_id: string
  conta_id: string
  status: string
  dia: number
  fase: Fase
  veredito: Veredito | null
  roas_validacao: number | null
  gasto_validacao: number
  faturamento_validacao: number
  no_spend: boolean
}

export const NOME_FASE: Record<Fase, string> = { validacao: 'Validação', pre_escala: 'Pré-escala', escala: 'Escala' }

export const VEREDITOS: Record<Veredito, { nome: string; icone: string; cor: string }> = {
  avanca: { nome: 'Avança', icone: '✓', cor: 'bg-good-soft text-good' },
  monitora: { nome: 'Monitorar', icone: '◐', cor: 'bg-warn-soft text-warn' },
  falhou: { nome: 'Falhou', icone: '✕', cor: 'bg-bad-soft text-bad' },
}

export const roasTexto = (r: number | null) => (r === null ? '—' : `${Number(r).toLocaleString('pt-BR', { maximumFractionDigits: 2 })}x`)

/** Texto da pílula: "D2 · Validação" ou, depois da validação, "Avança 1,8x". */
export function textoFase(f: FaseVeiculacao) {
  if (f.veredito) return `${VEREDITOS[f.veredito].nome} ${roasTexto(f.roas_validacao)}`
  return `D${f.dia} · ${NOME_FASE[f.fase]}`
}

export const corFase = (f: FaseVeiculacao) => (f.veredito ? VEREDITOS[f.veredito].cor : 'bg-info-soft text-info')

/** Fases que o manual pede para não pausar. */
export const naoPausar = (f: FaseVeiculacao | undefined) => !!f && f.status === 'rodando' && (f.fase === 'validacao' || f.fase === 'pre_escala')

export async function buscarFases(ofertaId: string | null, cardId?: string): Promise<FaseVeiculacao[]> {
  const { data, error } = await ops().rpc('fase_veiculacao', { p_oferta: ofertaId, p_card: cardId ?? null })
  if (error) throw new Error(error.message)
  return ((data ?? []) as FaseVeiculacao[]).map((f) => ({
    ...f,
    roas_validacao: f.roas_validacao === null ? null : Number(f.roas_validacao),
    gasto_validacao: Number(f.gasto_validacao),
    faturamento_validacao: Number(f.faturamento_validacao),
  }))
}

/** Fases agrupadas por card (para o quadro). */
export async function fasesDosCards(ofertaId: string | null): Promise<Map<string, FaseVeiculacao[]>> {
  const r = new Map<string, FaseVeiculacao[]>()
  for (const f of await buscarFases(ofertaId)) r.set(f.card_id, [...(r.get(f.card_id) ?? []), f])
  return r
}

/** Contas No-Bid: só ativas e marcadas como secundárias. */
export async function mandarParaNoBid(cardId: string, contaId: string) {
  const { error } = await ops().rpc('mandar_para_nobid', { p_card: cardId, p_conta: contaId })
  return error
}
