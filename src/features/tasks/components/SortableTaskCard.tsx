import { CSS } from "@dnd-kit/utilities"
import { useSortable } from "@dnd-kit/sortable"
import { motion } from "framer-motion"
import { CalendarDays, Check, CircleCheck, CircleX, FileText, GripVertical, LoaderCircle, Pencil, Trash2 } from "lucide-react"
import { format, parseISO } from "date-fns"
import { cn } from "../../../lib/cn"
import { useNotionStore } from "../../integrations/notion/store/notionStore"
import type { Note } from "../../notes/types"
import type { Task } from "../types"
import { PriorityBadge } from "./PriorityBadge"

interface SortableTaskCardProps {
  task: Task
  linkedNotes?: Note[]
  selected: boolean
  onEdit: (task: Task) => void
  onDelete: (taskId: string) => void
  onToggle: (taskId: string) => void
  onSelect: (taskId: string) => void
}

function getTaskCardNote(note?: string): string {
  if (!note) return ""
  if (note.trim().startsWith("图片 OCR 识别内容：")) return ""
  return note
}

function formatTaskDateTime(task: Task): string {
  if (!task.dueDate) return ""
  const dateLabel = format(parseISO(task.dueDate), "MM/dd")
  if (!task.startTime) return dateLabel
  if (!task.endTime) return `${dateLabel} ${task.startTime}`
  return `${dateLabel} ${task.startTime}-${task.endTime}`
}

