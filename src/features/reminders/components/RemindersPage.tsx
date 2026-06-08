import { FormEvent, type MutableRefObject, useEffect, useMemo, useRef, useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { addDays, addHours, endOfWeek, format, isBefore, isSameDay, parseISO, startOfToday } from "date-fns"
import {
  Bell,
  BellOff,
  CalendarClock,
  CheckCircle2,
  Clock3,
  Edit3,
  Music2,
  Plus,
  Search,
  Trash2,
  Wand2,
  Volume2,
  VolumeX,
  X,
} from "lucide-react"
import { TheoMascot } from "../../../components/brand/TheoMascot"
import { siameseCopy } from "../../../components/brand/copy"
import { BottomSheet } from "../../../components/ui/BottomSheet"
import { ErrorBanner } from "../../../components/ui/ErrorBanner"
import { useToast } from "../../../components/ui/ToastProvider"
import { cn } from "../../../lib/cn"
import {
  createEmptyReminderDraft,
  reminderToDraft,
  useReminderStore,
} from "../store/reminderStore"
import type { Reminder, ReminderCustomUnit, ReminderDraft, ReminderRepeat, ReminderSettings, ReminderSound } from "../types"

type ReminderGroup = "upcoming24h" | "thisWeek" | "later" | "completed"
type SnoozeChoice = "15m" | "1h" | "tomorrow" | "custom"

type WindowWithAudio = Window & {
  webkitAudioContext?: typeof AudioContext
}

const repeatLabels: Record<ReminderRepeat, string> = {
  none: "不重复",
  daily: "每天",
  workdays: "工作日",
  weekly: "每周",
  monthly: "每月",
  custom: "自定义",
}

const soundOptions: Array<{ label: string; value: ReminderSound }> = [
  { label: "铃声", value: "bell" },
  { label: "木鱼", value: "wood" },
  { label: "静音", value: "silent" },
]

const quickTimeOptions = [
  { label: "上午 9:00", time: "09:00" },
  { label: "中午 12:00", time: "12:00" },
  { label: "下午 6:00", time: "18:00" },
  { label: "睡前 22:00", time: "22:00" },
]

function sendReminderNotification(reminder: Reminder) {
  if (!("Notification" in window) || Notification.permission !== "granted") return
  new Notification(reminder.title, {
    body: "myschedule · 点击查看详情",
    tag: reminder.id,
  }).onclick = () => {
    window.focus()
    window.history.pushState(null, "", `/reminders?reminder=${reminder.id}`)
  }
}

function playReminderSound(settings: ReminderSettings, audioContextRef: MutableRefObject<AudioContext | null>) {
  if (settings.sound === "silent" || settings.volume <= 0) return
  const AudioContextCtor = window.AudioContext ?? (window as WindowWithAudio).webkitAudioContext
  if (!AudioContextCtor) return

  const context = audioContextRef.current ?? new AudioContextCtor()
  audioContextRef.current = context
  void context.resume()

  const gain = context.createGain()
  gain.gain.setValueAtTime(settings.volume, context.currentTime)
  gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.5)
  gain.connect(context.destination)

  const oscillator = context.createOscillator()
  oscillator.type = settings.sound === "wood" ? "square" : "sine"
  oscillator.frequency.setValueAtTime(settings.sound === "wood" ? 220 : 760, context.currentTime)
  oscillator.frequency.exponentialRampToValueAtTime(settings.sound === "wood" ? 170 : 520, context.currentTime + 0.22)
  oscillator.connect(gain)
  oscillator.start()
  oscillator.stop(context.currentTime + (settings.sound === "wood" ? 0.16 : 0.5))
}

function vibrateIfNeeded(settings: ReminderSettings) {
  if (!settings.vibration || !("vibrate" in navigator)) return
  navigator.vibrate([60, 40, 80])
}

function formatDateTime(value: string): string {
  return format(parseISO(value), "M月d日 HH:mm")
}

function formatRelativeGroup(reminder: Reminder): string {
  const scheduledAt = parseISO(reminder.scheduledAt)
  const today = startOfToday()
  if (reminder.completed) return "已完成"
  if (isBefore(scheduledAt, new Date())) return "已逾期"
  if (isSameDay(scheduledAt, today)) return "今天"
  return format(scheduledAt, "M月d日")
}

function getNotificationPermission(): NotificationPermission | "unsupported" {
  if (!("Notification" in window)) return "unsupported"
  return Notification.permission
}

function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60_000)
}

function getSnoozeMinutes(reminder: Reminder, choice: SnoozeChoice): number {
  if (choice === "1h") return 60
  if (choice === "tomorrow") {
    const scheduledAt = parseISO(reminder.scheduledAt)
    const tomorrowSameTime = addDays(scheduledAt, 1)
    return Math.max(15, Math.ceil((tomorrowSameTime.getTime() - Date.now()) / 60_000))
  }
  if (choice === "custom") return 30
  return 15
}

function getGroupForReminder(reminder: Reminder): ReminderGroup {
  if (reminder.completed) return "completed"
  const scheduledAt = parseISO(reminder.scheduledAt)
  const now = new Date()
  if (scheduledAt.getTime() <= addHours(now, 24).getTime()) return "upcoming24h"
  if (scheduledAt.getTime() <= endOfWeek(now, { weekStartsOn: 1 }).getTime()) return "thisWeek"
  return "later"
}

