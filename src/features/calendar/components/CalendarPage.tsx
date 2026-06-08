import { type ChangeEvent, type ClipboardEvent, type CSSProperties, type PointerEvent, type ReactNode, type TouchEvent, useEffect, useMemo, useRef, useState } from "react"
import { useLocation, useNavigate } from "react-router-dom"
import { DndContext, DragEndEvent, PointerSensor, useDraggable, useDroppable, useSensor, useSensors } from "@dnd-kit/core"
import { CSS } from "@dnd-kit/utilities"
import { AnimatePresence, motion } from "framer-motion"
import {
  addDays,
  addMonths,
  addWeeks,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  isToday,
  parseISO,
  startOfMonth,
  startOfToday,
  startOfWeek,
  subMonths,
  subWeeks,
} from "date-fns"
import { CalendarPlus, ChevronLeft, ChevronRight, Clock3, ListTodo, Plus, ScanText, TimerReset, Trash2, X } from "lucide-react"
import { BottomSheet } from "../../../components/ui/BottomSheet"
import { useTopBarSlot } from "../../../components/layout/topBarSlot"
import { siameseCopy } from "../../../components/brand/copy"
import { EmptyState } from "../../../components/ui/EmptyState"
import { useToast } from "../../../components/ui/ToastProvider"
import { cn } from "../../../lib/cn"
import { TaskEditor } from "../../tasks/components/TaskEditor"
import { useTaskStore } from "../../tasks/store/taskStore"
import { DEFAULT_TASK_LIST_ID, type CalendarEventType, type Task, type TaskDraft } from "../../tasks/types"
import { taskToDraft } from "../../tasks/utils"
import { useCountdownStore } from "../../countdown/store/countdownStore"
import type { CountdownDraft, CountdownEvent } from "../../countdown/types"
import { categoryLabels, DEFAULT_COUNTDOWN_COLOR, formatDateLabel, getAccentColor, getDaysInfo } from "../../countdown/utils"
import { type CalendarMode, type CalendarSourceType, useCalendarStore } from "../store/calendarStore"

const weekLabels = ["一", "二", "三", "四", "五", "六", "日"]
const modeOrder: Record<CalendarMode, number> = { month: 0, week: 1, day: 2 }
const hourSlots = Array.from({ length: 24 }, (_, hour) => hour * 60)
const quarterSlots = Array.from({ length: 96 }, (_, index) => index * 15)
const pinchThreshold = 36

const eventTypeMeta: Record<CalendarSourceType, { label: string; dot: string; soft: string; border: string }> = {
  task: {
    label: "任务",
    dot: "bg-[#6366F1]",
    soft: "bg-indigo-50 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-200",
    border: "border-l-[#6366F1]",
  },
  reminder: {
    label: "提醒",
    dot: "bg-[#10B981]",
    soft: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-200",
    border: "border-l-[#10B981]",
  },
  pomodoro: {
    label: "番茄钟",
    dot: "bg-[#F59E0B]",
    soft: "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-200",
    border: "border-l-[#F59E0B]",
  },
  countdown: {
    label: "日子",
    dot: "bg-[#11131A]",
    soft: "bg-neutral-100 text-neutral-900 dark:bg-white/10 dark:text-neutral-100",
    border: "border-l-[#11131A]",
  },
}

type CalendarItem =
  | {
      date: string
      id: string
      source: "task"
      task: Task
      title: string
      type: CalendarEventType
    }
  | {
      countdown: CountdownEvent
      date: string
      id: string
      source: "countdown"
      title: string
      type: "countdown"
    }

interface QuickAddState {
  date: string
  time?: string
  title: string
}

interface PinchGesture {
  startDistance: number
  currentDistance: number
  mode: CalendarMode
}

interface ImageScheduleDraft {
  draft: TaskDraft
  id: number
  ocrText: string
}

type TaskEditorEventType = CalendarEventType | "countdown"

function formatInputDate(date: Date): string {
  return format(date, "yyyy-MM-dd")
}

