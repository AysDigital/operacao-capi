import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

/** Falso quando o .env.local ainda não foi preenchido. */
export const supabaseConfigurado = Boolean(url && anonKey)

export const supabase = createClient(url || 'http://localhost', anonKey || 'chave-ausente')

/**
 * Acesso às tabelas e funções da operação.
 * Sempre use `ops()` — nunca `supabase.from(...)`, que aponta para o schema public do dashboard.
 */
export const ops = () => supabase.schema('ops')
