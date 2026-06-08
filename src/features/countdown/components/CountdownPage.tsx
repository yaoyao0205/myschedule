import { useEffect, useMemo, useState } from "react"
import { useLocation, useNavigate } from "react-router-dom"
import { AnimatePresence, motion } from "framer-motion"
import {
  Bell,
  CalendarDays,
  CalendarPlus,
  Check,
  ChevronRight,
  Clock3,
  Copy,
  Download,
  Link2,
  MoreHorizontal,
  Pencil,
  Pin,
  PinOff,
  Plus,
  Search,
  Share2,
  Sparkles,
  Trash2,
  X,
} from "lucide-react"
import { cn } from "../../../lib/cn"
import { useTopBarSlot } from "../../../components/layout/topBarSlot"
import { BottomSheet } from "../../../components/ui/BottomSheet"
import { useToast } from "../../../components/ui/ToastProvider"
import { useCalendarStore } from "../../calendar/store/calendarStore"
import { useTaskStore } from "../../tasks/store/taskStore"
import type { Task } from "../../tasks/types"
import type { CountdownDraft, CountdownEvent, CountdownSortMode } from "../types"
import {
  categoryLabels,
  colorPresets,
  formatDateLabel,
  getAccentColor,
  getDaysInfo,
  getProgress,
  getQuickDate,
  isPastDate,
  sortCountdownEvents,
} from "../utils"
import {
  countdownToDraft,
  createEmptyCountdownDraft,
  useCountdownStore,
} from "../store/countdownStore"

const sortLabels: Record<CountdownSortMode, string> = {
  color: "按颜色",
  createdAt: "按创建",
  days: "按天数",
  title: "按名称",
}

const typeLabels = {
  annual: "每年重复",
  countdown: "倒计时",
  countup: "正计时",
} as const

function createShareText(event: CountdownEvent) {
  const info = getDaysInfo(event)
  const headline = info.isToday ? "就是今天" : info.isPast ? `已过 ${info.days} 天` : `还有 ${info.days} 天`
  return `${event.title} · ${headline} · ${formatDateLabel(info.effectiveTargetDate)}`
}

function safeFileName(value: string) {
  return value.trim().replace(/[\\/:*?"<>|]/g, "-").replace(/\s+/g, "-") || "countdown"
}

function canvasToBlob(canvas: HTMLCanvasElement) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob)
        return
      }
      reject(new Error("Failed to create share image"))
    }, "image/png", 0.95)
  })
}

function downloadFile(file: File) {
  const url = URL.createObjectURL(file)
  const link = document.createElement("a")
  link.href = url
  link.download = file.name
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

async function copyText(text: string) {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch {
    // Fall back to the older clipboard path below.
  }

  try {
    const textarea = document.createElement("textarea")
    textarea.value = text
    textarea.setAttribute("readonly", "true")
    textarea.style.position = "fixed"
    textarea.style.left = "-9999px"
    textarea.style.top = "0"
    document.body.appendChild(textarea)
    textarea.select()
    const copied = document.execCommand("copy")
    textarea.remove()
    return copied
  } catch {
    return false
  }
}

function openImageInNewTab(file: File) {
  const url = URL.createObjectURL(file)
  const opened = window.open(url, "_blank", "noopener,noreferrer")
  if (!opened) {
    URL.revokeObjectURL(url)
    return false
  }
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000)
  return true
}

function drawRoundRect(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) {
  ctx.beginPath()
  ctx.moveTo(x + radius, y)
  ctx.arcTo(x + width, y, x + width, y + height, radius)
  ctx.arcTo(x + width, y + height, x, y + height, radius)
  ctx.arcTo(x, y + height, x, y, radius)
  ctx.arcTo(x, y, x + width, y, radius)
  ctx.closePath()
}

function drawText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number, lineHeight: number, maxLines = 2) {
  const chars = Array.from(text)
  const lines: string[] = []
  let line = ""

  chars.forEach((char) => {
    const nextLine = line + char
    if (ctx.measureText(nextLine).width > maxWidth && line) {
      lines.push(line)
      line = char
      return
    }
    line = nextLine
  })
  if (line) lines.push(line)

  lines.slice(0, maxLines).forEach((currentLine, index) => {
    const shouldClamp = index === maxLines - 1 && lines.length > maxLines
    const output = shouldClamp ? `${currentLine.slice(0, Math.max(0, currentLine.length - 1))}...` : currentLine
    ctx.fillText(output, x, y + index * lineHeight)
  })
}