function parseDateKey(date?: string): Date | null {
  if (!date) return null
  const parsed = parseISO(date)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

function getLunarLabel(date: Date): string {
  try {
    return new Intl.DateTimeFormat("zh-CN-u-ca-chinese", { day: "numeric" }).format(date)
  } catch {
    return ""
  }
}

function getVisibleDays(cursorDate: Date, mode: CalendarMode): Date[] {
  if (mode === "day") return [cursorDate]
  if (mode === "week") {
    return eachDayOfInterval({
      start: startOfWeek(cursorDate, { weekStartsOn: 1 }),
      end: endOfWeek(cursorDate, { weekStartsOn: 1 }),
    })
  }

  return eachDayOfInterval({
    start: startOfWeek(startOfMonth(cursorDate), { weekStartsOn: 1 }),
    end: endOfWeek(endOfMonth(cursorDate), { weekStartsOn: 1 }),
  })
}

function getHeaderLabel(cursorDate: Date, mode: CalendarMode): string {
  if (mode === "day") return format(cursorDate, "yyyy年 M月 d日")
  if (mode === "week") {
    const start = startOfWeek(cursorDate, { weekStartsOn: 1 })
    const end = endOfWeek(cursorDate, { weekStartsOn: 1 })
    return `${format(start, "M月d日")} - ${format(end, "M月d日")}`
  }

  return format(cursorDate, "yyyy年 M月")
}

function moveCursor(cursorDate: Date, mode: CalendarMode, direction: "prev" | "next"): Date {
  if (mode === "month") return direction === "next" ? addMonths(cursorDate, 1) : subMonths(cursorDate, 1)
  if (mode === "week") return direction === "next" ? addWeeks(cursorDate, 1) : subWeeks(cursorDate, 1)
  return direction === "next" ? addDays(cursorDate, 1) : addDays(cursorDate, -1)
}

function tasksForDay(tasks: Task[], date: Date): Task[] {
  return tasks.filter((task) => {
    const dueDate = parseDateKey(task.dueDate)
    return dueDate ? isSameDay(dueDate, date) : false
  })
}

function countdownsForDay(events: CountdownEvent[], date: Date): CountdownEvent[] {
  return events.filter((event) => {
    const targetDate = parseDateKey(getDaysInfo(event).effectiveTargetDate)
    return targetDate ? isSameDay(targetDate, date) : false
  })
}

function timeToMinutes(time?: string): number {
  if (!time) return 9 * 60
  const [hour = "9", minute = "0"] = time.split(":")
  return Number(hour) * 60 + Number(minute)
}

function minutesToTime(minutes: number): string {
  const safeMinutes = Math.max(0, Math.min(23 * 60 + 45, minutes))
  const hour = Math.floor(safeMinutes / 60)
  const minute = safeMinutes % 60
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`
}

function formatTimeRange(task: Task): string {
  if (!task.startTime) return "全天"
  const start = task.startTime || "09:00"
  const end = task.endTime || minutesToTime(timeToMinutes(start) + 60)
  return `${start} - ${end}`
}

function getTaskDuration(task: Task): number {
  const start = timeToMinutes(task.startTime)
  const end = task.endTime ? timeToMinutes(task.endTime) : start + 60
  return Math.max(15, end - start)
}

function isTimedTask(task: Task): boolean {
  return Boolean(task.startTime)
}

function buildTaskCalendarItems(tasks: Task[]): CalendarItem[] {
  return tasks
    .filter((task) => Boolean(task.dueDate))
    .map((task) => ({
      date: task.dueDate ?? "",
      id: `task-${task.id}`,
      source: "task",
      task,
      title: task.title,
      type: task.eventType ?? "task",
    }))
}

function buildCountdownCalendarItems(events: CountdownEvent[]): CalendarItem[] {
  return events.map((event) => ({
    countdown: event,
    date: getDaysInfo(event).effectiveTargetDate,
    id: `countdown-${event.id}`,
    source: "countdown",
    title: event.title,
    type: "countdown",
  }))
}

function itemsForDay(items: CalendarItem[], date: Date): CalendarItem[] {
  return items.filter((item) => {
    const itemDate = parseDateKey(item.date)
    return itemDate ? isSameDay(itemDate, date) : false
  })
}

function buildMonthlyItemCache(items: CalendarItem[], cursorDate: Date): Map<string, CalendarItem[]> {
  const cachedMonths = new Set(
    [-1, 0, 1].map((offset) => format(startOfMonth(addMonths(cursorDate, offset)), "yyyy-MM"))
  )
  const cache = new Map<string, CalendarItem[]>()

  items.forEach((item) => {
    const itemDate = parseDateKey(item.date)
    if (!itemDate || !cachedMonths.has(format(startOfMonth(itemDate), "yyyy-MM"))) return

    const dateKey = formatInputDate(itemDate)
    const dayItems = cache.get(dateKey) ?? []
    cache.set(dateKey, [...dayItems, item])
  })

  return cache
}

function buildDraftFromTask(task: Task, patch: Partial<TaskDraft> = {}): TaskDraft {
  return {
    ...taskToDraft(task),
    ...patch,
  }
}

function normalizeOcrLines(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
}

function hasOcrDateHint(text: string): boolean {
  return /(?:(?:20\d{2})\s*[年\/.-]\s*)?\d{1,2}\s*[月\/.-]\s*\d{1,2}\s*(?:日|号)?|今天|明天|后天|周[一二三四五六日天]/.test(text)
}

function hasOcrTimeHint(text: string): boolean {
  return /(上午|下午|晚上|凌晨|中午)?\s*\d{1,2}(?:[:：点时]\d{0,2})\s*(?:分)?/.test(text)
}

function hasScheduleHint(text: string): boolean {
  return hasOcrDateHint(text) || hasOcrTimeHint(text)
}

function splitOcrScheduleTexts(text: string): string[] {
  const trimmed = text.trim()
  if (!trimmed) return []

  const paragraphs = trimmed
    .split(/\n\s*\n+/)
    .map((item) => item.trim())
    .filter(Boolean)

  const paragraphSchedules = paragraphs.filter(hasScheduleHint)
  if (paragraphSchedules.length > 1) return paragraphSchedules

  const lines = normalizeOcrLines(trimmed)
  const groups: string[][] = []
  let current: string[] = []

  lines.forEach((line) => {
    const startsNewSchedule = hasScheduleHint(line) && current.length > 0 && current.some((item) => hasScheduleHint(item))
    if (startsNewSchedule) {
      groups.push(current)
      current = [line]
      return
    }
    current.push(line)
  })

  if (current.length) groups.push(current)

  const lineSchedules = groups
    .map((group) => group.join("\n").trim())
    .filter((item) => item.length > 0 && hasScheduleHint(item))

  return lineSchedules.length > 1 ? lineSchedules : [trimmed]
}

function parseOcrDate(text: string, fallbackDate: string): string {
  const now = new Date()
  const year = now.getFullYear()
  const slashDate = text.match(/(?:(20\d{2})\s*[年\/.-]\s*)?(\d{1,2})\s*[月\/.-]\s*(\d{1,2})\s*(?:日|号)?/)
  if (slashDate) {
    const parsedYear = Number(slashDate[1] ?? year)
    const parsedMonth = Number(slashDate[2])
    const parsedDay = Number(slashDate[3])
    const parsed = new Date(parsedYear, parsedMonth - 1, parsedDay)
    if (!Number.isNaN(parsed.getTime())) return formatInputDate(parsed)
  }

  if (/明天/.test(text)) return formatInputDate(addDays(startOfToday(), 1))
  if (/后天/.test(text)) return formatInputDate(addDays(startOfToday(), 2))
  if (/今天/.test(text)) return formatInputDate(startOfToday())

  return fallbackDate
}

function parseOcrTime(text: string): { endTime: string; startTime: string } {
  const toTime = (rawHour: string, rawMinute: string | undefined, period?: string) => {
    let hour = Number(rawHour)
    const minute = rawMinute ? Number(rawMinute) : 0
    if ((period === "下午" || period === "晚上") && hour < 12) hour += 12
    if (period === "凌晨" && hour === 12) hour = 0
    if (hour > 23 || minute > 59) return ""
    return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`
  }

  const rangeMatch = text.match(/(上午|下午|晚上|凌晨|中午)?\s*(\d{1,2})(?:[:：点时](\d{1,2})?)?\s*(?:分)?\s*[-~—至到]\s*(上午|下午|晚上|凌晨|中午)?\s*(\d{1,2})(?:[:：点时](\d{1,2})?)?/)
  if (rangeMatch) {
    const startTime = toTime(rangeMatch[2], rangeMatch[3], rangeMatch[1])
    const endTime = toTime(rangeMatch[5], rangeMatch[6], rangeMatch[4] || rangeMatch[1])
    if (startTime) return { endTime: endTime || minutesToTime(timeToMinutes(startTime) + 60), startTime }
  }

  const timeMatches = Array.from(text.matchAll(/(上午|下午|晚上|凌晨|中午)?\s*(\d{1,2})(?:[:：点时](\d{1,2})?)(?:分)?/g))
    .map((match) => {
      const startTime = toTime(match[2], match[3], match[1])
      if (!startTime) return null
      return {
        endTime: "",
        startTime,
      }
    })
    .filter(Boolean) as Array<{ endTime: string; startTime: string }>

  const first = timeMatches[0]
  if (!first) return { endTime: "", startTime: "" }
  return {
    startTime: first.startTime,
    endTime: first.endTime || minutesToTime(timeToMinutes(first.startTime) + 60),
  }
}