function groupReminders(reminders: Reminder[]): Record<ReminderGroup, Reminder[]> {
  return reminders.reduce<Record<ReminderGroup, Reminder[]>>(
    (groups, reminder) => {
      groups[getGroupForReminder(reminder)].push(reminder)
      return groups
    },
    { completed: [], later: [], thisWeek: [], upcoming24h: [] }
  )
}

function sortReminders(reminders: Reminder[]): Reminder[] {
  return [...reminders].sort((left, right) => {
    if (left.completed !== right.completed) return Number(left.completed) - Number(right.completed)
    return parseISO(left.scheduledAt).getTime() - parseISO(right.scheduledAt).getTime()
  })
}

function formatInputDate(date: Date): string {
  return format(date, "yyyy-MM-dd")
}

function formatInputTime(date: Date): string {
  return format(date, "HH:mm")
}

function parseNaturalLanguageReminder(text: string): ReminderDraft | null {
  const input = text.trim()
  if (!input) return null

  const now = new Date()
  let targetDate = now
  if (input.includes("后天")) targetDate = addDays(now, 2)
  else if (input.includes("明天")) targetDate = addDays(now, 1)

  let time = ""
  const timeMatch = input.match(/(\\d{1,2})(?:[:：点](\\d{1,2})?)?/)
  if (timeMatch) {
    let hour = Number(timeMatch[1])
    const minute = Number(timeMatch[2] ?? 0)
    if ((input.includes("下午") || input.includes("晚上")) && hour < 12) hour += 12
    time = `${String(Math.min(23, hour)).padStart(2, "0")}:${String(Math.min(59, minute)).padStart(2, "0")}`
  } else if (input.includes("早上") || input.includes("上午")) {
    time = "09:00"
  } else if (input.includes("中午")) {
    time = "12:00"
  } else if (input.includes("下午")) {
    time = "18:00"
  } else if (input.includes("睡前") || input.includes("晚上")) {
    time = "22:00"
  } else {
    time = formatInputTime(addMinutes(now, 30))
  }

  const title = input
    .replace(/今天|明天|后天|早上|上午|中午|下午|晚上|睡前/g, "")
    .replace(/\\d{1,2}(?:[:：点]\\d{0,2})?/g, "")
    .replace(/提醒我|提醒|要|去/g, "")
    .trim()

  return {
    ...createEmptyReminderDraft(),
    date: formatInputDate(targetDate),
    time,
    title: title || input,
  }
}

