import { type ReactNode, useEffect, useMemo, useState } from "react"
import {
  Bell,
  Download,
  FileJson,
  Flame,
  Upload,
  Link2,
  Mail,
  Moon,
  Palette,
  Phone,
  RotateCcw,
  ShieldCheck,
  Smartphone,
  TimerReset,
  Trash2,
  UserCircle2,
  Volume2,
} from "lucide-react"
import { useTopBarSlot } from "../../../components/layout/topBarSlot"
import { BottomSheet } from "../../../components/ui/BottomSheet"
import { useToast } from "../../../components/ui/ToastProvider"
import { cn } from "../../../lib/cn"
import { usePomodoroStore } from "../../pomodoro/store/pomodoroStore"
import type { PomodoroSettings } from "../../pomodoro/types"
import { useReminderStore } from "../../reminders/store/reminderStore"
import type { ReminderSettings } from "../../reminders/types"
import { useNoteStore } from "../../notes/store/noteStore"
import { useTaskStore } from "../../tasks/store/taskStore"
import { useNotionStore } from "../../integrations/notion/store/notionStore"
import { useNotionSync } from "../../integrations/notion/useNotionSync"
import { useProfileStore, type AppearanceMode, type ProfileState } from "../store/profileStore"

type ProfileModule = "identity" | "stats" | "settings" | "data"
type DangerAction = "clearData" | "logout" | null
type PomodoroSettingUpdater = <Key extends keyof PomodoroSettings>(key: Key, value: PomodoroSettings[Key]) => void

const modules: Array<{ icon: typeof UserCircle2; label: string; value: ProfileModule }> = [
  { icon: UserCircle2, label: "身份", value: "identity" },
  { icon: Flame, label: "数据", value: "stats" },
  { icon: Palette, label: "设置", value: "settings" },
  { icon: ShieldCheck, label: "数据与账号", value: "data" },
]

const storageKeys = [
  "focusflow.tasks.v1",
  "focusflow.notes.v1",
  "focusflow.calendar.v1",
  "focusflow.pomodoro.v1",
  "focusflow.reminders.v1",
  "focusflow.profile.v1",
  "focusflow.notion.v1",
  "focusflow.trash.v1",
]

function dateKey(date: Date): string {
  return date.toISOString().slice(0, 10)
}

function startOfLocalDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

function daysAgo(count: number): Date {
  const date = startOfLocalDay(new Date())
  date.setDate(date.getDate() - count)
  return date
}

function formatMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes} 分钟`
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  return rest ? `${hours} 小时 ${rest} 分钟` : `${hours} 小时`
}

function buildExportPayload() {
  return storageKeys.reduce<Record<string, unknown>>((payload, key) => {
    payload[key] = JSON.parse(window.localStorage.getItem(key) ?? "null")
    return payload
  }, {})
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value))
}

function importExportPayload(payload: unknown): number {
  if (!isPlainRecord(payload)) {
    throw new Error("导入文件格式不正确")
  }

  const entries = storageKeys
    .filter((key) => Object.prototype.hasOwnProperty.call(payload, key))
    .map((key) => [key, payload[key]] as const)

  if (!entries.length) {
    throw new Error("没有找到可导入的 yaoyaoflow 数据")
  }

  entries.forEach(([key, value]) => {
    if (value === null || value === undefined) {
      window.localStorage.removeItem(key)
      return
    }
    window.localStorage.setItem(key, JSON.stringify(value))
  })

  return entries.length
}

function downloadJson(filename: string, payload: unknown) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" })
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

export function ProfilePage() {
  const { notify } = useToast()
  const topBarSlot = useTopBarSlot()
  const profile = useProfileStore()
  const { tasks } = useTaskStore()
  const { notes } = useNoteStore()
  const { records: pomodoroRecords, settings: pomodoroSettings, setSetting: setPomodoroSetting } = usePomodoroStore()
  const { settings: reminderSettings, setSetting: setReminderSetting } = useReminderStore()
  const notion = useNotionSync(tasks, notes, notify)
  const [activeModule, setActiveModule] = useState<ProfileModule>("identity")
  const [dangerAction, setDangerAction] = useState<DangerAction>(null)

  const stats = useMemo(() => {
    const today = dateKey(new Date())
    const weekStart = daysAgo(6)
    const monthStart = daysAgo(29)
    const taskDate = (task: { createdAt: string; dueDate?: string }) => new Date(`${task.dueDate || task.createdAt.slice(0, 10)}T00:00:00`)
    const inRange = (date: Date, start: Date) => date >= start

    const todayTasks = tasks.filter((task) => (task.dueDate || task.createdAt.slice(0, 10)) === today)
    const weekTasks = tasks.filter((task) => inRange(taskDate(task), weekStart))
    const monthTasks = tasks.filter((task) => inRange(taskDate(task), monthStart))

    const rangeRecords = (start: Date) => pomodoroRecords.filter((record) => new Date(record.endedAt) >= start)
    const todayRecords = pomodoroRecords.filter((record) => record.endedAt.slice(0, 10) === today)
    const weekRecords = rangeRecords(weekStart)
    const monthRecords = rangeRecords(monthStart)

    return {
      month: buildRangeStats(monthTasks, monthRecords),
      today: buildRangeStats(todayTasks, todayRecords),
      week: buildRangeStats(weekTasks, weekRecords),
      yearlyHeatmap: buildYearlyHeatmap(tasks, pomodoroRecords),
    }
  }, [pomodoroRecords, tasks])

  const storageMb = storageKeys.reduce((total, key) => total + (window.localStorage.getItem(key)?.length ?? 0), 0) / 1024 / 1024

  useEffect(() => {
    const moduleTabs = (
      <nav className="flex justify-end gap-2 overflow-x-auto">
        {modules.map((module) => {
          const Icon = module.icon
          return (
            <button
              className={cn(
                "inline-flex min-w-fit items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition",
                activeModule === module.value ? "bg-[var(--ff-brand-soft)] text-[var(--ff-brand-text)]" : "text-[var(--ff-ink-500)] hover:bg-[var(--ff-surface-muted)]"
              )}
              key={module.value}
              type="button"
              onClick={() => setActiveModule(module.value)}
            >
              <Icon className="h-4 w-4" />
              {module.label}
            </button>
          )
        })}
      </nav>
    )

    topBarSlot?.setTopBarSlot({
      desktop: moduleTabs,
      mobilePanel: moduleTabs,
    })

    return () => topBarSlot?.setTopBarSlot(null)
  }, [activeModule, topBarSlot])

  function exportData() {
    downloadJson(`yaoyaoflow_export_${dateKey(new Date()).replace(/-/g, "")}.json`, buildExportPayload())
    notify("数据已导出", "success")
  }

  async function importData(file: File | null) {
    if (!file) return

    try {
      const content = await file.text()
      const count = importExportPayload(JSON.parse(content))
      notify(`已导入 ${count} 类数据，正在刷新`, "success")
      window.setTimeout(() => window.location.reload(), 700)
    } catch (error) {
      notify(error instanceof Error ? error.message : "JSON 导入失败", "error")
    }
  }

  function confirmDangerAction() {
    if (dangerAction === "clearData") {
      storageKeys.forEach((key) => window.localStorage.removeItem(key))
      notify("本地数据已清除，重启后生效", "warning")
    }

    if (dangerAction === "logout") {
      profile.resetAccount()
      notify("账号信息已注销，本地数据仍保留", "info")
    }

    setDangerAction(null)
  }

  return (
    <div className="mx-auto grid h-full min-h-0 w-full max-w-6xl grid-rows-[minmax(0,1fr)]">
      <main className="min-h-0 overflow-y-auto pr-1">
        {activeModule === "identity" ? <IdentityModule profile={profile} /> : null}
        {activeModule === "stats" ? <StatsModule stats={stats} /> : null}
        {activeModule === "settings" ? (
          <SettingsModule
            pomodoroSettings={pomodoroSettings}
            profile={profile}
            reminderSettings={reminderSettings}
            setPomodoroSetting={setPomodoroSetting}
            setReminderSetting={setReminderSetting}
          />
        ) : null}
        {activeModule === "data" ? (
          <DataModule exportData={exportData} importData={importData} notion={notion} setDangerAction={setDangerAction} storageMb={storageMb} />
        ) : null}
      </main>

      {dangerAction ? (
        <BottomSheet ariaLabel="账号与数据确认" className="max-w-md" onClose={() => setDangerAction(null)}>
          <div className="p-5">
            <h2 className="text-lg font-semibold text-rose-700">确认执行这个操作？</h2>
            <p className="mt-2 text-sm leading-6 text-[var(--ff-muted)]">
              {dangerAction === "clearData"
                ? "这会清除本机 yaoyaoflow 的任务、笔记、提醒、番茄和个人设置。建议先导出 JSON。"
                : "这会清空头像、用户名、签名和账号绑定信息，但不会删除任务和笔记。"}
            </p>
            <div className="mt-5 flex justify-end gap-3">
              <button className="ff-button-secondary px-4 py-3 text-sm" type="button" onClick={() => setDangerAction(null)}>
                取消
              </button>
              <button className="rounded-lg bg-rose-600 px-4 py-3 text-sm font-semibold text-white" type="button" onClick={confirmDangerAction}>
                确认
              </button>
            </div>
          </div>
        </BottomSheet>
      ) : null}
    </div>
  )
}

function buildRangeStats(tasks: Array<{ completed: boolean }>, records: Array<{ durationMinutes: number }>) {
  const completed = tasks.filter((task) => task.completed).length
  const total = tasks.length
  const focusMinutes = records.reduce((sum, record) => sum + record.durationMinutes, 0)

  return {
    completed,
    completionRate: total ? Math.round((completed / total) * 100) : 0,
    focusMinutes,
    pomodoros: records.length,
    total,
  }
}

function buildYearlyHeatmap(tasks: Array<{ completed: boolean; dueDate?: string; createdAt: string }>, records: Array<{ endedAt: string; durationMinutes: number }>) {
  return Array.from({ length: 365 }, (_, index) => {
    const date = daysAgo(364 - index)
    const key = dateKey(date)
    const taskScore = tasks.filter((task) => task.completed && (task.dueDate || task.createdAt.slice(0, 10)) === key).length
    const focusScore = records.filter((record) => record.endedAt.slice(0, 10) === key).reduce((sum, record) => sum + Math.ceil(record.durationMinutes / 25), 0)
    return { key, value: taskScore + focusScore }
  })
}

function IdentityModule({ profile }: { profile: ProfileState }) {
  return (
    <div className="grid gap-4 lg:grid-cols-[360px_minmax(0,1fr)]">
      <section className="ff-card p-5">
        <div className="flex items-center gap-4">
          <div className="grid h-20 w-20 place-items-center overflow-hidden rounded-3xl border border-[var(--ff-border)] bg-[var(--ff-brand-soft)]">
            {profile.avatarUrl ? (
              <img alt="头像" className="h-full w-full object-cover" src={profile.avatarUrl} />
            ) : (
              <UserCircle2 className="h-12 w-12 text-[var(--ff-brand)]" />
            )}
          </div>
          <div>
            <p className="text-sm text-[var(--ff-muted)]">yaoyaoflow Space</p>
            <h2 className="text-2xl font-semibold text-[var(--ff-ink-900)]">{profile.username || "yaoyaoflow 用户"}</h2>
          </div>
        </div>
        <p className="mt-4 rounded-xl bg-[var(--ff-surface-muted)] px-4 py-3 text-sm leading-6 text-[var(--ff-muted)]">
          {profile.signature || "写一句个性签名，让这里更像你的空间。"}
        </p>
      </section>

      <section className="ff-card grid gap-4 p-5">
        <TextField label="头像 URL" placeholder="https://..." value={profile.avatarUrl} onChange={profile.setAvatarUrl} />
        <TextField label="用户名" value={profile.username} onChange={profile.setUsername} />
        <TextField label="个性签名" placeholder="保持专注，慢慢来。" value={profile.signature} onChange={profile.setSignature} />
        <div className="grid gap-3 sm:grid-cols-2">
          <TextField icon={<Mail className="h-4 w-4" />} label="绑定邮箱" placeholder="name@example.com" value={profile.email} onChange={profile.setEmail} />
          <TextField icon={<Phone className="h-4 w-4" />} label="绑定手机" placeholder="+86 138..." value={profile.phone} onChange={profile.setPhone} />
        </div>
      </section>
    </div>
  )
}

function StatsModule({ stats }: { stats: ReturnType<typeof buildStatsForProps> }) {
  return (
    <div className="grid gap-4">
      <div className="grid gap-3 md:grid-cols-3">
        <RangeCard label="今日" stats={stats.today} />
        <RangeCard label="本周" stats={stats.week} />
        <RangeCard label="本月" stats={stats.month} />
      </div>
      <section className="ff-card p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-[var(--ff-ink-900)]">年度热力图</h2>
            <p className="text-sm text-[var(--ff-muted)]">任务完成与专注记录越多，颜色越深。</p>
          </div>
          <span className="rounded-full bg-[var(--ff-brand-soft)] px-3 py-1 text-xs font-semibold text-[var(--ff-brand-text)]">365 天</span>
        </div>
        <div className="mt-5 grid grid-flow-col grid-rows-7 gap-1 overflow-x-auto pb-2">
          {stats.yearlyHeatmap.map((day) => (
            <span
              className={cn(
                "h-3 w-3 rounded-[3px]",
                day.value === 0 ? "bg-[var(--ff-surface-muted)]" : day.value < 2 ? "bg-[#BFD7F6]" : day.value < 4 ? "bg-[#6EA6E8]" : "bg-[var(--ff-brand)]"
              )}
              key={day.key}
              title={`${day.key} · ${day.value}`}
            />
          ))}
        </div>
      </section>
    </div>
  )
}

function buildStatsForProps() {
  return {
    month: buildRangeStats([], []),
    today: buildRangeStats([], []),
    week: buildRangeStats([], []),
    yearlyHeatmap: [] as Array<{ key: string; value: number }>,
  }
}

function RangeCard({ label, stats }: { label: string; stats: ReturnType<typeof buildRangeStats> }) {
  return (
    <section className="ff-card grid gap-4 p-5">
      <h2 className="text-base font-semibold text-[var(--ff-ink-900)]">{label}</h2>
      <div className="grid grid-cols-2 gap-3">
        <Metric label="完成数" value={stats.completed} />
        <Metric label="完成率" value={`${stats.completionRate}%`} />
        <Metric label="专注时长" value={formatMinutes(stats.focusMinutes)} />
        <Metric label="番茄数" value={stats.pomodoros} />
      </div>
    </section>
  )
}

function SettingsModule({
  pomodoroSettings,
  profile,
  reminderSettings,
  setPomodoroSetting,
  setReminderSetting,
}: {
  pomodoroSettings: PomodoroSettings
  profile: ProfileState
  reminderSettings: ReminderSettings
  setPomodoroSetting: PomodoroSettingUpdater
  setReminderSetting: <Key extends keyof ReminderSettings>(key: Key, value: ReminderSettings[Key]) => void
}) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <SettingsCard icon={<Palette className="h-5 w-5" />} title="主题与外观">
        <Segmented
          value={profile.settings.appearance}
          options={[
            ["system", "跟随系统"],
            ["light", "白天"],
            ["dark", "夜间"],
            ["synthwave", "复古电子乐"],
            ["pixel", "像素风"],
            ["pop", "波普风格"],
            ["mondrian", "蒙德里安"],
          ]}
          onChange={(value) => profile.setSetting("appearance", value as AppearanceMode)}
        />
        <Toggle checked={profile.settings.ambienceThemes} label="时段氛围主题" onChange={(value) => profile.setSetting("ambienceThemes", value)} />
        <Toggle checked={profile.settings.haptics} label="触感反馈" onChange={(value) => profile.setSetting("haptics", value)} />
      </SettingsCard>

      <SettingsCard icon={<Bell className="h-5 w-5" />} title="通知配置">
        <Toggle checked={profile.settings.dailyMorningReminder} label="晨间提醒" onChange={(value) => profile.setSetting("dailyMorningReminder", value)} />
        <Toggle checked={profile.settings.dailyReviewReminder} label="夜间复盘提醒" onChange={(value) => profile.setSetting("dailyReviewReminder", value)} />
        <Toggle checked={profile.settings.pomodoroNotifications} label="番茄钟结束通知" onChange={(value) => profile.setSetting("pomodoroNotifications", value)} />
      </SettingsCard>

      <SettingsCard icon={<TimerReset className="h-5 w-5" />} title="番茄钟时长">
        <Range label="工作" max={90} min={5} value={pomodoroSettings.workMinutes} onChange={(value) => setPomodoroSetting("workMinutes", value)} />
        <Range label="短休息" max={30} min={1} value={pomodoroSettings.shortBreakMinutes} onChange={(value) => setPomodoroSetting("shortBreakMinutes", value)} />
        <Range label="长休息" max={60} min={5} value={pomodoroSettings.longBreakMinutes} onChange={(value) => setPomodoroSetting("longBreakMinutes", value)} />
      </SettingsCard>

      <SettingsCard icon={<Volume2 className="h-5 w-5" />} title="音效与触感">
        <Toggle checked={profile.settings.masterSound} label="全局音效" onChange={(value) => profile.setSetting("masterSound", value)} />
        <Toggle checked={profile.settings.taskSounds} label="任务音效" onChange={(value) => profile.setSetting("taskSounds", value)} />
        <Toggle checked={reminderSettings.vibration} label="提醒震动" onChange={(value) => setReminderSetting("vibration", value)} />
        <Range label="提醒音量" max={100} min={0} value={Math.round(reminderSettings.volume * 100)} onChange={(value) => setReminderSetting("volume", value / 100)} />
      </SettingsCard>
    </div>
  )
}

function DataModule({
  exportData,
  importData,
  notion,
  setDangerAction,
  storageMb,
}: {
  exportData: () => void
  importData: (file: File | null) => void
  notion: ReturnType<typeof useNotionSync>
  setDangerAction: (action: DangerAction) => void
  storageMb: number
}) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <NotionSyncCard notion={notion} />

      <section className="ff-card p-5">
        <FileJson className="h-6 w-6 text-[var(--ff-brand)]" />
        <h2 className="mt-3 text-lg font-semibold text-[var(--ff-ink-900)]">JSON 导出</h2>
        <p className="mt-2 text-sm leading-6 text-[var(--ff-muted)]">导出任务、笔记、提醒、番茄和个人设置。数据属于你，这一点要清楚。</p>
        <button className="ff-button-primary mt-4 px-4 py-3 text-sm" type="button" onClick={exportData}>
          <Download className="h-4 w-4" />
          导出全部数据
        </button>
        <label className="ff-button-secondary mt-3 inline-flex cursor-pointer px-4 py-3 text-sm">
          <Upload className="h-4 w-4" />
          导入 JSON 数据
          <input
            className="sr-only"
            type="file"
            accept="application/json,.json"
            onChange={(event) => {
              importData(event.currentTarget.files?.[0] ?? null)
              event.currentTarget.value = ""
            }}
          />
        </label>
      </section>

      <section className="ff-card p-5">
        <Smartphone className="h-6 w-6 text-[var(--ff-brand)]" />
        <h2 className="mt-3 text-lg font-semibold text-[var(--ff-ink-900)]">本地数据占用</h2>
        <p className="mt-2 text-sm text-[var(--ff-muted)]">{storageMb.toFixed(2)} MB / 50 MB</p>
        <div className="mt-4 h-2 rounded-full bg-[var(--ff-brand-soft)]">
          <div className="h-2 rounded-full bg-[var(--ff-brand)]" style={{ width: `${Math.min(100, (storageMb / 50) * 100)}%` }} />
        </div>
      </section>

      <section className="ff-card p-5">
        <Trash2 className="h-6 w-6 text-rose-500" />
        <h2 className="mt-3 text-lg font-semibold text-[var(--ff-ink-900)]">清除数据</h2>
        <p className="mt-2 text-sm leading-6 text-[var(--ff-muted)]">清空本机所有 yaoyaoflow 数据。建议先导出 JSON。</p>
        <button className="mt-4 rounded-lg bg-rose-600 px-4 py-3 text-sm font-semibold text-white" type="button" onClick={() => setDangerAction("clearData")}>
          清除本地数据
        </button>
      </section>

      <section className="ff-card p-5">
        <RotateCcw className="h-6 w-6 text-rose-500" />
        <h2 className="mt-3 text-lg font-semibold text-[var(--ff-ink-900)]">注销账号</h2>
        <p className="mt-2 text-sm leading-6 text-[var(--ff-muted)]">清除头像、用户名、签名、邮箱和手机绑定，不删除任务和笔记。</p>
        <button className="mt-4 ff-button-secondary px-4 py-3 text-sm" type="button" onClick={() => setDangerAction("logout")}>
          注销账号信息
        </button>
      </section>
    </div>
  )
}

function formatRelativeSyncTime(value: string | null) {
  if (!value) return "尚未同步"
  const diffMs = Date.now() - new Date(value).getTime()
  const minutes = Math.max(0, Math.round(diffMs / 60_000))
  if (minutes < 1) return "刚刚"
  if (minutes < 60) return `${minutes} 分钟前`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours} 小时前`
  return `${Math.round(hours / 24)} 天前`
}