async function createCountdownShareImage(event: CountdownEvent) {
  const info = getDaysInfo(event)
  const accent = getAccentColor(event)
  const stats = getSecondaryStats(event)
  const headline = info.isToday ? "就是今天" : info.isPast ? `${info.days} 天前` : `${info.days} 天后到来`
  const canvas = document.createElement("canvas")
  const width = 1080
  const height = 1440
  canvas.width = width
  canvas.height = height

  const ctx = canvas.getContext("2d")
  if (!ctx) throw new Error("Canvas is unavailable")

  ctx.fillStyle = "#F7F5EF"
  ctx.fillRect(0, 0, width, height)

  const gradient = ctx.createRadialGradient(780, 120, 20, 780, 120, 620)
  gradient.addColorStop(0, `${accent}42`)
  gradient.addColorStop(1, "rgba(247,245,239,0)")
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, width, height)

  ctx.fillStyle = "#FFFFFFD9"
  ctx.strokeStyle = "#DFDDD7"
  ctx.lineWidth = 3
  drawRoundRect(ctx, 70, 70, 940, 1300, 46)
  ctx.fill()
  ctx.stroke()

  ctx.fillStyle = "#FFFFFF"
  ctx.strokeStyle = "#E3E1DC"
  ctx.lineWidth = 2
  drawRoundRect(ctx, 112, 122, 230, 62, 31)
  ctx.fill()
  ctx.stroke()
  ctx.fillStyle = accent
  ctx.beginPath()
  ctx.arc(150, 153, 10, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = "#6D7280"
  ctx.font = "500 26px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
  ctx.fillText(getEventToneLabel(event), 178, 162)

  ctx.fillStyle = "#08090C"
  ctx.font = "800 68px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
  drawText(ctx, event.title, 112, 270, 820, 78, 2)

  ctx.fillStyle = "#6D7280"
  ctx.font = "400 34px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
  ctx.fillText(`${formatDateLabel(info.effectiveTargetDate)} · ${typeLabels[event.type]}`, 112, 390)

  ctx.fillStyle = "#FFFFFFB8"
  ctx.strokeStyle = "#DFDDD7"
  ctx.lineWidth = 3
  drawRoundRect(ctx, 112, 470, 856, 475, 46)
  ctx.fill()
  ctx.stroke()

  ctx.fillStyle = "#6D7280"
  ctx.font = "500 28px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
  ctx.textAlign = "center"
  ctx.fillText(categoryLabels[event.category], width / 2, 550)

  ctx.fillStyle = accent
  drawRoundRect(ctx, width / 2 - 75, 588, 150, 10, 5)
  ctx.fill()

  ctx.fillStyle = "#08090C"
  ctx.font = info.isToday ? "800 92px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" : "800 190px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
  ctx.fillText(info.isToday ? "就是今天" : String(info.days), width / 2, info.isToday ? 745 : 770)

  ctx.font = "700 42px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
  ctx.fillText(headline, width / 2, 850)
  ctx.textAlign = "left"

  stats.forEach((stat, index) => {
    const boxWidth = 264
    const x = 112 + index * 296
    ctx.fillStyle = "#FFFFFFCC"
    ctx.strokeStyle = "#DFDDD7"
    ctx.lineWidth = 3
    drawRoundRect(ctx, x, 990, boxWidth, 148, 28)
    ctx.fill()
    ctx.stroke()
    ctx.fillStyle = "#6D7280"
    ctx.font = "500 24px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
    ctx.textAlign = "center"
    ctx.fillText(stat.label, x + boxWidth / 2, 1048)
    ctx.fillStyle = "#08090C"
    ctx.font = "800 42px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
    ctx.fillText(stat.value, x + boxWidth / 2, 1110)
    ctx.textAlign = "left"
  })

  if (event.note) {
    ctx.fillStyle = "#6D7280"
    ctx.font = "400 28px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
    drawText(ctx, event.note, 112, 1214, 856, 42, 2)
  }

  ctx.fillStyle = "#11131A"
  ctx.font = "700 28px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
  ctx.fillText("yaoyaoflow", 112, 1310)
  ctx.fillStyle = "#8A909D"
  ctx.font = "400 24px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
  ctx.fillText("把重要日子放在时间流里", 112, 1348)

  const blob = await canvasToBlob(canvas)
  return new File([blob], `${safeFileName(event.title)}-share.png`, { type: "image/png" })
}

function groupEvents(events: CountdownEvent[], sortMode: CountdownSortMode) {
  const sorted = sortCountdownEvents(events, sortMode)

  return {
    past: sorted.filter((event) => getDaysInfo(event).displayType === "countup"),
    today: sorted.filter((event) => getDaysInfo(event).isToday),
    upcoming: sorted.filter((event) => {
      const info = getDaysInfo(event)
      return !info.isToday && info.displayType === "countdown"
    }),
  }
}

function getEventDescription(event: CountdownEvent) {
  const info = getDaysInfo(event)
  if (info.isToday) return "就是今天"
  if (info.isPast) return `已经过去 ${info.days} 天`
  return `${info.days} 天后到来`
}

function getEventToneLabel(event: CountdownEvent) {
  const info = getDaysInfo(event)
  if (info.isToday) return "今天"
  if (info.isPast) return "已过去"
  if (info.days <= 3) return "紧迫"
  if (info.days <= 14) return "临近"
  return "期待中"
}

function getSecondaryStats(event: CountdownEvent) {
  const info = getDaysInfo(event)
  const weeks = Math.max(0, Math.floor(info.days / 7))
  const months = Math.max(0, Math.floor(info.days / 30))

  if (info.displayType === "countup") {
    return [
      { label: "周数", value: `${weeks} 周` },
      { label: "月数", value: `${months} 月` },
      { label: "年数", value: `${Math.floor(info.days / 365)} 年` },
    ]
  }

  return [
    { label: "周数", value: `${weeks} 周` },
    { label: "月数", value: `${months} 月` },
    { label: "进度", value: `${getProgress(event)}%` },
  ]
}

