import { useCallback, useEffect, useState } from 'react'
import type { PostgrestError } from '@supabase/supabase-js'

/** Carrega uma lista do banco. `dados` fica null enquanto carrega. */
export function useCarregar<T>(buscar: () => PromiseLike<{ data: T[] | null; error: PostgrestError | null }>) {
  const [dados, setDados] = useState<T[] | null>(null)
  const [erro, setErro] = useState<string | null>(null)

  const recarregar = useCallback(async () => {
    const { data, error } = await buscar()
    if (error) setErro(error.message)
    else {
      setErro(null)
      setDados(data ?? [])
    }
    // a busca é fixa por tela
  }, [])

  useEffect(() => {
    recarregar()
  }, [recarregar])

  return { dados, erro, recarregar }
}
