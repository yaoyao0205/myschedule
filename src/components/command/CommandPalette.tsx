import { useEffect, useMemo, useState, type ReactNode } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { Bell, CalendarDays, CheckSquare, Clock, FileText, PartyPopper, Search, X } from "lucide-react"
import { useNavigate } from "react-router-dom"
import { useCountdownStore } from "../../features/countdown/store/countdownStore"
import { useNoteStore } from "../../features/notes/store/noteStore"
import { getPlainText } from "../../features/notes/utils"
import { useReminderStore } from "../../features/reminders/store/reminderStore"
import { useTaskStore } from "../../features/tasks/store/taskStore"
import { navItems } from "../navigation/navItems"

interface SearchResult {
  id: string
  title: string
  description: string
  path: string
  type: "任务" | "笔记" | "日子" | "提醒"
  icon: ReactNode
}

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  return ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName) || target.isContentEditable
}

function includesQuery(values: Array<string | undefined>, query: string) {
  const normalized = query.trim().toLowerCase()
  return values.join(" ").toLowerCase().includes(normalized)
}

export function CommandPalette() {
  const navigate = useNavigate()
  const tasks = useTaskStore((state) => state.tasks)
  const notes = useNoteStore((state) => state.notes)
  const countdowns = useCountdownStore((state) => state.events)
  const reminders = useReminderStore((state) => state.reminders)
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")

  const results = useMemo<SearchResult[]>(() => {
    const keyword = query.trim()
    if (!keyword) return []

    const taskResults = tasks
      .filter((task) => includesQuery([task.title, task.note, ...task.tags], keyword))
      .map<SearchResult>((task) => ({
        id: `task-${task.id}`,
        title: task.title,
        description: [task.dueDate, task.startTime, task.note].filter(Boolean).join(" · ") || "任务",
        path: "/tasks",
        type: "任务",
        icon: <CheckSquare className="h-4 w-4 text-[var(--ff-brand)]" />,
      }))

    const noteResults = notes
      .filter((note) => {
        const attachmentText = (note.attachments ?? []).flatMap((attachment) => [attachment.name, attachment.ocrText ?? ""]).join(" ")
        return includesQuery([note.title, getPlainText(note.content), attachmentText, ...note.tags], keyword)
      })
      .map<SearchResult>((note) => ({
        id: `note-${note.id}`,
        title: note.title,
        description: getPlainText(note.content).slice(0, 96) || "笔记",
        path: "/notes",
        type: "笔记",
        icon: <FileText className="h-4 w-4 text-[var(--ff-brand)]" />,
      }))

    const countdownResults = countdowns
      .filter((event) => includesQuery([event.title, event.note, event.targetDate], keyword))
      .map<SearchResult>((event) => ({
        id: `countdown-${event.id}`,
        title: event.title,
        description: `${event.targetDate} · ${event.note || "倒数日"}`,
        path: "/countdown",
        type: "日子",
        icon: <PartyPopper className="h-4 w-4 text-[var(--ff-brand)]" />,
      }))

    const reminderResults = reminders
      .filter((reminder) => includesQuery([reminder.title, reminder.note, reminder.taskTitle, reminder.scheduledAt], keyword))
      .map<SearchResult>((reminder) => ({
        id: `reminder-${reminder.id}`,
        title: reminder.title,
        description: [new Date(reminder.scheduledAt).toLocaleString(), reminder.note].filter(Boolean).join(" · "),
        path: "/reminders",
        type: "提醒",
        icon: <Bell className="h-4 w-4 text-[var(--ff-brand)]" />,
      }))

    return [...taskResults, ...noteResults, ...countdownResults, ...reminderResults].slice(0, 12)
  }, [countdowns, notes, query, reminders, tasks])

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (isTypingTarget(event.target)) return
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault()
        setOpen(true)
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [])

  useEffect(() => {
    if (!open) setQuery("")
  }, [open])

  function openPath(path: string) {
    navigate(path)
    setOpen(false)
  }

  return (
    <AnimatePresence>
      {open ? (
        <div className="fixed inset-0 z-50 grid place-items-start bg-slate-950/30 px-3 pt-20 backdrop-blur-sm sm:place-items-center sm:p-5">
          <motion.div
            className="ff-popover w-full max-w-2xl overflow-hidden rounded-xl border border-[var(--ff-border)] bg-[var(--ff-surface)]"
            initial={{ opacity: 0, y: -14, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -14, scale: 0.98 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
          >
            <div className="flex items-center gap-3 border-b border-[var(--ff-border)] px-4 py-3">
              <Search className="h-4 w-4 text-[var(--ff-ink-400)]" />
              <input
                autoFocus
                className="min-h-10 flex-1 bg-transparent text-sm text-[var(--ff-ink-900)] outline-none placeholder:text-[var(--ff-ink-400)] dark:text-[var(--ff-text)]"
                placeholder="搜索任务、笔记、日子、提醒，或跳转模块"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
              <span className="hidden rounded-md border border-[var(--ff-border)] px-2 py-1 text-[10px] font-semibold text-[var(--ff-ink-400)] sm:inline-flex">
                ⌘ K
              </span>
              <button className="ff-icon-button h-11 w-11" type="button" onClick={() => setOpen(false)} aria-label="关闭命令面板">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="max-h-[64vh] overflow-y-auto p-2">
              {query.trim() ? (
                results.length ? (
                  <div className="space-y-1">
                    {results.map((result) => (
                      <button
                        className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm hover:bg-[var(--ff-surface-muted)] active:bg-[var(--ff-surface-muted)]"
                        key={result.id}
                        type="button"
                        onClick={() => openPath(result.path)}
                      >
                        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-[var(--ff-border)] bg-[var(--ff-surface)]">
                          {result.icon}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-semibold text-[var(--ff-ink-900)] dark:text-[var(--ff-text)]">{result.title}</span>
                          <span className="mt-0.5 block truncate text-xs text-[var(--ff-ink-500)] dark:text-[var(--ff-muted)]">{result.description}</span>
                        </span>
                        <span className="rounded-full bg-[var(--ff-surface-muted)] px-2 py-1 text-xs font-semibold text-[var(--ff-ink-500)]">
                          {result.type}
                        </span>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-xl bg-[var(--ff-surface-muted)] px-4 py-6 text-center text-sm text-[var(--ff-ink-500)]">
                    没找到匹配内容
                  </div>
                )
              ) : (
                <div className="space-y-1">
                  <p className="px-3 py-2 text-xs font-semibold text-[var(--ff-ink-400)]">快速跳转</p>
                  {navItems.map((item) => {
                    const Icon = item.icon
                    return (
                      <button
                        className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm text-[var(--ff-ink-500)] hover:bg-[var(--ff-surface-muted)] active:bg-[var(--ff-surface-muted)] dark:text-[var(--ff-muted)]"
                        key={item.path}
                        type="button"
                        onClick={() => openPath(item.path)}
                      >
                        <Icon className="h-4 w-4 text-[var(--ff-brand)]" />
                        打开{item.label}
                      </button>
                    )
                  })}
                  <div className="mt-2 flex items-center gap-2 rounded-xl bg-[var(--ff-surface-muted)] px-3 py-2 text-xs text-[var(--ff-ink-500)]">
                    <Clock className="h-3.5 w-3.5" />
                    输入关键词即可跨模块搜索
                  </div>
                  <div className="flex items-center gap-2 rounded-xl bg-[var(--ff-surface-muted)] px-3 py-2 text-xs text-[var(--ff-ink-500)]">
                    <CalendarDays className="h-3.5 w-3.5" />
                    支持任务、笔记 OCR 文本、倒数日和提醒
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        </div>
      ) : null}
    </AnimatePresence>
  )
}