export function CountdownPage() {
  const location = useLocation()
  const navigate = useNavigate()
  const {
    addEvent,
    deleteEvent,
    events,
    migrateAnnualEvents,
    selectedEventId,
    selectEvent,
    sortMode,
    togglePinned,
    updateEvent,
  } = useCountdownStore()
  const tasks = useTaskStore((state) => state.tasks)
  const setCalendarCursorDate = useCalendarStore((state) => state.setCursorDate)
  const setCalendarMode = useCalendarStore((state) => state.setMode)
  const setCalendarSelectedDate = useCalendarStore((state) => state.setSelectedDate)
  const showCalendarEventType = useCalendarStore((state) => state.showEventType)
  const { notify } = useToast()
  const topBarSlot = useTopBarSlot()
  const [editorEvent, setEditorEvent] = useState<CountdownEvent | null>(null)
  const [editorOpen, setEditorOpen] = useState(false)
  const [sharePreview, setSharePreview] = useState<{ file: File; text: string; title: string; url: string } | null>(null)
  const [showTodayBanner, setShowTodayBanner] = useState(true)

  useEffect(() => {
    migrateAnnualEvents()
  }, [migrateAnnualEvents])

  useEffect(() => {
    if (!selectedEventId && events.length) {
      selectEvent(events[0].id)
    }
  }, [events, selectEvent, selectedEventId])

  useEffect(() => {
    if (!events.some((event) => getDaysInfo(event).isToday)) return
    const timer = window.setTimeout(() => setShowTodayBanner(false), 5000)
    return () => window.clearTimeout(timer)
  }, [events])

  useEffect(() => {
    return () => {
      if (sharePreview) URL.revokeObjectURL(sharePreview.url)
    }
  }, [sharePreview])

  useEffect(() => {
    const eventId = new URLSearchParams(location.search).get("event")
    if (!eventId || !events.some((event) => event.id === eventId)) return
    selectEvent(eventId)
  }, [events, location.search, selectEvent])

  const grouped = useMemo(() => groupEvents(events, sortMode), [events, sortMode])
  const selectedEvent = events.find((event) => event.id === selectedEventId) ?? events[0] ?? null
  const todayEvent = grouped.today[0]

  function openCreate() {
    setEditorEvent(null)
    setEditorOpen(true)
  }

  useEffect(() => {
    const controls = (
      <div className="flex min-w-0 items-center justify-end gap-2">
        <button className="ff-button-primary h-11 shrink-0 rounded-2xl px-4 text-sm" type="button" onClick={openCreate}>
          <Plus className="h-4 w-4" />
          记录日子
        </button>
      </div>
    )

    const mobileControls = (
      <button className="ff-button-primary h-10 w-10 shrink-0 rounded-2xl p-0" type="button" aria-label="记录日子" onClick={openCreate}>
        <Plus className="h-4 w-4" />
      </button>
    )

    topBarSlot?.setTopBarSlot({
      desktop: controls,
      mobileAction: mobileControls,
      mobilePanel: null,
    })

    return () => topBarSlot?.setTopBarSlot(null)
  }, [topBarSlot])

  function openEdit(event: CountdownEvent) {
    setEditorEvent(event)
    setEditorOpen(true)
  }

  function handleDelete(event: CountdownEvent) {
    const confirmed = window.confirm(`删除后无法恢复，确认删除「${event.title}」？`)
    if (!confirmed) return
    deleteEvent(event.id)
    notify("这个日子已删除", "success")
  }

  async function handleShare(event: CountdownEvent) {
    const text = createShareText(event)
    try {
      const file = await createCountdownShareImage(event)
      const shareData: ShareData = { files: [file], text, title: event.title }

      if (navigator.share && (!navigator.canShare || navigator.canShare(shareData))) {
        await navigator.share(shareData)
        notify("分享图片已发送", "success")
      } else {
        setSharePreview((current) => {
          if (current) URL.revokeObjectURL(current.url)
          return { file, text, title: event.title, url: URL.createObjectURL(file) }
        })
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        notify("分享被取消", "info")
        return
      }

      if (await copyText(text)) {
        notify("图片生成暂不可用，文案已复制", "warning")
      } else {
        notify("图片生成暂不可用，文案也没能复制", "warning")
      }
    }
  }

  async function sharePreviewImage() {
    if (!sharePreview) return
    const shareData: ShareData = { files: [sharePreview.file], text: sharePreview.text, title: sharePreview.title }
    if (!navigator.share || (navigator.canShare && !navigator.canShare(shareData))) {
      notify("当前环境不支持系统图片分享", "warning")
      return
    }

    try {
      await navigator.share(shareData)
      notify("分享图片已发送", "success")
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        notify("分享被取消", "info")
        return
      }
      notify("分享图片暂不可用", "warning")
    }
  }

  async function copyShareText() {
    if (!sharePreview) return
    if (await copyText(sharePreview.text)) {
      notify("分享文案已复制", "success")
    } else {
      notify("复制暂不可用", "warning")
    }
  }

  function handleOpenInCalendar(event: CountdownEvent) {
    const date = getDaysInfo(event).effectiveTargetDate
    setCalendarMode("day")
    setCalendarCursorDate(date)
    setCalendarSelectedDate(date)
    showCalendarEventType("countdown")
    navigate(`/calendar?date=${date}&source=countdown`)
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-3 overflow-y-auto pb-24 xl:overflow-hidden xl:pb-0">
      <AnimatePresence>
        {todayEvent && showTodayBanner ? (
          <motion.button
            className="flex min-h-12 items-center justify-between rounded-2xl border border-black/10 px-4 py-3 text-left text-sm font-semibold text-[#f8f6f0] shadow-[0_16px_34px_rgba(17,19,26,0.16)]"
            style={{ backgroundColor: getAccentColor(todayEvent) }}
            type="button"
            initial={{ opacity: 0, y: -14 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.32, ease: "easeOut" }}
            onClick={() => selectEvent(todayEvent.id)}
          >
            <span>今天是「{todayEvent.title}」的日子</span>
            <Sparkles className="h-4 w-4" />
          </motion.button>
        ) : null}
      </AnimatePresence>

      <div className="grid gap-3 xl:min-h-0 xl:flex-1 xl:overflow-hidden xl:grid-cols-[minmax(0,0.95fr)_minmax(360px,0.75fr)]">
        <section className="ff-glass-panel min-h-[420px] rounded-[28px] p-3 xl:min-h-0 xl:overflow-y-auto">
          {events.length ? (
            <div className="space-y-4">
              <CountdownGroup title="🎊 就是今天" events={grouped.today} selectedEventId={selectedEvent?.id ?? null} onSelect={selectEvent} />
              <CountdownGroup title="🌅 即将到来" events={grouped.upcoming} selectedEventId={selectedEvent?.id ?? null} onSelect={selectEvent} />
              <CountdownGroup title="🕰️ 已过去" events={grouped.past} selectedEventId={selectedEvent?.id ?? null} onSelect={selectEvent} />
            </div>
          ) : (
            <CountdownEmptyState onCreate={openCreate} />
          )}
        </section>

        <section className="hidden min-h-0 overflow-y-auto xl:block">
          {selectedEvent ? (
            <CountdownDetail
              event={selectedEvent}
              tasks={tasks}
              onDelete={handleDelete}
              onEdit={openEdit}
              onOpenInCalendar={handleOpenInCalendar}
              onShare={handleShare}
              onTogglePinned={togglePinned}
            />
          ) : null}
        </section>
      </div>

      {selectedEvent ? (
        <section className="xl:hidden">
          <CountdownDetail
            event={selectedEvent}
            tasks={tasks}
            compact
            onDelete={handleDelete}
            onEdit={openEdit}
            onOpenInCalendar={handleOpenInCalendar}
            onShare={handleShare}
            onTogglePinned={togglePinned}
          />
        </section>
      ) : null}

      <AnimatePresence>
        {editorOpen ? (
          <CountdownEditor
            event={editorEvent}
            tasks={tasks}
            onClose={() => setEditorOpen(false)}
            onSave={(draft) => {
              if (editorEvent) {
                updateEvent(editorEvent.id, draft)
                notify("这个日子已更新", "success")
              } else {
                addEvent(draft)
                notify("新的日子已记录", "success")
              }
              setEditorOpen(false)
            }}
          />
        ) : null}
        {sharePreview ? (
          <ShareImageSheet
            imageUrl={sharePreview.url}
            title={sharePreview.title}
            onClose={() =>
              setSharePreview((current) => {
                if (current) URL.revokeObjectURL(current.url)
                return null
              })
            }
            onCopyText={copyShareText}
            onDownload={() => {
              try {
                downloadFile(sharePreview.file)
                notify("分享图片已下载", "success")
              } catch {
                if (openImageInNewTab(sharePreview.file)) {
                  notify("已打开分享图片", "success")
                } else {
                  notify("当前环境无法下载图片", "warning")
                }
              }
            }}
            onShare={sharePreviewImage}
          />
        ) : null}
      </AnimatePresence>
    </div>
  )
}