export function RemindersPage() {
  const { notify } = useToast()
  const {
    addReminder,
    bulkDelete,
    bulkDisable,
    bulkEnable,
    clearSelection,
    completeReminder,
    deleteReminder,
    reminders,
    selectAll,
    selectedReminderIds,
    setSetting,
    settings,
    snoozeReminder,
    toggleEnabled,
    toggleSelectedReminder,
    triggerReminder,
    updateReminder,
  } = useReminderStore()
  const [editorReminder, setEditorReminder] = useState<Reminder | null>(null)
  const [editorOpen, setEditorOpen] = useState(false)
  const [draftSeed, setDraftSeed] = useState<ReminderDraft | null>(null)
  const [collapsedCompleted, setCollapsedCompleted] = useState(true)
  const [notificationPromptOpen, setNotificationPromptOpen] = useState(false)
  const [activeBanner, setActiveBanner] = useState<Reminder | null>(null)
  const [query, setQuery] = useState("")
  const [quickText, setQuickText] = useState("")
  const audioContextRef = useRef<AudioContext | null>(null)
  const triggeredIdsRef = useRef<Set<string>>(new Set())
  const notificationPermission = getNotificationPermission()

  const activeReminders = reminders.filter((reminder) => !reminder.completed)
  const overdueCount = activeReminders.filter((reminder) => isBefore(parseISO(reminder.scheduledAt), new Date())).length
  const todayCount = activeReminders.filter((reminder) => isSameDay(parseISO(reminder.scheduledAt), startOfToday())).length
  const enabledCount = activeReminders.filter((reminder) => reminder.enabled).length

  const visibleReminders = useMemo(() => {
    const keyword = query.trim().toLowerCase()
    return sortReminders(reminders)
      .filter((reminder) => {
        if (!keyword) return true
        return `${reminder.title} ${reminder.note} ${reminder.taskTitle}`.toLowerCase().includes(keyword)
      })
  }, [query, reminders])
  const groupedReminders = useMemo(() => groupReminders(visibleReminders), [visibleReminders])

  useEffect(() => {
    const interval = window.setInterval(() => {
      const now = Date.now()
      const dueReminders = useReminderStore
        .getState()
        .reminders.filter(
          (reminder) =>
            reminder.enabled &&
            !reminder.completed &&
            parseISO(reminder.scheduledAt).getTime() <= now &&
            !triggeredIdsRef.current.has(reminder.id)
        )

      dueReminders.forEach((reminder) => {
        triggeredIdsRef.current.add(reminder.id)
        const triggered = useReminderStore.getState().triggerReminder(reminder.id)
        if (!triggered) return

        playReminderSound(useReminderStore.getState().settings, audioContextRef)
        vibrateIfNeeded(useReminderStore.getState().settings)
        sendReminderNotification(triggered)
        setActiveBanner(triggered)
        notify(`提醒：${triggered.title}`, "warning")
        window.setTimeout(() => triggeredIdsRef.current.delete(reminder.id), 1000)
      })
    }, 1000)

    return () => window.clearInterval(interval)
  }, [notify])

  function openCreate() {
    setEditorReminder(null)
    setDraftSeed(null)
    setEditorOpen(true)
  }

  function openCreateWithDraft(draft: ReminderDraft) {
    setEditorReminder(null)
    setDraftSeed(draft)
    setEditorOpen(true)
  }

  function openEdit(reminder: Reminder) {
    setEditorReminder(reminder)
    setEditorOpen(true)
  }

  function closeEditor() {
    setEditorOpen(false)
    setEditorReminder(null)
    setDraftSeed(null)
  }

  function handleSubmit(draft: ReminderDraft) {
    if (editorReminder) {
      updateReminder(editorReminder.id, draft)
      notify("提醒已更新", "success")
    } else {
      addReminder(draft)
      notify("提醒已创建", "success")
    }
    if (notificationPermission === "default") {
      setNotificationPromptOpen(true)
    }
    closeEditor()
  }

  function handleComplete(reminderId: string) {
    completeReminder(reminderId)
    notify("提醒已完成", "success")
  }

  function handleSnooze(reminderId: string, choice: SnoozeChoice = "15m") {
    const reminder = reminders.find((item) => item.id === reminderId)
    const minutes = reminder ? getSnoozeMinutes(reminder, choice) : 15
    snoozeReminder(reminderId, minutes)
    setActiveBanner(null)
    notify(choice === "tomorrow" ? "已推迟到明天同一时间" : `已延后 ${minutes} 分钟`, "info")
  }

  function handleSelectAll() {
    if (selectedReminderIds.length === visibleReminders.length) {
      clearSelection()
      return
    }
    selectAll(visibleReminders.map((reminder) => reminder.id))
  }

  function previewSound() {
    playReminderSound(settings, audioContextRef)
  }

  function handleQuickCreate() {
    const parsed = parseNaturalLanguageReminder(quickText)
    if (!parsed) {
      notify("先输入一句提醒，例如：明天早上 9 点提醒我开会", "warning")
      return
    }
    openCreateWithDraft(parsed)
  }

  async function allowNotifications() {
    if (!("Notification" in window)) {
      setNotificationPromptOpen(false)
      notify("当前环境不支持系统通知", "warning")
      return
    }
    const permission = await Notification.requestPermission()
    setNotificationPromptOpen(false)
    notify(permission === "granted" ? "通知已开启" : "提醒已保存，但系统通知未开启", permission === "granted" ? "success" : "warning")
  }

  return (
    <>
      <div className="mx-auto grid w-full max-w-7xl gap-6">
        <AnimatePresence>
          {activeBanner ? (
            <ReminderBanner
              key={activeBanner.id}
              onClose={() => setActiveBanner(null)}
              onComplete={handleComplete}
              onSnooze={handleSnooze}
              reminder={activeBanner}
            />
          ) : null}
        </AnimatePresence>

        <button
          className="ff-button-primary fixed bottom-24 right-5 z-30 grid h-12 w-12 place-items-center rounded-full p-0 shadow-[0_12px_28px_rgba(59,125,216,0.22)] sm:bottom-6 sm:right-6"
          type="button"
          onClick={openCreate}
          aria-label="新建提醒"
          title="新建提醒"
        >
          <Plus className="h-5 w-5" />
        </button>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
          <main className="space-y-4">
            <section className="ff-card p-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div className="grid grid-cols-3 gap-2 sm:w-auto">
                  <Metric label="🌞 今天" value={todayCount} />
                  <Metric label="⚠️ 逾期" value={overdueCount} tone={overdueCount ? "danger" : "neutral"} />
                  <Metric label="🔔 启用中" value={enabledCount} />
                </div>
                <div className="grid gap-2 lg:w-[520px]">
                  <div className="ff-input flex min-h-11 min-w-0 items-center gap-2 px-3 text-slate-500">
                    <Wand2 className="h-4 w-4" />
                    <input
                      className="min-w-0 flex-1 bg-transparent text-sm outline-none"
                      value={quickText}
                      onChange={(event) => setQuickText(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") handleQuickCreate()
                      }}
                      placeholder="明天早上 9 点提醒我开会"
                    />
                    <button className="min-h-11 rounded-lg px-2 text-sm font-semibold text-[var(--ff-brand-text)] transition hover:bg-[var(--ff-brand-soft)]" type="button" onClick={handleQuickCreate}>
                      解析
                    </button>
                  </div>
                  <label className="ff-input flex min-h-11 min-w-0 items-center gap-2 px-3 text-slate-500">
                    <Search className="h-4 w-4" />
                    <input
                      className="min-w-0 flex-1 bg-transparent text-sm outline-none"
                      value={query}
                      onChange={(event) => setQuery(event.target.value)}
                      placeholder="搜索提醒"
                    />
                  </label>
                </div>
              </div>
            </section>

            {selectedReminderIds.length ? (
              <section className="ff-card flex flex-wrap items-center justify-between gap-3 p-3">
                <span className="text-sm font-medium text-slate-700 dark:text-slate-200">
                  已选择 {selectedReminderIds.length} 条提醒
                </span>
                <div className="flex flex-wrap gap-2">
                  <button className="ff-button-secondary px-3 py-2 text-sm" type="button" onClick={bulkEnable}>
                    启用
                  </button>
                  <button className="ff-button-secondary px-3 py-2 text-sm" type="button" onClick={bulkDisable}>
                    停用
                  </button>
                  <button className="ff-button-secondary px-3 py-2 text-sm" type="button" onClick={clearSelection}>
                    清除
                  </button>
                  <button className="ff-button-secondary ff-danger-action px-3 py-2 text-sm" type="button" onClick={bulkDelete}>
                    删除
                  </button>
                </div>
              </section>
            ) : null}

            <section className="space-y-4">
              {visibleReminders.length ? (
                <>
                  <div className="flex items-center justify-between px-1">
                    <button className="min-h-11 rounded-lg px-2 text-sm font-medium text-[var(--ff-brand-text)] transition hover:bg-[var(--ff-brand-soft)]" type="button" onClick={handleSelectAll}>
                      {selectedReminderIds.length === visibleReminders.length ? "取消全选" : "全选当前列表"}
                    </button>
                    <span className="text-xs text-slate-400">{visibleReminders.length} 条</span>
                  </div>
                  <ReminderGroupSection
                    label="⏰ 即将到来（24h内）"
                    reminders={groupedReminders.upcoming24h}
                    selectedReminderIds={selectedReminderIds}
                    onComplete={handleComplete}
                    onDelete={deleteReminder}
                    onEdit={openEdit}
                    onSnooze={handleSnooze}
                    onToggleEnabled={toggleEnabled}
                    onToggleSelected={toggleSelectedReminder}
                  />
                  <ReminderGroupSection
                    label="🗓️ 本周"
                    reminders={groupedReminders.thisWeek}
                    selectedReminderIds={selectedReminderIds}
                    onComplete={handleComplete}
                    onDelete={deleteReminder}
                    onEdit={openEdit}
                    onSnooze={handleSnooze}
                    onToggleEnabled={toggleEnabled}
                    onToggleSelected={toggleSelectedReminder}
                  />
                  <ReminderGroupSection
                    label="🌙 之后"
                    reminders={groupedReminders.later}
                    selectedReminderIds={selectedReminderIds}
                    onComplete={handleComplete}
                    onDelete={deleteReminder}
                    onEdit={openEdit}
                    onSnooze={handleSnooze}
                    onToggleEnabled={toggleEnabled}
                    onToggleSelected={toggleSelectedReminder}
                  />
                  <ReminderGroupSection
                    collapsed={collapsedCompleted}
                    label="✅ 已完成"
                    reminders={groupedReminders.completed}
                    selectedReminderIds={selectedReminderIds}
                    onComplete={handleComplete}
                    onDelete={deleteReminder}
                    onEdit={openEdit}
                    onSnooze={handleSnooze}
                    onToggleEnabled={toggleEnabled}
                    onToggleSelected={toggleSelectedReminder}
                    onToggleCollapsed={() => setCollapsedCompleted((value) => !value)}
                  />
                </>
              ) : (
                <ReminderEmptyState onCreate={openCreate} />
              )}
            </section>
          </main>

          <aside className="space-y-6">
            <ReminderSettingsPanel
              onPreviewSound={previewSound}
              settings={settings}
              setSetting={setSetting}
            />
            <section className="ff-card p-4">
              <div className="flex items-center gap-2">
                <CalendarClock className="h-4 w-4 text-indigo-500" />
                <h2 className="text-base font-semibold text-slate-950 dark:text-slate-100">🔔 触发方式</h2>
              </div>
              <div className="mt-4 space-y-3 text-sm leading-6 text-slate-500 dark:text-slate-400">
                {notificationPermission === "denied" ? (
                  <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-amber-800">
                    通知未开启。提醒仍会保存，打开应用时会显示应用内 Banner。
                  </p>
                ) : null}
                <p>提醒页面打开时会每秒扫描一次到期提醒，并触发系统通知、声音和震动。</p>
                <p>重复提醒触发后会自动滚到下一次；一次性提醒触发后会进入已完成。</p>
              </div>
            </section>
          </aside>
        </div>
      </div>

      <AnimatePresence>
        {editorOpen ? (
          <ReminderEditor
            initialDraft={draftSeed}
            reminder={editorReminder}
            onClose={closeEditor}
            onSubmit={handleSubmit}
          />
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {notificationPromptOpen ? (
          <NotificationPermissionSheet onAllow={allowNotifications} onClose={() => setNotificationPromptOpen(false)} />
        ) : null}
      </AnimatePresence>
    </>
  )
}

function Metric({ label, tone = "neutral", value }: { label: string; tone?: "danger" | "neutral"; value: number }) {
  return (
    <div className={cn("rounded-xl border p-3", tone === "danger" ? "border-rose-200 bg-rose-50" : "border-[var(--ff-border)] bg-[var(--ff-surface-muted)]")}>
      <span className="block text-[11px] text-slate-500">{label}</span>
      <strong className={cn("mt-1 block text-lg", tone === "danger" ? "text-rose-700" : "text-slate-950 dark:text-slate-100")}>
        {value}
      </strong>
    </div>
  )
}

function ReminderBanner({
  onClose,
  onComplete,
  onSnooze,
  reminder,
}: {
  onClose: () => void
  onComplete: (reminderId: string) => void
  onSnooze: (reminderId: string, choice?: SnoozeChoice) => void
  reminder: Reminder
}) {
  useEffect(() => {
    const timeout = window.setTimeout(onClose, 5000)
    return () => window.clearTimeout(timeout)
  }, [onClose])

  return (
    <motion.div
      className="sticky top-16 z-30 overflow-hidden rounded-xl border border-amber-200 bg-amber-50 text-amber-950 shadow-lg sm:top-4"
      initial={{ opacity: 0, y: -16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -16 }}
      transition={{ duration: 0.18, ease: "easeOut" }}
    >
      <div className="flex min-h-16 items-center gap-3 px-4 py-3">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-amber-100 text-amber-700">
          <Bell className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{reminder.title}</p>
          <p className="truncate text-xs text-amber-700">myschedule · 点击查看详情</p>
        </div>
        <button className="ff-button-secondary bg-white px-3 py-2 text-sm" type="button" onClick={() => onComplete(reminder.id)}>
          完成
        </button>
        <button className="ff-button-secondary bg-white px-3 py-2 text-sm" type="button" onClick={() => onSnooze(reminder.id, "15m")}>
          稍后 15 分钟
        </button>
        <button className="ff-icon-button h-10 w-10" type="button" aria-label="关闭提醒" onClick={onClose}>
          <X className="h-4 w-4" />
        </button>
      </div>
      <motion.div className="h-1 bg-amber-400" initial={{ width: "100%" }} animate={{ width: "0%" }} transition={{ duration: 5, ease: "linear" }} />
    </motion.div>
  )
}

function ReminderGroupSection({
  collapsed = false,
  label,
  onComplete,
  onDelete,
  onEdit,
  onSnooze,
  onToggleCollapsed,
  onToggleEnabled,
  onToggleSelected,
  reminders,
  selectedReminderIds,
}: {
  collapsed?: boolean
  label: string
  onComplete: (reminderId: string) => void
  onDelete: (reminderId: string) => void
  onEdit: (reminder: Reminder) => void
  onSnooze: (reminderId: string, choice?: SnoozeChoice) => void
  onToggleCollapsed?: () => void
  onToggleEnabled: (reminderId: string) => void
  onToggleSelected: (reminderId: string) => void
  reminders: Reminder[]
  selectedReminderIds: string[]
}) {
  if (!reminders.length) return null

  return (
    <div className="space-y-3">
      <button
        className={cn(
          "flex w-full items-center justify-between rounded-xl bg-[var(--ff-surface-muted)] px-3 py-2 text-left",
          !onToggleCollapsed && "cursor-default"
        )}
        type="button"
        onClick={onToggleCollapsed}
      >
        <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">{label}</span>
        <span className="text-xs text-slate-400">{collapsed ? "展开" : `${reminders.length} 条`}</span>
      </button>
      {collapsed
        ? null
        : reminders.map((reminder) => (
            <ReminderCard
              key={reminder.id}
              onComplete={onComplete}
              onDelete={onDelete}
              onEdit={onEdit}
              onSnooze={onSnooze}
              onToggleEnabled={onToggleEnabled}
              onToggleSelected={onToggleSelected}
              reminder={reminder}
              selected={selectedReminderIds.includes(reminder.id)}
            />
          ))}
    </div>
  )
}

function ReminderCard({
  onComplete,
  onDelete,
  onEdit,
  onSnooze,
  onToggleEnabled,
  onToggleSelected,
  reminder,
  selected,
}: {
  onComplete: (reminderId: string) => void
  onDelete: (reminderId: string) => void
  onEdit: (reminder: Reminder) => void
  onSnooze: (reminderId: string, choice?: SnoozeChoice) => void
  onToggleEnabled: (reminderId: string) => void
  onToggleSelected: (reminderId: string) => void
  reminder: Reminder
  selected: boolean
}) {
  const overdue = !reminder.completed && isBefore(parseISO(reminder.scheduledAt), new Date())
  const [snoozeOpen, setSnoozeOpen] = useState(false)

  return (
    <article
      className={cn(
        "ff-card flex flex-col gap-4 p-4 transition sm:flex-row sm:items-start sm:justify-between",
        selected && "border-indigo-300 bg-[var(--ff-brand-soft)]",
        overdue && "border-rose-200"
      )}
    >
      <div className="flex min-w-0 flex-1 gap-3">
        <button
          className={cn(
            "mt-1 grid h-6 w-6 shrink-0 place-items-center rounded-lg border text-transparent transition",
            selected ? "border-indigo-500 bg-indigo-500 text-white" : "border-[var(--ff-border)] hover:border-indigo-300"
          )}
          type="button"
          aria-label={selected ? "取消选择提醒" : "选择提醒"}
          onClick={() => onToggleSelected(reminder.id)}
        >
          <CheckCircle2 className="h-4 w-4" />
        </button>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-[11px] font-semibold",
                overdue ? "bg-rose-50 text-rose-700" : "bg-[var(--ff-brand-soft)] text-indigo-700"
              )}
            >
              {formatRelativeGroup(reminder)}
            </span>
            <span className="rounded-full bg-[var(--ff-surface-muted)] px-2 py-0.5 text-[11px] font-semibold text-slate-500">
              {repeatLabels[reminder.repeat]}
              {reminder.repeat === "custom" ? ` · ${reminder.customInterval}${reminder.customUnit === "day" ? "天" : reminder.customUnit === "week" ? "周" : "月"}` : ""}
            </span>
            {!reminder.enabled ? (
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-500">已停用</span>
            ) : null}
            {reminder.snoozedAt ? (
              <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700">已推迟</span>
            ) : null}
            {getNotificationPermission() === "denied" ? (
              <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700">通知未开启</span>
            ) : null}
          </div>
          <h2 className={cn("mt-2 truncate text-base font-semibold", reminder.completed ? "text-slate-400 line-through" : "text-slate-950 dark:text-slate-100")}>
            {reminder.title}
          </h2>
          {reminder.note ? (
            <p className="mt-1 text-sm leading-6 text-slate-500 dark:text-slate-400">{reminder.note}</p>
          ) : null}
          <p className="mt-3 inline-flex items-center gap-1.5 text-sm text-slate-500 dark:text-slate-400">
            <Clock3 className="h-4 w-4" />
            {formatDateTime(reminder.scheduledAt)}
            {reminder.taskTitle ? ` · ${reminder.taskTitle}` : ""}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 sm:justify-end">
        {!reminder.completed ? (
          <>
            <div className="relative">
              <button className="ff-button-secondary px-3 py-2 text-sm" type="button" onClick={() => setSnoozeOpen((value) => !value)}>
                稍后
              </button>
              {snoozeOpen ? (
                <div className="absolute right-0 top-12 z-20 grid w-40 gap-1 rounded-xl border border-[var(--ff-border)] bg-[var(--ff-surface)] p-2 shadow-lg">
                  {[
                    ["15分钟", "15m"],
                    ["1小时", "1h"],
                    ["明天同一时间", "tomorrow"],
                    ["自定义", "custom"],
                  ].map(([label, choice]) => (
                    <button
                      className="rounded-lg px-3 py-2 text-left text-sm text-slate-600 hover:bg-[var(--ff-surface-muted)]"
                      key={choice}
                      type="button"
                      onClick={() => {
                        onSnooze(reminder.id, choice as SnoozeChoice)
                        setSnoozeOpen(false)
                      }}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
            <button className="ff-button-secondary px-3 py-2 text-sm" type="button" onClick={() => onComplete(reminder.id)}>
              完成
            </button>
          </>
        ) : null}
        <button className="ff-icon-button h-10 w-10" type="button" aria-label={reminder.enabled ? "停用提醒" : "启用提醒"} onClick={() => onToggleEnabled(reminder.id)}>
          {reminder.enabled ? <Bell className="h-4 w-4" /> : <BellOff className="h-4 w-4" />}
        </button>
        <button className="ff-icon-button h-10 w-10" type="button" aria-label="编辑提醒" onClick={() => onEdit(reminder)}>
          <Edit3 className="h-4 w-4" />
        </button>
        <button className="ff-icon-button ff-danger-action h-10 w-10" type="button" aria-label="删除提醒" onClick={() => onDelete(reminder.id)}>
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </article>
  )
}

function ReminderEmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="ff-card grid place-items-center px-5 py-8 text-center">
      <div className="relative mb-4">
        <TheoMascot pose="idle" size={88} />
        <motion.svg
          aria-hidden="true"
          animate={{ rotate: [-3, 3, -3] }}
          className="absolute -right-3 top-1 h-9 w-9 text-indigo-500"
          fill="none"
          transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
          viewBox="0 0 48 48"
        >
          <path d="M15 20a9 9 0 0 1 18 0v8l4 5H11l4-5v-8Z" fill="var(--ff-brand-soft)" stroke="currentColor" strokeWidth="2" />
          <path d="M20 36a5 5 0 0 0 8 0" stroke="currentColor" strokeLinecap="round" strokeWidth="2" />
        </motion.svg>
      </div>
      <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">{siameseCopy.empty.reminders}</h3>
      <p className="mt-2 max-w-sm text-sm text-slate-500 dark:text-slate-400">需要时，西奥会准点出现。</p>
      <button className="ff-button-secondary mt-4 px-4 py-2 text-sm" type="button" onClick={onCreate}>
        新建提醒
      </button>
    </div>
  )
}

function NotificationPermissionSheet({ onAllow, onClose }: { onAllow: () => void; onClose: () => void }) {
  return (
    <BottomSheet ariaLabel="通知权限" className="max-w-md" onClose={onClose}>
      <div className="p-5">
        <div className="grid h-12 w-12 place-items-center rounded-xl bg-[var(--ff-brand-soft)] text-indigo-600">
          <Bell className="h-5 w-5" />
        </div>
        <h2 className="mt-4 text-lg font-semibold text-slate-950 dark:text-slate-100">myschedule 需要发送提醒通知</h2>
        <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">
          授权后，即使你切到别的页面，也能收到系统提醒。拒绝也没关系，提醒仍会保存并在应用内显示。
        </p>
        <div className="mt-5 flex justify-end gap-3">
          <button className="ff-button-secondary px-4 py-3 text-sm" type="button" onClick={onClose}>
            稍后
          </button>
          <button className="ff-button-primary px-4 py-3 text-sm" type="button" onClick={onAllow}>
            允许通知
          </button>
        </div>
      </div>
    </BottomSheet>
  )
}

function ReminderEditor({
  initialDraft,
  onClose,
  onSubmit,
  reminder,
}: {
  initialDraft: ReminderDraft | null
  onClose: () => void
  onSubmit: (draft: ReminderDraft) => void
  reminder: Reminder | null
}) {
  const [draft, setDraft] = useState<ReminderDraft>(() => (reminder ? reminderToDraft(reminder) : initialDraft ?? createEmptyReminderDraft()))
  const [titleError, setTitleError] = useState(false)

  function updateField<Key extends keyof ReminderDraft>(key: Key, value: ReminderDraft[Key]) {
    if (key === "title") setTitleError(false)
    setDraft((current) => ({ ...current, [key]: value }))
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!draft.title.trim()) {
      setTitleError(true)
      return
    }
    onSubmit(draft)
  }

  return (
    <BottomSheet ariaLabel={reminder ? "编辑提醒" : "新建提醒"} className="max-w-xl" onClose={onClose}>
      <form className="p-4" onSubmit={handleSubmit}>
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-indigo-500">{reminder ? "编辑提醒" : "新建提醒"}</p>
            <h2 className="text-xl font-semibold text-slate-950 dark:text-slate-100">
              {reminder ? "调整提醒的节奏" : "让这件事准时回来"}
            </h2>
          </div>
          <button className="ff-icon-button h-11 w-11" type="button" onClick={onClose} aria-label="关闭">
            <X className="h-5 w-5" />
          </button>
        </div>

        {titleError ? <ErrorBanner message="请先写下提醒标题。" /> : null}

        <div className="space-y-4">
          <label className="block">
            <span className="text-sm font-medium text-slate-700 dark:text-slate-200">提醒标题</span>
            <input
              autoFocus
              className="ff-input mt-2 w-full px-4 py-3 text-base outline-none"
              value={draft.title}
              onChange={(event) => updateField("title", event.target.value)}
              placeholder="例如：站起来喝水"
            />
          </label>

          <label className="block">
            <span className="text-sm font-medium text-slate-700 dark:text-slate-200">备注</span>
            <textarea
              className="ff-input mt-2 min-h-24 w-full resize-none px-4 py-3 text-sm outline-none"
              value={draft.note}
              onChange={(event) => updateField("note", event.target.value)}
              placeholder="补充地点、准备材料或提醒原因"
            />
          </label>

          <div className="grid gap-3 sm:grid-cols-3">
            <label className="block">
              <span className="text-sm font-medium text-slate-700 dark:text-slate-200">日期</span>
              <input
                className="ff-input mt-2 w-full px-3 py-3 text-sm outline-none"
                type="date"
                value={draft.date}
                onChange={(event) => updateField("date", event.target.value)}
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-slate-700 dark:text-slate-200">时间</span>
              <input
                className="ff-input mt-2 w-full px-3 py-3 text-sm outline-none"
                type="time"
                value={draft.time}
                onChange={(event) => updateField("time", event.target.value)}
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-slate-700 dark:text-slate-200">重复</span>
              <select
                className="ff-input mt-2 w-full px-3 py-3 text-sm outline-none"
                value={draft.repeat}
                onChange={(event) => updateField("repeat", event.target.value as ReminderRepeat)}
              >
                {Object.entries(repeatLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div>
            <span className="text-sm font-medium text-slate-700 dark:text-slate-200">常用时间</span>
            <div className="mt-2 flex flex-wrap gap-2">
              {quickTimeOptions.map((option) => (
                <button
                  className={cn(
                    "rounded-full border px-3 py-2 text-sm font-medium transition",
                    draft.time === option.time
                      ? "border-indigo-300 bg-[var(--ff-brand-soft)] text-indigo-700"
                      : "border-[var(--ff-border)] bg-[var(--ff-surface)] text-slate-500 hover:text-slate-800"
                  )}
                  key={option.time}
                  type="button"
                  onClick={() => updateField("time", option.time)}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          {draft.repeat === "weekly" ? (
            <label className="block">
              <span className="text-sm font-medium text-slate-700 dark:text-slate-200">每周星期几</span>
              <select
                className="ff-input mt-2 w-full px-3 py-3 text-sm outline-none"
                value={draft.weekDay}
                onChange={(event) => updateField("weekDay", Number(event.target.value))}
              >
                {["周日", "周一", "周二", "周三", "周四", "周五", "周六"].map((label, index) => (
                  <option key={label} value={index}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          {draft.repeat === "monthly" ? (
            <label className="block">
              <span className="flex items-center justify-between gap-3 text-sm font-medium text-slate-700 dark:text-slate-200">
                每月日期
                <span className="text-xs text-slate-400">{draft.monthDay} 日</span>
              </span>
              <input
                className="mt-2 w-full accent-[var(--ff-brand)]"
                min={1}
                max={31}
                step={1}
                type="range"
                value={draft.monthDay}
                onChange={(event) => updateField("monthDay", Number(event.target.value))}
              />
            </label>
          ) : null}

          {draft.repeat === "custom" ? (
            <div className="grid gap-3 sm:grid-cols-3">
              <label className="block">
                <span className="flex items-center justify-between gap-3 text-sm font-medium text-slate-700 dark:text-slate-200">
                  间隔
                  <span className="text-xs text-slate-400">{draft.customInterval}</span>
                </span>
                <input
                  className="mt-2 w-full accent-[var(--ff-brand)]"
                  min={1}
                  max={30}
                  step={1}
                  type="range"
                  value={draft.customInterval}
                  onChange={(event) => updateField("customInterval", Number(event.target.value))}
                />
              </label>
              <label className="block">
                <span className="text-sm font-medium text-slate-700 dark:text-slate-200">单位</span>
                <select
                  className="ff-input mt-2 w-full px-3 py-3 text-sm outline-none"
                  value={draft.customUnit}
                  onChange={(event) => updateField("customUnit", event.target.value as ReminderCustomUnit)}
                >
                  <option value="day">天</option>
                  <option value="week">周</option>
                  <option value="month">月</option>
                </select>
              </label>
              <label className="block">
                <span className="text-sm font-medium text-slate-700 dark:text-slate-200">结束次数</span>
                <input
                  className="ff-input mt-2 w-full px-3 py-3 text-sm outline-none"
                  min={0}
                  type="number"
                  value={draft.customEndCount}
                  onChange={(event) => updateField("customEndCount", Number(event.target.value))}
                  placeholder="0 为不限"
                />
              </label>
              <label className="block sm:col-span-3">
                <span className="text-sm font-medium text-slate-700 dark:text-slate-200">结束日期</span>
                <input
                  className="ff-input mt-2 w-full px-3 py-3 text-sm outline-none"
                  type="date"
                  value={draft.customEndDate}
                  onChange={(event) => updateField("customEndDate", event.target.value)}
                />
              </label>
            </div>
          ) : null}

          <label className="block">
            <span className="text-sm font-medium text-slate-700 dark:text-slate-200">关联任务</span>
            <input
              className="ff-input mt-2 w-full px-4 py-3 text-sm outline-none"
              value={draft.taskTitle}
              onChange={(event) => updateField("taskTitle", event.target.value)}
              placeholder="可选，例如：产品周会"
            />
          </label>
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button className="ff-button-secondary px-4 py-3 text-sm" type="button" onClick={onClose}>
            取消
          </button>
          <button className="ff-button-primary px-4 py-3 text-sm" type="submit">
            {reminder ? "保存提醒" : "创建提醒"}
          </button>
        </div>
      </form>
    </BottomSheet>
  )
}

function ReminderSettingsPanel({
  onPreviewSound,
  settings,
  setSetting,
}: {
  onPreviewSound: () => void
  settings: ReminderSettings
  setSetting: <Key extends keyof ReminderSettings>(key: Key, value: ReminderSettings[Key]) => void
}) {
  return (
    <section className="ff-card p-4">
      <div className="flex items-center gap-2">
        <Bell className="h-4 w-4 text-indigo-500" />
        <h2 className="text-base font-semibold text-slate-950 dark:text-slate-100">提醒设置</h2>
      </div>

      <div className="mt-4 space-y-4">
        <div>
          <label className="text-sm font-medium text-slate-700 dark:text-slate-200">音效选择</label>
          <div className="mt-2 flex gap-2">
            <select
              className="ff-input min-w-0 flex-1 px-3 py-2 text-sm outline-none"
              value={settings.sound}
              onChange={(event) => setSetting("sound", event.target.value as ReminderSound)}
            >
              {soundOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <button className="ff-button-secondary px-3 py-2 text-sm" type="button" onClick={onPreviewSound}>
              <Music2 className="h-4 w-4" />
              试听
            </button>
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between gap-3">
            <span className="inline-flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-200">
              {settings.volume > 0 ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
              音量
            </span>
            <span className="text-xs text-slate-400">{Math.round(settings.volume * 100)}%</span>
          </div>
          <input
            className="mt-2 w-full accent-[var(--ff-brand)]"
            max={1}
            min={0}
            step={0.05}
            type="range"
            value={settings.volume}
            onChange={(event) => setSetting("volume", Number(event.target.value))}
          />
        </div>

        <label className="flex items-center justify-between gap-3 rounded-xl border border-[var(--ff-border)] bg-[var(--ff-surface-muted)] px-3 py-2 text-sm font-medium text-slate-700 dark:text-slate-200">
          震动提示
          <input
            checked={settings.vibration}
            className="h-5 w-5 accent-[var(--ff-brand)]"
            type="checkbox"
            onChange={(event) => setSetting("vibration", event.target.checked)}
          />
        </label>
      </div>
    </section>
  )
}
