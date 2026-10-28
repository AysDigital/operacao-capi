import type { ReactNode } from 'react'
import { closestCenter, DndContext, KeyboardSensor, PointerSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

/**
 * Lista curta reordenável pela alça "⋮⋮" (itens de checklist, anexos).
 * `onOrdenar` recebe os ids na ordem nova.
 */
export function Ordenavel<T extends { id: string }>({
  itens,
  onOrdenar,
  children,
}: {
  itens: T[]
  onOrdenar: (ids: string[]) => void
  children: (item: T, alca: ReactNode) => ReactNode
}) {
  const sensores = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )
  const ids = itens.map((i) => i.id)

  function fim({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return
    onOrdenar(arrayMove(ids, ids.indexOf(String(active.id)), ids.indexOf(String(over.id))))
  }

  return (
    <DndContext sensors={sensores} collisionDetection={closestCenter} onDragEnd={fim}>
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        {itens.map((item) => (
          <Linha key={item.id} id={item.id}>
            {(alca) => children(item, alca)}
          </Linha>
        ))}
      </SortableContext>
    </DndContext>
  )
}

function Linha({ id, children }: { id: string; children: (alca: ReactNode) => ReactNode }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id })
  const alca = (
    <button
      type="button"
      ref={setActivatorNodeRef}
      {...attributes}
      {...listeners}
      aria-label="Arrastar para reordenar"
      title="Arrastar para reordenar"
      className="shrink-0 cursor-grab touch-none px-0.5 text-muted opacity-40 group-hover:opacity-100 active:cursor-grabbing"
    >
      <svg viewBox="0 0 16 16" aria-hidden className="h-3.5 w-3.5" fill="currentColor">
        <circle cx="6" cy="4" r="1.1" />
        <circle cx="10" cy="4" r="1.1" />
        <circle cx="6" cy="8" r="1.1" />
        <circle cx="10" cy="8" r="1.1" />
        <circle cx="6" cy="12" r="1.1" />
        <circle cx="10" cy="12" r="1.1" />
      </svg>
    </button>
  )
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={`group relative ${isDragging ? 'z-10 opacity-70' : ''}`}
    >
      {children(alca)}
    </div>
  )
}