function CountdownGroup({
  events,
  onSelect,
  selectedEventId,
  title,
}: {
  events: CountdownEvent[]
  onSelect: (eventId: string) => void
  selectedEventId: string | null
  title: string
}) {
  if (!events.length) return null

  return (
    <section>
      <div className="mb-2 flex items-center justify-between px-1">
        <h2 className="ff-mono text-[10px] uppercase tracking-[0.22em] text-[var(--ff-muted)]">{title}</h2>
        <span className="ff-mono rounded-full border border-black/10 bg-white/48 px-2.5 py-1 text-[10px] text-[var(--ff-muted)]">{events.length} 个</span>
      </div>
      <div className="space-y-2">
        <AnimatePresence initial={false}>
          {events.map((event) => (
            <CountdownCard event={event} key={event.id} selected={event.id === selectedEventId} onSelect={onSelect} />
          ))}
        </AnimatePresence>
      </div>
    </section>
  )
}

function CountdownCard({
  event,
  onSelect,
  selected,
}: {
  event: CountdownEvent
  onSelect: (eventId: string) => void
  selected: boolean
}) {
  const info = getDaysInfo(event)
  const accent = getAccentColor(event)
  const muted = info.isPast

  return (
    <motion.button
      className={cn(
        "group relative flex w-full items-center gap-3 overflow-hidden rounded-[22px] border p-3 text-left transition",
        selected ? "border-black/22 bg-white/70 shadow-[0_18px_46px_rgba(17,19,26,0.08)]" : "border-transparent bg-white/30 hover:border-black/10 hover:bg-white/58",
        muted ? "opacity-55" : ""
      )}
      style={info.isToday ? { backgroundColor: "rgba(255,255,255,0.72)", borderColor: "rgba(17,19,26,0.2)" } : undefined}
      type="button"
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.18, ease: "easeOut" }}
      onClick={() => onSelect(event.id)}
    >
      <span className="absolute inset-y-0 left-0 w-[3px]" style={{ backgroundColor: accent }} aria-hidden="true" />
      <span className="pointer-events-none absolute right-5 top-4 h-10 w-10 rounded-full opacity-10 blur-xl" style={{ backgroundColor: accent }} aria-hidden="true" />
      <div className="min-w-0 flex-1 pl-1">
        <div className="flex items-center gap-2">
          <h3 className="truncate text-base font-semibold tracking-[-0.01em] text-[var(--ff-text)]">{event.title}</h3>
          {event.pinned ? <Pin className="h-3.5 w-3.5 text-[var(--ff-brand)]" /> : null}
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-[var(--ff-muted)]">
          <span>{formatDateLabel(info.effectiveTargetDate)}</span>
          <span>·</span>
          <span>{typeLabels[event.type]}</span>
          <span className="rounded-full border border-black/10 bg-white/48 px-2 py-0.5">{categoryLabels[event.category]}</span>
        </div>
      </div>
      <div className="shrink-0 text-right tabular-nums text-[var(--ff-text)]">
        {info.isToday ? (
          <p className="ff-display text-2xl">今天</p>
        ) : (
          <>
            <p className="text-xs font-medium">{info.isPast ? "已过" : "还有"}</p>
            <p className="ff-display text-3xl leading-none">{info.days}</p>
            <p className="text-xs font-medium">天</p>
          </>
        )}
      </div>
      <ChevronRight className="h-4 w-4 shrink-0 text-[var(--ff-subtle)] opacity-0 transition group-hover:opacity-100" />
    </motion.button>
  )
}

