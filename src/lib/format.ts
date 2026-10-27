const FUSO = 'America/Sao_Paulo'

const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

/** Centavos (inteiro) → "R$ 1.234,56". */
export function formatarCentavos(centavos: number | bigint | null | undefined): string {
  if (centavos == null) return '—'
  return brl.format(Number(centavos) / 100)
}

/** Centavos → forma curta para cartões de destaque: "R$ 53,3 mil", "R$ 1,2 mi", "R$ 950,00". */
export function formatarCompacto(centavos: number | bigint | null | undefined): string {
  if (centavos == null) return '—'
  const v = Number(centavos) / 100
  const abs = Math.abs(v)
  const sinal = v < 0 ? '−' : ''
  const num = (x: number) => x.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
  if (abs >= 1_000_000) return `${sinal}R$ ${num(abs / 1_000_000)} mi`
  if (abs >= 1_000) return `${sinal}R$ ${num(abs / 1_000)} mil`
  return formatarCentavos(centavos)
}

/** Data UTC do banco → data em America/Sao_Paulo ("16/10/2026"). */
export function formatarData(iso: string | null | undefined): string {
  if (!iso) return '—'
  return new Intl.DateTimeFormat('pt-BR', { timeZone: FUSO, dateStyle: 'short' }).format(new Date(iso))
}

/** Data sem horário ("2026-09-15", coluna date) → "15/09/2026", sem conversão de fuso. */
export function formatarDiaIso(dia: string | null | undefined): string {
  if (!dia) return '—'
  const [a, m, d] = dia.slice(0, 10).split('-')
  return `${d}/${m}/${a}`
}

/** Dia já no calendário de Brasília ("2026-10-16") → "sex., 16/10". */
export function formatarDia(dia: string): string {
  const d = new Date(`${dia}T12:00:00Z`)
  const semana = new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC', weekday: 'short' }).format(d)
  const data = new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC', day: '2-digit', month: '2-digit' }).format(d)
  return `${semana} ${data}`
}

/** Hoje no calendário de Brasília, somando `dias` ("2026-10-16"). */
export function diaBrasilia(dias = 0): string {
  const hoje = new Intl.DateTimeFormat('en-CA', { timeZone: FUSO }).format(new Date())
  const d = new Date(`${hoje}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + dias)
  return d.toISOString().slice(0, 10)
}

/** Data e hora UTC do banco → "16/10/2026 14:30" em America/Sao_Paulo. */
export function formatarDataHora(iso: string | null | undefined): string {
  if (!iso) return '—'
  return new Intl.DateTimeFormat('pt-BR', { timeZone: FUSO, dateStyle: 'short', timeStyle: 'short' }).format(
    new Date(iso),
  )
}