function NotionSyncCard({ notion }: { notion: ReturnType<typeof useNotionSync> }) {
  const { setDatabase, setDirection, setEnabled } = useNotionStore()
  const [manualCode, setManualCode] = useState("")
  const connected = Boolean(notion.connection)

  return (
    <section className="ff-card p-5 lg:col-span-2">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Link2 className="h-5 w-5 text-[var(--ff-brand)]" />
            <h2 className="text-lg font-semibold text-[var(--ff-ink-900)]">Notion 同步</h2>
          </div>
          <p className="mt-2 text-sm leading-6 text-[var(--ff-muted)]">
            可选连接 Notion workspace，同步任务和笔记。OAuth token 通过 Electron 安全层加密保存。
          </p>
        </div>
        {connected ? (
          <button className="ff-button-secondary ff-danger-action px-4 py-2 text-sm" type="button" onClick={notion.clearConnection}>
            断开连接
          </button>
        ) : (
          <button className="ff-button-primary px-4 py-2 text-sm" type="button" disabled={notion.busy} onClick={notion.connect}>
            连接 Notion
          </button>
        )}
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <div className="rounded-xl bg-[var(--ff-surface-muted)] p-3">
          <p className="text-xs text-[var(--ff-muted)]">连接状态</p>
          <p className="mt-1 text-sm font-semibold text-[var(--ff-ink-900)]">
            {connected ? `已连接 ${notion.connection?.workspaceName}` : notion.config?.configured ? "未连接" : "待配置 OAuth"}
          </p>
        </div>
        <div className="rounded-xl bg-[var(--ff-surface-muted)] p-3">
          <p className="text-xs text-[var(--ff-muted)]">最后同步</p>
          <p className="mt-1 text-sm font-semibold text-[var(--ff-ink-900)]">{formatRelativeSyncTime(notion.settings.lastSyncedAt)}</p>
        </div>
        <div className="rounded-xl bg-[var(--ff-surface-muted)] p-3">
          <p className="text-xs text-[var(--ff-muted)]">同步方向</p>
          <p className="mt-1 text-sm font-semibold text-[var(--ff-ink-900)]">{notion.settings.direction === "push" ? "仅推送" : "双向同步"}</p>
        </div>
      </div>

      {!notion.config?.configured ? (
        <div className="mt-4 rounded-xl border border-[var(--ff-warning)]/30 bg-[var(--ff-warning-soft)] p-3 text-sm leading-6 text-[var(--ff-warning)]">
          需要设置 `NOTION_OAUTH_CLIENT_ID`、`NOTION_OAUTH_CLIENT_SECRET`，并在 Notion 后台登记公网 HTTPS 回调页，例如 `https://你的域名/oauth/notion-callback.html`。
        </div>
      ) : null}

      {!connected ? (
        <div className="mt-4 rounded-xl border border-[var(--ff-border)] bg-[var(--ff-surface-muted)] p-3">
          <p className="text-sm font-semibold text-[var(--ff-ink-900)]">手动完成授权</p>
          <p className="mt-1 text-xs leading-5 text-[var(--ff-muted)]">
            如果浏览器没有自动回到应用，把 Notion 回调后的完整地址或 `code=...` 粘贴到这里。
          </p>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <input
              className="ff-input min-w-0 flex-1 px-3 text-sm"
              placeholder="https://...?...code=... 或直接粘贴 code"
              value={manualCode}
              onChange={(event) => setManualCode(event.target.value)}
            />
            <button className="ff-button-secondary px-4 py-2 text-sm" type="button" disabled={notion.busy || !manualCode.trim()} onClick={() => void notion.completeWithCode(manualCode)}>
              使用 code 连接
            </button>
          </div>
        </div>
      ) : null}

      {connected ? (
        <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto]">
          <label className="block">
            <span className="text-sm font-semibold text-[var(--ff-ink-700)]">目标数据库</span>
            <div className="mt-2 flex gap-2">
              <select
                className="ff-input min-w-0 flex-1 px-3 text-sm"
                value={notion.settings.databaseId}
                onChange={(event) => {
                  const database = notion.databases.find((item) => item.id === event.target.value) ?? null
                  setDatabase(database)
                }}
              >
                <option value="">选择 Notion Database</option>
                {notion.databases.map((database) => (
                  <option key={database.id} value={database.id}>
                    {database.title}
                  </option>
                ))}
              </select>
              <button className="ff-button-secondary px-3 py-2 text-sm" type="button" disabled={notion.busy} onClick={() => void notion.refreshDatabases()}>
                刷新
              </button>
            </div>
          </label>

          <div className="flex flex-wrap items-end gap-2">
            <button className="ff-button-primary px-4 py-2 text-sm" type="button" disabled={notion.busy || !notion.settings.databaseId} onClick={() => void notion.runFullSync()}>
              {notion.busy ? "同步中" : "立即全量同步"}
            </button>
          </div>

          <div className="flex flex-wrap gap-2 lg:col-span-2">
            <button
              className={cn("rounded-xl border px-4 py-2 text-sm font-semibold", notion.settings.direction === "push" ? "border-[var(--ff-brand)] bg-[var(--ff-brand-soft)] text-[var(--ff-brand-text)]" : "border-[var(--ff-border)] text-[var(--ff-muted)]")}
              type="button"
              onClick={() => setDirection("push")}
            >
              仅推送
            </button>
            <button
              className={cn("rounded-xl border px-4 py-2 text-sm font-semibold", notion.settings.direction === "bidirectional" ? "border-[var(--ff-brand)] bg-[var(--ff-brand-soft)] text-[var(--ff-brand-text)]" : "border-[var(--ff-border)] text-[var(--ff-muted)]")}
              type="button"
              onClick={() => setDirection("bidirectional")}
            >
              双向同步
            </button>
            <Toggle checked={notion.settings.enabled} label="任务变更后自动推送" onChange={setEnabled} />
          </div>
        </div>
      ) : null}

      {notion.error ? <p className="mt-3 text-sm text-[var(--ff-danger)]">{notion.error}</p> : null}
    </section>
  )
}