function CountdownDetail({
  compact = false,
  event,
  onDelete,
  onEdit,
  onOpenInCalendar,
  onShare,
  onTogglePinned,
  tasks,
}: {
  compact?: boolean
  event: CountdownEvent
  onDelete: (event: CountdownEvent) => void
  onEdit: (event: CountdownEvent) => void
  onOpenInCalendar: (event: CountdownEvent) => void
  onShare: (event: CountdownEvent) => void
  onTogglePinned: (eventId: string) => void
  tasks: Task[]
}) {
  const info = getDaysInfo(event)
  const accent = getAccentColor(event)
  const progress = getProgress(event)
  const stats = getSecondaryStats(event)
  const linkedTasks = tasks.filter((task) => event.linkedTaskIds?.includes(task.id))

  return (
    <article className={cn("ff-glass-panel overflow-hidden rounded-[28px]", compact ? "p-4" : "p-5")}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="ff-mono inline-flex rounded-full border border-black/10 bg-white/46 px-2.5 py-1 text-[10px] uppercase tracking-[0.24em] text-[var(--ff-muted)]">
            <span className="mr-2 mt-1 h-1.5 w-1.5 rounded-full" style={{ backgroundColor: accent }} />
            {getEventToneLabel(event)}
          </p>
          <h2 className="ff-display mt-1 text-2xl text-[var(--ff-text)]">{event.title}</h2>
          <p className="mt-1 text-sm text-[var(--ff-muted)]">{formatDateLabel(info.effectiveTargetDate)} · {typeLabels[event.type]}</p>
        </div>
        <div className="flex items-center gap-1">
          <button className="ff-icon-button h-10 w-10" type="button" aria-label={event.pinned ? "取消置顶" : "置顶"} onClick={() => onTogglePinned(event.id)}>
            {event.pinned ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />}
          </button>
          <button className="ff-icon-button h-10 w-10" type="button" aria-label="编辑日子" onClick={() => onEdit(event)}>
            <Pencil className="h-4 w-4" />
          </button>
          <button className="ff-icon-button h-10 w-10" type="button" aria-label="分享日子" onClick={() => onShare(event)}>
            <Share2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="relative mt-5 overflow-hidden rounded-[26px] border border-black/10 bg-white/46 p-6 text-center shadow-[0_1px_0_rgba(255,255,255,0.72)_inset]">
        {info.isToday ? <CelebrationParticles color={event.color} /> : null}
        <p className="ff-mono text-[10px] uppercase tracking-[0.24em] text-[var(--ff-muted)]">{categoryLabels[event.category]}</p>
        <div className="mx-auto mt-3 h-1 w-16 rounded-full" style={{ backgroundColor: accent }} />
        <div className="mt-3 tabular-nums text-[var(--ff-text)]">
          {info.isToday ? (
            <p className="ff-display text-[52px] leading-none sm:text-[64px]">就是今天</p>
          ) : (
            <p className="ff-display text-[72px] leading-none">{info.days}</p>
          )}
        </div>
        <p className="mt-3 text-base font-medium text-[var(--ff-text)]">{getEventDescription(event)}</p>
        {event.note ? <p className="mx-auto mt-2 max-w-sm text-sm text-[var(--ff-muted)]">{event.note}</p> : null}
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2">
        {stats.map((stat) => (
          <div className="rounded-2xl border border-black/10 bg-white/42 p-3 text-center" key={stat.label}>
            <p className="ff-mono text-[10px] uppercase tracking-[0.12em] text-[var(--ff-muted)]">{stat.label}</p>
            <p className="ff-display mt-1 text-xl tabular-nums text-[var(--ff-text)]">{stat.value}</p>
          </div>
        ))}
      </div>

      <button className="ff-button-primary mt-4 w-full rounded-2xl px-4 py-2 text-sm" type="button" onClick={() => onOpenInCalendar(event)}>
        <CalendarDays className="h-4 w-4" />
        在日历查看
      </button>

      {info.displayType === "countdown" && !info.isToday ? (
        <div className="mt-4 rounded-2xl border border-black/10 bg-white/42 p-4">
          <div className="mb-2 flex items-center justify-between text-xs text-[var(--ff-muted)]">
            <span>从创建日到目标日</span>
            <span>{progress <= 10 ? "才刚开始" : progress >= 90 ? "快到了" : `${progress}%`}</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-[var(--ff-border-strong)]">
            <motion.div
              className={cn("h-full rounded-full", progress >= 90 ? "countdown-progress-danger" : "")}
              style={{ backgroundColor: accent }}
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.45, ease: "easeOut" }}
            />
          </div>
        </div>
      ) : null}

      <div className="mt-4 rounded-2xl border border-black/10 bg-white/42 p-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-[var(--ff-text)]">
          <Link2 className="h-4 w-4" />
          🔗 关联任务
        </div>
        {linkedTasks.length ? (
          <div className="mt-3 space-y-2">
            {linkedTasks.map((task) => (
              <div className="flex items-center justify-between rounded-xl bg-white/54 px-3 py-2 text-sm" key={task.id}>
                <span className={cn("truncate", task.completed ? "text-[var(--ff-muted)] line-through" : "text-[var(--ff-text)]")}>{task.title}</span>
                {task.completed ? <Check className="h-4 w-4 text-[var(--ff-success)]" /> : <MoreHorizontal className="h-4 w-4 text-[var(--ff-subtle)]" />}
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-2 text-sm text-[var(--ff-muted)]">还没有关联任务，可以在编辑时绑定清单任务。✨</p>
        )}
      </div>

      <button className="ff-button-secondary ff-danger-action mt-4 w-full rounded-2xl px-4 py-2 text-sm" type="button" onClick={() => onDelete(event)}>
        <Trash2 className="h-4 w-4" />
        删除这个日子
      </button>
    </article>
  )
}

function ShareImageSheet({
  imageUrl,
  onClose,
  onCopyText,
  onDownload,
  onShare,
  title,
}: {
  imageUrl: string
  onClose: () => void
  onCopyText: () => void
  onDownload: () => void
  onShare: () => void
  title: string
}) {
  return (
    <BottomSheet ariaLabel="图片分享" className="max-w-xl overflow-hidden" onClose={onClose}>
      <div className="border-b border-[var(--ff-border)] px-5 py-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="ff-mono text-[10px] uppercase tracking-[0.24em] text-[var(--ff-muted)]">share card</p>
            <h2 className="ff-display mt-1 truncate text-2xl text-[var(--ff-text)]">{title}</h2>
          </div>
          <button className="ff-icon-button h-10 w-10" type="button" aria-label="关闭图片分享" onClick={onClose}>
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="max-h-[70vh] overflow-y-auto px-5 py-4">
        <div className="overflow-hidden rounded-[26px] border border-[var(--ff-border)] bg-[var(--ff-surface-muted)] p-2">
          <img className="block w-full rounded-[20px]" src={imageUrl} alt={`${title} 分享图片`} />
        </div>
      </div>

      <div className="grid gap-2 border-t border-[var(--ff-border)] px-5 py-4 sm:grid-cols-3">
        <button className="ff-button-primary justify-center px-4 py-3 text-sm" type="button" onClick={onShare}>
          <Share2 className="h-4 w-4" />
          分享图片
        </button>
        <button className="ff-button-secondary justify-center px-4 py-3 text-sm" type="button" onClick={onDownload}>
          <Download className="h-4 w-4" />
          下载图片
        </button>
        <button className="ff-button-secondary justify-center px-4 py-3 text-sm" type="button" onClick={onCopyText}>
          <Copy className="h-4 w-4" />
          复制文案
        </button>
      </div>
    </BottomSheet>
  )
}

function CelebrationParticles({ color }: { color: string }) {
  return (
    <div className="pointer-events-none absolute inset-x-0 top-9 flex justify-center" aria-hidden="true">
      {Array.from({ length: 12 }).map((_, index) => (
        <motion.span
          className="absolute h-2 w-2 rounded-sm"
          style={{ backgroundColor: color }}
          key={index}
          initial={{ opacity: 0.95, x: 0, y: 20, rotate: 0 }}
          animate={{
            opacity: 0,
            x: Math.cos(index) * (28 + index * 3),
            y: -42 - (index % 4) * 10,
            rotate: 120 + index * 18,
          }}
          transition={{ duration: 0.6, delay: index * 0.025, ease: "easeOut" }}
        />
      ))}
    </div>
  )
}

function CountdownEmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="ff-card grid min-h-[420px] place-items-center p-8 text-center">
      <div>
        <div className="mx-auto grid h-24 w-24 place-items-center rounded-3xl border border-[var(--ff-border)] bg-[var(--ff-surface-muted)]">
          <svg className="h-14 w-14 text-[var(--ff-brand)]" viewBox="0 0 56 56" fill="none" aria-hidden="true">
            <rect x="10" y="13" width="36" height="33" rx="8" stroke="currentColor" strokeWidth="2.5" />
            <path d="M18 9v9M38 9v9M11 23h34" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
            <circle cx="28" cy="34" r="6" stroke="currentColor" strokeWidth="2.5" />
          </svg>
        </div>
        <h2 className="mt-4 text-lg font-semibold text-[var(--ff-text)]">还没有记录任何日子</h2>
        <p className="mt-2 text-sm text-[var(--ff-muted)]">先记录一个重要时刻，让时间开始有形状。</p>
        <button className="ff-button-primary mt-4 px-4 py-2 text-sm" type="button" onClick={onCreate}>
          <CalendarPlus className="h-4 w-4" />
          记录第一个日子
        </button>
      </div>
    </div>
  )
}