function inferTitleFromOcr(text: string): string {
  const noisyPattern = /(日程|时间|日期|地点|地址|会议号|腾讯会议|zoom|扫码|二维码|星期|周[一二三四五六日天]?|上午|下午|晚上|今天|明天|后天|\d{1,2}[:：点]\d{0,2})/i
  const line = normalizeOcrLines(text)
    .map((item) => item.replace(/^[#\-•\s]+/, "").trim())
    .find((item) => item.length >= 2 && item.length <= 48 && !noisyPattern.test(item))

  return line || "图片识别日程"
}

function createDraftFromOcrText(text: string, fallbackDate: string): TaskDraft {
  const trimmed = text.trim()
  const { endTime, startTime } = parseOcrTime(trimmed)
  return {
    listId: DEFAULT_TASK_LIST_ID,
    title: inferTitleFromOcr(trimmed),
    note: [`图片 OCR 识别内容：`, trimmed].filter(Boolean).join("\n\n"),
    priority: "medium",
    dueDate: parseOcrDate(trimmed, fallbackDate),
    startTime,
    endTime,
    eventType: "task",
    tags: "图片识别, 日程",
  }
}

function createDraftsFromOcrText(text: string, fallbackDate: string): TaskDraft[] {
  const seen = new Set<string>()
  return splitOcrScheduleTexts(text)
    .map((scheduleText) => createDraftFromOcrText(scheduleText, fallbackDate))
    .filter((draft) => {
      const key = `${draft.title}|${draft.dueDate}|${draft.startTime}|${draft.endTime}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
}

function createCountdownDraftFromTaskDraft(draft: TaskDraft, fallbackDate: string): CountdownDraft {
  return {
    category: "life",
    color: DEFAULT_COUNTDOWN_COLOR,
    linkedTaskIds: [],
    note: draft.note,
    reminderDaysBefore: 0,
    reminderEnabled: false,
    targetDate: draft.dueDate || fallbackDate,
    title: draft.title,
    type: "countdown",
  }
}

export function CalendarPage() {
  const location = useLocation()
  const navigate = useNavigate()
  const { tasks, taskLists, addTask, deleteTask, toggleTask, updateTask } = useTaskStore()
  const countdownEvents = useCountdownStore((state) => state.events)
  const addCountdownEvent = useCountdownStore((state) => state.addEvent)
  const deleteCountdownEvent = useCountdownStore((state) => state.deleteEvent)
  const selectCountdownEvent = useCountdownStore((state) => state.selectEvent)
  const {
    activeEventTypes,
    mode,
    cursorDate,
    selectedDate,
    showLunar,
    setMode,
    setCursorDate,
    setSelectedDate,
    setShowLunar,
    showEventType,
    toggleEventType,
    resetToToday,
  } = useCalendarStore()
  const { notify } = useToast()
  const topBarSlot = useTopBarSlot()
  const [editorOpen, setEditorOpen] = useState(false)
  const [imageDraft, setImageDraft] = useState<ImageScheduleDraft | null>(null)
  const [imagePasteOpen, setImagePasteOpen] = useState(false)
  const [imageRecognizing, setImageRecognizing] = useState(false)
  const [pastedImageDataUrls, setPastedImageDataUrls] = useState<string[]>([])
  const [monthPanelOpen, setMonthPanelOpen] = useState(false)
  const [quickAdd, setQuickAdd] = useState<QuickAddState | null>(null)
  const [currentMinutes, setCurrentMinutes] = useState(() => {
    const now = new Date()
    return now.getHours() * 60 + now.getMinutes()
  })
  const [slideDirection, setSlideDirection] = useState(1)
  const gestureStartX = useRef<number | null>(null)
  const pinchGesture = useRef<PinchGesture | null>(null)

  const cursorDateValue = useMemo(() => parseISO(cursorDate), [cursorDate])
  const selectedDateValue = useMemo(() => parseISO(selectedDate), [selectedDate])
  const visibleDays = useMemo(() => getVisibleDays(cursorDateValue, mode), [cursorDateValue, mode])
  const filteredTasks = useMemo(
    () => tasks.filter((task) => activeEventTypes.includes(task.eventType ?? "task")),
    [activeEventTypes, tasks]
  )
  const filteredCountdownEvents = useMemo(
    () => (activeEventTypes.includes("countdown") ? countdownEvents : []),
    [activeEventTypes, countdownEvents]
  )
  const calendarItems = useMemo(
    () => [...buildTaskCalendarItems(filteredTasks), ...buildCountdownCalendarItems(filteredCountdownEvents)],
    [filteredCountdownEvents, filteredTasks]
  )
  const monthlyItemCache = useMemo(
    () => buildMonthlyItemCache(calendarItems, cursorDateValue),
    [calendarItems, cursorDateValue]
  )
  const selectedItems = useMemo(() => itemsForDay(calendarItems, selectedDateValue), [calendarItems, selectedDateValue])
  const scheduledCount = filteredTasks.filter((task) => task.dueDate && !task.completed).length
  const overdueCount = filteredTasks.filter((task) => {
    const dueDate = parseDateKey(task.dueDate)
    return dueDate && dueDate < startOfToday() && !task.completed
  }).length
  const showDesktopPanel = mode === "day" || (mode === "month" && monthPanelOpen)

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))

  useEffect(() => {
    const interval = window.setInterval(() => {
      const now = new Date()
      setCurrentMinutes(now.getHours() * 60 + now.getMinutes())
    }, 60_000)

    return () => window.clearInterval(interval)
  }, [])

  useEffect(() => {
    const controls = (
      <div className="flex min-w-0 flex-wrap items-center justify-end gap-2">
        <div className="inline-flex rounded-xl border border-[var(--ff-border)] bg-[var(--ff-surface-muted)] p-1" role="tablist" aria-label="日历视图">
          <SegmentedModeButton mode={mode} target="month" onChange={changeMode}>月</SegmentedModeButton>
          <SegmentedModeButton mode={mode} target="week" onChange={changeMode}>周</SegmentedModeButton>
          <SegmentedModeButton mode={mode} target="day" onChange={changeMode}>日</SegmentedModeButton>
        </div>
        <button
          className={cn(
            "rounded-xl px-4 py-2 text-sm font-medium transition",
            showLunar ? "bg-[var(--ff-brand-soft)] text-[var(--ff-brand-text)]" : "ff-button-secondary"
          )}
          type="button"
          onClick={() => setShowLunar(!showLunar)}
        >
          农历
        </button>
        <button
          className="ff-button-secondary rounded-xl px-4 py-2 text-sm"
          type="button"
          disabled={imageRecognizing}
          onClick={openImagePasteSheet}
        >
          <ScanText className="h-4 w-4" />
          {imageRecognizing ? "识别中" : "识图日程"}
        </button>
      </div>
    )

    topBarSlot?.setTopBarSlot({
      desktop: controls,
      mobileAction: (
        <div className="flex items-center gap-2">
          <button
            className={cn(
              "h-10 shrink-0 rounded-2xl px-3 text-sm font-semibold transition",
              showLunar ? "bg-[var(--ff-brand-soft)] text-[var(--ff-brand-text)]" : "ff-button-secondary"
            )}
            type="button"
            onClick={() => setShowLunar(!showLunar)}
          >
            农历
          </button>
          <button
            className="ff-button-secondary h-10 w-10 shrink-0 rounded-2xl p-0"
            type="button"
            aria-label="识图日程"
            disabled={imageRecognizing}
            onClick={openImagePasteSheet}
          >
            <ScanText className="h-4 w-4" />
          </button>
        </div>
      ),
      mobilePanel: (
        <div className="inline-flex w-full rounded-xl border border-[var(--ff-border)] bg-[var(--ff-surface-muted)] p-1" role="tablist" aria-label="日历视图">
          <SegmentedModeButton mode={mode} target="month" onChange={changeMode}>月</SegmentedModeButton>
          <SegmentedModeButton mode={mode} target="week" onChange={changeMode}>周</SegmentedModeButton>
          <SegmentedModeButton mode={mode} target="day" onChange={changeMode}>日</SegmentedModeButton>
        </div>
      ),
    })

    return () => topBarSlot?.setTopBarSlot(null)
  }, [imageRecognizing, mode, showLunar, topBarSlot])

  useEffect(() => {
    const params = new URLSearchParams(location.search)
    const dateParam = params.get("date")
    if (!dateParam || !parseDateKey(dateParam)) return
    setCursorDate(dateParam)
    setSelectedDate(dateParam)
    setMode("day")
    if (params.get("source") === "countdown") {
      showEventType("countdown")
    }
  }, [location.search, setCursorDate, setMode, setSelectedDate, showEventType])

  function changeMode(nextMode: CalendarMode) {
    const anchorDate = mode === "month" ? selectedDate : cursorDate
    setSlideDirection(modeOrder[nextMode] > modeOrder[mode] ? 1 : -1)
    if (nextMode !== "month") {
      setCursorDate(anchorDate)
      setSelectedDate(anchorDate)
      setMonthPanelOpen(false)
    }
    setMode(nextMode)
  }

  function move(direction: "prev" | "next") {
    setSlideDirection(direction === "next" ? 1 : -1)
    setCursorDate(formatInputDate(moveCursor(cursorDateValue, mode, direction)))
  }

  function selectDate(date: Date) {
    setSelectedDate(formatInputDate(date))
    if (mode === "month") setMonthPanelOpen(true)
  }

  function openCreateForDate(date: Date) {
    setImageDraft(null)
    setSelectedDate(formatInputDate(date))
    setQuickAdd(null)
    setMonthPanelOpen(false)
    setEditorOpen(true)
  }

  function handleSubmit(draft: TaskDraft, eventType: TaskEditorEventType) {
    if (eventType === "countdown") {
      const eventId = addCountdownEvent(createCountdownDraftFromTaskDraft(draft, selectedDate))
      selectCountdownEvent(eventId)
      showEventType("countdown")
      setImageDraft(null)
      setEditorOpen(false)
      notify("日子已记录", "success")
      return
    }

    addTask(draft)
    setImageDraft(null)
    setEditorOpen(false)
    notify("事项已创建", "success")
  }

  function openImagePasteSheet() {
    setPastedImageDataUrls([])
    setImagePasteOpen(true)
  }

  async function handleRecognizeImageSchedule(dataUrls: string[]) {
    if (!window.focusflowCalendarOCR) {
      notify("当前环境暂不支持图片识别", "warning")
      return
    }
    if (!dataUrls.length) {
      notify("先在弹窗中添加图片", "info")
      return
    }

    setImageRecognizing(true)
    try {
      const texts: string[] = []
      for (const dataUrl of dataUrls) {
        const result = await window.focusflowCalendarOCR.recognizeImage({ dataUrl })
        if (result.canceled) continue
        if (result.text.trim()) texts.push(result.text.trim())
      }

      if (!texts.length) {
        notify("图片里没有识别到文字", "warning")
        return
      }

      const drafts = texts.flatMap((text) => createDraftsFromOcrText(text, selectedDate))
      setImagePasteOpen(false)
      setPastedImageDataUrls([])
      setMonthPanelOpen(false)

      if (drafts.length === 1) {
        const draft = drafts[0]
        setImageDraft({ draft, id: Date.now(), ocrText: texts.join("\n\n---\n\n") })
        setSelectedDate(draft.dueDate || selectedDate)
        setEditorOpen(true)
        notify("已识别图片内容，请确认日程信息", "success")
        return
      }

      drafts.forEach((draft) => addTask(draft))
      const firstDate = drafts.find((draft) => draft.dueDate)?.dueDate
      if (firstDate) setSelectedDate(firstDate)
      setImageDraft(null)
      setEditorOpen(false)
      notify(`已创建 ${drafts.length} 条识图日程`, "success")
    } catch (error) {
      notify(error instanceof Error ? error.message : "图片识别失败", "warning")
    } finally {
      setImageRecognizing(false)
    }
  }

  function openCountdownEvent(countdown: CountdownEvent) {
    selectCountdownEvent(countdown.id)
    navigate(`/countdown?event=${countdown.id}`)
  }

  function handleDeleteCalendarTask(task: Task) {
    const confirmed = window.confirm(`删除「${task.title}」？它会移到回收站。`)
    if (!confirmed) return
    deleteTask(task.id)
    notify("事项已移到回收站", "info")
  }

  function handleDeleteCalendarCountdown(countdown: CountdownEvent) {
    const confirmed = window.confirm(`删除日子「${countdown.title}」？它会移到回收站。`)
    if (!confirmed) return
    deleteCountdownEvent(countdown.id)
    notify("日子已移到回收站", "info")
  }

  function createQuickTask() {
    if (!quickAdd?.title.trim()) return
    const startTime = quickAdd.time ?? ""
    addTask({
      listId: DEFAULT_TASK_LIST_ID,
      title: quickAdd.title.trim(),
      note: "",
      priority: "medium",
      dueDate: quickAdd.date,
      startTime,
      endTime: quickAdd.time ? minutesToTime(timeToMinutes(startTime) + 60) : "",
      eventType: "task",
      tags: "日程",
    })
    setQuickAdd(null)
    notify("事项已添加", "success")
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over) return
    const task = tasks.find((item) => item.id === String(active.id))
    if (!task) return

    const [date, minutes] = String(over.id).split("__")
    if (!date || !minutes) return
    const startTime = minutesToTime(Number(minutes))
    const duration = getTaskDuration(task)
    updateTask(task.id, buildDraftFromTask(task, {
      dueDate: date,
      startTime,
      endTime: minutesToTime(Number(minutes) + duration),
    }))
    setSelectedDate(date)
    notify(`已调整到 ${startTime}`, "success")
  }

  function handlePointerDown(event: PointerEvent<HTMLDivElement>) {
    if (pinchGesture.current) return
    gestureStartX.current = event.clientX
  }

  function handlePointerUp(event: PointerEvent<HTMLDivElement>) {
    if (gestureStartX.current === null) return
    const delta = event.clientX - gestureStartX.current
    gestureStartX.current = null
    if (Math.abs(delta) < 64) return
    move(delta < 0 ? "next" : "prev")
  }

  function getTouchDistance(touches: TouchEvent<HTMLDivElement>["touches"]): number {
    const first = touches.item(0)
    const second = touches.item(1)
    if (!first || !second) return 0

    return Math.hypot(second.clientX - first.clientX, second.clientY - first.clientY)
  }

  function handleTouchStart(event: TouchEvent<HTMLDivElement>) {
    if (event.touches.length !== 2) return
    const distance = getTouchDistance(event.touches)
    gestureStartX.current = null
    pinchGesture.current = { startDistance: distance, currentDistance: distance, mode }
  }

  function handleTouchMove(event: TouchEvent<HTMLDivElement>) {
    if (!pinchGesture.current || event.touches.length !== 2) return
    pinchGesture.current.currentDistance = getTouchDistance(event.touches)
  }

  function handleTouchEnd() {
    const gesture = pinchGesture.current
    pinchGesture.current = null
    if (!gesture) return

    const delta = gesture.currentDistance - gesture.startDistance
    if (Math.abs(delta) < pinchThreshold) return

    if (gesture.mode === "month" && delta < 0) {
      changeMode("week")
    }

    if (gesture.mode === "week" && delta > 0) {
      changeMode("day")
    }
  }

  const initialDraft: TaskDraft = {
    listId: DEFAULT_TASK_LIST_ID,
    title: "",
    note: "",
    priority: "medium",
    dueDate: selectedDate,
    startTime: "",
    endTime: "",
    eventType: "task",
    tags: "日程",
  }
  const editorDraft = imageDraft?.draft ?? initialDraft

  return (
    <div className={cn("mx-auto grid w-full max-w-7xl gap-6", showDesktopPanel ? "xl:grid-cols-[minmax(0,1fr)_340px]" : "xl:grid-cols-1")}>
      <section className="min-w-0">
        <button
          className="ff-button-primary fixed bottom-24 right-5 z-30 grid h-12 w-12 place-items-center rounded-full p-0 shadow-[0_12px_28px_rgba(59,125,216,0.22)] sm:bottom-6 sm:right-6"
          type="button"
          onClick={() => openCreateForDate(selectedDateValue)}
          aria-label="新建事项"
          title="新建事项"
        >
          <CalendarPlus className="h-5 w-5" />
        </button>

        <div
          className="ff-card overflow-hidden"
          onPointerDown={handlePointerDown}
          onPointerUp={handlePointerUp}
          onTouchEnd={handleTouchEnd}
          onTouchMove={handleTouchMove}
          onTouchStart={handleTouchStart}
        >
          <header className="flex flex-col gap-3 border-b border-[var(--ff-border)] p-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-2">
              <button className="ff-icon-button h-11 w-11" type="button" aria-label="上一段时间" onClick={() => move("prev")}>
                <ChevronLeft className="h-5 w-5" />
              </button>
              <h2 className="min-w-44 text-center text-xl font-semibold text-slate-950 dark:text-slate-100">
                {getHeaderLabel(cursorDateValue, mode)}
              </h2>
              <button className="ff-icon-button h-11 w-11" type="button" aria-label="下一段时间" onClick={() => move("next")}>
                <ChevronRight className="h-5 w-5" />
              </button>
              <button className="ff-button-primary ml-0 px-4 py-3 text-sm lg:ml-2" type="button" onClick={resetToToday}>
                今天
              </button>
            </div>
            <Legend activeEventTypes={activeEventTypes} onToggle={toggleEventType} />
          </header>

          <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
            <AnimatePresence mode="wait">
              <motion.div
                key={`${mode}-${cursorDate}-${showLunar}-${activeEventTypes.join("-")}`}
                initial={{ opacity: 0, x: slideDirection * 48 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: slideDirection * -48 }}
                transition={{ duration: 0.28, ease: "easeInOut" }}
              >
                {mode === "month" ? (
                  <MonthView
                    cursorDate={cursorDateValue}
                    days={visibleDays}
                    onDeleteCountdown={handleDeleteCalendarCountdown}
                    onDeleteTask={handleDeleteCalendarTask}
                    onSelectDate={selectDate}
                    selectedDate={selectedDateValue}
                    showLunar={showLunar}
                    itemsByDate={monthlyItemCache}
                    onOpenCountdown={openCountdownEvent}
                  />
                ) : (
                  <TimeGrid
                    currentMinutes={currentMinutes}
                    days={visibleDays}
                    mode={mode}
                    onDeleteCountdown={handleDeleteCalendarCountdown}
                    onDeleteTask={handleDeleteCalendarTask}
                    onOpenCountdown={openCountdownEvent}
                    onQuickCreate={(date, time) => {
                      setSelectedDate(date)
                      setQuickAdd({ date, time, title: "" })
                    }}
                    quickAdd={quickAdd}
                    setQuickAdd={setQuickAdd}
                    submitQuickTask={createQuickTask}
                    countdownEvents={filteredCountdownEvents}
                    tasks={filteredTasks}
                    toggleTask={toggleTask}
                  />
                )}
              </motion.div>
            </AnimatePresence>
          </DndContext>
        </div>

        {mode === "day" ? (
          <div className="mt-4 xl:hidden">
            <DayPanel
              date={selectedDateValue}
              onCreate={() => openCreateForDate(selectedDateValue)}
              onDeleteCountdown={handleDeleteCalendarCountdown}
              onDeleteTask={handleDeleteCalendarTask}
              onQuickAdd={() => setQuickAdd({ date: selectedDate, title: "" })}
              overdueCount={overdueCount}
              quickAdd={quickAdd}
              setQuickAdd={setQuickAdd}
              scheduledCount={scheduledCount}
              submitQuickTask={createQuickTask}
              items={selectedItems}
              onOpenCountdown={openCountdownEvent}
              toggleTask={toggleTask}
            />
          </div>
        ) : null}
      </section>

      <AnimatePresence initial={false}>
        {showDesktopPanel ? (
          <motion.aside
            className="hidden space-y-4 xl:block"
            initial={{ opacity: 0, x: 32 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 32 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
          >
            <DayPanel
              date={selectedDateValue}
              onClose={mode === "month" ? () => setMonthPanelOpen(false) : undefined}
              onCreate={() => openCreateForDate(selectedDateValue)}
              onDeleteCountdown={handleDeleteCalendarCountdown}
              onDeleteTask={handleDeleteCalendarTask}
              onQuickAdd={() => setQuickAdd({ date: selectedDate, title: "" })}
              overdueCount={overdueCount}
              quickAdd={quickAdd}
              setQuickAdd={setQuickAdd}
              scheduledCount={scheduledCount}
              submitQuickTask={createQuickTask}
              items={selectedItems}
              onOpenCountdown={openCountdownEvent}
              toggleTask={toggleTask}
            />
          </motion.aside>
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {imagePasteOpen ? (
          <ImageSchedulePasteSheet
            imageDataUrls={pastedImageDataUrls}
            loading={imageRecognizing}
            onChangeImages={setPastedImageDataUrls}
            onClose={() => {
              if (imageRecognizing) return
              setImagePasteOpen(false)
              setPastedImageDataUrls([])
            }}
            onRecognize={() => handleRecognizeImageSchedule(pastedImageDataUrls)}
          />
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {monthPanelOpen ? (
          <div className="xl:hidden">
            <BottomSheet ariaLabel="当日事项" className="max-w-xl" onClose={() => setMonthPanelOpen(false)}>
              <div className="p-4">
                <DayPanel
                  date={selectedDateValue}
                  onClose={() => setMonthPanelOpen(false)}
                  onCreate={() => openCreateForDate(selectedDateValue)}
                  onDeleteCountdown={handleDeleteCalendarCountdown}
                  onDeleteTask={handleDeleteCalendarTask}
                  onQuickAdd={() => setQuickAdd({ date: selectedDate, title: "" })}
                  overdueCount={overdueCount}
                  quickAdd={quickAdd}
                  setQuickAdd={setQuickAdd}
                  scheduledCount={scheduledCount}
                  submitQuickTask={createQuickTask}
                  items={selectedItems}
                  onOpenCountdown={openCountdownEvent}
                  toggleTask={toggleTask}
                />
              </div>
            </BottomSheet>
          </div>
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {editorOpen ? (
          <TaskEditor
            key={imageDraft ? `image-${imageDraft.id}` : selectedDate}
            initialDraft={editorDraft}
            includeCountdownType
            taskLists={taskLists}
            onClose={() => {
              setImageDraft(null)
              setEditorOpen(false)
            }}
            onSubmit={handleSubmit}
          />
        ) : null}
      </AnimatePresence>
    </div>
  )
}

function SegmentedModeButton({ children, mode, onChange, target }: { children: ReactNode; mode: CalendarMode; onChange: (mode: CalendarMode) => void; target: CalendarMode }) {
  return (
    <button
      aria-selected={mode === target}
      className={cn(
        "rounded-lg px-4 py-2 text-sm font-medium transition",
        mode === target ? "bg-[var(--ff-surface)] text-slate-950 dark:text-slate-100" : "text-slate-500 hover:text-slate-950 dark:text-slate-400 dark:hover:text-slate-100"
      )}
      role="tab"
      type="button"
      onClick={() => onChange(target)}
    >
      {children}
    </button>
  )
}

function ImageSchedulePasteSheet({
  imageDataUrls,
  loading,
  onChangeImages,
  onClose,
  onRecognize,
}: {
  imageDataUrls: string[]
  loading: boolean
  onChangeImages: (value: string[]) => void
  onClose: () => void
  onRecognize: () => void
}) {
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  function readImageFiles(files: File[]) {
    if (!files.length) return
    Promise.all(
      files.map(
        (file) =>
          new Promise<string>((resolve, reject) => {
            const reader = new FileReader()
            reader.onload = () => {
              if (typeof reader.result === "string") {
                resolve(reader.result)
                return
              }
              reject(new Error("图片读取失败"))
            }
            reader.onerror = () => reject(new Error("图片读取失败"))
            reader.readAsDataURL(file)
          })
      )
    )
      .then((dataUrls) => onChangeImages([...imageDataUrls, ...dataUrls]))
      .catch(() => {
        onChangeImages(imageDataUrls)
      })
  }

  function handlePaste(event: ClipboardEvent<HTMLDivElement>) {
    const files = Array.from(event.clipboardData.items)
      .filter((clipboardItem) => clipboardItem.type.startsWith("image/"))
      .map((clipboardItem) => clipboardItem.getAsFile())
      .filter(Boolean) as File[]
    if (!files.length) return

    event.preventDefault()
    readImageFiles(files)
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    readImageFiles(Array.from(event.target.files ?? []).filter((file) => file.type.startsWith("image/")))
    event.target.value = ""
  }

  function removeImage(index: number) {
    onChangeImages(imageDataUrls.filter((_, itemIndex) => itemIndex !== index))
  }

  return (
    <BottomSheet ariaLabel="多图识别日程" className="max-w-3xl overflow-hidden" onClose={onClose}>
      <div className="border-b border-[var(--ff-border)] px-5 py-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="ff-mono text-[10px] uppercase tracking-[0.24em] text-[var(--ff-muted)]">image to schedule</p>
            <h2 className="ff-display mt-1 text-2xl text-[var(--ff-text)]">多图识别日程</h2>
          </div>
          <button className="ff-icon-button h-10 w-10" type="button" aria-label="关闭识图日程" disabled={loading} onClick={onClose}>
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="px-5 py-4">
        <div
          className={cn(
            "grid min-h-72 place-items-center overflow-hidden rounded-[24px] border border-dashed border-black/14 bg-white/40 p-4 text-center outline-none transition",
            "focus:border-[var(--ff-brand)] focus:bg-white/58 focus:shadow-[0_0_0_4px_rgba(59,125,216,0.12)]"
          )}
          tabIndex={0}
          onPaste={handlePaste}
        >
          {imageDataUrls.length ? (
            <div className="grid w-full grid-cols-2 gap-3 sm:grid-cols-3">
              {imageDataUrls.map((imageDataUrl, index) => (
                <div className="group relative aspect-[4/3] overflow-hidden rounded-[18px] border border-black/10 bg-white/60 shadow-[0_12px_32px_rgba(17,19,26,0.1)]" key={`${imageDataUrl.slice(0, 48)}-${index}`}>
                  <img className="h-full w-full object-contain" src={imageDataUrl} alt={`待识别日程图片 ${index + 1}`} />
                  <span className="absolute left-2 top-2 rounded-full bg-black/70 px-2 py-1 text-[10px] font-semibold text-white">{index + 1}</span>
                  <button
                    className="ff-icon-button ff-danger-action absolute right-2 top-2 h-8 w-8 bg-white/90 opacity-0 shadow-sm transition-opacity group-hover:opacity-100 focus:opacity-100"
                    type="button"
                    aria-label={`移除第 ${index + 1} 张图片`}
                    disabled={loading}
                    onClick={() => removeImage(index)}
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="max-w-sm">
              <ScanText className="mx-auto h-10 w-10 text-[var(--ff-brand)]" />
              <p className="mt-3 text-base font-semibold text-[var(--ff-text)]">点击这里粘贴图片，或添加多张图片</p>
              <p className="mt-2 text-sm leading-6 text-[var(--ff-muted)]">支持截图、聊天里的日程图片、课程表或会议通知。多张图片会逐张识别；一张图片里有多条日程时会拆成多条创建。</p>
            </div>
          )}
        </div>
        <input ref={fileInputRef} className="hidden" type="file" accept="image/*" multiple onChange={handleFileChange} />
      </div>

      <div className="flex flex-wrap justify-between gap-2 border-t border-[var(--ff-border)] px-5 py-4">
        <div className="flex flex-wrap gap-2">
          <button className="ff-button-secondary px-4 py-3 text-sm" type="button" disabled={loading} onClick={() => fileInputRef.current?.click()}>
            <Plus className="h-4 w-4" />
            添加图片
          </button>
          <button className="ff-button-secondary px-4 py-3 text-sm" type="button" disabled={loading || !imageDataUrls.length} onClick={() => onChangeImages([])}>
            清空
          </button>
        </div>
        <div className="flex gap-2">
          <button className="ff-button-secondary px-4 py-3 text-sm" type="button" disabled={loading} onClick={onClose}>
            取消
          </button>
          <button className="ff-button-primary px-4 py-3 text-sm" type="button" disabled={loading || !imageDataUrls.length} onClick={onRecognize}>
            <ScanText className="h-4 w-4" />
            {loading ? "识别中" : `识别 ${imageDataUrls.length} 张`}
          </button>
        </div>
      </div>
    </BottomSheet>
  )
}

function MonthView({
  cursorDate,
  days,
  itemsByDate,
  onDeleteCountdown,
  onDeleteTask,
  onOpenCountdown,
  onSelectDate,
  selectedDate,
  showLunar,
}: {
  cursorDate: Date
  days: Date[]
  itemsByDate: Map<string, CalendarItem[]>
  onDeleteCountdown: (countdown: CountdownEvent) => void
  onDeleteTask: (task: Task) => void
  onOpenCountdown: (countdown: CountdownEvent) => void
  onSelectDate: (date: Date) => void
  selectedDate: Date
  showLunar: boolean
}) {
  return (
    <>
      <div className="grid grid-cols-7 border-b border-[var(--ff-border)] bg-[var(--ff-surface-muted)] text-center text-xs font-semibold text-slate-500 dark:text-slate-400">
        {weekLabels.map((label) => (
          <div className="py-3" key={label}>{label}</div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {days.map((day) => {
          const dayItems = itemsByDate.get(formatInputDate(day)) ?? []
          const weekend = day.getDay() === 0 || day.getDay() === 6
          return (
            <div
              className={cn(
                "relative min-h-20 border-b border-r border-[var(--ff-border)] p-2 text-left transition hover:bg-[var(--ff-surface-muted)] active:bg-[var(--ff-surface-muted)]",
                !isSameMonth(day, cursorDate) && "bg-[var(--ff-surface-muted)] text-slate-400",
                isSameDay(day, selectedDate) && "bg-[var(--ff-surface-raised)] ring-2 ring-inset ring-[var(--ff-brand)]",
                weekend && "opacity-50"
              )}
              key={day.toISOString()}
              role="button"
              tabIndex={0}
              onClick={() => onSelectDate(day)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault()
                  onSelectDate(day)
                }
              }}
            >
              <div className="relative mb-2 inline-flex min-h-8 min-w-8 flex-col items-center">
                <span className={cn("grid h-7 w-7 place-items-center rounded-full text-sm font-semibold", isSameDay(day, selectedDate) ? "bg-[var(--ff-brand)] text-[var(--ff-paper)] shadow-[0_8px_18px_rgba(17,19,26,0.16)]" : isToday(day) ? "bg-indigo-500 text-white" : "text-slate-700 dark:text-slate-200")}>
                  {format(day, "d")}
                </span>
                {dayItems.length ? <span className="mt-1 h-1 w-1 rounded-full bg-[var(--ff-brand)]" /> : null}
                {showLunar ? <span className="absolute -bottom-1 -right-4 text-[9px] text-slate-400">{getLunarLabel(day)}</span> : null}
              </div>
              <div className="space-y-1">
                {dayItems.slice(0, 3).map((item) => (
                  <CalendarEventPill item={item} key={item.id} onDeleteCountdown={onDeleteCountdown} onDeleteTask={onDeleteTask} onOpenCountdown={onOpenCountdown} />
                ))}
                {dayItems.length > 3 ? <p className="text-[11px] text-slate-400">+{dayItems.length - 3} 项</p> : null}
              </div>
            </div>
          )
        })}
      </div>
    </>
  )
}

function TimeGrid({ countdownEvents, currentMinutes, days, mode, onDeleteCountdown, onDeleteTask, onOpenCountdown, onQuickCreate, quickAdd, setQuickAdd, submitQuickTask, tasks, toggleTask }: { countdownEvents: CountdownEvent[]; currentMinutes: number; days: Date[]; mode: CalendarMode; onDeleteCountdown: (countdown: CountdownEvent) => void; onDeleteTask: (task: Task) => void; onOpenCountdown: (countdown: CountdownEvent) => void; onQuickCreate: (date: string, time: string) => void; quickAdd: QuickAddState | null; setQuickAdd: (value: QuickAddState | null) => void; submitQuickTask: () => void; tasks: Task[]; toggleTask: (taskId: string) => void }) {
  const slots = mode === "day" ? quarterSlots : hourSlots
  const slotHeight = mode === "day" ? 28 : 48
  const granularity = mode === "day" ? 15 : 60

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[760px]">
        <div className="grid border-b border-[var(--ff-border)] bg-[var(--ff-surface-muted)]" style={{ gridTemplateColumns: `48px repeat(${days.length}, minmax(0, 1fr))` }}>
          <div />
          {days.map((day) => (
            <div className="p-3 text-center text-sm font-semibold text-slate-700 dark:text-slate-200" key={day.toISOString()}>
              {format(day, mode === "day" ? "M月d日 EEE" : "EEE d")}
            </div>
          ))}
        </div>
        <AllDayBanner countdownEvents={countdownEvents} days={days} onDeleteCountdown={onDeleteCountdown} onDeleteTask={onDeleteTask} onOpenCountdown={onOpenCountdown} tasks={tasks} toggleTask={toggleTask} />
        <div className="relative grid" style={{ gridTemplateColumns: `48px repeat(${days.length}, minmax(0, 1fr))` }}>
          <div className="border-r border-[var(--ff-border)]">
            {slots.map((minutes) => (
              <div className="border-b border-[var(--ff-border)] pr-2 text-right text-[11px] text-slate-400" key={minutes} style={{ height: slotHeight }}>
                {minutes % 60 === 0 ? minutesToTime(minutes) : ""}
              </div>
            ))}
          </div>
          {days.map((day) => {
            const dateKey = formatInputDate(day)
            const timedTasks = tasksForDay(tasks, day).filter(isTimedTask)
            return (
              <div className="relative border-r border-[var(--ff-border)]" key={dateKey}>
                {isToday(day) ? (
                  <div className="pointer-events-none absolute inset-x-0 z-10 border-t border-red-500" style={{ top: (currentMinutes / granularity) * slotHeight }}>
                    <span className="absolute -left-[53px] -top-1.5 h-3 w-3 rounded-full bg-red-500" />
                  </div>
                ) : null}
                {slots.map((minutes) => (
                  <TimeSlot
                    date={dateKey}
                    key={`${dateKey}-${minutes}`}
                    minutes={minutes}
                    onQuickCreate={onQuickCreate}
                    quickAdd={quickAdd}
                    setQuickAdd={setQuickAdd}
                    slotHeight={slotHeight}
                    submitQuickTask={submitQuickTask}
                  />
                ))}
                <TimelineEventLayer
                  granularity={granularity}
                  onDeleteTask={onDeleteTask}
                  slotHeight={slotHeight}
                  tasks={timedTasks}
                  toggleTask={toggleTask}
                />
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function AllDayBanner({ countdownEvents, days, onDeleteCountdown, onDeleteTask, onOpenCountdown, tasks, toggleTask }: { countdownEvents: CountdownEvent[]; days: Date[]; onDeleteCountdown: (countdown: CountdownEvent) => void; onDeleteTask: (task: Task) => void; onOpenCountdown: (countdown: CountdownEvent) => void; tasks: Task[]; toggleTask: (taskId: string) => void }) {
  return (
    <div className="grid border-b border-[var(--ff-border)]" style={{ gridTemplateColumns: `48px repeat(${days.length}, minmax(0, 1fr))` }}>
      <div className="border-r border-[var(--ff-border)] px-1 py-2 text-center text-[10px] font-medium text-slate-400">
        全天
      </div>
      {days.map((day) => {
        const dayTasks = tasksForDay(tasks, day).filter((task) => !isTimedTask(task))
        const dayCountdowns = countdownsForDay(countdownEvents, day)
        const hasItems = dayTasks.length || dayCountdowns.length
        return (
          <div className="min-h-14 border-r border-[var(--ff-border)] p-2" key={day.toISOString()}>
            {hasItems ? (
              <div className="flex flex-wrap gap-1.5">
                {dayCountdowns.map((countdown) => (
                  <CalendarEventPill item={buildCountdownCalendarItems([countdown])[0]} key={countdown.id} onDeleteCountdown={onDeleteCountdown} onDeleteTask={onDeleteTask} onOpenCountdown={onOpenCountdown} />
                ))}
                {dayTasks.map((task) => (
                  <CalendarEventPill
                    item={buildTaskCalendarItems([task])[0]}
                    key={task.id}
                    onDeleteCountdown={onDeleteCountdown}
                    onDeleteTask={onDeleteTask}
                    onOpenCountdown={onOpenCountdown}
                    onToggleTask={toggleTask}
                  />
                ))}
              </div>
            ) : (
              <span className="text-[11px] text-slate-300 dark:text-slate-600">跨天 / 全天</span>
            )}
          </div>
        )
      })}
    </div>
  )
}

function TimelineEventLayer({ granularity, onDeleteTask, slotHeight, tasks, toggleTask }: { granularity: number; onDeleteTask: (task: Task) => void; slotHeight: number; tasks: Task[]; toggleTask: (taskId: string) => void }) {
  return (
    <div className="pointer-events-none absolute inset-x-1 top-0 z-20">
      {tasks.map((task) => {
        const top = (timeToMinutes(task.startTime) / granularity) * slotHeight + 2
        const height = Math.max(32, (getTaskDuration(task) / granularity) * slotHeight - 4)

        return (
          <DraggableEventBlock
            key={task.id}
            onDeleteTask={onDeleteTask}
            style={{ height, left: 0, position: "absolute", right: 0, top }}
            task={task}
            toggleTask={toggleTask}
          />
        )
      })}
    </div>
  )
}

function TimeSlot({ date, minutes, onQuickCreate, quickAdd, setQuickAdd, slotHeight, submitQuickTask }: { date: string; minutes: number; onQuickCreate: (date: string, time: string) => void; quickAdd: QuickAddState | null; setQuickAdd: (value: QuickAddState | null) => void; slotHeight: number; submitQuickTask: () => void }) {
  const { setNodeRef, isOver } = useDroppable({ id: `${date}__${minutes}` })
  const time = minutesToTime(minutes)
  const activeQuickAdd = quickAdd?.date === date && quickAdd.time === time

  return (
    <div
      ref={setNodeRef}
      aria-label={`${date} ${time} 快速创建`}
      className={cn("border-b border-[var(--ff-border)] p-1", isOver && "bg-[var(--ff-brand-soft)]")}
      role="button"
      style={{ minHeight: slotHeight }}
      tabIndex={0}
      onClick={() => onQuickCreate(date, time)}
      onKeyDown={(event) => {
        if (event.key === "Enter") onQuickCreate(date, time)
      }}
    >
      {activeQuickAdd ? (
        <input
          autoFocus
          className="ff-input w-full px-2 py-1 text-xs outline-none"
          value={quickAdd.title}
          onChange={(event) => setQuickAdd({ ...quickAdd, title: event.target.value })}
          onClick={(event) => event.stopPropagation()}
          onKeyDown={(event) => {
            if (event.key === "Enter") submitQuickTask()
            if (event.key === "Escape") setQuickAdd(null)
          }}
          placeholder="输入标题后 Enter"
        />
      ) : null}
    </div>
  )
}

function DraggableEventBlock({ onDeleteTask, style, task, toggleTask }: { onDeleteTask: (task: Task) => void; style?: CSSProperties; task: Task; toggleTask: (taskId: string) => void }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: task.id })
  const type = task.eventType ?? "task"
  const meta = eventTypeMeta[type]

  return (
    <div
      ref={setNodeRef}
      className={cn("group pointer-events-auto relative flex w-full touch-none flex-col justify-center overflow-visible rounded-md border-l-[3px] px-2 py-1 pr-8 text-left text-xs font-medium", meta.soft, meta.border, isDragging && "opacity-80")}
      style={{ ...style, transform: CSS.Translate.toString(transform) }}
      title="拖拽到时间格可调整时间"
      onClick={(event) => {
        event.stopPropagation()
        toggleTask(task.id)
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault()
          event.stopPropagation()
          toggleTask(task.id)
        }
      }}
      {...attributes}
      {...listeners}
    >
      {isDragging ? (
        <span className="absolute -top-7 left-0 rounded-md bg-slate-950 px-2 py-1 text-[11px] text-white">
          {formatTimeRange(task)}
        </span>
      ) : null}
      <span className="block truncate">{task.title}</span>
      <span className="block truncate opacity-70">{formatTimeRange(task)}</span>
      <button
        className="ff-icon-button ff-danger-action absolute right-1 top-1/2 h-6 w-6 -translate-y-1/2 opacity-0 transition-opacity group-hover:opacity-100 focus:opacity-100"
        type="button"
        aria-label={`删除事项：${task.title}`}
        onClick={(event) => {
          event.stopPropagation()
          onDeleteTask(task)
        }}
        onPointerDown={(event) => event.stopPropagation()}
      >
        <Trash2 className="h-3 w-3" />
      </button>
    </div>
  )
}

function CalendarEventPill({
  item,
  onDeleteCountdown,
  onDeleteTask,
  onOpenCountdown,
  onToggleTask,
}: {
  item: CalendarItem
  onDeleteCountdown: (countdown: CountdownEvent) => void
  onDeleteTask: (task: Task) => void
  onOpenCountdown: (countdown: CountdownEvent) => void
  onToggleTask?: (taskId: string) => void
}) {
  const meta = eventTypeMeta[item.type]
  const clickable = item.source === "countdown" || Boolean(onToggleTask)

  return (
    <div
      className={cn("group flex min-h-8 min-w-0 items-start gap-1 rounded-md px-2 py-1 text-left text-[11px] font-medium leading-4", meta.soft, clickable && "cursor-pointer hover:ring-2 hover:ring-black/10")}
      role={clickable ? "button" : undefined}
      tabIndex={clickable ? 0 : undefined}
      onClick={(event) => {
        if (!clickable) return
        event.stopPropagation()
        if (item.source === "countdown") {
          onOpenCountdown(item.countdown)
          return
        }
        onToggleTask?.(item.task.id)
      }}
      onKeyDown={(event) => {
        if (!clickable || (event.key !== "Enter" && event.key !== " ")) return
        event.preventDefault()
        event.stopPropagation()
        if (item.source === "countdown") {
          onOpenCountdown(item.countdown)
          return
        }
        onToggleTask?.(item.task.id)
      }}
    >
      <span className="line-clamp-2 min-w-0 flex-1 break-normal [word-break:keep-all]">
        {item.source === "countdown" ? "日子 · " : ""}
        {item.title}
      </span>
      <button
        className="ff-icon-button ff-danger-action h-5 w-5 shrink-0 opacity-0 transition-opacity group-hover:opacity-100 focus:opacity-100"
        type="button"
        aria-label={item.source === "countdown" ? `删除日子：${item.title}` : `删除事项：${item.title}`}
        onClick={(event) => {
          event.stopPropagation()
          if (item.source === "countdown") {
            onDeleteCountdown(item.countdown)
            return
          }
          onDeleteTask(item.task)
        }}
      >
        <Trash2 className="h-3 w-3" />
      </button>
    </div>
  )
}

function Legend({ activeEventTypes, onToggle }: { activeEventTypes: CalendarSourceType[]; onToggle: (eventType: CalendarSourceType) => void }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {(Object.keys(eventTypeMeta) as CalendarSourceType[]).map((eventType) => {
        const meta = eventTypeMeta[eventType]
        const active = activeEventTypes.includes(eventType)
        return (
          <button className={cn("ff-button-secondary px-3 py-2 text-xs", !active && "opacity-45")} type="button" key={eventType} onClick={() => onToggle(eventType)}>
            <span className={cn("h-2 w-2 rounded-full", meta.dot)} />
            {meta.label}
          </button>
        )
      })}
    </div>
  )
}

function DayPanel({
  date,
  items,
  onClose,
  onCreate,
  onDeleteCountdown,
  onDeleteTask,
  onOpenCountdown,
  onQuickAdd,
  overdueCount,
  quickAdd,
  scheduledCount,
  setQuickAdd,
  submitQuickTask,
  toggleTask,
}: {
  date: Date
  items: CalendarItem[]
  onClose?: () => void
  onCreate: () => void
  onDeleteCountdown: (countdown: CountdownEvent) => void
  onDeleteTask: (task: Task) => void
  onOpenCountdown: (countdown: CountdownEvent) => void
  onQuickAdd: () => void
  overdueCount: number
  quickAdd: QuickAddState | null
  scheduledCount: number
  setQuickAdd: (value: QuickAddState | null) => void
  submitQuickTask: () => void
  toggleTask: (taskId: string) => void
}) {
  const dateKey = formatInputDate(date)
  const activeQuickAdd = quickAdd?.date === dateKey && !quickAdd.time
  const taskItems = items.filter((item): item is Extract<CalendarItem, { source: "task" }> => item.source === "task")
  const countdownItems = items.filter((item): item is Extract<CalendarItem, { source: "countdown" }> => item.source === "countdown")

  return (
    <div className="space-y-4">
      <div className="ff-card p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-indigo-500">选中日期</p>
            <h2 className="mt-2 text-2xl font-semibold text-slate-950 dark:text-slate-100">{format(date, "M月d日")}</h2>
          </div>
          {onClose ? (
            <button className="ff-icon-button h-11 w-11" type="button" aria-label="关闭当天事项面板" onClick={onClose}>
              <X className="h-5 w-5" />
            </button>
          ) : null}
        </div>
        <div className="mt-4 grid gap-2">
          <button className="ff-button-primary w-full px-4 py-3 text-sm" type="button" onClick={onCreate}>
            <CalendarPlus className="h-4 w-4" />
            新建完整事项
          </button>
          <button className="ff-button-secondary w-full px-4 py-3 text-sm" type="button" onClick={onQuickAdd}>
            <Plus className="h-4 w-4" />
            + 添加事项
          </button>
        </div>
        <AnimatePresence>
          {activeQuickAdd ? (
            <motion.div
              className="mt-3"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              transition={{ duration: 0.18, ease: "easeOut" }}
            >
              <input
                autoFocus
                className="ff-input w-full px-3 py-2 text-sm outline-none"
                value={quickAdd.title}
                onChange={(event) => setQuickAdd({ ...quickAdd, title: event.target.value })}
                onKeyDown={(event) => {
                  if (event.key === "Enter") submitQuickTask()
                  if (event.key === "Escape") setQuickAdd(null)
                }}
                placeholder="输入全天事项，Enter 创建"
              />
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <CalendarStat icon={<ListTodo className="h-4 w-4" />} label="已安排" value={scheduledCount} />
        <CalendarStat icon={<TimerReset className="h-4 w-4" />} label="日子" value={countdownItems.length} />
      </div>
      <div className="ff-card p-4">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-base font-semibold text-slate-950 dark:text-slate-100">当天安排</h3>
          {overdueCount ? <span className="text-xs font-medium text-rose-500">{overdueCount} 个过期</span> : null}
        </div>
        <div className="mt-4 space-y-2">
          {items.length ? (
            <>
              {countdownItems.map((item) => {
                const info = getDaysInfo(item.countdown)
                return (
                  <div className="ff-card-muted flex w-full items-start justify-between gap-3 border-l-4 p-3 text-left transition hover:border-[var(--ff-border-strong)] hover:bg-white/70" style={{ borderLeftColor: getAccentColor(item.countdown) }} key={item.id}>
                    <button className="min-w-0 flex-1 text-left" type="button" onClick={() => onOpenCountdown(item.countdown)}>
                      <span className="min-w-0 text-sm font-medium text-slate-700 dark:text-slate-200">
                        <span className="block truncate">{item.title}</span>
                        <span className="mt-1 block text-xs text-slate-400">
                          {categoryLabels[item.countdown.category]} · {formatDateLabel(info.effectiveTargetDate)}
                        </span>
                      </span>
                    </button>
                    <div className="flex shrink-0 items-center gap-2">
                      <span className="ff-tag px-2 py-1 text-[10px]">
                        {info.isToday ? "今天" : info.isPast ? `已过 ${info.days} 天` : `还有 ${info.days} 天`}
                      </span>
                      <button className="ff-icon-button ff-danger-action h-8 w-8" type="button" aria-label={`删除日子：${item.title}`} onClick={() => onDeleteCountdown(item.countdown)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                )
              })}
              {taskItems.map(({ task }) => (
                <div className="ff-card-muted flex w-full items-start justify-between gap-3 p-3 text-left" key={task.id}>
                  <button className="min-w-0 flex-1 text-left" type="button" onClick={() => toggleTask(task.id)}>
                    <span className={cn("text-sm font-medium text-slate-700 dark:text-slate-200", task.completed && "opacity-40")}>
                      <span className={cn("ff-complete-text", task.completed && "is-completed")}>{task.title}</span>
                      <span className="mt-1 block text-xs text-slate-400">{formatTimeRange(task)}</span>
                    </span>
                  </button>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="ff-tag px-2 py-1 text-[10px]">{eventTypeMeta[task.eventType ?? "task"].label}</span>
                    <button className="ff-icon-button ff-danger-action h-8 w-8" type="button" aria-label={`删除事项：${task.title}`} onClick={() => onDeleteTask(task)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </>
          ) : (
            <EmptyState title={siameseCopy.empty.calendar} description="需要计划时，再放一件事。" actionLabel="新建当天任务" onAction={onCreate} pose="sleeping" />
          )}
        </div>
      </div>
    </div>
  )
}

function CalendarStat({ icon, label, value }: { icon: ReactNode; label: string; value: number }) {
  return (
    <div className="ff-card p-4">
      <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
        {icon}
        {label}
      </div>
      <strong className="mt-2 block text-2xl text-slate-950 dark:text-slate-100">{value}</strong>
    </div>
  )
}