export function SortableTaskCard({
  task,
  linkedNotes = [],
  selected,
  onEdit,
  onDelete,
  onToggle,
  onSelect,
}: SortableTaskCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: task.id })
  const notionEnabled = useNotionStore((state) => state.settings.enabled && Boolean(state.connection))
  const syncState = useNotionStore((state) => state.syncMeta.tasks[task.id])
  const previewNote = getTaskCardNote(task.note)
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  function handleToggle() {
    onToggle(task.id)
    if (!task.completed) {
      navigator.vibrate?.(12)
    }
  }

  return (
    <motion.article
      ref={setNodeRef}
      className={cn(
        "group rounded-[14px] border border-black/10 bg-white/58 px-3 py-2.5 shadow-[0_1px_0_rgba(255,255,255,0.74)_inset] transition hover:border-black/16 hover:bg-white/78 hover:shadow-[0_12px_32px_rgba(17,19,26,0.06)] sm:rounded-[18px] sm:px-4 sm:py-3",
        selected && "border-black/28 bg-white/84 ring-3 ring-black/[0.05]",
        task.completed && "opacity-40",
        isDragging && "z-10 scale-[1.01] shadow-2xl"
      )}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{
        opacity: 0,
        x: -24,
        height: 0,
        marginTop: 0,
        marginBottom: 0,
        paddingTop: 0,
        paddingBottom: 0,
      }}
      transition={{
        opacity: { duration: 0.18, ease: "easeOut" },
        y: { duration: 0.18, ease: "easeOut" },
        x: { duration: 0.16, ease: "easeOut" },
        height: { duration: 0.12, delay: 0.1, ease: "easeOut" },
        marginTop: { duration: 0.12, delay: 0.1, ease: "easeOut" },
        marginBottom: { duration: 0.12, delay: 0.1, ease: "easeOut" },
        paddingTop: { duration: 0.12, delay: 0.1, ease: "easeOut" },
        paddingBottom: { duration: 0.12, delay: 0.1, ease: "easeOut" },
      }}
      layout
      style={style}
    >
      <div className="grid min-w-0 grid-cols-[24px_34px_minmax(0,1fr)_auto] items-center gap-2 sm:grid-cols-[28px_40px_minmax(0,1fr)_auto] sm:gap-3">
        <button
          className="ff-icon-button h-8 w-6 text-[var(--ff-subtle)] opacity-70 hover:opacity-100 sm:h-10 sm:w-7"
          type="button"
          aria-label="拖拽排序"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-4 w-4" />
        </button>

        <button
          className={cn(
            "grid h-8 w-8 shrink-0 place-items-center rounded-full transition sm:h-10 sm:w-10",
            task.completed
              ? "text-white"
              : "text-transparent hover:bg-black/[0.06] active:bg-black/[0.06]"
          )}
          type="button"
          aria-label={task.completed ? "标记未完成" : "标记完成"}
          onClick={handleToggle}
        >
          <span
            className={cn(
              "grid h-5 w-5 place-items-center rounded-full border sm:h-6 sm:w-6",
              task.completed ? "border-black bg-black" : "border-black/18 bg-white/42"
            )}
          >
            <Check className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
          </span>
        </button>

        <div className="min-w-0 flex-1 overflow-hidden">
          <div className="flex min-w-0 flex-wrap items-center gap-1.5 sm:gap-2">
            <h3 className="min-w-0 max-w-full break-words text-sm font-semibold leading-6 tracking-[-0.01em] text-[var(--ff-text)] transition [overflow-wrap:anywhere] sm:text-[15px]">
              <span className={cn("ff-complete-text", task.completed && "is-completed")}>{task.title}</span>
            </h3>
            <PriorityBadge priority={task.priority} />
          </div>

          {previewNote ? <p className="mt-0.5 line-clamp-1 break-words text-xs leading-5 text-[var(--ff-muted)] [overflow-wrap:anywhere] sm:mt-1 sm:line-clamp-2">{previewNote}</p> : null}

          <div className="mt-1.5 flex min-w-0 flex-wrap items-center gap-1 text-xs text-[var(--ff-muted)] sm:mt-2 sm:gap-1.5">
            {task.dueDate ? (
              <span className="ff-tag gap-1 px-2 py-0.5 text-[11px] sm:px-2.5 sm:py-1 sm:text-xs">
                <CalendarDays className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                {formatTaskDateTime(task)}
              </span>
            ) : null}
            {task.tags.map((tag) => (
              <span className="ff-tag max-w-[160px] truncate px-2 py-0.5 text-[11px] sm:px-2.5 sm:py-1 sm:text-xs" key={tag}>
                #{tag}
              </span>
            ))}
            {task.pomodoroCount > 0 ? (
              <span className="ff-tag px-2 py-0.5 text-[11px] sm:px-2.5 sm:py-1 sm:text-xs">
                {task.pomodoroCount} 番茄
              </span>
            ) : null}
            {linkedNotes.length ? (
              <span className="ff-tag gap-1 px-2 py-0.5 text-[11px] sm:px-2.5 sm:py-1 sm:text-xs" title={linkedNotes.map((note) => note.title).join("、")}>
                <FileText className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                {linkedNotes.length} 笔记
              </span>
            ) : null}
            {notionEnabled && syncState?.status ? <TaskSyncStatus status={syncState.status} /> : null}
          </div>
        </div>

        <div className="flex shrink-0 items-center justify-end gap-1">
          <label className="grid h-8 w-8 place-items-center rounded-xl border border-transparent hover:border-black/10 hover:bg-black/[0.04] sm:h-10 sm:w-10">
            <input
              checked={selected}
              className="h-4 w-4 rounded border-black/20 text-black focus:ring-black sm:h-5 sm:w-5"
              type="checkbox"
              aria-label="选择任务"
              onChange={() => onSelect(task.id)}
            />
          </label>
          <button className="ff-icon-button h-8 w-8 text-[var(--ff-subtle)] hover:text-[var(--ff-text)] sm:h-10 sm:w-10" type="button" aria-label="编辑任务" onClick={() => onEdit(task)}>
            <Pencil className="h-4 w-4" />
          </button>
          <button className="ff-icon-button ff-danger-action h-8 w-8 text-[var(--ff-subtle)] sm:h-10 sm:w-10" type="button" aria-label="删除任务" onClick={() => onDelete(task.id)}>
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>
    </motion.article>
  )
}

function TaskSyncStatus({ status }: { status: "failed" | "idle" | "synced" | "syncing" }) {
  if (status === "idle") return null
  if (status === "syncing") {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-[var(--ff-brand)]" title="同步中">
        <LoaderCircle className="h-3 w-3 animate-spin" />
      </span>
    )
  }
  if (status === "failed") {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-[var(--ff-danger)]" title="同步失败，进入设置页可重试">
        <CircleX className="h-3 w-3" />
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 text-[11px] font-medium text-[var(--ff-teal)]" title="已同步">
      <CircleCheck className="h-3 w-3" />
    </span>
  )
}
