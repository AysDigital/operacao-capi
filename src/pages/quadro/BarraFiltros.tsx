import { Dica } from '../../components/ds'
import type { Etiqueta } from '../../lib/cadastros'
import { STATUS_VEICULACAO, temFiltro, TIPOS, type ContaQuadro, type Filtros, type StatusVeiculacao, type TipoCard } from '../../lib/quadro'

const caixa = 'rounded-control border border-line bg-surface px-2.5 py-1.5 text-sm outline-none focus:border-muted'

const VAZIO: Filtros = { busca: '', etiqueta: '', tipo: '', conta: '', status: '', vencedores: false, arquivados: false }

export function BarraFiltros({
  filtros,
  onFiltros,
  etiquetas,
  contas,
  visiveis,
  aoVivo,
  onArquivados,
}: {
  filtros: Filtros
  onFiltros: (f: Filtros) => void
  etiquetas: Etiqueta[]
  contas: ContaQuadro[]
  visiveis: number | null
  aoVivo: boolean
  onArquivados: () => void
}) {
  const mudar = <K extends keyof Filtros>(k: K, v: Filtros[K]) => onFiltros({ ...filtros, [k]: v })
  const destaque = (ativo: unknown) => (ativo ? 'border-accent text-accent-strong' : '')

  return (
    <div className="mb-4 flex flex-wrap items-center gap-2">
      <input
        type="search"
        value={filtros.busca}
        onChange={(e) => mudar('busca', e.target.value)}
        placeholder="Buscar por nome"
        aria-label="Buscar por nome"
        className={`${caixa} w-44`}
      />
      <select value={filtros.etiqueta} onChange={(e) => mudar('etiqueta', e.target.value)} aria-label="Etiqueta" className={`${caixa} ${destaque(filtros.etiqueta)}`}>
        <option value="">Etiqueta</option>
        {etiquetas.map((e) => (
          <option key={e.id} value={e.id}>
            {e.nome}
          </option>
        ))}
      </select>
      <select value={filtros.tipo} onChange={(e) => mudar('tipo', e.target.value as TipoCard | '')} aria-label="Tipo" className={`${caixa} ${destaque(filtros.tipo)}`}>
        <option value="">Tipo</option>
        {TIPOS.map((t) => (
          <option key={t.valor} value={t.valor}>
            {t.nome}
          </option>
        ))}
      </select>
      <div className="flex items-center gap-1">
        <select
          value={filtros.status}
          onChange={(e) => mudar('status', e.target.value as StatusVeiculacao | '')}
          aria-label="Status da veiculação"
          className={`${caixa} ${destaque(filtros.status)}`}
        >
          <option value="">Veiculação</option>
          {Object.entries(STATUS_VEICULACAO).map(([valor, s]) => (
            <option key={valor} value={valor}>
              {s.nome}
            </option>
          ))}
        </select>
        <span className="text-sm text-muted">na</span>
        <select value={filtros.conta} onChange={(e) => mudar('conta', e.target.value)} aria-label="Conta de anúncio" className={`${caixa} ${destaque(filtros.conta)}`}>
          <option value="">qualquer conta</option>
          {contas.map((c) => (
            <option key={c.id} value={c.id}>
              {c.apelido}
              {c.ativa ? '' : ' (inativa)'}
            </option>
          ))}
        </select>
      </div>
      <label className="flex items-center gap-1.5 text-sm">
        <input type="checkbox" checked={filtros.vencedores} onChange={(e) => mudar('vencedores', e.target.checked)} className="accent-[var(--c-accent)]" />
        Só vencedores
      </label>
      <label className="flex items-center gap-1.5 text-sm">
        <input type="checkbox" checked={filtros.arquivados} onChange={(e) => mudar('arquivados', e.target.checked)} className="accent-[var(--c-accent)]" />
        Mostrar arquivados
      </label>
      {temFiltro(filtros) && (
        <button onClick={() => onFiltros(VAZIO)} className="text-sm text-accent-strong hover:underline">
          Limpar filtros
        </button>
      )}

      <div className="ml-auto flex items-center gap-3 text-sm text-muted">
        <button onClick={onArquivados} className="rounded-control border border-line px-2.5 py-1 hover:bg-surface-2 hover:text-ink">
          Arquivados
        </button>
        {visiveis !== null && (
          <span className="tabular-nums">
            {visiveis} {visiveis === 1 ? 'card' : 'cards'}
          </span>
        )}
        {aoVivo ? (
          <span className="inline-flex items-center gap-1 text-good">
            <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-good" />
            Ao vivo
          </span>
        ) : (
          <Dica conteudo="As mudanças feitas em outro computador só aparecem ao recarregar a página ou voltar para esta aba." lado="direita">
            <span>Sem tempo real</span>
          </Dica>
        )}
      </div>
    </div>
  )
}