function Metric({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-xl bg-[var(--ff-surface-muted)] p-3">
      <strong className="block text-xl font-semibold text-[var(--ff-ink-900)]">{value}</strong>
      <span className="mt-1 block text-xs text-[var(--ff-muted)]">{label}</span>
    </div>
  )
}

function TextField({ icon, label, onChange, placeholder, value }: { icon?: ReactNode; label: string; onChange: (value: string) => void; placeholder?: string; value: string }) {
  return (
    <label className="block">
      <span className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--ff-ink-700)]">
        {icon}
        {label}
      </span>
      <input className="ff-input mt-2 w-full px-4 py-3 text-sm outline-none" value={value} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} />
    </label>
  )
}

function SettingsCard({ children, icon, title }: { children: ReactNode; icon: ReactNode; title: string }) {
  return (
    <section className="ff-card grid gap-4 p-5">
      <h2 className="inline-flex items-center gap-2 text-lg font-semibold text-[var(--ff-ink-900)]">
        {icon}
        {title}
      </h2>
      {children}
    </section>
  )
}

function Toggle({ checked, label, onChange }: { checked: boolean; label: string; onChange: (value: boolean) => void }) {
  return (
    <label className="flex items-center justify-between gap-3 rounded-xl bg-[var(--ff-surface-muted)] px-4 py-3 text-sm font-medium">
      {label}
      <input className="h-5 w-5 accent-[var(--ff-brand)]" checked={checked} type="checkbox" onChange={(event) => onChange(event.target.checked)} />
    </label>
  )
}

function Range({ label, max, min, onChange, value }: { label: string; max: number; min: number; onChange: (value: number) => void; value: number }) {
  return (
    <label className="block rounded-xl bg-[var(--ff-surface-muted)] px-4 py-3">
      <span className="flex justify-between text-sm font-medium">
        <span>{label}</span>
        <span>{value}</span>
      </span>
      <input className="mt-3 w-full accent-[var(--ff-brand)]" max={max} min={min} type="range" value={value} onChange={(event) => onChange(Number(event.target.value))} />
    </label>
  )
}

function Segmented({ onChange, options, value }: { onChange: (value: string) => void; options: Array<[string, string]>; value: string }) {
  return (
    <div className="inline-flex w-fit max-w-full flex-wrap gap-1 rounded-xl bg-[var(--ff-surface-muted)] p-1">
      {options.map(([optionValue, label]) => (
        <button
          className={cn("rounded-lg px-3 py-2 text-sm font-semibold", value === optionValue ? "bg-[var(--ff-brand-soft)] text-[var(--ff-brand-text)]" : "text-[var(--ff-muted)]")}
          key={optionValue}
          type="button"
          onClick={() => onChange(optionValue)}
        >
          {label}
        </button>
      ))}
    </div>
  )
}