function CountdownEditor({
  event,
  onClose,
  onSave,
  tasks,
}: {
  event: CountdownEvent | null
  onClose: () => void
  onSave: (draft: CountdownDraft) => void
  tasks: Task[]
}) {
  const [draft, setDraft] = useState<CountdownDraft>(() => (event ? countdownToDraft(event) : createEmptyCountdownDraft()))
  const [taskQuery, setTaskQuery] = useState("")
  const { notify } = useToast()

  const filteredTasks = tasks
    .filter((task) => `${task.title} ${task.note ?? ""}`.toLowerCase().includes(taskQuery.toLowerCase().trim()))
    .slice(0, 6)

  function patchDraft(patch: Partial<CountdownDraft>) {
    setDraft((current) => ({ ...current, ...patch }))
  }

  function toggleTask(taskId: string) {
    const selected = draft.linkedTaskIds.includes(taskId)
    patchDraft({
      linkedTaskIds: selected ? draft.linkedTaskIds.filter((id) => id !== taskId) : [...draft.linkedTaskIds, taskId],
    })
  }

  function handleSubmit() {
    const title = draft.title.trim()
    if (!title) {
      notify("给这个日子起个名字吧", "warning")
      return
    }
    if (!draft.targetDate) {
      notify("请选择目标日期", "warning")
      return
    }
    const normalizedType = draft.type === "countdown" && isPastDate(draft.targetDate) ? "countup" : draft.type
    onSave({ ...draft, title, type: normalizedType })
  }

  return (
    <BottomSheet ariaLabel={event ? "编辑日子" : "记录日子"} className="max-h-[92vh] max-w-2xl overflow-y-auto" onClose={onClose}>
      <div className="border-b border-[var(--ff-border)] px-5 py-4">
        <p className="text-sm font-medium text-[var(--ff-brand)]">{event ? "编辑日子" : "新建日子"}</p>
        <h2 className="text-xl font-semibold text-[var(--ff-text)]">{event ? "调整这个重要时刻" : "给未来或过去放一枚书签"}</h2>
      </div>

      <div className="space-y-5 px-5 py-5">
        <label className="block">
          <span className="text-sm font-medium text-[var(--ff-text)]">事件名称</span>
          <input
            className="ff-input mt-2 w-full px-3"
            maxLength={20}
            placeholder="给这个日子起个名字"
            value={draft.title}
            onChange={(event) => patchDraft({ title: event.target.value })}
          />
        </label>

        <div>
          <span className="text-sm font-medium text-[var(--ff-text)]">目标日期</span>
          <div className="mt-2 grid gap-2 sm:grid-cols-[1fr_auto]">
            <input
              className="ff-input w-full px-3"
              type="date"
              value={draft.targetDate}
              onChange={(event) => patchDraft({ targetDate: event.currentTarget.value })}
              onInput={(event) => patchDraft({ targetDate: event.currentTarget.value })}
            />
            <div className="flex flex-wrap gap-2">
              {([
                ["明天", "tomorrow"],
                ["下周", "nextWeek"],
                ["下个月", "nextMonth"],
                ["明年今天", "nextYear"],
              ] as const).map(([label, value]) => (
                <button className="ff-button-secondary px-3 py-2 text-xs" type="button" key={value} onClick={() => patchDraft({ targetDate: getQuickDate(value) })}>
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div>
          <span className="text-sm font-medium text-[var(--ff-text)]">类型</span>
          <div className="mt-2 grid grid-cols-3 gap-2">
            {Object.entries(typeLabels).map(([value, label]) => (
              <button
                className={cn("rounded-xl border px-3 py-2 text-sm font-medium transition", draft.type === value ? "border-[var(--ff-brand)] bg-[var(--ff-brand-soft)] text-[var(--ff-brand-text)]" : "border-[var(--ff-border)] bg-[var(--ff-surface-muted)] text-[var(--ff-muted)]")}
                type="button"
                key={value}
                onClick={() => patchDraft({ type: value as CountdownDraft["type"] })}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <span className="text-sm font-medium text-[var(--ff-text)]">分类标签</span>
          <div className="mt-2 flex flex-wrap gap-2">
            {Object.entries(categoryLabels).map(([value, label]) => (
              <button
                className={cn("rounded-full border px-3 py-2 text-sm transition", draft.category === value ? "border-[var(--ff-brand)] bg-[var(--ff-brand-soft)] text-[var(--ff-brand-text)]" : "border-[var(--ff-border)] bg-[var(--ff-surface-muted)] text-[var(--ff-muted)]")}
                type="button"
                key={value}
                onClick={() => patchDraft({ category: value as CountdownDraft["category"] })}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <span className="text-sm font-medium text-[var(--ff-text)]">颜色</span>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {colorPresets.map((color) => (
              <button
                className={cn("grid h-10 w-10 place-items-center rounded-full border-2 transition", draft.color === color ? "border-[var(--ff-text)]" : "border-transparent")}
                style={{ backgroundColor: color }}
                type="button"
                aria-label="选择颜色"
                key={color}
                onClick={() => patchDraft({ color })}
              >
                {draft.color === color ? <Check className="h-4 w-4 text-white" /> : null}
              </button>
            ))}
            <label className="grid h-10 w-10 place-items-center rounded-full border border-[var(--ff-border)] bg-[var(--ff-surface-muted)]">
              <input className="h-8 w-8 cursor-pointer opacity-0" type="color" value={draft.color} aria-label="自定义颜色" onChange={(event) => patchDraft({ color: event.target.value })} />
            </label>
          </div>
        </div>

        <label className="block">
          <span className="text-sm font-medium text-[var(--ff-text)]">备注</span>
          <input
            className="ff-input mt-2 w-full px-3"
            maxLength={100}
            placeholder="可选，写一句只有你知道的注释"
            value={draft.note}
            onChange={(event) => patchDraft({ note: event.target.value })}
          />
        </label>

        <div className="rounded-xl border border-[var(--ff-border)] bg-[var(--ff-surface-muted)] p-3">
          <label className="flex items-center justify-between gap-3">
            <span className="flex items-center gap-2 text-sm font-medium text-[var(--ff-text)]">
              <Bell className="h-4 w-4" />
              提醒
            </span>
            <input
              className="h-5 w-5 accent-[var(--ff-brand)]"
              type="checkbox"
              checked={draft.reminderEnabled}
              onChange={(event) => patchDraft({ reminderEnabled: event.target.checked })}
            />
          </label>
          {draft.reminderEnabled ? (
            <div className="mt-3 flex items-center gap-2">
              <Clock3 className="h-4 w-4 text-[var(--ff-muted)]" />
              <span className="text-sm text-[var(--ff-muted)]">提前</span>
              <input
                className="ff-input w-20 px-2 text-center"
                min={0}
                type="number"
                value={draft.reminderDaysBefore}
                onChange={(event) => patchDraft({ reminderDaysBefore: Number(event.target.value) })}
              />
              <span className="text-sm text-[var(--ff-muted)]">天提醒</span>
            </div>
          ) : null}
        </div>

        <div className="rounded-xl border border-[var(--ff-border)] bg-[var(--ff-surface-muted)] p-3">
          <div className="flex items-center gap-2 text-sm font-medium text-[var(--ff-text)]">
            <Search className="h-4 w-4" />
            关联任务
          </div>
          <input
            className="ff-input mt-3 w-full px-3"
            placeholder="搜索任务并绑定"
            value={taskQuery}
            onChange={(event) => setTaskQuery(event.target.value)}
          />
          <div className="mt-3 space-y-2">
            {filteredTasks.map((task) => {
              const selected = draft.linkedTaskIds.includes(task.id)
              return (
                <button
                  className={cn("flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition", selected ? "bg-[var(--ff-brand-soft)] text-[var(--ff-brand-text)]" : "bg-[var(--ff-surface)] text-[var(--ff-text)]")}
                  type="button"
                  key={task.id}
                  onClick={() => toggleTask(task.id)}
                >
                  <span className="truncate">{task.title}</span>
                  {selected ? <Check className="h-4 w-4" /> : null}
                </button>
              )
            })}
          </div>
        </div>
      </div>

      <div className="sticky bottom-0 flex justify-end gap-2 border-t border-[var(--ff-border)] bg-[var(--ff-surface)] px-5 py-4">
        <button className="ff-button-secondary px-4 py-2 text-sm" type="button" onClick={onClose}>
          取消
        </button>
        <button className="ff-button-primary px-4 py-2 text-sm" type="button" onClick={handleSubmit}>
          {event ? "保存日子" : "记录日子"}
        </button>
      </div>
    </BottomSheet>
  )
}
