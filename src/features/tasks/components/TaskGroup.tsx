import { AnimatePresence } from "framer-motion"
import type { Task, TaskGroup as TaskGroupType } from "../types"
import { SortableTaskCard } from "./SortableTaskCard"

interface TaskGroupProps {
  group: TaskGroupType
  selectedTaskIds: string[]
  onEdit: (task: Task) => void
  onDelete: (taskId: string) => void
  onToggle: (taskId: string) => void
  onSelect: (taskId: string) => void
  onCreate: () => void
}

export function TaskGroup({ group, selectedTaskIds, onEdit, onDelete, onToggle, onSelect, onCreate }: TaskGroupProps) {
  const isEmpty = group.tasks.length === 0

  return (
    <section className="ff-glass-panel flex flex-col overflow-hidden rounded-[18px] p-2.5 sm:rounded-[26px] sm:p-3">
      <div className={isEmpty ? "flex items-center justify-between gap-3 px-1" : "flex items-start justify-between gap-3 border-b border-[var(--ff-border)] px-1 pb-2 sm:pb-2.5"}>
        <div className="min-w-0">
          <p className="ff-mono text-[9px] uppercase tracking-[0.22em] text-[var(--ff-muted)] sm:text-[10px]">list ✅</p>
          <h2 className="ff-display mt-0.5 text-lg text-[var(--ff-text)] sm:text-xl">🗂️ {group.title}</h2>
          <p className={isEmpty ? "mt-0.5 line-clamp-1 text-xs leading-5 text-[var(--ff-muted)]" : "mt-0.5 line-clamp-1 text-xs leading-5 text-[var(--ff-muted)] sm:line-clamp-2"}>{group.description}</p>
        </div>
        <span className="ff-mono shrink-0 rounded-full border border-black/10 bg-white/52 px-2.5 py-1 text-xs font-medium text-[var(--ff-muted)] sm:px-3">
          {group.tasks.length}
        </span>
      </div>

      {group.tasks.length > 0 ? (
        <div className="space-y-1.5 pt-2 sm:space-y-2 sm:pt-3">
          <AnimatePresence initial={false}>
            {group.tasks.map((task) => (
              <SortableTaskCard
                key={task.id}
                task={task}
                selected={selectedTaskIds.includes(task.id)}
                onEdit={onEdit}
                onDelete={onDelete}
                onToggle={onToggle}
                onSelect={onSelect}
              />
            ))}
          </AnimatePresence>
        </div>
      ) : (
        <button
          className="mt-3 flex min-h-12 items-center justify-between rounded-[18px] border border-dashed border-black/12 bg-white/24 px-4 py-3 text-left text-sm text-[var(--ff-muted)] transition hover:border-black/20 hover:bg-white/44"
          type="button"
          onClick={onCreate}
        >
          <span>还没有任务。点击添加第一件明确的事。✨</span>
          <span className="ff-mono text-[11px] uppercase tracking-[0.12em]">new</span>
        </button>
      )}
    </section>
  )
}
