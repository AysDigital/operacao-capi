import { TituloPagina } from '../components/ui'

export function Placeholder({ titulo }: { titulo: string }) {
  return (
    <>
      <TituloPagina>{titulo}</TituloPagina>
      <p className="text-sm text-muted">Em construção.</p>
    </>
  )
}
