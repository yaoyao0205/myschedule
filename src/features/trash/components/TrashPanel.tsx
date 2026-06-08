import { useState } from "react"
import { AnimatePresence } from "framer-motion"
import { Clock, FileText, ListTodo, RotateCcw, Trash2, X } from "lucide-react"
import { BottomSheet } from "../../../components/ui/BottomSheet"
import { useToast } from "../../../components/ui/ToastProvider"
import { cn } from "../../../lib/cn"
import { useCountdownStore } from "../../countdown/store/countdownStore"
import type { CountdownEvent } from "../../countdown/types"
import { useNoteStore } from "../../notes/store/noteStore"
import type { Note } from "../../notes/types"
import { useReminderStore } from "../../reminders/store/reminderStore"
import type { Reminder } from "../../reminders/types"
import { useTaskStore } from "../../tasks/store/taskStore"
import type { Task } from "../../tasks/types"
import { type TrashItem, type TrashItemType, useTrashStore } from "../store/trashStore"

const typeLabels: Record<TrashItemType, string> = {
  countdown: "日子",
  note: "笔记",
  reminder: "提醒",
  task: "任务",
}

const typeIcons: Record<TrashItemType, typeof ListTodo> = {
  countdown: Clock,
  note: FileText,
  reminder: Clock,
  task: ListTodo,
}

function formatDeletedAt(value: string) {
  const minutes = Math.max(0, Math.round((Date.now() - new Date(value).getTime()) / 60_000))
  if (minutes < 1) return "刚刚删除"
  if (minutes < 60) return `${minutes} 分钟前删除`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours} 小时前删除`
  return `${Math.round(hours / 24)} 天前删除`
}

export function TrashPanel({ collapsed = false }: { collapsed?: boolean }) {
  const [open, setOpen] = useState(false)
  const { notify } = useToast()
  const { clearTrash, items, removeTrashItem } = useTrashStore()
  const restoreTask = useTaskStore((state) => state.restoreTask)
  const restoreNote = useNoteStore((state) => state.restoreNote)
  const restoreReminder = useReminderStore((state) => state.restoreReminder)
  const restoreEvent = useCountdownStore((state) => state.restoreEvent)

  function restoreItem(item: TrashItem) {
    if (item.type === "task") restoreTask(item.data as Task)
    if (item.type === "note") restoreNote(item.data as Note)
    if (item.type === "reminder") restoreReminder(item.data as Reminder)
    if (item.type === "countdown") restoreEvent(item.data as CountdownEvent)
    removeTrashItem(item.id)
    notify(`已恢复「${item.title}」`, "success")
  }

  function permanentlyDelete(item: TrashItem) {
    removeTrashItem(item.id)
    notify(`已永久删除「${item.title}」`, "warning")
  }

  return (
    <>
      <button
        className={cn(
          "relative flex w-full items-center justify-center gap-3 rounded-2xl px-3 py-3 text-sm font-semibold text-[var(--ff-ink-500)] transition hover:bg-white/54 hover:text-[var(--ff-text)]",
          collapsed ? "lg:h-12 lg:w-12 lg:justify-center lg:px-0" : "lg:justify-start"
        )}
        type="button"
        aria-label="回收站"
        title="回收站"
        onClick={() => setOpen(true)}
      >
        <Trash2 className="h-5 w-5" />
        <span className={cn("hidden", !collapsed && "lg:inline")}>回收站</span>
        {items.length ? (
          <span className="absolute right-2 top-2 grid h-5 min-w-5 place-items-center rounded-full bg-[var(--ff-danger)] px-1 text-[10px] font-semibold text-white">
            {items.length > 99 ? "99+" : items.length}
          </span>
        ) : null}
      </button>

      <AnimatePresence>
        {open ? (
          <BottomSheet ariaLabel="回收站" className="max-h-[88vh] max-w-2xl overflow-hidden" onClose={() => setOpen(false)}>
            <div className="border-b border-[var(--ff-border)] px-5 py-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="ff-mono text-[10px] uppercase tracking-[0.24em] text-[var(--ff-muted)]">safety net</p>
                  <h2 className="ff-display mt-1 text-2xl text-[var(--ff-text)]">回收站</h2>
                  <p className="mt-1 text-sm text-[var(--ff-muted)]">删除的内容会先放在这里，恢复前还有一口气。</p>
                </div>
                <button className="ff-icon-button h-10 w-10" type="button" aria-label="关闭回收站" onClick={() => setOpen(false)}>
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="max-h-[60vh] overflow-y-auto px-5 py-4">
              {items.length ? (
                <div className="space-y-2">
                  {items.map((item) => (
                    <TrashRow item={item} key={item.id} onDelete={permanentlyDelete} onRestore={restoreItem} />
                  ))}
                </div>
              ) : (
                <div className="grid min-h-48 place-items-center text-center">
                  <div>
                    <Trash2 className="mx-auto h-10 w-10 text-[var(--ff-subtle)]" />
                    <h3 className="mt-3 text-base font-semibold text-[var(--ff-text)]">回收站是空的</h3>
                    <p className="mt-1 text-sm text-[var(--ff-muted)]">没有东西需要从灰烬里捞回来。</p>
                  </div>
                </div>
              )}
            </div>

            {items.length ? (
              <div className="border-t border-[var(--ff-border)] px-5 py-4">
                <button className="ff-button-secondary ff-danger-action px-4 py-2 text-sm" type="button" onClick={clearTrash}>
                  清空回收站
                </button>
              </div>
            ) : null}
          </BottomSheet>
        ) : null}
      </AnimatePresence>
    </>
  )
}

function TrashRow({
  item,
  onDelete,
  onRestore,
}: {
  item: TrashItem
  onDelete: (item: TrashItem) => void
  onRestore: (item: TrashItem) => void
}) {
  const Icon = typeIcons[item.type]

  return (
    <article className="flex flex-wrap items-center gap-3 rounded-xl border border-[var(--ff-border)] bg-[var(--ff-surface-muted)] p-3">
      <div className="grid h-10 w-10 place-items-center rounded-xl bg-[var(--ff-surface)] text-[var(--ff-brand)]">
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="truncate text-sm font-semibold text-[var(--ff-text)]">{item.title}</h3>
          <span className="rounded-full bg-[var(--ff-surface)] px-2 py-0.5 text-xs text-[var(--ff-muted)]">{typeLabels[item.type]}</span>
        </div>
        <p className="mt-1 text-xs text-[var(--ff-muted)]">{formatDeletedAt(item.deletedAt)}</p>
      </div>
      <div className="flex items-center gap-2">
        <button className="ff-button-secondary px-3 py-2 text-sm" type="button" onClick={() => onRestore(item)}>
          <RotateCcw className="h-4 w-4" />
          恢复
        </button>
        <button className={cn("ff-icon-button ff-danger-action h-10 w-10")} type="button" aria-label="永久删除" onClick={() => onDelete(item)}>
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </article>
  )
}
