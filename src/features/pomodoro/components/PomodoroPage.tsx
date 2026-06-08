import { type MutableRefObject, useEffect, useMemo, useRef, useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { addDays, differenceInCalendarDays, format, isSameDay, parseISO, startOfToday, startOfWeek, subDays } from "date-fns"
import {
  CheckCircle2,
  Coffee,
  Maximize2,
  Music2,
  Pause,
  Play,
  RotateCcw,
  Search,
  Settings2,
  SkipForward,
  TimerReset,
  Volume2,
  VolumeX,
  X,
} from "lucide-react"
import { siameseCopy } from "../../../components/brand/copy"
import { BottomSheet } from "../../../components/ui/BottomSheet"
import { useToast } from "../../../components/ui/ToastProvider"
import { cn } from "../../../lib/cn"
import { useTaskStore } from "../../tasks/store/taskStore"
import type { Task } from "../../tasks/types"
import { usePomodoroStore } from "../store/pomodoroStore"
import type { PomodoroPhase, PomodoroRecord, PomodoroSettings, PomodoroSound } from "../types"

const ringRadius = 80
const ringStroke = 6
const ringCircumference = 2 * Math.PI * ringRadius
const confetti = Array.from({ length: 18 }, (_, index) => ({
  rotate: index * 21,
  x: Math.cos((index / 18) * Math.PI * 2) * (58 + (index % 3) * 16),
  y: Math.sin((index / 18) * Math.PI * 2) * (48 + (index % 4) * 12),
}))

const phaseMeta: Record<PomodoroPhase, { accent: string; description: string; label: string; soft: string }> = {
  work: {
    accent: "var(--ff-brand)",
    description: siameseCopy.pomodoro.start,
    label: "专注中",
    soft: "bg-[var(--ff-brand-soft)] text-indigo-700",
  },
  shortBreak: {
    accent: "#10B981",
    description: siameseCopy.pomodoro.rest,
    label: "短休息",
    soft: "bg-emerald-50 text-emerald-700",
  },
  longBreak: {
    accent: "#10B981",
    description: siameseCopy.pomodoro.longBreak,
    label: "长休息",
    soft: "bg-emerald-50 text-emerald-700",
  },
}

const soundOptions: Array<{ label: string; value: PomodoroSound }> = [
  { label: "铃声", value: "bell" },
  { label: "木鱼", value: "wood" },
  { label: "白噪声", value: "noise" },
  { label: "静音", value: "silent" },
]

type WindowWithAudio = Window & {
  webkitAudioContext?: typeof AudioContext
}

function formatSeconds(seconds: number): string {
  const minutes = Math.floor(Math.max(0, seconds) / 60)
  const restSeconds = Math.max(0, seconds) % 60
  return `${String(minutes).padStart(2, "0")}:${String(restSeconds).padStart(2, "0")}`
}

function parseTaskDate(date?: string): Date | null {
  if (!date) return null
  const parsed = parseISO(date)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

function getTaskDateLabel(task: Task): string {
  const dueDate = parseTaskDate(task.dueDate)
  return dueDate ? format(dueDate, "MM/dd") : "无日期"
}

function getRecordDate(record: PomodoroRecord): Date {
  return parseISO(record.endedAt)
}

function formatFocusMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes} 分钟`
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  return rest ? `${hours} 小时 ${rest} 分钟` : `${hours} 小时`
}

function countRecordsForDate(records: PomodoroRecord[], date: Date): number {
  return records.filter((record) => isSameDay(getRecordDate(record), date)).length
}

function getRecordsForDate(records: PomodoroRecord[], dateKey: string): PomodoroRecord[] {
  return records.filter((record) => record.endedAt.slice(0, 10) === dateKey)
}

function getLongestStreak(records: PomodoroRecord[]): number {
  const dateKeys = Array.from(new Set(records.map((record) => record.endedAt.slice(0, 10)))).sort()
  let longest = 0
  let current = 0
  let previous: Date | null = null

  dateKeys.forEach((dateKey) => {
    const currentDate = parseISO(dateKey)
    if (previous && differenceInCalendarDays(currentDate, previous) === 1) {
      current += 1
    } else {
      current = 1
    }
    longest = Math.max(longest, current)
    previous = currentDate
  })

  return longest
}

function getBestDay(records: PomodoroRecord[]): { count: number; dateKey: string } {
  const counts = records.reduce<Record<string, number>>((acc, record) => {
    const dateKey = record.endedAt.slice(0, 10)
    acc[dateKey] = (acc[dateKey] ?? 0) + 1
    return acc
  }, {})

  return Object.entries(counts).reduce(
    (best, [dateKey, count]) => (count > best.count ? { count, dateKey } : best),
    { count: 0, dateKey: "" }
  )
}

function heatClass(count: number): string {
  if (count >= 6) return "bg-emerald-600"
  if (count >= 4) return "bg-emerald-500"
  if (count >= 2) return "bg-emerald-300"
  if (count >= 1) return "bg-emerald-100"
  return "bg-[var(--ff-surface-muted)]"
}

function playSound(settings: PomodoroSettings, audioContextRef: MutableRefObject<AudioContext | null>) {
  if (settings.sound === "silent" || settings.volume <= 0) return
  const AudioContextCtor = window.AudioContext ?? (window as WindowWithAudio).webkitAudioContext
  if (!AudioContextCtor) return

  const context = audioContextRef.current ?? new AudioContextCtor()
  audioContextRef.current = context
  void context.resume()
  const gain = context.createGain()
  gain.gain.setValueAtTime(settings.volume, context.currentTime)
  gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.65)
  gain.connect(context.destination)

  if (settings.sound === "noise") {
    const buffer = context.createBuffer(1, context.sampleRate * 0.5, context.sampleRate)
    const data = buffer.getChannelData(0)
    for (let index = 0; index < data.length; index += 1) {
      data[index] = (Math.random() * 2 - 1) * 0.25
    }
    const source = context.createBufferSource()
    source.buffer = buffer
    source.connect(gain)
    source.start()
    source.stop(context.currentTime + 0.5)
    return
  }

  const oscillator = context.createOscillator()
  oscillator.type = settings.sound === "wood" ? "square" : "sine"
  oscillator.frequency.setValueAtTime(settings.sound === "wood" ? 260 : 880, context.currentTime)
  oscillator.frequency.exponentialRampToValueAtTime(settings.sound === "wood" ? 180 : 660, context.currentTime + 0.25)
  oscillator.connect(gain)
  oscillator.start()
  oscillator.stop(context.currentTime + (settings.sound === "wood" ? 0.18 : 0.65))
}

function requestNotificationPermission() {
  if (!("Notification" in window) || Notification.permission !== "default") return
  void Notification.requestPermission()
}

function sendPhaseNotification(previousPhase: PomodoroPhase, nextPhase: PomodoroPhase) {
  if (!("Notification" in window) || Notification.permission !== "granted") return
  const title = previousPhase === "work" ? "番茄完成" : "休息结束"
  const body = previousPhase === "work" ? phaseMeta[nextPhase].description : "可以回到下一轮专注了。"
  new Notification(title, { body })
}

export function PomodoroPage() {
  const { notify } = useToast()
  const { tasks } = useTaskStore()
  const {
    finishPhase,
    pauseTimer,
    recalibrateTimer,
    records,
    resetTimer,
    selectHistoryDate,
    selectTask,
    selectedHistoryDate,
    setRemainingSeconds,
    setSetting,
    settings,
    startTimer,
    timer,
  } = usePomodoroStore()
  const [immersive, setImmersive] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [taskSearch, setTaskSearch] = useState("")
  const [pendingTask, setPendingTask] = useState<Task | null>(null)
  const [flashVisible, setFlashVisible] = useState(false)
  const [celebrationId, setCelebrationId] = useState<number | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const workerRef = useRef<Worker | null>(null)
  const completingRef = useRef(false)
  const settingsRef = useRef(settings)

  settingsRef.current = settings

  const today = startOfToday()
  const todayKey = format(today, "yyyy-MM-dd")
  const selectedTask = useMemo(
    () => tasks.find((task) => task.id === timer.selectedTaskId) ?? null,
    [tasks, timer.selectedTaskId]
  )
  const todayTasks = useMemo(
    () =>
      tasks.filter((task) => {
        const dueDate = parseTaskDate(task.dueDate)
        return dueDate && isSameDay(dueDate, today) && !task.completed
      }),
    [tasks, today]
  )
  const filteredTodayTasks = useMemo(() => {
    const keyword = taskSearch.trim().toLowerCase()
    if (!keyword) return todayTasks
    return todayTasks.filter((task) => {
      const haystack = `${task.title} ${task.note ?? ""} ${task.tags.join(" ")}`.toLowerCase()
      return haystack.includes(keyword)
    })
  }, [taskSearch, todayTasks])
  const todayRecords = useMemo(() => getRecordsForDate(records, todayKey), [records, todayKey])
  const todayFocusMinutes = todayRecords.reduce((total, record) => total + record.durationMinutes, 0)
  const todayTaskCount = new Set(todayRecords.map((record) => record.taskId).filter(Boolean)).size
  const weekStart = startOfWeek(today, { weekStartsOn: 1 })
  const weekDays = Array.from({ length: 7 }, (_, index) => addDays(weekStart, index))
  const weeklyCounts = weekDays.map((day) => countRecordsForDate(records, day))
  const bestDay = getBestDay(records)
  const longestStreak = getLongestStreak(records)
  const selectedDayRecords = getRecordsForDate(records, selectedHistoryDate)
  const activeTaskTitle = selectedTask?.title ?? timer.selectedTaskTitle
  const tomatoNumber = timer.phase === "work" ? timer.completedWorkSessions + 1 : Math.max(1, timer.completedWorkSessions)

  function completeCurrentPhase() {
    if (completingRef.current) return
    completingRef.current = true
    window.setTimeout(() => {
      completingRef.current = false
    }, 1000)

    const previousPhase = usePomodoroStore.getState().timer.phase
    const record = usePomodoroStore.getState().finishPhase("completed")
    const nextPhase = usePomodoroStore.getState().timer.phase

    if (record?.taskId) {
      useTaskStore.getState().recordPomodoro(record.taskId)
    }

    playSound(settingsRef.current, audioContextRef)
    sendPhaseNotification(previousPhase, nextPhase)
    setFlashVisible(true)
    window.setTimeout(() => setFlashVisible(false), 300)

    if (previousPhase === "work") {
      setCelebrationId(Date.now())
      window.setTimeout(() => setCelebrationId(null), 900)
      notify(record?.taskTitle ? `已记录到「${record.taskTitle}」` : "已记录一次自由专注", "success")
    } else {
      notify("休息结束，准备好就开始下一轮。", "info")
    }
  }

  useEffect(() => {
    const worker = new Worker("/pomodoro-worker.js")
    workerRef.current = worker
    worker.onmessage = (event: MessageEvent<{ remainingSeconds?: number; type: "complete" | "tick" }>) => {
      if (event.data.type === "tick" && typeof event.data.remainingSeconds === "number") {
        usePomodoroStore.getState().setRemainingSeconds(event.data.remainingSeconds)
      }
      if (event.data.type === "complete") {
        completeCurrentPhase()
      }
    }

    return () => {
      worker.terminate()
      workerRef.current = null
    }
  }, [])

  useEffect(() => {
    if (timer.status === "running" && timer.endsAt) {
      workerRef.current?.postMessage({ endsAt: new Date(timer.endsAt).getTime(), type: "start" })
      return
    }

    workerRef.current?.postMessage({ type: "stop" })
  }, [timer.endsAt, timer.status])

  useEffect(() => {
    if (recalibrateTimer()) {
      completeCurrentPhase()
    }

    function reconcile() {
      if (usePomodoroStore.getState().recalibrateTimer()) {
        completeCurrentPhase()
      }
    }

    window.addEventListener("focus", reconcile)
    document.addEventListener("visibilitychange", reconcile)
    return () => {
      window.removeEventListener("focus", reconcile)
      document.removeEventListener("visibilitychange", reconcile)
    }
  }, [recalibrateTimer])

  function handleStartPause() {
    if (timer.status === "running") {
      pauseTimer()
      return
    }

    requestNotificationPermission()
    startTimer()
  }

  function handleSkip() {
    finishPhase("skipped")
    notify("已跳过当前阶段", "info")
  }

  function handleSelectTask(task: Task | null) {
    if (timer.status === "running" && task?.id !== timer.selectedTaskId) {
      setPendingTask(task)
      return
    }

    selectTask(task?.id ?? null, task?.title ?? "")
  }

  function confirmTaskSwitch() {
    selectTask(pendingTask?.id ?? null, pendingTask?.title ?? "")
    setPendingTask(null)
  }

  function previewSound() {
    playSound(settings, audioContextRef)
  }

  return (
    <>
      <div className={cn("mx-auto grid h-full min-h-0 w-full max-w-7xl", immersive && "hidden")} aria-hidden={immersive}>
        <div className="grid min-h-0 gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
          <main className="grid min-h-0 grid-rows-[auto_minmax(0,1fr)] gap-4">
            <TaskBindingPanel
              activeTaskTitle={activeTaskTitle}
              filteredTasks={filteredTodayTasks}
              onSearch={setTaskSearch}
              onSelectTask={handleSelectTask}
              search={taskSearch}
              selectedTaskId={timer.selectedTaskId}
              timerRunning={timer.status === "running"}
            />
            <TimerCard
              activeTaskTitle={activeTaskTitle}
              celebrationId={celebrationId}
              flashVisible={flashVisible}
              immersive={false}
              onEnterImmersive={() => setImmersive(true)}
              onReset={resetTimer}
              onSkip={handleSkip}
              onStartPause={handleStartPause}
              phase={timer.phase}
              remainingSeconds={timer.remainingSeconds}
              status={timer.status}
              tomatoNumber={tomatoNumber}
              totalSeconds={timer.totalSeconds}
            />
          </main>

          <aside className="hidden min-h-0 space-y-4 overflow-hidden xl:block">
            <button className="ff-button-secondary w-full justify-between px-4 py-3 text-sm" type="button" onClick={() => setSettingsOpen(true)}>
              <span className="inline-flex items-center gap-2">
                <Settings2 className="h-4 w-4" />
                番茄设置
              </span>
              <span className="text-xs text-slate-400">{settings.workMinutes}/{settings.shortBreakMinutes}/{settings.longBreakMinutes} 分钟</span>
            </button>
            <StatsPanel
              bestDay={bestDay}
              longestStreak={longestStreak}
              onSelectHistoryDate={selectHistoryDate}
              onStartFirst={handleStartPause}
              records={records}
              selectedDate={selectedHistoryDate}
              selectedRecords={selectedDayRecords}
              todayFocusMinutes={todayFocusMinutes}
              todayRecords={todayRecords}
              todayTaskCount={todayTaskCount}
              weekDays={weekDays}
              weeklyCounts={weeklyCounts}
            />
          </aside>
        </div>
      </div>

      <AnimatePresence>
        {immersive ? (
          <motion.div
            className={cn(
              "fixed inset-0 z-50 grid min-h-screen place-items-center px-4 py-6",
              timer.phase === "work" ? "bg-[var(--ff-bg)]" : "bg-[#F0FDF4]"
            )}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
          >
            <button
              className="ff-icon-button absolute right-4 top-4 h-11 w-11 bg-[var(--ff-surface)]"
              type="button"
              aria-label="退出沉浸模式"
              onClick={() => setImmersive(false)}
            >
              <X className="h-5 w-5" />
            </button>
            <div className="w-full max-w-2xl">
              <TimerCard
                activeTaskTitle={activeTaskTitle}
                celebrationId={celebrationId}
                flashVisible={flashVisible}
                immersive
                onReset={resetTimer}
                onSkip={handleSkip}
                onStartPause={handleStartPause}
                phase={timer.phase}
                remainingSeconds={timer.remainingSeconds}
                status={timer.status}
                tomatoNumber={tomatoNumber}
                totalSeconds={timer.totalSeconds}
              />
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {settingsOpen ? (
          <BottomSheet ariaLabel="番茄设置" className="max-w-xl" onClose={() => setSettingsOpen(false)}>
            <div className="max-h-[86vh] overflow-y-auto p-4">
              <SettingsPanel onPreviewSound={previewSound} settings={settings} setSetting={setSetting} />
            </div>
          </BottomSheet>
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {pendingTask ? (
          <BottomSheet ariaLabel="切换专注任务" className="max-w-md" onClose={() => setPendingTask(null)}>
            <div className="p-5">
              <p className="text-sm font-medium text-indigo-500">切换任务</p>
              <h2 className="mt-2 text-lg font-semibold text-slate-950 dark:text-slate-100">计时中切换任务？</h2>
              <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">
                当前番茄完成时会记录到切换后的任务。确认要切到「{pendingTask.title}」吗？
              </p>
              <div className="mt-5 flex justify-end gap-3">
                <button className="ff-button-secondary px-4 py-3 text-sm" type="button" onClick={() => setPendingTask(null)}>
                  取消
                </button>
                <button className="ff-button-primary px-4 py-3 text-sm" type="button" onClick={confirmTaskSwitch}>
                  确认切换
                </button>
              </div>
            </div>
          </BottomSheet>
        ) : null}
      </AnimatePresence>
    </>
  )
}

function TaskBindingPanel({ activeTaskTitle, filteredTasks, onSearch, onSelectTask, search, selectedTaskId, timerRunning }: { activeTaskTitle: string; filteredTasks: Task[]; onSearch: (value: string) => void; onSelectTask: (task: Task | null) => void; search: string; selectedTaskId: string | null; timerRunning: boolean }) {
  return (
    <section className="ff-card p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-medium text-indigo-500">今天在做什么？</p>
          <h2 className="mt-1 text-lg font-semibold text-slate-950 dark:text-slate-100">
            {activeTaskTitle || "自由专注"}
          </h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            {timerRunning ? "计时中切换任务需要确认。" : "开始前选择任务，完成后会自动记入番茄数。"}
          </p>
        </div>
        <button className="ff-button-secondary px-4 py-2 text-sm" type="button" onClick={() => onSelectTask(null)}>
          自由专注
        </button>
      </div>

      <label className="mt-3 flex items-center gap-2 rounded-xl border border-[var(--ff-border)] bg-[var(--ff-surface-muted)] px-3">
        <Search className="h-4 w-4 text-slate-400" />
        <input
          className="min-h-11 flex-1 bg-transparent text-sm outline-none"
          value={search}
          onChange={(event) => onSearch(event.target.value)}
          placeholder="搜索今日任务"
        />
      </label>

      <div className="mt-3 grid gap-2">
        {filteredTasks.length ? (
          filteredTasks.map((task) => (
            <button
              className={cn(
                "ff-card-muted flex w-full items-center justify-between gap-3 p-3 text-left transition",
                selectedTaskId === task.id && "border-indigo-300 bg-[var(--ff-brand-soft)]"
              )}
              key={task.id}
              type="button"
              onClick={() => onSelectTask(task)}
            >
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium text-slate-800 dark:text-slate-100">{task.title}</span>
                <span className="mt-1 block text-xs text-slate-400">
                  {getTaskDateLabel(task)} · {task.pomodoroCount} 番茄
                </span>
              </span>
              {selectedTaskId === task.id ? <CheckCircle2 className="h-5 w-5 shrink-0 text-indigo-500" /> : null}
            </button>
          ))
        ) : (
          <div className="rounded-xl border border-dashed border-[var(--ff-border)] px-4 py-3 text-sm text-slate-500 dark:text-slate-400">
            今天没有匹配的任务，先自由专注也很好。
          </div>
        )}
      </div>
    </section>
  )
}

function TimerCard({ activeTaskTitle, celebrationId, flashVisible, immersive, onEnterImmersive, onReset, onSkip, onStartPause, phase, remainingSeconds, status, tomatoNumber, totalSeconds }: { activeTaskTitle: string; celebrationId: number | null; flashVisible: boolean; immersive: boolean; onEnterImmersive?: () => void; onReset: () => void; onSkip: () => void; onStartPause: () => void; phase: PomodoroPhase; remainingSeconds: number; status: "idle" | "paused" | "running"; tomatoNumber: number; totalSeconds: number }) {
  const meta = phaseMeta[phase]
  const progress = totalSeconds ? 1 - remainingSeconds / totalSeconds : 0
  const dashOffset = ringCircumference * (1 - Math.max(0, Math.min(1, progress)))

  return (
    <section
      className={cn(
        "ff-card relative grid min-h-0 overflow-hidden p-5 text-center",
        phase !== "work" && "border-emerald-100 bg-[#F0FDF4]",
        immersive && "border-transparent bg-transparent"
      )}
    >
      <AnimatePresence>
        {flashVisible ? (
          <motion.div
            className="pointer-events-none absolute inset-0 z-30 bg-white"
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.6 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15, repeat: 1, repeatType: "reverse" }}
          />
        ) : null}
      </AnimatePresence>

      <div className="mx-auto grid h-full min-h-0 w-full max-w-lg content-center">
        <div className="mb-3 flex items-center justify-center gap-2">
          <p className="min-w-0 max-w-sm truncate text-sm font-medium text-slate-500 dark:text-slate-400">
            {activeTaskTitle || "自由专注"}
          </p>
          {onEnterImmersive ? (
            <button className="ff-icon-button h-9 min-h-9 w-9 min-w-9" type="button" aria-label="进入沉浸模式" title="沉浸模式" onClick={onEnterImmersive}>
              <Maximize2 className="h-4 w-4" />
            </button>
          ) : null}
        </div>

        <div className="relative mx-auto grid h-52 w-52 place-items-center">
          <svg className="-rotate-90" width="200" height="200" viewBox="0 0 200 200" aria-hidden="true">
            <circle cx="100" cy="100" r={ringRadius} fill="none" stroke="rgba(99, 102, 241, 0.15)" strokeWidth={ringStroke} />
            <circle
              cx="100"
              cy="100"
              r={ringRadius}
              fill="none"
              stroke={meta.accent}
              strokeDasharray={ringCircumference}
              strokeDashoffset={dashOffset}
              strokeLinecap="round"
              strokeWidth={ringStroke}
              style={{ transition: "stroke-dashoffset 800ms linear" }}
            />
          </svg>

          <div className="absolute inset-0 grid place-items-center">
            <div>
              <strong className="block text-5xl font-light tabular-nums tracking-tight text-slate-950 dark:text-slate-100">
                {formatSeconds(remainingSeconds)}
              </strong>
              <span className={cn("mt-3 inline-flex rounded-full px-3 py-1 text-xs font-semibold", meta.soft)}>
                {meta.label} · 第 {tomatoNumber} 个番茄
              </span>
            </div>
          </div>

          <AnimatePresence>
            {celebrationId ? <Celebration key={celebrationId} /> : null}
          </AnimatePresence>
        </div>

        {phase !== "work" ? (
          <div className="mx-auto mt-2 inline-flex items-center gap-2 rounded-full bg-white/70 px-4 py-2 text-sm font-medium text-emerald-700">
            <Coffee className="h-4 w-4" />
            {meta.description}
          </div>
        ) : (
          <p className="mx-auto mt-2 max-w-sm text-sm text-slate-500 dark:text-slate-400">{meta.description}</p>
        )}

        <div className="mx-auto mt-5 grid max-w-xl grid-cols-[1fr_1.4fr_1fr] gap-3">
          <button className="ff-button-secondary px-3 py-2 text-sm" type="button" onClick={onSkip}>
            <SkipForward className="h-4 w-4" />
            跳过
          </button>
          <button className="ff-button-primary min-h-12 px-5 py-3 text-base" type="button" onClick={onStartPause}>
            {status === "running" ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
            {status === "running" ? "暂停" : "开始"}
          </button>
          <button className="ff-button-secondary px-3 py-2 text-sm" type="button" onClick={onReset}>
            <RotateCcw className="h-4 w-4" />
            重置
          </button>
        </div>
      </div>
    </section>
  )
}

function Celebration() {
  return (
    <motion.div className="pointer-events-none absolute inset-0 z-20 grid place-items-center" exit={{ opacity: 0 }}>
      {confetti.map((item, index) => (
        <motion.span
          className={cn("absolute h-2 w-2 rounded-full", index % 3 === 0 ? "bg-amber-400" : index % 3 === 1 ? "bg-emerald-400" : "bg-indigo-400")}
          initial={{ opacity: 1, scale: 0, x: 0, y: 0 }}
          animate={{ opacity: 0, rotate: item.rotate, scale: 1, x: item.x, y: item.y }}
          transition={{ duration: 0.62, ease: "easeOut" }}
          key={index}
        />
      ))}
      <motion.svg
        className="h-16 w-16"
        viewBox="0 0 64 64"
        initial={{ opacity: 0, scale: 0 }}
        animate={{ opacity: 1, scale: [0, 1.2, 1] }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        aria-hidden="true"
      >
        <path d="M32 18c12 0 20 8 20 19 0 10-8 18-20 18S12 47 12 37c0-11 8-19 20-19Z" fill="#F97316" />
        <path d="M32 19c-2-7 3-10 8-9-1 5-4 8-8 9Z" fill="#22C55E" />
        <path d="M32 19c-4-4-9-4-13 0 5 1 9 1 13 0Z" fill="#16A34A" />
      </motion.svg>
    </motion.div>
  )
}

function StatsPanel({ bestDay, longestStreak, onSelectHistoryDate, onStartFirst, records, selectedDate, selectedRecords, todayFocusMinutes, todayRecords, todayTaskCount, weekDays, weeklyCounts }: { bestDay: { count: number; dateKey: string }; longestStreak: number; onSelectHistoryDate: (date: string) => void; onStartFirst: () => void; records: PomodoroRecord[]; selectedDate: string; selectedRecords: PomodoroRecord[]; todayFocusMinutes: number; todayRecords: PomodoroRecord[]; todayTaskCount: number; weekDays: Date[]; weeklyCounts: number[] }) {
  return (
    <section className="space-y-4">
      <div className="ff-card p-4">
        <p className="text-sm font-medium text-indigo-500">今日</p>
        <div className="mt-4 grid grid-cols-3 gap-2">
          <StatCard label="完成番茄" value={todayRecords.length} />
          <StatCard label="专注时长" value={formatFocusMinutes(todayFocusMinutes)} />
          <StatCard label="完成任务" value={todayTaskCount} />
        </div>
      </div>

      <div className="ff-card p-4">
        <p className="text-sm font-medium text-indigo-500">本周趋势</p>
        <WeeklyLineChart counts={weeklyCounts} days={weekDays} />
      </div>

      <div className="ff-card max-h-[172px] overflow-hidden p-4">
        <p className="text-sm font-medium text-indigo-500">历史</p>
        {records.length ? (
          <>
            <div className="mt-4 grid grid-cols-3 gap-2">
              <StatCard label="总番茄" value={records.length} />
              <StatCard label="最长连续" value={`${longestStreak} 天`} />
              <StatCard label="最高效日" value={bestDay.count ? `${bestDay.count} 个` : "暂无"} />
            </div>
            <Heatmap records={records} selectedDate={selectedDate} onSelect={onSelectHistoryDate} />
            <DayRecordTimeline dateKey={selectedDate} records={selectedRecords} />
          </>
        ) : (
          <PomodoroEmptyState onStart={onStartFirst} />
        )}
      </div>
    </section>
  )
}

function StatCard({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-xl border border-[var(--ff-border)] bg-[var(--ff-surface-muted)] p-3">
      <span className="block text-[11px] text-slate-500 dark:text-slate-400">{label}</span>
      <strong className="mt-1 block truncate text-base text-slate-950 dark:text-slate-100">{value}</strong>
    </div>
  )
}

function WeeklyLineChart({ counts, days }: { counts: number[]; days: Date[] }) {
  const max = Math.max(1, ...counts)
  const points = counts.map((count, index) => {
    const x = 16 + index * 44
    const y = 96 - (count / max) * 72
    return `${x},${y}`
  })

  return (
    <div className="mt-4">
      <svg className="h-32 w-full" viewBox="0 0 296 120" role="img" aria-label="本周每日番茄数折线图">
        <path d="M16 96 C70 90 92 110 148 84 S232 18 280 36" fill="none" stroke="rgba(99,102,241,0.10)" strokeLinecap="round" strokeWidth="10" />
        <polyline fill="none" points={points.join(" ")} stroke="var(--ff-brand)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" />
        {counts.map((count, index) => {
          const [x, y] = points[index].split(",").map(Number)
          return <circle cx={x} cy={y} fill="var(--ff-surface)" key={days[index].toISOString()} r="4" stroke="var(--ff-brand)" strokeWidth="2" />
        })}
      </svg>
      <div className="grid grid-cols-7 text-center text-[10px] text-slate-400">
        {days.map((day) => (
          <span key={day.toISOString()}>{format(day, "EEE")}</span>
        ))}
      </div>
    </div>
  )
}

function Heatmap({ onSelect, records, selectedDate }: { onSelect: (date: string) => void; records: PomodoroRecord[]; selectedDate: string }) {
  const weekStart = startOfWeek(startOfToday(), { weekStartsOn: 1 })
  const firstDay = subDays(weekStart, 51 * 7)
  const weeks = Array.from({ length: 52 }, (_, weekIndex) =>
    Array.from({ length: 7 }, (_, dayIndex) => addDays(firstDay, weekIndex * 7 + dayIndex))
  )

  return (
    <div className="mt-5 overflow-x-auto pb-1">
      <div className="flex min-w-[650px] gap-1" aria-label="每日专注热力图">
        {weeks.map((week, weekIndex) => (
          <div className="grid grid-rows-7 gap-1" key={weekIndex}>
            {week.map((day) => {
              const dateKey = format(day, "yyyy-MM-dd")
              const count = countRecordsForDate(records, day)
              return (
                <button
                  className={cn(
                    "h-2.5 w-2.5 rounded-sm ring-offset-2 ring-offset-[var(--ff-surface)] transition hover:scale-125",
                    heatClass(count),
                    selectedDate === dateKey && "ring-2 ring-indigo-500"
                  )}
                  key={dateKey}
                  type="button"
                  aria-label={`${dateKey}，${count} 个番茄`}
                  onClick={() => onSelect(dateKey)}
                  title={`${dateKey} · ${count} 个番茄`}
                />
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}

function DayRecordTimeline({ dateKey, records }: { dateKey: string; records: PomodoroRecord[] }) {
  return (
    <div className="mt-5">
      <h3 className="text-sm font-semibold text-slate-950 dark:text-slate-100">{dateKey} 记录</h3>
      <div className="mt-3 space-y-3">
        {records.length ? (
          records.map((record) => (
            <div className="relative pl-5" key={record.id}>
              <span className="absolute left-0 top-2 h-2 w-2 rounded-full bg-[var(--ff-brand)]" />
              <div className="rounded-xl border border-[var(--ff-border)] bg-[var(--ff-surface-muted)] p-3">
                <p className="truncate text-sm font-medium text-slate-800 dark:text-slate-100">
                  {record.taskTitle || "自由专注"}
                </p>
                <p className="mt-1 text-xs text-slate-400">
                  {format(parseISO(record.startedAt), "HH:mm")} - {format(parseISO(record.endedAt), "HH:mm")} · {record.durationMinutes} 分钟
                </p>
              </div>
            </div>
          ))
        ) : (
          <p className="rounded-xl border border-dashed border-[var(--ff-border)] p-3 text-sm text-slate-500 dark:text-slate-400">
            这一天还没有专注记录。
          </p>
        )}
      </div>
    </div>
  )
}

function PomodoroEmptyState({ onStart }: { onStart: () => void }) {
  return (
    <div className="mt-3 rounded-xl border border-[var(--ff-border)] bg-[var(--ff-surface-muted)] px-4 py-3">
      <div className="flex items-start gap-3">
        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[var(--ff-brand-soft)] text-[var(--ff-brand-text)]">
          <TimerReset className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-slate-950 dark:text-slate-100">还没有历史记录</p>
          <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">完成第一颗番茄后，这里会显示你的专注轨迹。</p>
        </div>
      </div>
      <button className="mt-3 min-h-10 w-full rounded-lg bg-[var(--ff-brand-soft)] px-3 text-sm font-semibold text-[var(--ff-brand-text)] transition hover:bg-[var(--ff-brand)] hover:text-white" type="button" onClick={onStart}>
        开始第一颗番茄
      </button>
    </div>
  )
}

function SettingsPanel({ onPreviewSound, settings, setSetting }: { onPreviewSound: () => void; settings: PomodoroSettings; setSetting: <Key extends keyof PomodoroSettings>(key: Key, value: PomodoroSettings[Key]) => void }) {
  return (
    <section className="ff-card p-4">
      <div className="flex items-center gap-2">
        <Settings2 className="h-4 w-4 text-indigo-500" />
        <h2 className="text-base font-semibold text-slate-950 dark:text-slate-100">设置</h2>
      </div>

      <div className="mt-4 space-y-4">
        <SettingSlider label="工作时长" max={90} min={5} step={5} value={settings.workMinutes} onChange={(value) => setSetting("workMinutes", value)} />
        <SettingSlider label="短休息时长" max={30} min={1} step={1} value={settings.shortBreakMinutes} onChange={(value) => setSetting("shortBreakMinutes", value)} />
        <SettingSlider label="长休息时长" max={60} min={5} step={5} value={settings.longBreakMinutes} onChange={(value) => setSetting("longBreakMinutes", value)} />
        <SettingSlider label="长休息间隔" max={8} min={2} step={1} suffix=" 个番茄" value={settings.longBreakInterval} onChange={(value) => setSetting("longBreakInterval", value)} />

        <SettingToggle checked={settings.autoStartWork} label="自动开始工作" onChange={(checked) => setSetting("autoStartWork", checked)} />
        <SettingToggle checked={settings.autoStartBreak} label="自动开始休息" onChange={(checked) => setSetting("autoStartBreak", checked)} />
        <SettingToggle checked={settings.doNotDisturb} label="勿扰模式" onChange={(checked) => setSetting("doNotDisturb", checked)} />

        <div>
          <label className="text-sm font-medium text-slate-700 dark:text-slate-200">音效选择</label>
          <div className="mt-2 flex gap-2">
            <select
              className="ff-input min-w-0 flex-1 px-3 py-2 text-sm outline-none"
              value={settings.sound}
              onChange={(event) => setSetting("sound", event.target.value as PomodoroSound)}
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
      </div>
    </section>
  )
}

function SettingSlider({ label, max, min, onChange, step, suffix = " 分钟", value }: { label: string; max: number; min: number; onChange: (value: number) => void; step: number; suffix?: string; value: number }) {
  return (
    <label className="block">
      <span className="flex items-center justify-between gap-3 text-sm font-medium text-slate-700 dark:text-slate-200">
        {label}
        <span className="text-xs text-slate-400">
          {value}
          {suffix}
        </span>
      </span>
      <input
        className="mt-2 w-full accent-[var(--ff-brand)]"
        max={max}
        min={min}
        step={step}
        type="range"
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </label>
  )
}

function SettingToggle({ checked, label, onChange }: { checked: boolean; label: string; onChange: (checked: boolean) => void }) {
  return (
    <label className="flex items-center justify-between gap-3 rounded-xl border border-[var(--ff-border)] bg-[var(--ff-surface-muted)] px-3 py-2 text-sm font-medium text-slate-700 dark:text-slate-200">
      {label}
      <input
        checked={checked}
        className="h-5 w-5 accent-[var(--ff-brand)]"
        type="checkbox"
        onChange={(event) => onChange(event.target.checked)}
      />
    </label>
  )
}
