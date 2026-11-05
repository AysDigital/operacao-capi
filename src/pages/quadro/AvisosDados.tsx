import { useEffect, useState } from 'react'
import { Aviso } from '../../components/ds'
import { formatarDataHora } from '../../lib/format'
import { EVENTO_METRICAS, manterMetricasFrescas } from '../../lib/metricas'
import { buscarAlertas, type Alertas } from '../../lib/ranking'

/**
 * Faixas no topo de Quadros e do Ranking: vendas paradas (gasto nas últimas 24 h
 * sem venda registrada) e falha na última busca da Meta. Também mantém as
 * métricas da Meta frescas (no máximo uma busca por hora).
 */
export function AvisosDados() {
  const [alertas, setAlertas] = useState<Alertas | null>(null)
  const [erroBusca, setErroBusca] = useState<string | null>(null)

  useEffect(() => {
    let vivo = true
    const carregar = () => buscarAlertas().then((a) => vivo && setAlertas(a), (e: Error) => console.warn('Alertas:', e.message))
    carregar()
    manterMetricasFrescas().then((erro) => vivo && setErroBusca(erro))
    window.addEventListener(EVENTO_METRICAS, carregar)
    const t = setInterval(carregar, 10 * 60_000)
    return () => {
      vivo = false
      window.removeEventListener(EVENTO_METRICAS, carregar)
      clearInterval(t)
    }
  }, [])

  const faixas = []
  if (alertas?.semVendasDesde !== null && alertas?.semVendasDesde !== undefined) {
    faixas.push(
      <Aviso key="vendas" tom="atencao">
        {alertas.semVendasDesde
          ? `Nenhuma venda registrada desde ${formatarDataHora(alertas.semVendasDesde)}.`
          : 'Nenhuma venda registrada ainda.'}{' '}
        Confira o webhook da plataforma de vendas.
      </Aviso>,
    )
  }
  if (erroBusca) {
    faixas.push(
      <Aviso key="busca" tom="ruim" onFechar={() => setErroBusca(null)}>
        A busca de métricas na Meta falhou: {erroBusca}
      </Aviso>,
    )
  } else if (alertas?.falhasMeta) {
    faixas.push(
      <Aviso key="falhas" tom="ruim">
        A última busca de métricas na Meta ({formatarDataHora(alertas.falhasMeta.em)}) falhou em{' '}
        {alertas.falhasMeta.falhas.map((f) => `${f.conta} (${f.erro})`).join('; ')}.
      </Aviso>,
    )
  }

  return faixas.length ? <div className="mb-4 space-y-2">{faixas}</div> : null
}
